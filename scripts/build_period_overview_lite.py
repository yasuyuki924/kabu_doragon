#!/usr/bin/env python3
"""Build weekly/monthly overview files for period-end dates only.

This intentionally writes a lean record shape for missing historical files so
old weekly/monthly ranking pages stay small. Existing overview files are left
untouched unless --overwrite is supplied.
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
import tempfile
from collections import OrderedDict, deque
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.jquants_provider import default_paths  # noqa: E402

PUBLIC_JSON = ROOT / "data" / "public_json"
OVERVIEW_LITE_DIR = PUBLIC_JSON / "overview_lite"
TICKER_META_DIR = PUBLIC_JSON / "ticker_meta"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-date", default="", help="Inclusive YYYY-MM-DD lower bound. Defaults to earliest OHLCV date.")
    parser.add_argument("--end-date", default="", help="Inclusive YYYY-MM-DD upper bound. Defaults to latest OHLCV date.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing weekly/monthly overview files.")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_compact_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def read_ohlcv_csv(path: Path) -> list[dict[str, float | int | str]]:
    if not path.exists():
        return []
    rows: list[dict[str, float | int | str]] = []
    with path.open("r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if not row.get("date"):
                continue
            rows.append(
                {
                    "date": str(row["date"]),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": int(float(row["volume"])),
                }
            )
    rows.sort(key=lambda item: str(item["date"]))
    return rows


def ticker_meta(code: str) -> dict[str, Any]:
    meta = read_json(TICKER_META_DIR / f"{code}.json", {})
    return meta if isinstance(meta, dict) else {}


def period_end_dates(all_dates: set[str], start_date: str, end_date: str) -> tuple[set[str], set[str]]:
    weekly: dict[tuple[int, int], str] = {}
    monthly: dict[str, str] = {}
    for value in sorted(all_dates):
        if start_date and value < start_date:
            continue
        if end_date and value > end_date:
            continue
        date_value = datetime.strptime(value, "%Y-%m-%d").date()
        weekly[date_value.isocalendar()[:2]] = value
        monthly[value[:7]] = value
    return set(weekly.values()), set(monthly.values())


def existing_dates(filename: str) -> list[str]:
    if not OVERVIEW_LITE_DIR.exists():
        return []
    return sorted(path.name for path in OVERVIEW_LITE_DIR.iterdir() if path.is_dir() and (path / filename).exists())


class JsonlWriterCache:
    def __init__(self, root: Path, max_open: int = 48) -> None:
        self.root = root
        self.max_open = max_open
        self.handles: OrderedDict[Path, Any] = OrderedDict()

    def write(self, timeframe: str, date_value: str, record: dict[str, Any]) -> None:
        path = self.root / timeframe / f"{date_value}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        handle = self.handles.get(path)
        if handle is None:
            if len(self.handles) >= self.max_open:
                _, oldest = self.handles.popitem(last=False)
                oldest.close()
            handle = path.open("a", encoding="utf-8")
            self.handles[path] = handle
        else:
            self.handles.move_to_end(path)
        handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

    def close(self) -> None:
        for handle in self.handles.values():
            handle.close()
        self.handles.clear()


class RollingAverage:
    def __init__(self, window: int) -> None:
        self.window = window
        self.values: deque[float] = deque()
        self.total = 0.0

    def push(self, value: float) -> float | None:
        self.values.append(value)
        self.total += value
        if len(self.values) > self.window:
            self.total -= self.values.popleft()
        if len(self.values) < self.window:
            return None
        return self.total / self.window


def distance_to_ma(close: float, ma: float | None) -> float | None:
    return round((close - ma) / ma * 100, 4) if ma else None


def base_record(meta: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": meta["code"],
        "name": meta["name"],
        "market": meta["market"],
        "sector": meta.get("sector", ""),
        "industry": meta.get("industry", ""),
        "themes": meta.get("themes", []),
        "tags": meta.get("tags", []),
        "links": meta.get("links", {}),
        **row,
        "strategyMatches": [],
        "strategyScores": {},
        "strategyReasons": {},
        "strategyExcludedReasons": {},
    }


def iter_period_records(
    rows: list[dict[str, float | int | str]],
    weekly_targets: set[str],
    monthly_targets: set[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    ma25 = RollingAverage(25)
    ma75 = RollingAverage(75)
    ma200 = RollingAverage(200)
    vol25 = RollingAverage(25)
    current_week = None
    current_month = None
    week_open = week_high = week_low = week_volume = 0.0
    month_open = month_high = month_low = month_volume = 0.0
    week_days = 0
    month_days = 0
    weekly_records: list[dict[str, Any]] = []
    monthly_records: list[dict[str, Any]] = []

    for row in rows:
        date_value = str(row["date"])
        date_obj = datetime.strptime(date_value, "%Y-%m-%d").date()
        week_key = date_obj.isocalendar()[:2]
        month_key = date_value[:7]
        open_value = float(row["open"])
        high = float(row["high"])
        low = float(row["low"])
        close = float(row["close"])
        volume = int(float(row["volume"]))
        close_ma25 = ma25.push(close)
        close_ma75 = ma75.push(close)
        close_ma200 = ma200.push(close)
        volume_ma25 = vol25.push(float(volume))

        if current_week != week_key:
            current_week = week_key
            week_open = open_value
            week_high = high
            week_low = low
            week_volume = volume
            week_days = 1
        else:
            week_high = max(week_high, high)
            week_low = min(week_low, low)
            week_volume += volume
            week_days += 1

        if current_month != month_key:
            current_month = month_key
            month_open = open_value
            month_high = high
            month_low = low
            month_volume = volume
            month_days = 1
        else:
            month_high = max(month_high, high)
            month_low = min(month_low, low)
            month_volume += volume
            month_days += 1

        common = {
            "date": date_value,
            "close": close,
            "ma25": round(close_ma25, 4) if close_ma25 is not None else None,
            "ma75": round(close_ma75, 4) if close_ma75 is not None else None,
            "ma200": round(close_ma200, 4) if close_ma200 is not None else None,
            "volumeMa25": round(volume_ma25, 4) if volume_ma25 is not None else None,
            "distanceToMa25": distance_to_ma(close, close_ma25),
            "distanceToMa75": distance_to_ma(close, close_ma75),
            "distanceToMa200": distance_to_ma(close, close_ma200),
        }
        if date_value in weekly_targets:
            change = close - week_open if week_open else None
            volume_base = float(volume_ma25 or 0) * week_days
            weekly_records.append(
                {
                    **common,
                    "open": week_open,
                    "high": week_high,
                    "low": week_low,
                    "volume": int(week_volume),
                    "turnover": close * week_volume,
                    "change": round(change, 4) if change is not None else None,
                    "changePercent": round(change / week_open * 100, 4) if change is not None and week_open else None,
                    "volumeRatio25": round(week_volume / volume_base, 4) if volume_base else None,
                }
            )
        if date_value in monthly_targets:
            change = close - month_open if month_open else None
            volume_base = float(volume_ma25 or 0) * month_days
            monthly_records.append(
                {
                    **common,
                    "open": month_open,
                    "high": month_high,
                    "low": month_low,
                    "volume": int(month_volume),
                    "turnover": close * month_volume,
                    "change": round(change, 4) if change is not None else None,
                    "changePercent": round(change / month_open * 100, 4) if change is not None and month_open else None,
                    "volumeRatio25": round(month_volume / volume_base, 4) if volume_base else None,
                }
            )
    return weekly_records, monthly_records


def build_overview_payload(records: list[dict[str, Any]], *, date_value: str, timeframe: str, generated_at: str) -> dict[str, Any]:
    sorted_records = sorted(records, key=lambda item: str(item.get("code") or ""))
    rise_count = sum(1 for item in sorted_records if float(item.get("changePercent") or 0) > 0)
    fall_count = sum(1 for item in sorted_records if float(item.get("changePercent") or 0) < 0)
    average_change = (
        sum(float(item.get("changePercent") or 0) for item in sorted_records) / len(sorted_records)
        if sorted_records
        else None
    )
    return {
        "date": date_value,
        "generatedAt": generated_at,
        "schema": "period-ranking-lite",
        "source": "build_period_overview_lite",
        "timeframe": timeframe,
        "periodEndOnly": True,
        "changeBasis": "period_open_to_close",
        "turnoverBasis": "period_total",
        "recordCount": len(sorted_records),
        "riseCount": rise_count,
        "fallCount": fall_count,
        "flatCount": len(sorted_records) - rise_count - fall_count,
        "averageChangePercent": round(average_change, 4) if average_change is not None else None,
        "records": sorted_records,
    }


def existing_target_dates(filename: str, target_dates: set[str]) -> list[str]:
    existing = set(existing_dates(filename))
    return sorted(existing & target_dates)


def write_index(generated_at: str, weekly_target_dates: set[str], monthly_target_dates: set[str]) -> None:
    write_compact_json(
        OVERVIEW_LITE_DIR / "index.json",
        {
            "generatedAt": generated_at,
            "daily": existing_dates("market_pulse.json"),
            "weekly": existing_target_dates("market_pulse_weekly.json", weekly_target_dates),
            "monthly": existing_target_dates("market_pulse_monthly.json", monthly_target_dates),
        },
    )


def main() -> int:
    args = parse_args()
    paths = default_paths()
    codes = sorted(path.stem for path in paths.ohlcv_dir.glob("*.csv"))
    all_dates: set[str] = set()
    for code in codes:
        with (paths.ohlcv_dir / f"{code}.csv").open("r", encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                if row.get("date"):
                    all_dates.add(str(row["date"]))

    weekly_target_dates, monthly_target_dates = period_end_dates(all_dates, args.start_date, args.end_date)
    latest_date = max(all_dates) if all_dates else ""
    if latest_date:
        weekly_target_dates.add(latest_date)
        monthly_target_dates.add(latest_date)
    weekly_dates = set(weekly_target_dates)
    monthly_dates = set(monthly_target_dates)
    if not args.overwrite:
        weekly_dates -= set(existing_dates("market_pulse_weekly.json"))
        monthly_dates -= set(existing_dates("market_pulse_monthly.json"))
    print(f"codes={len(codes)} weekly_to_write={len(weekly_dates)} monthly_to_write={len(monthly_dates)}")
    print(f"weekly range={min(weekly_dates) if weekly_dates else ''}..{max(weekly_dates) if weekly_dates else ''}")
    print(f"monthly range={min(monthly_dates) if monthly_dates else ''}..{max(monthly_dates) if monthly_dates else ''}")
    if args.dry_run:
        return 0

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    if not weekly_dates and not monthly_dates:
        write_index(generated_at, weekly_target_dates, monthly_target_dates)
        print(f"wrote {OVERVIEW_LITE_DIR / 'index.json'}")
        return 0

    tmp_parent = ROOT / "tmp" if (ROOT / "tmp").exists() else ROOT
    with tempfile.TemporaryDirectory(prefix="period_overview_", dir=str(tmp_parent)) as tmp_name:
        tmp_root = Path(tmp_name)
        writer = JsonlWriterCache(tmp_root)
        try:
            for index, code in enumerate(codes, start=1):
                meta = ticker_meta(code)
                rows = read_ohlcv_csv(paths.ohlcv_dir / f"{code}.csv")
                if not meta or not rows:
                    continue
                weekly_records, monthly_records = iter_period_records(rows, weekly_dates, monthly_dates)
                for record in weekly_records:
                    writer.write("weekly", str(record["date"]), base_record(meta, record))
                for record in monthly_records:
                    writer.write("monthly", str(record["date"]), base_record(meta, record))
                if index % 250 == 0:
                    print(f"processed={index}/{len(codes)}", flush=True)
        finally:
            writer.close()

        for timeframe, dates, filename in (
            ("weekly", sorted(weekly_dates), "market_pulse_weekly.json"),
            ("monthly", sorted(monthly_dates), "market_pulse_monthly.json"),
        ):
            written = 0
            for date_value in dates:
                jsonl_path = tmp_root / timeframe / f"{date_value}.jsonl"
                if not jsonl_path.exists():
                    continue
                records = [json.loads(line) for line in jsonl_path.read_text(encoding="utf-8").splitlines() if line.strip()]
                write_compact_json(
                    OVERVIEW_LITE_DIR / date_value / filename,
                    build_overview_payload(records, date_value=date_value, timeframe=timeframe, generated_at=generated_at),
                )
                written += 1
            print(f"wrote {timeframe}={written}", flush=True)

    write_index(generated_at, weekly_target_dates, monthly_target_dates)
    print(f"wrote {OVERVIEW_LITE_DIR / 'index.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
