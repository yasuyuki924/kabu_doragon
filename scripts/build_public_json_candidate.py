#!/usr/bin/env python3
"""Build production-candidate lightweight ticker JSON from warehouse Parquet."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import pandas as pd


DEFAULT_INPUT = Path("data/warehouse_test/prices_by_year")
DEFAULT_OUTPUT = Path("data/public_json/ticker_recent/1y/ohlcv_ma")
DEFAULT_FALLBACK_CSV = Path("data/ohlcv_raw")
MA_WINDOWS = (5, 25, 75, 200)
OUTPUT_COLUMNS = ("date", "open", "high", "low", "close", "volume", "ma5", "ma25", "ma75", "ma200")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--fallback-csv-dir", type=Path, default=DEFAULT_FALLBACK_CSV)
    parser.add_argument("--years", type=int, default=1)
    return parser.parse_args()


def format_number(value):
    if pd.isna(value):
        return None
    numeric = float(value)
    if numeric.is_integer():
        return int(numeric)
    return round(numeric, 4)


def read_prices(input_dir: Path) -> pd.DataFrame:
    parquet_files = sorted(input_dir.glob("year=*/prices.parquet"))
    if not parquet_files:
        raise FileNotFoundError(f"Parquet files not found: {input_dir}/year=*/prices.parquet")

    frames = [pd.read_parquet(path) for path in parquet_files]
    prices = pd.concat(frames, ignore_index=True)
    prices = prices[["code", "date", "open", "high", "low", "close", "volume"]].copy()
    prices["code"] = prices["code"].astype("string")
    prices["date"] = pd.to_datetime(prices["date"])
    prices = prices.sort_values(["code", "date"]).reset_index(drop=True)
    return prices


def read_fallback_csv_prices(fallback_dir: Path) -> pd.DataFrame:
    if not fallback_dir.exists():
        return pd.DataFrame(columns=["code", "date", "open", "high", "low", "close", "volume"])
    frames = []
    for path in sorted(fallback_dir.glob("*.csv")):
        code = path.stem
        try:
            frame = pd.read_csv(path)
        except Exception:
            continue
        if frame.empty or not set(["date", "open", "high", "low", "close", "volume"]).issubset(frame.columns):
            continue
        frame = frame[["date", "open", "high", "low", "close", "volume"]].copy()
        frame.insert(0, "code", code)
        frames.append(frame)
    if not frames:
        return pd.DataFrame(columns=["code", "date", "open", "high", "low", "close", "volume"])
    prices = pd.concat(frames, ignore_index=True)
    prices["code"] = prices["code"].astype("string")
    prices["date"] = pd.to_datetime(prices["date"], errors="coerce")
    prices = prices.dropna(subset=["date"]).sort_values(["code", "date"]).reset_index(drop=True)
    return prices


def add_moving_averages(prices: pd.DataFrame) -> pd.DataFrame:
    enriched = prices.copy()
    grouped = enriched.groupby("code", sort=False)["close"]
    for window in MA_WINDOWS:
        enriched[f"ma{window}"] = grouped.transform(lambda series: series.rolling(window, min_periods=1).mean())
    return enriched


def prepare_output_dir(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for path in output_dir.glob("*.json"):
        path.unlink()


def write_ticker_json(enriched: pd.DataFrame, output_dir: Path, years: float) -> dict:
    latest_date = enriched["date"].max()
    cutoff_date = latest_date - pd.DateOffset(years=years)
    recent = enriched[enriched["date"] >= cutoff_date].copy()
    recent["date"] = recent["date"].dt.strftime("%Y-%m-%d")
    prepare_output_dir(output_dir)

    total_records = 0
    per_code = {}
    started = time.perf_counter()
    for code, group in recent.groupby("code", sort=True):
        rows = []
        for row in group[list(OUTPUT_COLUMNS)].itertuples(index=False, name=None):
            item = dict(zip(OUTPUT_COLUMNS, row))
            rows.append(
                {
                    "date": item["date"],
                    "open": format_number(item["open"]),
                    "high": format_number(item["high"]),
                    "low": format_number(item["low"]),
                    "close": format_number(item["close"]),
                    "volume": int(item["volume"]) if not pd.isna(item["volume"]) else None,
                    "ma5": format_number(item["ma5"]),
                    "ma25": format_number(item["ma25"]),
                    "ma75": format_number(item["ma75"]),
                    "ma200": format_number(item["ma200"]),
                }
            )
        payload = {"ohlcv": rows}
        path = output_dir / f"{code}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        total_records += len(rows)
        per_code[str(code)] = {
            "records": len(rows),
            "startDate": rows[0]["date"] if rows else None,
            "endDate": rows[-1]["date"] if rows else None,
            "bytes": path.stat().st_size,
        }

    return {
        "writeSeconds": time.perf_counter() - started,
        "latestDate": latest_date.strftime("%Y-%m-%d"),
        "cutoffDate": cutoff_date.strftime("%Y-%m-%d"),
        "outputStartDate": recent["date"].min() if not recent.empty else None,
        "outputEndDate": recent["date"].max() if not recent.empty else None,
        "codeCount": len(per_code),
        "recordCount": total_records,
        "perCode": per_code,
    }


def directory_size(path: Path) -> int:
    return sum(child.stat().st_size for child in path.rglob("*") if child.is_file())


def main() -> int:
    args = parse_args()
    overall_started = time.perf_counter()

    read_started = time.perf_counter()
    prices = read_prices(args.input_dir)
    input_code_count = int(prices["code"].nunique())
    fallback_prices = read_fallback_csv_prices(args.fallback_csv_dir)
    if not fallback_prices.empty:
        prices = (
            pd.concat([prices, fallback_prices], ignore_index=True)
            .drop_duplicates(subset=["code", "date"], keep="last")
            .sort_values(["code", "date"])
            .reset_index(drop=True)
        )
    read_seconds = time.perf_counter() - read_started

    ma_started = time.perf_counter()
    enriched = add_moving_averages(prices)
    ma_seconds = time.perf_counter() - ma_started

    write_metrics = write_ticker_json(enriched, args.output_dir, args.years)
    total_seconds = time.perf_counter() - overall_started

    metrics = {
        "inputDir": str(args.input_dir),
        "fallbackCsvDir": str(args.fallback_csv_dir),
        "outputDir": str(args.output_dir),
        "format": "ticker_recent_1y_ohlcv_ma",
        "keys": list(OUTPUT_COLUMNS),
        "excluded": ["RCI", "RSI", "strategy", "reasons", "metadata", "links"],
        "inputRows": int(len(prices)),
        "inputCodeCount": input_code_count,
        "fallbackCodeCount": int(fallback_prices["code"].nunique()) if not fallback_prices.empty else 0,
        "combinedCodeCount": int(prices["code"].nunique()),
        "inputStartDate": prices["date"].min().strftime("%Y-%m-%d"),
        "inputEndDate": prices["date"].max().strftime("%Y-%m-%d"),
        "outputCodeCount": write_metrics["codeCount"],
        "outputRecordCount": write_metrics["recordCount"],
        "outputStartDate": write_metrics["outputStartDate"],
        "outputEndDate": write_metrics["outputEndDate"],
        "outputBytes": directory_size(args.output_dir),
        "timings": {
            "totalSeconds": total_seconds,
            "parquetReadSeconds": read_seconds,
            "maComputeSeconds": ma_seconds,
            "jsonWriteSeconds": write_metrics["writeSeconds"],
        },
        "representativeCodes": {
            code: write_metrics["perCode"].get(code)
            for code in ("6327", "8309", "4883", "3133", "7203", "7162", "4772", "7236", "5250")
        },
    }

    metrics_path = args.output_dir.parent / "ohlcv_ma_metrics.json"
    metrics_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
