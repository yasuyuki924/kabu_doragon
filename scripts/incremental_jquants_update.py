#!/usr/bin/env python3
"""Run a lightweight J-Quants incremental update for public_json runtime data."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.data_source.local_data import build_daily_record  # noqa: E402
from src.indicators.core import build_enriched_rows  # noqa: E402
from src.jquants_provider import (  # noqa: E402
    build_client,
    default_paths,
    fetch_trading_dates,
    format_yyyymmdd,
    load_auth_config,
    resolve_latest_trading_date,
    sync_prices,
    write_sync_state,
    write_update_state,
)


PUBLIC_JSON = ROOT / "data" / "public_json"
TICKER_RECENT_DIR = PUBLIC_JSON / "ticker_recent" / "1y" / "ohlcv_ma"
TICKER_META_DIR = PUBLIC_JSON / "ticker_meta"
TICKER_DETAIL_DIR = PUBLIC_JSON / "ticker_detail_recent" / "1y"
OVERVIEW_LITE_DIR = PUBLIC_JSON / "overview_lite"
MANIFEST_JSON = ROOT / "data" / "manifest.json"
UPDATE_SUMMARY_JSON = ROOT / "data" / "update_summary.json"
UPDATE_HEALTH_JSON = ROOT / "data" / "update_health.json"
UPDATE_STATE_JSON = ROOT / "data" / "update_state.json"
SYNC_STATE_JSON = ROOT / "data" / "jquants_sync_state.json"
LOGS_DIR = ROOT / "logs"

OHLCV_KEYS = ("date", "open", "high", "low", "close", "volume", "ma5", "ma25", "ma75", "ma200")
DETAIL_ROW_KEYS = (
    "date",
    "change",
    "changePercent",
    "distanceToMa25",
    "distanceToMa75",
    "distanceToMa200",
    "volumeRatio25",
    "rci12",
    "rci24",
    "rci48",
    "rsi2",
    "rangePosition52w",
    "strategyMatches",
    "strategyScores",
    "strategyReasons",
    "strategyExcludedReasons",
    "trendTurnReason",
    "trendTurnScore",
    "trendTurnAboveMa75Ratio",
)
LEGACY_PROCESS_PATTERNS = (
    "run_update_and_build_public_json",
    "run_jquants_close_retry",
    "fetch_prices.py",
    "jquants_provider.py",
)


class Logger:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = path.open("a", encoding="utf-8")

    def close(self) -> None:
        self._fh.close()

    def log(self, message: str) -> None:
        line = f"[{datetime.now().astimezone().isoformat(timespec='seconds')}] {message}"
        print(line, flush=True)
        self._fh.write(line + "\n")
        self._fh.flush()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-running-legacy-update", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_compact_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def detect_running_legacy_updates() -> list[str]:
    try:
        proc = subprocess.run(["pgrep", "-fl", "|".join(LEGACY_PROCESS_PATTERNS)], check=False, capture_output=True, text=True)
    except FileNotFoundError:
        return []
    current_pid = os.getpid()
    rows = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        pid_text = line.split(maxsplit=1)[0]
        try:
            if int(pid_text) == current_pid:
                continue
        except ValueError:
            pass
        if "incremental_jquants_update.py" in line:
            continue
        rows.append(line)
    return rows


def load_manifest_latest() -> str:
    manifest = read_json(MANIFEST_JSON, {})
    return str(manifest.get("latestDate") or "").strip()


def discover_codes() -> list[str]:
    codes = sorted(path.stem for path in TICKER_RECENT_DIR.glob("*.json"))
    if codes:
        return codes
    paths = default_paths()
    watchlist = read_json(paths.watchlist_json, [])
    return sorted({str(item.get("ticker") or item.get("code") or "").strip() for item in watchlist if isinstance(item, dict)})


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


def format_number(value: Any) -> int | float | None:
    if value is None:
        return None
    number = float(value)
    return int(number) if number.is_integer() else round(number, 4)


def ticker_meta(code: str) -> dict[str, Any]:
    meta = read_json(TICKER_META_DIR / f"{code}.json", {})
    return meta if isinstance(meta, dict) else {}


def build_overview_payload(
    records: list[dict[str, Any]],
    *,
    target_date: str,
    updated_at: str,
    source: str,
    timeframe: str,
) -> dict[str, Any]:
    sorted_records = sorted(records, key=lambda item: str(item.get("code") or ""))
    rise_count = sum(1 for item in sorted_records if float(item.get("changePercent") or 0) > 0)
    fall_count = sum(1 for item in sorted_records if float(item.get("changePercent") or 0) < 0)
    average_change = (
        sum(float(item.get("changePercent") or 0) for item in sorted_records) / len(sorted_records)
        if sorted_records
        else None
    )
    return {
        "date": target_date,
        "generatedAt": updated_at,
        "source": source,
        "timeframe": timeframe,
        "recordCount": len(sorted_records),
        "riseCount": rise_count,
        "fallCount": fall_count,
        "flatCount": len(sorted_records) - rise_count - fall_count,
        "averageChangePercent": round(average_change, 4) if average_change is not None else None,
        "records": sorted_records,
    }


def build_period_overview_row(
    latest_row: dict[str, Any],
    rows: list[dict[str, float | int | str]],
    *,
    target_date: str,
    timeframe: str,
) -> dict[str, Any] | None:
    target = next((row for row in reversed(rows) if str(row.get("date")) == target_date), None)
    if not target:
        return None
    target_dt = parse_date(target_date)
    if timeframe == "weekly":
        target_week = target_dt.isocalendar()[:2]
        period_rows = [
            row
            for row in rows
            if str(row.get("date")) <= target_date and parse_date(str(row.get("date"))).isocalendar()[:2] == target_week
        ]
    else:
        target_month = target_date[:7]
        period_rows = [row for row in rows if str(row.get("date")) <= target_date and str(row.get("date", ""))[:7] == target_month]
    if not period_rows:
        return None
    open_price = float(period_rows[0].get("open") or 0)
    close = float(target.get("close") or 0)
    change = close - open_price if open_price else None
    volume = sum(int(float(row.get("volume") or 0)) for row in period_rows)
    daily_volume_ma25 = float(latest_row.get("volumeMa25") or 0)
    volume_base = daily_volume_ma25 * len(period_rows)
    return {
        **latest_row,
        "date": target_date,
        "open": open_price,
        "high": max(float(row.get("high") or 0) for row in period_rows),
        "low": min(float(row.get("low") or 0) for row in period_rows),
        "close": close,
        "volume": volume,
        "turnover": close * volume,
        "change": round(change, 4) if change is not None else None,
        "changePercent": round((change / open_price) * 100, 4) if change is not None and open_price else None,
        "volumeRatio25": round(volume / volume_base, 4) if volume_base else None,
    }


def rebuild_public_json_from_ohlcv(codes: list[str], target_date: str, logger: Logger) -> dict[str, Any]:
    paths = default_paths()
    started = time.perf_counter()
    record_count = 0
    overview_records: list[dict[str, Any]] = []
    overview_weekly_records: list[dict[str, Any]] = []
    overview_monthly_records: list[dict[str, Any]] = []
    updated_at = datetime.now().astimezone().isoformat(timespec="seconds")

    for index, code in enumerate(codes, start=1):
        rows = read_ohlcv_csv(paths.ohlcv_dir / f"{code}.csv")
        if not rows:
            continue
        enriched = build_enriched_rows(rows)
        recent = enriched[-245:]
        ohlcv_rows = []
        for row in recent:
            ohlcv_rows.append(
                {
                    "date": row["date"],
                    "open": format_number(row["open"]),
                    "high": format_number(row["high"]),
                    "low": format_number(row["low"]),
                    "close": format_number(row["close"]),
                    "volume": int(row["volume"]),
                    "ma5": format_number(row.get("ma5")),
                    "ma25": format_number(row.get("ma25")),
                    "ma75": format_number(row.get("ma75")),
                    "ma200": format_number(row.get("ma200")),
                }
            )
        write_compact_json(TICKER_RECENT_DIR / f"{code}.json", {"ohlcv": ohlcv_rows})
        detail_rows = [{key: row.get(key) for key in DETAIL_ROW_KEYS if key in row} for row in recent]
        write_compact_json(
            TICKER_DETAIL_DIR / f"{code}.json",
            {
                "code": code,
                "range": "1y",
                "updatedAt": updated_at,
                "startDate": detail_rows[0].get("date") if detail_rows else None,
                "endDate": detail_rows[-1].get("date") if detail_rows else None,
                "rows": detail_rows,
            },
        )
        latest_row = next((row for row in reversed(enriched) if str(row.get("date")) == target_date), None)
        meta = ticker_meta(code)
        if latest_row and meta:
            overview_records.append(build_daily_record(meta, latest_row))
            latest_weekly_row = build_period_overview_row(latest_row, rows, target_date=target_date, timeframe="weekly")
            latest_monthly_row = build_period_overview_row(latest_row, rows, target_date=target_date, timeframe="monthly")
        else:
            latest_weekly_row = None
            latest_monthly_row = None
        if latest_weekly_row and meta:
            overview_weekly_records.append(build_daily_record(meta, latest_weekly_row))
        if latest_monthly_row and meta:
            overview_monthly_records.append(build_daily_record(meta, latest_monthly_row))
        record_count += len(ohlcv_rows)
        if index % 500 == 0:
            logger.log(f"build_public_json progress={index}/{len(codes)}")

    write_compact_json(
        OVERVIEW_LITE_DIR / target_date / "market_pulse.json",
        build_overview_payload(
            overview_records,
            target_date=target_date,
            updated_at=updated_at,
            source="incremental_jquants_update",
            timeframe="daily",
        ),
    )
    write_compact_json(
        OVERVIEW_LITE_DIR / target_date / "market_pulse_weekly.json",
        build_overview_payload(
            overview_weekly_records,
            target_date=target_date,
            updated_at=updated_at,
            source="incremental_jquants_update",
            timeframe="weekly",
        ),
    )
    write_compact_json(
        OVERVIEW_LITE_DIR / target_date / "market_pulse_monthly.json",
        build_overview_payload(
            overview_monthly_records,
            target_date=target_date,
            updated_at=updated_at,
            source="incremental_jquants_update",
            timeframe="monthly",
        ),
    )
    return {
        "codeCount": len(codes),
        "tickerRecentRecordCount": record_count,
        "overviewRecordCount": len(overview_records),
        "overviewWeeklyRecordCount": len(overview_weekly_records),
        "overviewMonthlyRecordCount": len(overview_monthly_records),
        "seconds": round(time.perf_counter() - started, 3),
    }


def update_manifest(target_date: str) -> None:
    manifest = read_json(MANIFEST_JSON, {})
    available_dates = [str(item) for item in manifest.get("availableDates") or [] if str(item).strip()]
    if target_date not in available_dates:
        available_dates.append(target_date)
    available_dates = sorted(set(available_dates))
    payload = {
        **manifest,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "latestDate": target_date,
        "availableDates": available_dates,
    }
    write_json(MANIFEST_JSON, payload)


def write_summary_and_health(status: str, *, target_date: str, manifest_latest: str, details: dict[str, Any]) -> None:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    write_json(
        UPDATE_SUMMARY_JSON,
        {
            "generatedAt": now,
            "date": target_date,
            "status": status,
            "manifestPreviousLatestDate": manifest_latest,
            **details,
        },
    )
    write_json(
        UPDATE_HEALTH_JSON,
        {
            "checkedAt": now,
            "context": "incremental_jquants_update",
            "status": status,
            "manifest": {"latestDate": target_date if status == "success" else manifest_latest},
            "jquants": {"targetDate": target_date},
            "details": details,
        },
    )


def main() -> int:
    args = parse_args()
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOGS_DIR / f"incremental_update_{datetime.now().strftime('%Y%m%d')}.log"
    logger = Logger(log_path)
    try:
        logger.log("[START] incremental update")
        logger.log(f"cwd={ROOT}")
        logger.log(f"log={log_path}")

        running = detect_running_legacy_updates()
        if running and not args.allow_running_legacy_update:
            logger.log("[ERROR] legacy update process is running; refusing incremental update")
            for line in running:
                logger.log(f"running={line}")
            return 2

        paths = default_paths()
        config = load_auth_config(paths.root)
        client, api_version = build_client(config)
        target_date = resolve_latest_trading_date(client, api_version)
        manifest_latest = load_manifest_latest()
        logger.log(f"manifest.latestDate={manifest_latest or '-'}")
        logger.log(f"jquants.targetDate={target_date}")

        if manifest_latest and target_date <= manifest_latest:
            logger.log("[SKIP] already up to date")
            write_summary_and_health("skipped", target_date=target_date, manifest_latest=manifest_latest, details={"reason": "already_up_to_date"})
            return 0
        if not manifest_latest:
            logger.log("[ERROR] manifest.latestDate is empty; incremental update needs a baseline")
            return 3

        start_candidate = parse_date(manifest_latest) + timedelta(days=1)
        target = parse_date(target_date)
        trading_dates = fetch_trading_dates(client, api_version, start_candidate, target)
        if not trading_dates:
            logger.log("[SKIP] no trading dates in delta range")
            write_summary_and_health("skipped", target_date=target_date, manifest_latest=manifest_latest, details={"reason": "no_trading_dates"})
            return 0
        start_date = trading_dates[0]
        end_date = trading_dates[-1]
        logger.log("mode=incremental")
        logger.log(f"dateRange={format_yyyymmdd(start_date)}..{format_yyyymmdd(end_date)}")
        logger.log(f"tradingDateCount={len(trading_dates)}")

        codes = discover_codes()
        logger.log(f"codeCount={len(codes)}")
        if not codes:
            logger.log("[ERROR] no ticker codes were discovered")
            return 4
        if args.dry_run:
            logger.log("[DRY-RUN] no data was changed")
            return 0

        fetch_started = time.perf_counter()
        latest_date, updated_dates, updated_codes, adjusted_codes, adjusted_date_from = sync_prices(
            client,
            api_version,
            paths,
            codes,
            start_date,
            end_date,
            1,
        )
        fetch_seconds = round(time.perf_counter() - fetch_started, 3)
        logger.log(f"fetch=OK latestDate={latest_date} updatedDates={len(updated_dates)} updatedCodes={len(updated_codes)} seconds={fetch_seconds}")

        if latest_date != target_date:
            if latest_date is None or str(latest_date) < target_date:
                logger.log(f"[SKIP] target data is not available yet fetchedLatestDate={latest_date} targetDate={target_date}")
                write_summary_and_health(
                    "skipped",
                    target_date=target_date,
                    manifest_latest=manifest_latest,
                    details={
                        "reason": "target_data_not_available_yet",
                        "fetchedLatestDate": latest_date,
                        "dateRange": f"{format_yyyymmdd(start_date)}..{format_yyyymmdd(end_date)}",
                        "fetchSeconds": fetch_seconds,
                        "log": str(log_path),
                    },
                )
                return 0
            logger.log(f"[ERROR] fetched latestDate={latest_date}; expected targetDate={target_date}")
            write_summary_and_health(
                "failed",
                target_date=target_date,
                manifest_latest=manifest_latest,
                details={"reason": "latest_date_mismatch", "fetchedLatestDate": latest_date, "log": str(log_path)},
            )
            return 5

        write_update_state(
            UPDATE_STATE_JSON,
            snapshot_type="daily",
            updated_dates=updated_dates,
            updated_codes=updated_codes,
            adjusted_codes=adjusted_codes,
            adjusted_date_from=adjusted_date_from,
        )
        write_sync_state(
            SYNC_STATE_JSON,
            plan=config.plan,
            universe="tse",
            segments=["prime", "standard", "growth"],
            last_successful_date=target_date,
        )

        build_metrics = rebuild_public_json_from_ohlcv(codes, target_date, logger)
        logger.log(f"build_public_json=OK {json.dumps(build_metrics, ensure_ascii=False)}")
        update_manifest(target_date)
        write_summary_and_health(
            "success",
            target_date=target_date,
            manifest_latest=manifest_latest,
            details={
                "mode": "incremental",
                "dateRange": f"{format_yyyymmdd(start_date)}..{format_yyyymmdd(end_date)}",
                "updatedDates": sorted(updated_dates),
                "updatedCodeCount": len(updated_codes),
                "adjustedCodeCount": len(adjusted_codes),
                "fetchSeconds": fetch_seconds,
                "build": build_metrics,
                "log": str(log_path),
            },
        )
        logger.log(f"manifest.latestDate={target_date}")
        logger.log("[OK] incremental update completed")
        return 0
    except Exception as exc:
        logger.log(f"[ERROR] {type(exc).__name__}: {exc}")
        manifest_latest = load_manifest_latest()
        write_summary_and_health(
            "failed",
            target_date="",
            manifest_latest=manifest_latest,
            details={"reason": type(exc).__name__, "message": str(exc), "log": str(log_path)},
        )
        return 1
    finally:
        logger.close()


if __name__ == "__main__":
    raise SystemExit(main())
