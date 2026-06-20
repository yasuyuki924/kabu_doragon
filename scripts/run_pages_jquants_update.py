#!/usr/bin/env python3
"""Rebuild the GitHub Pages runtime data from J-Quants.

This entrypoint is designed for ephemeral GitHub Actions runners. It does not
require committed raw OHLCV history; instead it fetches the recent history
needed by the public site, rebuilds public JSON, and leaves private/raw inputs
outside the Pages artifact.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.incremental_jquants_update import (  # noqa: E402
    Logger,
    OVERVIEW_LITE_DIR,
    PUBLIC_JSON,
    build_overview_payload,
    rebuild_public_json_from_ohlcv,
    resolve_active_universe,
    sync_ticker_meta,
)
from src.data_source.local_data import build_daily_record  # noqa: E402
from src.indicators.core import build_enriched_rows  # noqa: E402
from src.jquants_provider import (  # noqa: E402
    build_client,
    default_paths,
    fetch_trading_dates,
    load_auth_config,
    read_ohlcv_rows,
    resolve_latest_trading_date,
    sync_prices,
    write_sync_state,
    write_update_state,
)


MANIFEST_JSON = ROOT / "data" / "manifest.json"
UPDATE_HEALTH_JSON = ROOT / "data" / "update_health.json"
UPDATE_SUMMARY_JSON = ROOT / "data" / "update_summary.json"
LOGS_DIR = ROOT / "logs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recent-days", type=int, default=45)
    parser.add_argument("--history-days", type=int, default=430)
    parser.add_argument("--chunk-days", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_compact_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def ticker_meta(code: str) -> dict[str, Any]:
    path = PUBLIC_JSON / "ticker_meta" / f"{code}.json"
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, dict) else {}


def build_recent_daily_overviews(codes: list[str], dates: list[str], logger: Logger) -> dict[str, Any]:
    started = time.perf_counter()
    records_by_date: dict[str, list[dict[str, Any]]] = {date: [] for date in dates}
    date_set = set(dates)
    for index, code in enumerate(codes, start=1):
        meta = ticker_meta(code)
        rows = read_ohlcv_rows(default_paths().ohlcv_dir / f"{code}.csv")
        if not meta or not rows:
            continue
        for row in build_enriched_rows(rows):
            date_value = str(row.get("date") or "")
            if date_value in date_set:
                records_by_date[date_value].append(build_daily_record(meta, row))
        if index % 500 == 0:
            logger.log(f"daily_overview progress={index}/{len(codes)}")

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    written = 0
    for date_value, records in records_by_date.items():
        write_compact_json(
            OVERVIEW_LITE_DIR / date_value / "market_pulse.json",
            build_overview_payload(
                records,
                target_date=date_value,
                updated_at=generated_at,
                source="run_pages_jquants_update",
                timeframe="daily",
            ),
        )
        written += 1
    return {"dailyFiles": written, "seconds": round(time.perf_counter() - started, 3)}


def write_manifest(target_date: str, dates: list[str]) -> None:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    payload = {
        "generatedAt": now,
        "latestDate": target_date,
        "availableDates": dates,
        "currentSnapshot": {
            "date": target_date,
            "snapshotType": "daily",
            "generatedAt": now,
        },
    }
    write_json(MANIFEST_JSON, payload)


def write_health(status: str, target_date: str, details: dict[str, Any]) -> None:
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    write_json(
        UPDATE_SUMMARY_JSON,
        {"generatedAt": now, "date": target_date, "status": status, **details},
    )
    write_json(
        UPDATE_HEALTH_JSON,
        {
            "checkedAt": now,
            "context": "github_pages_jquants_update",
            "status": status,
            "manifest": {"latestDate": target_date, "generatedAt": now},
            "jquants": {"targetDate": target_date},
            "details": details,
        },
    )


def main() -> int:
    args = parse_args()
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOGS_DIR / f"pages_jquants_update_{datetime.now().strftime('%Y%m%d')}.log"
    logger = Logger(log_path)
    try:
        logger.log("[START] pages J-Quants rebuild")
        paths = default_paths()
        config = load_auth_config(paths.root)
        client, api_version = build_client(config)
        target_date = resolve_latest_trading_date(client, api_version)
        target = parse_date(target_date).date()
        start_date = target - timedelta(days=args.history_days)
        recent_cutoff = target - timedelta(days=args.recent_days)
        recent_dates = [d.strftime("%Y-%m-%d") for d in fetch_trading_dates(client, api_version, recent_cutoff, target)]
        if target_date not in recent_dates:
            recent_dates.append(target_date)
            recent_dates = sorted(set(recent_dates))
        logger.log(f"targetDate={target_date} historyStart={start_date} recentDates={len(recent_dates)}")

        active_watchlist = resolve_active_universe(client, api_version, paths, logger)
        codes = sorted({str(item.get("ticker") or "").strip() for item in active_watchlist if str(item.get("ticker") or "").strip()})
        logger.log(f"codeCount={len(codes)}")
        if args.dry_run:
            logger.log("[DRY-RUN] no data changed")
            return 0

        sync_ticker_meta(active_watchlist, target_date)
        latest_date, updated_dates, updated_codes, adjusted_codes, adjusted_date_from = sync_prices(
            client,
            api_version,
            paths,
            codes,
            start_date,
            target,
            args.chunk_days,
        )
        if latest_date and str(latest_date) < target_date:
            logger.log(f"[SKIP] target data unavailable fetchedLatestDate={latest_date}")
            write_health("skipped", target_date, {"reason": "target_data_not_available_yet", "fetchedLatestDate": latest_date})
            return 0

        write_update_state(
            paths.update_state_json,
            snapshot_type="daily",
            updated_dates=updated_dates,
            updated_codes=updated_codes,
            adjusted_codes=adjusted_codes,
            adjusted_date_from=adjusted_date_from,
        )
        write_sync_state(
            paths.sync_state_json,
            plan=config.plan,
            universe="tse",
            segments=["prime", "standard", "growth"],
            last_successful_date=target_date,
        )

        build_metrics = rebuild_public_json_from_ohlcv(codes, target_date, logger)
        daily_metrics = build_recent_daily_overviews(codes, recent_dates, logger)
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "build_period_overview_lite.py"),
                "--start-date",
                recent_dates[0],
                "--end-date",
                target_date,
                "--overwrite",
            ],
            check=True,
            cwd=ROOT,
        )
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "backfill_period_overview_lite_strategies.py")],
            check=True,
            cwd=ROOT,
        )
        write_manifest(target_date, recent_dates)
        write_health(
            "success",
            target_date,
            {
                "historyStartDate": start_date.isoformat(),
                "recentDateCount": len(recent_dates),
                "updatedDateCount": len(updated_dates),
                "updatedCodeCount": len(updated_codes),
                "adjustedCodeCount": len(adjusted_codes),
                "build": build_metrics,
                "dailyOverview": daily_metrics,
                "log": str(log_path),
            },
        )
        logger.log(f"[OK] pages J-Quants rebuild completed targetDate={target_date}")
        return 0
    except Exception as exc:
        logger.log(f"[ERROR] {type(exc).__name__}: {exc}")
        write_health("failed", "", {"reason": type(exc).__name__, "message": str(exc), "log": str(log_path)})
        return 1
    finally:
        logger.close()


if __name__ == "__main__":
    raise SystemExit(main())
