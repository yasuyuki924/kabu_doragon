#!/usr/bin/env python3
"""Build trial ticker_recent JSON from adjusted OHLCV CSV files."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = ROOT / "data" / "ohlcv_adjusted"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "public_json" / "ticker_recent_adjusted" / "1y" / "ohlcv_ma"
DEFAULT_CODES = ("8392", "8050")
PRICE_FIELDS = ("open", "high", "low", "close")
MA_WINDOWS = (5, 25, 75, 200)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codes", default=",".join(DEFAULT_CODES), help="Comma separated ticker codes.")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--years", type=int, default=1, help="Recent calendar years to keep.")
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write JSON files. Without this flag the script only reports the trial build.",
    )
    return parser.parse_args()


def parse_codes(raw: str) -> list[str]:
    return sorted({item.strip() for item in raw.split(",") if item.strip()})


def read_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"adjusted OHLCV not found: {path}")
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if not row.get("date"):
                continue
            item = {"date": str(row["date"]).strip()}
            for field in PRICE_FIELDS:
                item[field] = float(row[field])
            item["volume"] = int(float(row["volume"]))
            rows.append(item)
    return sorted(rows, key=lambda item: item["date"])


def moving_average(values: list[float], index: int, window: int) -> float:
    subset = values[max(0, index - window + 1) : index + 1]
    return sum(subset) / len(subset)


def format_number(value: float) -> float | int:
    rounded = round(float(value), 4)
    return int(rounded) if rounded.is_integer() else rounded


def enrich_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    closes = [float(row["close"]) for row in rows]
    enriched: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        item = {
            "date": row["date"],
            "open": format_number(row["open"]),
            "high": format_number(row["high"]),
            "low": format_number(row["low"]),
            "close": format_number(row["close"]),
            "volume": int(row["volume"]),
        }
        for window in MA_WINDOWS:
            item[f"ma{window}"] = format_number(moving_average(closes, index, window))
        enriched.append(item)
    return enriched


def recent_cutoff(rows: list[dict[str, Any]], years: int) -> str:
    latest = datetime.strptime(str(rows[-1]["date"]), "%Y-%m-%d")
    try:
        cutoff = latest.replace(year=latest.year - years)
    except ValueError:
        cutoff = latest.replace(month=2, day=28, year=latest.year - years)
    return cutoff.strftime("%Y-%m-%d")


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"ohlcv": rows}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def main() -> int:
    args = parse_args()
    metrics: dict[str, Any] = {
        "mode": "write" if args.write else "dry-run",
        "inputDir": str(args.input_dir),
        "outputDir": str(args.output_dir),
        "codes": [],
    }
    for code in parse_codes(args.codes):
        input_path = args.input_dir / f"{code}.csv"
        output_path = args.output_dir / f"{code}.json"
        rows = read_rows(input_path)
        enriched = enrich_rows(rows)
        cutoff = recent_cutoff(enriched, args.years)
        recent = [row for row in enriched if str(row["date"]) >= cutoff]
        if args.write:
            write_json(output_path, recent)
        metrics["codes"].append(
            {
                "code": code,
                "inputRows": len(rows),
                "outputRows": len(recent),
                "startDate": recent[0]["date"] if recent else None,
                "endDate": recent[-1]["date"] if recent else None,
                "output": str(output_path.relative_to(ROOT)),
            }
        )
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
