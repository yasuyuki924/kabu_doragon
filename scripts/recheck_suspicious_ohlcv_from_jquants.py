#!/usr/bin/env python3
"""Recheck split-like ticker_recent anomalies through isolated J-Quants downloads."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

TICKER_RECENT_DIR = ROOT / "data" / "public_json" / "ticker_recent" / "1y" / "ohlcv_ma"
DEFAULT_RECHECK_RAW_DIR = ROOT / "data" / "recheck_ohlcv_raw"
DEFAULT_RECHECK_ADJUSTED_DIR = ROOT / "data" / "recheck_ohlcv_adjusted"
DEFAULT_ACTIONS_DIR = ROOT / "data" / "corporate_actions"
OHLCV_FIELDS = ("date", "open", "high", "low", "close", "volume")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codes", help="Optional comma separated recheck codes. Default is the suspicious cohort.")
    parser.add_argument("--ticker-recent-dir", type=Path, default=TICKER_RECENT_DIR)
    parser.add_argument("--raw-output-dir", type=Path, default=DEFAULT_RECHECK_RAW_DIR)
    parser.add_argument("--adjusted-output-dir", type=Path, default=DEFAULT_RECHECK_ADJUSTED_DIR)
    parser.add_argument("--actions-dir", type=Path, default=DEFAULT_ACTIONS_DIR)
    parser.add_argument("--history-years", type=int, default=5)
    parser.add_argument("--end-date", help="ISO date. Defaults to today.")
    parser.add_argument("--chunk-days", type=int, default=180)
    parser.add_argument("--pause-seconds", type=float, default=2.5, help="Pause between ticker fetches.")
    parser.add_argument("--no-skip-existing", action="store_true", help="Fetch even when recheck CSVs already exist.")
    parser.add_argument("--jump-ratio", type=float, default=1.8)
    parser.add_argument("--ma-distortion", type=float, default=1.35)
    parser.add_argument(
        "--fetch",
        action="store_true",
        help="Call J-Quants. Without this flag the script only prints the target cohort.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write only recheck_ohlcv_raw and recheck_ohlcv_adjusted files. Requires --fetch.",
    )
    return parser.parse_args()


def parse_codes(raw: str | None) -> list[str]:
    if not raw:
        return []
    return sorted({item.strip().upper() for item in raw.split(",") if item.strip()})


def number(value: object) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if numeric == numeric else None


def load_chart_rows(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload if isinstance(payload, list) else payload.get("ohlcv", [])
    return [item for item in rows if isinstance(item, dict)]


def find_suspicious_events(path: Path, jump_ratio: float, ma_distortion: float) -> list[dict[str, Any]]:
    rows = load_chart_rows(path)
    events: list[dict[str, Any]] = []
    for index in range(1, len(rows)):
        previous = rows[index - 1]
        current = rows[index]
        previous_close = number(previous.get("close"))
        current_close = number(current.get("close"))
        if not previous_close or not current_close:
            continue
        close_jump = max(previous_close / current_close, current_close / previous_close)
        ma25 = number(current.get("ma25"))
        ma75 = number(current.get("ma75"))
        ma25_dist = max(ma25 / current_close, current_close / ma25) if ma25 else 1.0
        ma75_dist = max(ma75 / current_close, current_close / ma75) if ma75 else 1.0
        if close_jump < jump_ratio or max(ma25_dist, ma75_dist) < ma_distortion:
            continue
        events.append(
            {
                "fromDate": str(previous.get("date") or ""),
                "toDate": str(current.get("date") or ""),
                "fromClose": previous_close,
                "toClose": current_close,
                "closeJump": round(close_jump, 4),
                "ma25Dist": round(ma25_dist, 4),
                "ma75Dist": round(ma75_dist, 4),
            }
        )
    return events


def detect_suspicious_codes(input_dir: Path, jump_ratio: float, ma_distortion: float) -> list[dict[str, Any]]:
    cohort: list[dict[str, Any]] = []
    for path in sorted(input_dir.glob("*.json")):
        events = find_suspicious_events(path, jump_ratio, ma_distortion)
        if events:
            cohort.append({"code": path.stem, "events": events})
    return cohort


def format_csv_number(value: object) -> str:
    numeric = float(value)
    rounded = round(numeric, 4)
    return str(int(rounded)) if rounded.is_integer() else f"{rounded:.4f}".rstrip("0").rstrip(".")


def write_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=OHLCV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "date": row["date"],
                    "open": format_csv_number(row["open"]),
                    "high": format_csv_number(row["high"]),
                    "low": format_csv_number(row["low"]),
                    "close": format_csv_number(row["close"]),
                    "volume": int(row["volume"]),
                }
            )


def chunk_ranges(start_date: date, end_date: date, chunk_days: int) -> list[tuple[date, date]]:
    ranges: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        chunk_end = min(end_date, cursor + timedelta(days=max(1, chunk_days) - 1))
        ranges.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return ranges


def merge_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_date = {str(row["date"]): row for row in rows}
    return [by_date[key] for key in sorted(by_date)]


def merge_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key = {(str(event.get("code") or ""), str(event.get("effectiveDate") or "")): event for event in events}
    return [by_key[key] for key in sorted(by_key)]


def fetch_code_rows(client: object, api_version: str, code: str, start_date: date, end_date: date, chunk_days: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    from src.jquants_provider import fetch_bars_frame, frame_to_corporate_action_events, frame_to_ohlcv_rows

    raw_rows: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    for chunk_start, chunk_end in chunk_ranges(start_date, end_date, chunk_days):
        frame = fetch_bars_frame(client, api_version, code=code, from_date=chunk_start, to_date=chunk_end)
        raw_rows.extend(frame_to_ohlcv_rows(frame, api_version, adjusted=False).get(code, []))
        events.extend(frame_to_corporate_action_events(frame, api_version).get(code, []))
    return merge_rows(raw_rows), merge_events(events)


def estimate_existing_raw_bytes(codes: list[str]) -> dict[str, Any]:
    sizes = []
    for code in codes:
        path = ROOT / "data" / "ohlcv_raw" / f"{code}.csv"
        if path.exists():
            sizes.append(path.stat().st_size)
    average = int(sum(sizes) / len(sizes)) if sizes else 0
    return {
        "sampleFiles": len(sizes),
        "averageBytes": average,
        "estimatedBytes": average * len(codes),
    }


def main() -> int:
    args = parse_args()
    cohort = detect_suspicious_codes(args.ticker_recent_dir, args.jump_ratio, args.ma_distortion)
    detected_codes = [item["code"] for item in cohort]
    target_codes = parse_codes(args.codes) or detected_codes
    metrics: dict[str, Any] = {
        "mode": "write" if args.write else "fetch" if args.fetch else "dry-run",
        "tickerRecentDir": str(args.ticker_recent_dir),
        "suspiciousCodeCount": len(detected_codes),
        "suspiciousEventCount": sum(len(item["events"]) for item in cohort),
        "targetCodeCount": len(target_codes),
        "targetCodes": target_codes,
        "boundaryPreview": cohort[:12],
        "rawSizeEstimate": estimate_existing_raw_bytes(target_codes),
        "outputs": {
            "raw": str(args.raw_output_dir),
            "adjusted": str(args.adjusted_output_dir),
        },
    }
    if args.write and not args.fetch:
        raise SystemExit("--write requires --fetch")
    if not args.fetch:
        print(json.dumps(metrics, ensure_ascii=False, indent=2))
        return 0

    from src.jquants_provider import apply_corporate_actions, build_client, load_auth_config, read_corporate_action_events

    end_date = datetime.strptime(args.end_date, "%Y-%m-%d").date() if args.end_date else date.today()
    start_date = end_date.replace(year=end_date.year - max(1, args.history_years))
    config = load_auth_config(ROOT)
    client, api_version = build_client(config)
    fetched: list[dict[str, Any]] = []
    for code in target_codes:
        raw_path = args.raw_output_dir / f"{code}.csv"
        adjusted_path = args.adjusted_output_dir / f"{code}.csv"
        if args.write and not args.no_skip_existing and raw_path.exists() and adjusted_path.exists():
            fetched.append(
                {
                    "code": code,
                    "status": "skipped_existing",
                    "rawPath": str(raw_path),
                    "adjustedPath": str(adjusted_path),
                }
            )
            continue
        try:
            raw_rows, fetched_events = fetch_code_rows(client, api_version, code, start_date, end_date, args.chunk_days)
            stored_events = read_corporate_action_events(args.actions_dir / f"{code}.json")
            adjustment_events = fetched_events or stored_events
            adjusted_rows = apply_corporate_actions(raw_rows, adjustment_events, code=code, auto_correct_effective_dates=True)
            if args.write:
                write_rows(raw_path, raw_rows)
                write_rows(adjusted_path, adjusted_rows)
            fetched.append(
                {
                    "code": code,
                    "status": "ok",
                    "rawRows": len(raw_rows),
                    "eventCount": len(adjustment_events),
                    "eventSource": "jquants_adjfactor" if fetched_events else "stored_corporate_actions",
                    "adjustedRows": len(adjusted_rows),
                }
            )
        except Exception as error:
            fetched.append(
                {
                    "code": code,
                    "status": "failed",
                    "errorType": type(error).__name__,
                    "error": str(error),
                }
            )
        if args.pause_seconds > 0:
            time.sleep(args.pause_seconds)
    metrics["range"] = {"startDate": start_date.isoformat(), "endDate": end_date.isoformat()}
    metrics["apiVersion"] = api_version
    metrics["fetched"] = fetched
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
