#!/usr/bin/env python3
"""Dry-run OHLCV repair from the archived data/tickers backup.

This script intentionally does not write repaired OHLCV or public_json files.
It reads the Google Drive tar.gz backup directly, compares it with current
data/ohlcv CSVs, and writes a dry-run report.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import tarfile
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BACKUP = Path(
    "/Users/okamoto/Library/CloudStorage/GoogleDrive-yasuyuki924@gmail.com/"
    "マイドライブ/KabuDragon_Backup/2026-05-06_lightweight_archive/tickers_20260506.tar.gz"
)
DEFAULT_REPORT = ROOT / "reports" / "kabudragon_ohlcv_backup_repair_dry_run.md"
CURRENT_OHLCV_DIR = ROOT / "data" / "ohlcv"
BACKUP_MAX_DATE = "2026-05-01"
TARGET_DATE = "2026-05-07"
CSV_FIELDS = ("date", "open", "high", "low", "close", "volume")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup", type=Path, default=DEFAULT_BACKUP)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--sample-limit", type=int, default=20)
    parser.add_argument("--apply", action="store_true", help="Write repaired data/ohlcv CSVs and rebuild public_json")
    return parser.parse_args()


def date_of(row: dict[str, Any]) -> str:
    return str(row.get("date") or row.get("Date") or "").strip()


def normalize_number(value: Any, *, integer: bool) -> str:
    if value is None or value == "":
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if integer:
        return str(int(number))
    return str(int(number) if number.is_integer() else round(number, 4))


def normalize_row(row: dict[str, Any]) -> dict[str, str]:
    out = {"date": date_of(row)}
    for key in CSV_FIELDS[1:]:
        value = row.get(key)
        if value is None:
            value = row.get(key.capitalize())
        if value is None:
            value = row.get(key.upper())
        out[key] = normalize_number(value, integer=(key == "volume"))
    return out


def extract_rows_from_payload(payload: Any) -> list[dict[str, str]]:
    rows = payload
    if isinstance(payload, dict):
        rows = payload.get("ohlcv") or payload.get("rows") or payload.get("data") or []
    if isinstance(rows, dict):
        rows = rows.get("ohlcv") or rows.get("rows") or rows.get("data") or []
    if not isinstance(rows, list):
        return []
    return [normalize_row(row) for row in rows if isinstance(row, dict) and date_of(row)]


def read_current_rows(code: str) -> list[dict[str, str]]:
    path = CURRENT_OHLCV_DIR / f"{code}.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as fh:
        return [normalize_row(row) for row in csv.DictReader(fh) if date_of(row)]


def write_current_rows(code: str, rows: list[dict[str, str]]) -> None:
    path = CURRENT_OHLCV_DIR / f"{code}.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def summarize_dates(rows: list[dict[str, str]]) -> dict[str, Any]:
    dates = [row["date"] for row in rows]
    duplicates = sum(count - 1 for count in Counter(dates).values() if count > 1)
    return {
        "rows": len(rows),
        "first": min(dates) if dates else None,
        "last": max(dates) if dates else None,
        "hasBackupMaxDate": BACKUP_MAX_DATE in dates,
        "hasTargetDate": TARGET_DATE in dates,
        "duplicates": duplicates,
    }


def merge_rows(backup_rows: list[dict[str, str]], current_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    merged = {row["date"]: row for row in backup_rows if row["date"] <= BACKUP_MAX_DATE}
    for row in current_rows:
        merged[row["date"]] = row
    return [merged[date] for date in sorted(merged)]


def current_codes() -> set[str]:
    return {path.stem for path in CURRENT_OHLCV_DIR.glob("*.csv")}


def append_sample(samples: dict[str, list[str]], key: str, code: str, limit: int) -> None:
    bucket = samples.setdefault(key, [])
    if len(bucket) < limit:
        bucket.append(code)


def analyze_backup(args: argparse.Namespace) -> tuple[dict[str, Any], dict[str, list[str]], list[tuple[str, list[dict[str, str]]]]]:
    current_code_set = current_codes()
    backup_code_set: set[str] = set()
    samples: dict[str, list[str]] = {}
    repairs: list[tuple[str, list[dict[str, str]]]] = []
    stats: dict[str, Any] = {
        "targetCodes": 0,
        "backupCodes": 0,
        "currentCodes": len(current_code_set),
        "mergeableCodes": 0,
        "backupHas20260501": 0,
        "currentHas20260507": 0,
        "mergedHas20260501": 0,
        "mergedHas20260507": 0,
        "mergedDuplicateDateCodes": 0,
        "mergedRowsIncreasedCodes": 0,
        "backupParseErrors": 0,
        "backupEmptyCodes": 0,
        "currentEmptyCodes": 0,
        "maxRowIncrease": 0,
        "maxRowIncreaseCode": None,
        "totalCurrentRows": 0,
        "totalMergedRows": 0,
        "wouldWriteOhlcvCodes": 0,
        "appliedOhlcvCodes": 0,
        "touchedOhlcvRaw": False,
        "rebuiltPublicJson": False,
        "publicJsonBuildSeconds": None,
    }

    with tarfile.open(args.backup, "r:gz") as tar:
        for member in tar:
            if not member.isfile():
                continue
            name = member.name
            if not name.startswith("data/tickers/") or not name.endswith(".json"):
                continue
            code = Path(name).stem
            backup_code_set.add(code)
            try:
                extracted = tar.extractfile(member)
                if extracted is None:
                    raise ValueError("extractfile returned None")
                backup_rows = extract_rows_from_payload(json.load(extracted))
            except Exception:
                stats["backupParseErrors"] += 1
                append_sample(samples, "backup_parse_errors", code, args.sample_limit)
                continue

            current_rows = read_current_rows(code)
            backup_summary = summarize_dates(backup_rows)
            current_summary = summarize_dates(current_rows)
            merged_rows = merge_rows(backup_rows, current_rows)
            merged_summary = summarize_dates(merged_rows)

            stats["totalCurrentRows"] += current_summary["rows"]
            stats["totalMergedRows"] += merged_summary["rows"]
            if backup_summary["rows"] == 0:
                stats["backupEmptyCodes"] += 1
                append_sample(samples, "backup_empty", code, args.sample_limit)
            if code in current_code_set and current_summary["rows"] == 0:
                stats["currentEmptyCodes"] += 1
                append_sample(samples, "current_empty", code, args.sample_limit)
            if backup_summary["hasBackupMaxDate"]:
                stats["backupHas20260501"] += 1
            if current_summary["hasTargetDate"]:
                stats["currentHas20260507"] += 1
            if backup_rows and current_rows:
                stats["mergeableCodes"] += 1
                repairs.append((code, merged_rows))
            if merged_summary["hasBackupMaxDate"]:
                stats["mergedHas20260501"] += 1
            if merged_summary["hasTargetDate"]:
                stats["mergedHas20260507"] += 1
            if merged_summary["duplicates"]:
                stats["mergedDuplicateDateCodes"] += 1
                append_sample(samples, "merged_duplicate_dates", code, args.sample_limit)
            increase = merged_summary["rows"] - current_summary["rows"]
            if increase > 0:
                stats["mergedRowsIncreasedCodes"] += 1
                if increase > stats["maxRowIncrease"]:
                    stats["maxRowIncrease"] = increase
                    stats["maxRowIncreaseCode"] = code
            else:
                append_sample(samples, "no_row_increase", code, args.sample_limit)
            if not merged_summary["hasBackupMaxDate"]:
                append_sample(samples, "merged_missing_2026_05_01", code, args.sample_limit)
            if not merged_summary["hasTargetDate"]:
                append_sample(samples, "merged_missing_2026_05_07", code, args.sample_limit)

    missing_backup = sorted(current_code_set - backup_code_set)
    missing_current = sorted(backup_code_set - current_code_set)
    for code in missing_backup[: args.sample_limit]:
        append_sample(samples, "missing_backup", code, args.sample_limit)
    for code in missing_current[: args.sample_limit]:
        append_sample(samples, "missing_current", code, args.sample_limit)

    stats["backupCodes"] = len(backup_code_set)
    stats["targetCodes"] = len(current_code_set | backup_code_set)
    stats["missingBackupCodes"] = len(missing_backup)
    stats["missingCurrentCodes"] = len(missing_current)
    stats["wouldWriteOhlcvCodes"] = len(repairs)
    return stats, samples, repairs


def apply_repairs(repairs: list[tuple[str, list[dict[str, str]]]]) -> int:
    for code, rows in repairs:
        write_current_rows(code, rows)
    return len(repairs)


def rebuild_public_json() -> tuple[dict[str, Any], float]:
    scripts_dir = ROOT / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from incremental_jquants_update import Logger, discover_codes, rebuild_public_json_from_ohlcv

    started = time.perf_counter()
    log_path = ROOT / "logs" / f"ohlcv_backup_repair_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    logger = Logger(log_path)
    try:
        codes = discover_codes()
        metrics = rebuild_public_json_from_ohlcv(codes, TARGET_DATE, logger)
        metrics["log"] = str(log_path)
        return metrics, round(time.perf_counter() - started, 3)
    finally:
        logger.close()


def render_report(args: argparse.Namespace, stats: dict[str, Any], samples: dict[str, list[str]]) -> str:
    lines = [
        "# KabuDragon OHLCV Backup Repair Dry Run",
        "",
        f"- generatedAt: {datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"- backup: `{args.backup}`",
        f"- currentOhlcvDir: `{CURRENT_OHLCV_DIR}`",
        f"- dryRunOnly: `{str(not args.apply).lower()}`",
        f"- apply: `{str(args.apply).lower()}`",
        f"- backupMaxDate: `{BACKUP_MAX_DATE}`",
        f"- targetDate: `{TARGET_DATE}`",
        "",
        "## Summary",
        "",
    ]
    summary_keys = [
        "targetCodes",
        "backupCodes",
        "currentCodes",
        "mergeableCodes",
        "backupHas20260501",
        "currentHas20260507",
        "mergedHas20260501",
        "mergedHas20260507",
        "mergedDuplicateDateCodes",
        "mergedRowsIncreasedCodes",
        "missingBackupCodes",
        "missingCurrentCodes",
        "backupParseErrors",
        "backupEmptyCodes",
        "currentEmptyCodes",
        "totalCurrentRows",
        "totalMergedRows",
        "maxRowIncrease",
        "maxRowIncreaseCode",
        "wouldWriteOhlcvCodes",
        "appliedOhlcvCodes",
        "touchedOhlcvRaw",
        "rebuiltPublicJson",
        "publicJsonBuildSeconds",
    ]
    for key in summary_keys:
        lines.append(f"- {key}: `{stats.get(key)}`")
    lines.extend(["", "## Problem Samples", ""])
    if not samples:
        lines.append("- none")
    for key in sorted(samples):
        values = ", ".join(samples[key]) if samples[key] else "-"
        lines.append(f"- {key}: {values}")
    lines.extend(
        [
            "",
            "## Decision Notes",
            "",
            "- Apply is limited to codes present in both backup and current `data/ohlcv`.",
            "- Duplicate dates are resolved by keeping the current `data/ohlcv` row.",
            "- This run did not restore `data/tickers` or `data/overview`.",
            "- This run did not touch `data/ohlcv_raw`.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    if not args.backup.exists():
        raise SystemExit(f"backup not found: {args.backup}")
    stats, samples, repairs = analyze_backup(args)
    if args.apply:
        stats["appliedOhlcvCodes"] = apply_repairs(repairs)
        build_metrics, build_seconds = rebuild_public_json()
        stats["rebuiltPublicJson"] = True
        stats["publicJsonBuildSeconds"] = build_seconds
        stats["publicJsonBuild"] = build_metrics
    report = render_report(args, stats, samples)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report, encoding="utf-8")
    print(report)
    print(f"Wrote dry-run report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
