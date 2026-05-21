#!/usr/bin/env python3
"""Promote adjusted OHLCV into daily_records and overview_lite for a bounded code/date subset."""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.common import (  # noqa: E402
    build_daily_record,
    build_enriched_rows,
    build_wtd_mtd_bars,
    load_daily_records,
    load_watchlist,
    merge_daily_records,
    summarize_sector_strength,
    summarize_tag_counts,
    summarize_theme_counts,
    write_json,
)
from src.app.shared_view_data import STALE_TOLERANCE_BUSINESS_DAYS  # noqa: E402
from src.common.paths import DAILY_RECORDS_DIR, ROOT as PROJECT_ROOT, TICKERS_DIR  # noqa: E402


DEFAULT_INPUT_DIR = PROJECT_ROOT / "data" / "recheck_ohlcv_adjusted"
OVERVIEW_LITE_DIR = PROJECT_ROOT / "data" / "public_json" / "overview_lite"
RANKINGS_DIR = PROJECT_ROOT / "data" / "rankings"
REPORT_MD = PROJECT_ROOT / "reports" / "kabudragon_adjusted_strategy_ranking_integration.md"
REPORT_JSON = PROJECT_ROOT / "reports" / "kabudragon_adjusted_strategy_ranking_integration.json"
LITE_FILES = {
    "daily": "market_pulse.json",
    "weekly": "market_pulse_weekly.json",
    "monthly": "market_pulse_monthly.json",
}
DATE_SUFFIX = {"daily": "", "weekly": "_weekly", "monthly": "_monthly"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--from-date", required=True)
    parser.add_argument("--to-date", required=True)
    parser.add_argument("--write", action="store_true", help="Write data files. Default is dry-run.")
    return parser.parse_args()


def read_adjusted_rows(path: Path) -> list[dict[str, float | int | str]]:
    rows: list[dict[str, float | int | str]] = []
    with path.open("r", encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if not row.get("date"):
                continue
            rows.append(
                {
                    "date": str(row["date"]).strip(),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": int(float(row["volume"])),
                }
            )
    return sorted(rows, key=lambda item: str(item["date"]))


def target_codes(input_dir: Path) -> list[str]:
    return sorted(path.stem for path in input_dir.glob("*.csv"))


def target_dates(input_dir: Path, from_date: str, to_date: str) -> list[str]:
    dates: set[str] = set()
    for path in input_dir.glob("*.csv"):
        with path.open("r", encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                date_value = str(row.get("date") or "").strip()
                if from_date <= date_value <= to_date:
                    dates.add(date_value)
    return sorted(dates)


def watchlist_meta_by_code(target_code_list: list[str]) -> dict[str, dict[str, object]]:
    target_code_set = set(target_code_list)
    out: dict[str, dict[str, object]] = {}
    try:
        watchlist = load_watchlist()
    except FileNotFoundError:
        watchlist = []
    for item in watchlist:
        code = str(item.get("ticker") or "").strip()
        if not code or code not in target_code_set:
            continue
        out[code] = {
            "code": code,
            "name": str(item.get("name") or ""),
            "market": str(item.get("market") or ""),
            "sector": str(item.get("sector") or ""),
            "industry": str(item.get("industry") or ""),
            "themes": item.get("themes", []),
            "tags": item.get("tags", []),
            "links": item.get("links", {}),
        }
    for code in target_code_list:
        path = TICKERS_DIR / f"{code}.json"
        if not path.exists() or code in out:
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        code = str(payload.get("code") or path.stem).strip()
        if not code or code in out:
            continue
        out[code] = {
            "code": code,
            "name": str(payload.get("name") or ""),
            "market": str(payload.get("market") or ""),
            "sector": str(payload.get("sector") or ""),
            "industry": str(payload.get("industry") or ""),
            "themes": payload.get("themes", []),
            "tags": payload.get("tags", []),
            "links": payload.get("links", {}),
        }
    for daily_path in sorted(DAILY_RECORDS_DIR.glob("*.json"), reverse=True):
        if len(out) >= len(target_code_set):
            break
        try:
            payload = json.loads(daily_path.read_text(encoding="utf-8"))
        except Exception:
            continue
        records = payload.get("records")
        if not isinstance(records, list):
            continue
        for record in records:
            if not isinstance(record, dict):
                continue
            code = str(record.get("code") or "").strip()
            if not code or code in out or code not in target_code_set:
                continue
            out[code] = {
                "code": code,
                "name": str(record.get("name") or ""),
                "market": str(record.get("market") or ""),
                "sector": str(record.get("sector") or ""),
                "industry": str(record.get("industry") or ""),
                "themes": record.get("themes", []),
                "tags": record.get("tags", []),
                "links": record.get("links", {}),
            }
    return out


def backup_targets(dates: list[str], backup_dir: Path, write: bool) -> dict[str, Any]:
    metrics: dict[str, Any] = {"dailyRecords": 0, "overviewLite": 0, "rankings": 0, "missing": []}
    if not write:
        return metrics
    backup_dir.mkdir(parents=True, exist_ok=False)
    for date_value in dates:
        for suffix in ["", "_weekly", "_monthly"]:
            source = DAILY_RECORDS_DIR / f"{date_value}{suffix}.json"
            if source.exists():
                target = backup_dir / "daily_records" / source.name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                metrics["dailyRecords"] += 1
        overview_dir = OVERVIEW_LITE_DIR / date_value
        if overview_dir.exists():
            target_dir = backup_dir / "overview_lite" / date_value
            target_dir.mkdir(parents=True, exist_ok=True)
            for name in LITE_FILES.values():
                source = overview_dir / name
                if source.exists():
                    shutil.copy2(source, target_dir / name)
                    metrics["overviewLite"] += 1
        ranking_dir = RANKINGS_DIR / date_value
        if ranking_dir.exists():
            target_dir = backup_dir / "rankings" / date_value
            shutil.copytree(ranking_dir, target_dir, dirs_exist_ok=True)
            metrics["rankings"] += len([path for path in ranking_dir.glob("*.json")])
    return metrics


def build_updates(
    codes: list[str],
    dates: list[str],
    input_dir: Path,
) -> tuple[dict[str, dict[str, dict[str, object]]], dict[str, Any]]:
    date_set = set(dates)
    meta_by_code = watchlist_meta_by_code(codes)
    updates: dict[str, dict[str, dict[str, object]]] = {
        "daily": {date_value: {} for date_value in dates},
        "weekly": {date_value: {} for date_value in dates},
        "monthly": {date_value: {} for date_value in dates},
    }
    metrics: dict[str, Any] = {"missingMeta": [], "rowsByCode": {}, "updatedRecords": Counter()}
    for code in codes:
        meta = meta_by_code.get(code)
        if not meta:
            metrics["missingMeta"].append(code)
            continue
        rows = read_adjusted_rows(input_dir / f"{code}.csv")
        wtd_rows, mtd_rows = build_wtd_mtd_bars(rows)
        enriched_daily = build_enriched_rows(rows)
        enriched_weekly = build_enriched_rows(wtd_rows)
        enriched_monthly = build_enriched_rows(mtd_rows)
        metrics["rowsByCode"][code] = len(rows)
        for index, row in enumerate(enriched_daily):
            date_value = str(row["date"])
            if date_value not in date_set:
                continue
            updates["daily"][date_value][code] = build_daily_record(meta, row)
            updates["weekly"][date_value][code] = build_daily_record(meta, enriched_weekly[index])
            updates["monthly"][date_value][code] = build_daily_record(meta, enriched_monthly[index])
            metrics["updatedRecords"]["daily"] += 1
            metrics["updatedRecords"]["weekly"] += 1
            metrics["updatedRecords"]["monthly"] += 1
    metrics["updatedRecords"] = dict(metrics["updatedRecords"])
    return updates, metrics


def count_strategies(records: list[dict[str, object]]) -> dict[str, int]:
    counts = Counter()
    for record in records:
        matches = record.get("strategyMatches")
        if isinstance(matches, list):
            for strategy_id in matches:
                counts[str(strategy_id)] += 1
        if record.get("highPullback30Candidate"):
            counts["strategy_high_pullback_30"] += 1
        if record.get("trendTurnCandidate"):
            counts["trend_turn"] += 1
    return dict(sorted(counts.items()))


def recompute_lite_summary(payload: dict[str, Any]) -> dict[str, Any]:
    records = [item for item in payload.get("records", []) if isinstance(item, dict)]
    rise_count = sum(1 for item in records if float(item.get("changePercent") or 0) > 0)
    fall_count = sum(1 for item in records if float(item.get("changePercent") or 0) < 0)
    flat_count = len(records) - rise_count - fall_count
    average_change = sum(float(item.get("changePercent") or 0) for item in records) / len(records) if records else None
    payload.update(
        {
            "recordCount": len(records),
            "riseCount": rise_count,
            "fallCount": fall_count,
            "flatCount": flat_count,
            "aboveMa25Count": sum(1 for item in records if float(item.get("distanceToMa25") or 0) > 0),
            "aboveMa75Count": sum(1 for item in records if float(item.get("distanceToMa75") or 0) > 0),
            "aboveMa200Count": sum(1 for item in records if float(item.get("distanceToMa200") or 0) > 0),
            "averageChangePercent": round(average_change, 4) if average_change is not None else None,
            "volumeSpikeCount": sum(1 for item in records if float(item.get("volumeRatio25") or 0) >= 2.0),
            "sectorBreadth": summarize_sector_strength(records)[:12],
            "themeBreadth": summarize_theme_counts(records)[:12],
            "tagBreadth": summarize_tag_counts(records)[:12],
            "staleToleranceBusinessDays": payload.get("staleToleranceBusinessDays", STALE_TOLERANCE_BUSINESS_DAYS),
        }
    )
    return payload


def patch_overview_lite(date_value: str, timeframe: str, updates: dict[str, dict[str, object]], write: bool) -> dict[str, Any]:
    path = OVERVIEW_LITE_DIR / date_value / LITE_FILES[timeframe]
    if not path.exists():
        return {"path": str(path.relative_to(PROJECT_ROOT)), "exists": False, "patched": 0}
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("records")
    if not isinstance(records, list):
        return {"path": str(path.relative_to(PROJECT_ROOT)), "exists": True, "patched": 0, "reason": "records missing"}
    patched = 0
    for record in records:
        if not isinstance(record, dict):
            continue
        code = str(record.get("code") or "").strip()
        update = updates.get(code)
        if not update:
            continue
        for key, value in update.items():
            if key in record or key in {
                "strategyMatches",
                "strategyScores",
                "strategyReasons",
                "strategyExcludedReasons",
                "strategyMetrics",
                "highPullback30",
                "highPullback30Candidate",
                "highPullback30DropRate",
                "highPullback30HighDate",
                "highPullback30LowDate",
                "highPullback30BarsToLow",
            }:
                record[key] = value
        patched += 1
    if write and patched:
        payload["records"] = records
        write_json(path, recompute_lite_summary(payload))
    return {"path": str(path.relative_to(PROJECT_ROOT)), "exists": True, "patched": patched}


def write_reports(report: dict[str, Any]) -> None:
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# KabuDragon adjusted strategy/ranking integration",
        "",
        f"Generated: {report['generatedAt']}",
        "",
        "## Scope",
        f"- Mode: `{report['mode']}`",
        f"- Date range: `{report['dateRange']['from']}` to `{report['dateRange']['to']}`",
        f"- Target codes: {report['targetCodeCount']}",
        f"- Target dates: {report['targetDateCount']}",
        f"- Backup: `{report['backupDir']}`",
        "",
        "## Data changes",
        f"- daily_records patched: {report['writeMetrics']['dailyRecordsPatched']}",
        f"- overview_lite records patched: {report['writeMetrics']['overviewLiteRecordsPatched']}",
        f"- ranking files patched: {report['writeMetrics']['rankingFilesPatched']}",
        "",
        "## Strategy counts before/after",
    ]
    for date_value, payload in report["strategyCountSamples"].items():
        lines.append(f"### {date_value}")
        lines.append(f"- before: `{payload['before']}`")
        lines.append(f"- after: `{payload['after']}`")
    lines.extend(
        [
            "",
            "## Safety",
            "- data/ohlcv_raw was not touched.",
            "- data/ohlcv was not touched.",
            "- public_json full regeneration was not run.",
            "- Only target daily_records and overview_lite files in the bounded date range were updated.",
            "- Commit and push were not run.",
        ]
    )
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    codes = target_codes(args.input_dir)
    dates = target_dates(args.input_dir, args.from_date, args.to_date)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = PROJECT_ROOT / "reports" / f"backup_{timestamp}_adjusted_strategy_ranking"
    before_counts: dict[str, dict[str, int]] = {}
    for date_value in [dates[0], dates[-1]] if dates else []:
        before_counts[date_value] = count_strategies(load_daily_records(date_value) or [])
    backup_metrics = backup_targets(dates, backup_dir, args.write)
    updates, build_metrics = build_updates(codes, dates, args.input_dir)
    daily_patched = 0
    overview_patched = 0
    if args.write:
        for timeframe, suffix in DATE_SUFFIX.items():
            for date_value in dates:
                date_updates = updates[timeframe][date_value]
                if not date_updates:
                    continue
                merge_daily_records(f"{date_value}{suffix}", date_updates, None)
                daily_patched += len(date_updates)
                result = patch_overview_lite(date_value, timeframe, date_updates, True)
                overview_patched += int(result.get("patched") or 0)
    after_counts: dict[str, dict[str, int]] = {}
    for date_value in before_counts:
        after_counts[date_value] = count_strategies(load_daily_records(date_value) or [])
    report = {
        "generatedAt": datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds"),
        "mode": "write" if args.write else "dry-run",
        "inputDir": str(args.input_dir.relative_to(PROJECT_ROOT) if args.input_dir.is_absolute() and args.input_dir.is_relative_to(PROJECT_ROOT) else args.input_dir),
        "dateRange": {"from": args.from_date, "to": args.to_date},
        "targetCodeCount": len(codes),
        "targetCodes": codes,
        "targetDateCount": len(dates),
        "targetDates": dates,
        "backupDir": str(backup_dir.relative_to(PROJECT_ROOT)),
        "backupMetrics": backup_metrics,
        "buildMetrics": build_metrics,
        "writeMetrics": {
            "dailyRecordsPatched": daily_patched,
            "overviewLiteRecordsPatched": overview_patched,
            "rankingFilesPatched": 0,
            "rankingNote": "data/rankings is absent, and scanner ranking is served from overview_lite records.",
        },
        "strategyCountSamples": {
            date_value: {"before": before_counts.get(date_value, {}), "after": after_counts.get(date_value, {})}
            for date_value in before_counts
        },
    }
    write_reports(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
