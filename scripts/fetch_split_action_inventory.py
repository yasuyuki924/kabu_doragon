#!/usr/bin/env python3
"""Fetch official action metadata into a new isolated directory, never price files."""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from requests.exceptions import HTTPError, RetryError

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.check_split_adjustment import active_codes, event_digest, load_events, validate_rows
from src.jquants_provider import (
    build_client, coerce_float, frame_to_corporate_action_events, load_auth_config,
    merge_corporate_action_events, read_ohlcv_rows, write_corporate_action_events,
    normalize_repo_code,
)


def fetch_inventory(client, data_dir: Path, output: Path, codes: list[str], *,
                    receipt_dir: Path | None = None, min_interval: float = 0) -> dict:
    data_dir, output = data_dir.resolve(), output.resolve()
    if output.exists() or output.is_relative_to(data_dir) or data_dir.is_relative_to(output):
        raise ValueError("inventory output must be new and separate from source data")
    if receipt_dir is not None:
        receipt_dir = receipt_dir.resolve()
        if (receipt_dir.is_relative_to(data_dir) or data_dir.is_relative_to(receipt_dir) or
                receipt_dir.is_relative_to(output) or output.is_relative_to(receipt_dir)):
            raise ValueError("receipts must be separate from source data and completed inventory")
    coverage = {}
    needed_dates = {}
    trading_dates = set()
    for code in codes:
        rows = read_ohlcv_rows(data_dir / "ohlcv_raw" / f"{code}.csv")
        validate_rows(code, rows)
        coverage[code] = {"fromDate": rows[0]["date"], "toDate": rows[-1]["date"]}
        needed_dates[code] = {row["date"] for row in rows}
        trading_dates.update(row["date"] for row in rows)
    detected = {code: [] for code in codes}
    last_request = 0.0
    for index, day in enumerate(sorted(trading_dates), 1):
        receipt_path = receipt_dir / f"{day}.json" if receipt_dir is not None else None
        cached = receipt_path is not None and receipt_path.exists()
        if cached:
            receipt = json.loads(receipt_path.read_text())
            if receipt.get("source") != "jquants-v2" or receipt.get("date") != day:
                raise ValueError(f"invalid official receipt for {day}")
            frame = pd.DataFrame(receipt["records"])
        else:
            for attempt in range(5):
                time.sleep(max(0, min_interval - (time.monotonic() - last_request)))
                last_request = time.monotonic()
                try:
                    frame = client.get_eq_bars_daily(date_yyyymmdd=date.fromisoformat(day).strftime("%Y%m%d"))
                    break
                except (HTTPError, RetryError) as exc:
                    if "429" not in str(exc) or attempt == 4:
                        raise
                    delay = 60 * (attempt + 1)
                    print(f"action metadata rate limit date={day}; wait={delay}s", flush=True)
                    time.sleep(delay)
        if frame.empty or not {"Code", "Date", "AdjFactor"}.issubset(frame.columns):
            raise ValueError(f"official action fields unavailable for {day}")
        factors = {
            normalize_repo_code(record["Code"]): coerce_float(record["AdjFactor"])
            for record in frame.to_dict("records")
            if str(record["Date"])[:10] == day
        }
        for code in codes:
            if day in needed_dates[code] and (
                factors.get(code) is None or not math.isfinite(factors[code]) or factors[code] <= 0
            ):
                raise ValueError(f"official action coverage missing for {code} at {day}")
        events = frame_to_corporate_action_events(frame, "v2")
        if receipt_path is not None and not cached:
            records = [{"Code": str(record["Code"]), "Date": str(record["Date"])[:10],
                        "AdjFactor": coerce_float(record["AdjFactor"])}
                       for record in frame.to_dict("records")]
            receipt_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = receipt_path.with_suffix(".json.tmp")
            temporary.write_text(json.dumps({"source": "jquants-v2", "date": day, "records": records},
                                            allow_nan=False), encoding="utf-8")
            temporary.replace(receipt_path)
        for code in codes:
            detected[code] = merge_corporate_action_events(detected[code], events.get(code, []))
        print(f"action metadata {index}/{len(trading_dates)} date={day} cached={cached}", flush=True)
    output.mkdir(parents=True)
    digests = {}
    for code in codes:
        path = output / "corporate_actions" / f"{code}.json"
        write_corporate_action_events(path, code=code, events=detected[code])
        digests[code] = event_digest(load_events(path))
    inventory = {
        "source": "jquants-v2", "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "coverage": coverage, "actionDigests": digests, "tradingDateCount": len(trading_dates),
    }
    (output / "action_inventory.json").write_text(json.dumps(inventory, indent=2), encoding="utf-8")
    return inventory


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--auth-root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--codes")
    parser.add_argument("--fetch", action="store_true", help="Explicit authorization to call J-Quants; default is plan only")
    parser.add_argument("--receipt-dir", type=Path, help="Isolated resumable official metadata receipts; never raw price data")
    parser.add_argument("--min-interval", type=float, default=1.1, help="Minimum seconds between official requests")
    args = parser.parse_args()
    codes = sorted(set(value.strip().upper() for value in args.codes.split(",") if value.strip())) if args.codes else active_codes(args.data_dir)
    if not codes:
        parser.error("no codes")
    if not args.fetch:
        print(json.dumps({"mode": "plan", "codeCount": len(codes), "output": str(args.output_dir),
                          "writesPriceFiles": False, "range": "retained raw history"}))
        return 0
    try:
        client, api_version = build_client(load_auth_config(args.auth_root))
        if api_version != "v2":
            raise ValueError("official AdjFactor inventory requires J-Quants v2")
        inventory = fetch_inventory(client, args.data_dir, args.output_dir, codes,
                                    receipt_dir=args.receipt_dir, min_interval=max(0, args.min_interval))
        print(json.dumps({"status": "OK", "codeCount": len(codes),
                          "tradingDateCount": inventory["tradingDateCount"]}))
        return 0
    except Exception as exc:
        print(f"[BLOCKED] {type(exc).__name__}: action inventory fetch did not complete", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
