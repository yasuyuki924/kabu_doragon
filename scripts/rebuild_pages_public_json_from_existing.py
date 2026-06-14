#!/usr/bin/env python3
"""Rebuild Pages public JSON from cached local data without J-Quants access."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.incremental_jquants_update import (  # noqa: E402
    Logger,
    OVERVIEW_LITE_DIR,
    PUBLIC_JSON,
    UPDATE_HEALTH_JSON,
    UPDATE_SUMMARY_JSON,
    build_overview_payload,
    default_paths,
    read_ohlcv_csv,
    rebuild_public_json_from_ohlcv,
    ticker_meta,
    write_compact_json,
    write_json,
)
from src.data_source.local_data import build_daily_record  # noqa: E402
from src.indicators.core import build_enriched_rows  # noqa: E402


MANIFEST_JSON = ROOT / "data" / "manifest.json"
OVERVIEW_LITE_INDEX_JSON = PUBLIC_JSON / "overview_lite" / "index.json"
TICKER_META_DIR = PUBLIC_JSON / "ticker_meta"
LOGS_DIR = ROOT / "logs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recent-days", type=int, default=430)
    parser.add_argument("--target-date", default="")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def valid_date(value: str) -> bool:
    try:
        parse_date(value)
    except ValueError:
        return False
    return True


def discover_codes() -> list[str]:
    codes = sorted(path.stem for path in TICKER_META_DIR.glob("*.json"))
    if codes:
        return codes
    paths = default_paths()
    return sorted(path.stem for path in paths.ohlcv_dir.glob("*.csv"))


def discover_ohlcv_dates(codes: list[str]) -> list[str]:
    paths = default_paths()
    dates: set[str] = set()
    for code in codes:
        for row in read_ohlcv_csv(paths.ohlcv_dir / f"{code}.csv"):
            value = str(row.get("date") or "")
            if valid_date(value):
                dates.add(value)
    return sorted(dates)


def resolve_target_date(codes: list[str], explicit_target: str) -> str:
    candidates: list[str] = []
    if explicit_target:
        candidates.append(explicit_target)
    manifest = read_json(MANIFEST_JSON, {})
    candidates.append(str(manifest.get("latestDate") or ""))
    index = read_json(OVERVIEW_LITE_INDEX_JSON, {})
    daily_dates = [str(item) for item in index.get("daily") or [] if str(item)]
    candidates.extend(reversed(daily_dates))

    paths = default_paths()
    for candidate in candidates:
        if not candidate or not valid_date(candidate):
            continue
        for code in codes[:200]:
            rows = read_ohlcv_csv(paths.ohlcv_dir / f"{code}.csv")
            if any(str(row.get("date") or "") == candidate for row in rows):
                return candidate

    available_dates = discover_ohlcv_dates(codes)
    if not available_dates:
        raise RuntimeError("No cached OHLCV dates were found. Run the J-Quants refresh workflow once.")
    return available_dates[-1]


def resolve_recent_dates(codes: list[str], target_date: str, recent_days: int) -> list[str]:
    target = parse_date(target_date)
    cutoff = target - timedelta(days=recent_days)

    manifest = read_json(MANIFEST_JSON, {})
    index = read_json(OVERVIEW_LITE_INDEX_JSON, {})
    candidates = [
        str(item)
        for item in (manifest.get("availableDates") or index.get("daily") or [])
        if str(item) and valid_date(str(item))
    ]
    if not candidates:
        candidates = discover_ohlcv_dates(codes)
    dates = sorted({item for item in candidates if cutoff <= parse_date(item) <= target})
    if target_date not in dates:
        dates.append(target_date)
    return sorted(set(dates))


def build_recent_daily_overviews(codes: list[str], dates: list[str], logger: Logger) -> dict[str, Any]:
    started = time.perf_counter()
    records_by_date: dict[str, list[dict[str, Any]]] = {value: [] for value in dates}
    date_set = set(dates)
    paths = default_paths()
    for index, code in enumerate(codes, start=1):
        meta = ticker_meta(code)
        rows = read_ohlcv_csv(paths.ohlcv_dir / f"{code}.csv")
        if not meta or not rows:
            continue
        for row in build_enriched_rows(rows):
            value = str(row.get("date") or "")
            if value in date_set:
                records_by_date[value].append(build_daily_record(meta, row))
        if index % 500 == 0:
            logger.log(f"daily_overview_from_cache progress={index}/{len(codes)}")

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    for value, records in records_by_date.items():
        write_compact_json(
            OVERVIEW_LITE_DIR / value / "market_pulse.json",
            build_overview_payload(
                records,
                target_date=value,
                updated_at=generated_at,
                source="rebuild_pages_public_json_from_existing",
                timeframe="daily",
            ),
        )
    return {"dailyFiles": len(records_by_date), "seconds": round(time.perf_counter() - started, 3)}


def write_manifest(target_date: str, dates: list[str]) -> None:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    write_json(
        MANIFEST_JSON,
        {
            "generatedAt": now,
            "latestDate": target_date,
            "availableDates": dates,
            "currentSnapshot": {
                "date": target_date,
                "snapshotType": "daily",
                "generatedAt": now,
            },
        },
    )


def write_overview_index(dates: list[str]) -> dict[str, int]:
    payload: dict[str, Any] = {"generatedAt": datetime.now().astimezone().isoformat(timespec="seconds")}
    counts: dict[str, int] = {}
    for key, filename in (
        ("daily", "market_pulse.json"),
        ("weekly", "market_pulse_weekly.json"),
        ("monthly", "market_pulse_monthly.json"),
    ):
        available = [value for value in dates if (OVERVIEW_LITE_DIR / value / filename).exists()]
        payload[key] = available
        counts[key] = len(available)
    write_compact_json(OVERVIEW_LITE_INDEX_JSON, payload)
    return counts


def write_health(status: str, target_date: str, details: dict[str, Any]) -> None:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    write_json(UPDATE_SUMMARY_JSON, {"generatedAt": now, "date": target_date, "status": status, **details})
    write_json(
        UPDATE_HEALTH_JSON,
        {
            "checkedAt": now,
            "context": "github_pages_existing_data_rebuild",
            "status": status,
            "manifest": {"latestDate": target_date, "generatedAt": now},
            "details": details,
        },
    )


def main() -> int:
    args = parse_args()
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOGS_DIR / f"pages_existing_data_rebuild_{datetime.now().strftime('%Y%m%d')}.log"
    logger = Logger(log_path)
    try:
        logger.log("[START] Pages existing-data rebuild")
        paths = default_paths()
        if not paths.ohlcv_dir.exists() or not any(paths.ohlcv_dir.glob("*.csv")):
            raise RuntimeError("Cached OHLCV CSV files are missing. Run the J-Quants refresh workflow once.")
        if not TICKER_META_DIR.exists() or not any(TICKER_META_DIR.glob("*.json")):
            raise RuntimeError("Cached ticker metadata is missing. Run the J-Quants refresh workflow once.")

        codes = discover_codes()
        target_date = resolve_target_date(codes, args.target_date)
        dates = resolve_recent_dates(codes, target_date, args.recent_days)
        logger.log(f"targetDate={target_date} codeCount={len(codes)} recentDates={len(dates)}")
        if args.dry_run:
            logger.log("[DRY-RUN] no data changed")
            return 0

        build_metrics = rebuild_public_json_from_ohlcv(codes, target_date, logger)
        daily_metrics = build_recent_daily_overviews(codes, dates, logger)
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "build_period_overview_lite.py"),
                "--start-date",
                dates[0],
                "--end-date",
                target_date,
                "--overwrite",
            ],
            check=True,
            cwd=ROOT,
        )
        write_manifest(target_date, dates)
        index_metrics = write_overview_index(dates)
        write_health(
            "success",
            target_date,
            {
                "recentDateCount": len(dates),
                "build": build_metrics,
                "dailyOverview": daily_metrics,
                "overviewLiteIndex": index_metrics,
                "log": str(log_path),
            },
        )
        logger.log(f"[OK] Pages existing-data rebuild completed targetDate={target_date}")
        return 0
    except Exception as exc:
        logger.log(f"[ERROR] {type(exc).__name__}: {exc}")
        write_health("failed", "", {"reason": type(exc).__name__, "message": str(exc), "log": str(log_path)})
        return 1
    finally:
        logger.close()


if __name__ == "__main__":
    raise SystemExit(main())
