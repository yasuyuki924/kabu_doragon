#!/usr/bin/env python3
"""Build trial adjusted OHLCV CSVs from raw rows and corporate action events."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from fractions import Fraction
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW_DIR = ROOT / "data" / "ohlcv_raw"
DEFAULT_ACTIONS_DIR = ROOT / "data" / "corporate_actions"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "ohlcv_adjusted"
DEFAULT_CODES = ("8392", "8050")
PRICE_FIELDS = ("open", "high", "low", "close")
OHLCV_FIELDS = ("date", "open", "high", "low", "close", "volume")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codes", default=",".join(DEFAULT_CODES), help="Comma separated ticker codes.")
    parser.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR)
    parser.add_argument("--actions-dir", type=Path, default=DEFAULT_ACTIONS_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--event",
        action="append",
        default=[],
        metavar="CODE:DATE:FACTOR",
        help="Trial-only corporate action event, for example 8392:2026-03-23:5.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write CSV files. Without this flag the script only reports the trial build.",
    )
    return parser.parse_args()


def parse_codes(raw: str) -> list[str]:
    return sorted({item.strip() for item in raw.split(",") if item.strip()})


def format_number(value: float) -> str:
    rounded = round(value, 4)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.4f}".rstrip("0").rstrip(".")


def read_raw_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"raw OHLCV not found: {path}")
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if not row.get("date"):
                continue
            normalized = {"date": str(row["date"]).strip()}
            for field in PRICE_FIELDS:
                normalized[field] = float(row[field])
            normalized["volume"] = int(float(row["volume"]))
            rows.append(normalized)
    return sorted(rows, key=lambda item: item["date"])


def normalize_event(code: str, raw_event: dict[str, Any]) -> dict[str, Any] | None:
    effective_date = str(raw_event.get("effectiveDate") or "").strip()
    factor = float(raw_event.get("factor") or 0)
    if not effective_date or factor <= 0:
        return None
    pre_shares = float(raw_event.get("preShares") or 1)
    post_shares = float(raw_event.get("postShares") or factor)
    return {
        "code": str(raw_event.get("code") or code),
        "effectiveDate": effective_date,
        "type": str(raw_event.get("type") or ("split" if factor > 1 else "reverse_split")),
        "preShares": pre_shares,
        "postShares": post_shares,
        "factor": factor,
        "adjFactor": float(raw_event.get("adjFactor") or round(1 / factor, 10)),
        "source": str(raw_event.get("source") or "corporate_actions"),
    }


def read_action_events(path: Path, code: str) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    items = payload.get("events") if isinstance(payload, dict) else []
    events = [normalize_event(code, item) for item in items if isinstance(item, dict)]
    return sorted([item for item in events if item], key=lambda item: item["effectiveDate"])


def parse_inline_event(raw: str) -> dict[str, Any]:
    parts = [part.strip() for part in raw.split(":")]
    if len(parts) != 3:
        raise ValueError(f"invalid --event {raw!r}; expected CODE:DATE:FACTOR")
    code, effective_date, factor_text = parts
    datetime.strptime(effective_date, "%Y-%m-%d")
    factor = float(factor_text)
    if factor <= 0:
        raise ValueError(f"invalid event factor: {factor_text}")
    shares = Fraction(str(factor)).limit_denominator(1000)
    return {
        "code": code,
        "effectiveDate": effective_date,
        "type": "split" if factor > 1 else "reverse_split",
        "preShares": float(shares.denominator),
        "postShares": float(shares.numerator),
        "factor": factor,
        "adjFactor": round(1 / factor, 10),
        "source": "inline_trial_event",
    }


def merged_events(file_events: list[dict[str, Any]], inline_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_date = {event["effectiveDate"]: event for event in file_events}
    for event in inline_events:
        by_date[event["effectiveDate"]] = event
    return [by_date[key] for key in sorted(by_date)]


def adjustment_factors(rows: list[dict[str, Any]], events: list[dict[str, Any]]) -> dict[str, float]:
    event_factors: dict[str, float] = {}
    for event in events:
        effective_date = event["effectiveDate"]
        event_factors[effective_date] = event_factors.get(effective_date, 1.0) * float(event["factor"])
    cumulative = 1.0
    factors: dict[str, float] = {}
    for row in reversed(rows):
        row_date = str(row["date"])
        factors[row_date] = cumulative
        cumulative *= event_factors.get(row_date, 1.0)
    return factors


def adjust_rows(rows: list[dict[str, Any]], events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    factors = adjustment_factors(rows, events)
    adjusted: list[dict[str, Any]] = []
    for row in rows:
        factor = factors.get(str(row["date"]), 1.0)
        if factor <= 0:
            raise ValueError(f"invalid cumulative factor on {row['date']}: {factor}")
        item = {"date": str(row["date"])}
        for field in PRICE_FIELDS:
            item[field] = round(float(row[field]) / factor, 4)
        item["volume"] = int(round(float(row["volume"]) * factor))
        if item["high"] < max(item["open"], item["close"]) or item["low"] > min(item["open"], item["close"]):
            raise ValueError(f"inconsistent adjusted OHLC on {item['date']}")
        adjusted.append(item)
    return adjusted


def write_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=OHLCV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "date": row["date"],
                    "open": format_number(float(row["open"])),
                    "high": format_number(float(row["high"])),
                    "low": format_number(float(row["low"])),
                    "close": format_number(float(row["close"])),
                    "volume": int(row["volume"]),
                }
            )


def summarize(code: str, rows: list[dict[str, Any]], events: list[dict[str, Any]], output_path: Path) -> dict[str, Any]:
    return {
        "code": code,
        "rows": len(rows),
        "startDate": rows[0]["date"] if rows else None,
        "endDate": rows[-1]["date"] if rows else None,
        "events": events,
        "output": str(output_path.relative_to(ROOT)),
    }


def main() -> int:
    args = parse_args()
    codes = parse_codes(args.codes)
    inline_by_code: dict[str, list[dict[str, Any]]] = {}
    for raw_event in args.event:
        event = parse_inline_event(raw_event)
        inline_by_code.setdefault(event["code"], []).append(event)

    metrics: dict[str, Any] = {
        "mode": "write" if args.write else "dry-run",
        "rawDir": str(args.raw_dir),
        "actionsDir": str(args.actions_dir),
        "outputDir": str(args.output_dir),
        "codes": [],
        "skipped": [],
    }
    for code in codes:
        raw_path = args.raw_dir / f"{code}.csv"
        action_path = args.actions_dir / f"{code}.json"
        output_path = args.output_dir / f"{code}.csv"
        rows = read_raw_rows(raw_path)
        events = merged_events(read_action_events(action_path, code), inline_by_code.get(code, []))
        if not events:
            metrics["skipped"].append({"code": code, "reason": "no corporate action events"})
            continue
        adjusted = adjust_rows(rows, events)
        if args.write:
            write_rows(output_path, adjusted)
        metrics["codes"].append(summarize(code, adjusted, events, output_path))

    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
