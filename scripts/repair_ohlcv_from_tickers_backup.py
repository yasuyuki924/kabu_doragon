#!/usr/bin/env python3
"""Dry-run / apply OHLCV repair from the archived data/tickers backup.

Default mode (no --apply) is a dry run: no files are written.
With --apply, repairs data/ohlcv CSVs and rebuilds public_json.
With --apply --fix-raw, ALSO writes to data/ohlcv_raw CSVs so that
the next incremental J-Quants update does not overwrite the repaired data.

NOTE: --fix-raw writes backup-sourced (already adjusted) rows into
data/ohlcv_raw.  For codes with corporate-action events this may cause
a double-adjustment on the next sync_prices call.  The trade-off is
intentional: the raw files currently have a 1052-day gap and must be
filled so that incremental updates work correctly.

Exit codes:
  0 - completed (dry-run or apply)
  1 - backup not found or unrecoverable error
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
OHLCV_RAW_DIR = ROOT / "data" / "ohlcv_raw"
BACKUP_MAX_DATE = "2026-05-01"
CSV_FIELDS = ("date", "open", "high", "low", "close", "volume")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup", type=Path, default=DEFAULT_BACKUP)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--sample-limit", type=int, default=20)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write repaired data/ohlcv CSVs and rebuild public_json",
    )
    parser.add_argument(
        "--fix-raw",
        action="store_true",
        help=(
            "Also write merged rows to data/ohlcv_raw CSVs (requires --apply). "
            "Use this when ohlcv_raw has a gap that would re-break ohlcv on the next incremental update."
        ),
    )
    return parser.parse_args()


def resolve_target_date() -> str:
    """Return manifest.latestDate, or today's date as fallback."""
    try:
        manifest = json.loads((ROOT / "data" / "manifest.json").read_text())
        d = str(manifest.get("latestDate") or "").strip()
        if d:
            return d
    except Exception:
        pass
    return datetime.now().strftime("%Y-%m-%d")


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


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as fh:
        return [normalize_row(row) for row in csv.DictReader(fh) if date_of(row)]


def read_current_rows(code: str) -> list[dict[str, str]]:
    return read_csv_rows(CURRENT_OHLCV_DIR / f"{code}.csv")


def read_raw_rows(code: str) -> list[dict[str, str]]:
    return read_csv_rows(OHLCV_RAW_DIR / f"{code}.csv")


def write_csv_rows(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def write_current_rows(code: str, rows: list[dict[str, str]]) -> None:
    write_csv_rows(CURRENT_OHLCV_DIR / f"{code}.csv", rows)


def write_raw_rows(code: str, rows: list[dict[str, str]]) -> None:
    write_csv_rows(OHLCV_RAW_DIR / f"{code}.csv", rows)


def summarize_dates(rows: list[dict[str, str]], target_date: str = "") -> dict[str, Any]:
    dates = [row["date"] for row in rows]
    duplicates = sum(count - 1 for count in Counter(dates).values() if count > 1)
    return {
        "rows": len(rows),
        "first": min(dates) if dates else None,
        "last": max(dates) if dates else None,
        "hasBackupMaxDate": BACKUP_MAX_DATE in dates,
        "hasTargetDate": bool(target_date and target_date in dates),
        "duplicates": duplicates,
    }


def merge_rows(
    backup_rows: list[dict[str, str]],
    current_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Merge backup (up to BACKUP_MAX_DATE) with current rows (all dates preserved).

    Strategy:
    - Start with backup rows where date <= BACKUP_MAX_DATE (fills the historical gap)
    - Override/extend with ALL current rows (preserves every date already in current)
    - Result: complete history = backup gap-fill + all current dates
    """
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


# Each repair entry: (code, ohlcv_merged_rows, raw_merged_rows)
# raw_merged_rows is non-empty only when --fix-raw is requested.
RepairEntry = tuple[str, list[dict[str, str]], list[dict[str, str]]]


def analyze_backup(
    args: argparse.Namespace,
    target_date: str,
) -> tuple[dict[str, Any], dict[str, list[str]], list[RepairEntry]]:
    current_code_set = current_codes()
    backup_code_set: set[str] = set()
    samples: dict[str, list[str]] = {}
    repairs: list[RepairEntry] = []
    stats: dict[str, Any] = {
        "targetDate": target_date,
        "targetCodes": 0,
        "backupCodes": 0,
        "currentCodes": len(current_code_set),
        "mergeableCodes": 0,
        "backupHasBackupMaxDate": 0,
        "currentHasTargetDate": 0,
        "mergedHasBackupMaxDate": 0,
        "mergedHasTargetDate": 0,
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
        "appliedRawCodes": 0,
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
            backup_summary = summarize_dates(backup_rows, target_date)
            current_summary = summarize_dates(current_rows, target_date)
            ohlcv_merged_rows = merge_rows(backup_rows, current_rows)
            merged_summary = summarize_dates(ohlcv_merged_rows, target_date)

            # For --fix-raw: merge backup with ohlcv_raw current rows
            raw_merged_rows: list[dict[str, str]] = []
            if args.fix_raw:
                raw_current_rows = read_raw_rows(code)
                raw_merged_rows = merge_rows(backup_rows, raw_current_rows)

            stats["totalCurrentRows"] += current_summary["rows"]
            stats["totalMergedRows"] += merged_summary["rows"]
            if backup_summary["rows"] == 0:
                stats["backupEmptyCodes"] += 1
                append_sample(samples, "backup_empty", code, args.sample_limit)
            if code in current_code_set and current_summary["rows"] == 0:
                stats["currentEmptyCodes"] += 1
                append_sample(samples, "current_empty", code, args.sample_limit)
            if backup_summary["hasBackupMaxDate"]:
                stats["backupHasBackupMaxDate"] += 1
            if current_summary["hasTargetDate"]:
                stats["currentHasTargetDate"] += 1
            if backup_rows and current_rows:
                stats["mergeableCodes"] += 1
                repairs.append((code, ohlcv_merged_rows, raw_merged_rows))
            if merged_summary["hasBackupMaxDate"]:
                stats["mergedHasBackupMaxDate"] += 1
            if merged_summary["hasTargetDate"]:
                stats["mergedHasTargetDate"] += 1
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
                append_sample(samples, f"merged_missing_{BACKUP_MAX_DATE}", code, args.sample_limit)
            if not merged_summary["hasTargetDate"]:
                append_sample(samples, f"merged_missing_{target_date}", code, args.sample_limit)

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


def apply_repairs(
    repairs: list[RepairEntry],
    fix_raw: bool = False,
) -> tuple[int, int]:
    """Write repaired rows. Returns (ohlcv_count, raw_count)."""
    ohlcv_count = 0
    raw_count = 0
    for code, ohlcv_rows, raw_rows in repairs:
        write_current_rows(code, ohlcv_rows)
        ohlcv_count += 1
        if fix_raw and raw_rows:
            write_raw_rows(code, raw_rows)
            raw_count += 1
    return ohlcv_count, raw_count


def rebuild_public_json(target_date: str) -> tuple[dict[str, Any], float]:
    scripts_dir = ROOT / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from incremental_jquants_update import Logger, discover_codes, rebuild_public_json_from_ohlcv

    started = time.perf_counter()
    log_path = ROOT / "logs" / f"ohlcv_backup_repair_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    logger = Logger(log_path)
    try:
        codes = discover_codes()
        metrics = rebuild_public_json_from_ohlcv(codes, target_date, logger)
        metrics["log"] = str(log_path)
        return metrics, round(time.perf_counter() - started, 3)
    finally:
        logger.close()


def render_report(
    args: argparse.Namespace,
    stats: dict[str, Any],
    samples: dict[str, list[str]],
    target_date: str,
) -> str:
    lines = [
        "# KabuDragon OHLCV Backup Repair",
        "",
        f"- generatedAt: {datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"- backup: `{args.backup}`",
        f"- currentOhlcvDir: `{CURRENT_OHLCV_DIR}`",
        f"- ohlcvRawDir: `{OHLCV_RAW_DIR}`",
        f"- dryRunOnly: `{str(not args.apply).lower()}`",
        f"- apply: `{str(args.apply).lower()}`",
        f"- fixRaw: `{str(args.fix_raw).lower()}`",
        f"- backupMaxDate: `{BACKUP_MAX_DATE}`",
        f"- targetDate: `{target_date}` (derived from manifest.json)",
        "",
        "## Summary",
        "",
    ]
    summary_keys = [
        "targetDate",
        "targetCodes",
        "backupCodes",
        "currentCodes",
        "mergeableCodes",
        "backupHasBackupMaxDate",
        "currentHasTargetDate",
        "mergedHasBackupMaxDate",
        "mergedHasTargetDate",
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
        "appliedRawCodes",
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
            "- `merge_rows` preserves ALL current dates (no date is dropped).",
            "- This run did not restore `data/tickers` or `data/overview`.",
        ]
    )
    if args.fix_raw:
        lines.extend(
            [
                "- `--fix-raw` was used: backup-sourced (already adjusted) rows were written to `data/ohlcv_raw`.",
                "  Codes with corporate-action events may be double-adjusted on the next incremental update.",
                "  This is an acceptable trade-off to fix the 1052-day gap in `data/ohlcv_raw`.",
            ]
        )
    else:
        lines.append("- This run did NOT touch `data/ohlcv_raw` (use --fix-raw to also repair raw).")
    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    if args.fix_raw and not args.apply:
        print("WARNING: --fix-raw has no effect without --apply", file=sys.stderr)
    if not args.backup.exists():
        print(f"ERROR: backup not found: {args.backup}", file=sys.stderr)
        return 1

    target_date = resolve_target_date()
    stats, samples, repairs = analyze_backup(args, target_date)

    if args.apply:
        ohlcv_count, raw_count = apply_repairs(repairs, fix_raw=args.fix_raw)
        stats["appliedOhlcvCodes"] = ohlcv_count
        stats["appliedRawCodes"] = raw_count
        stats["touchedOhlcvRaw"] = raw_count > 0
        build_metrics, build_seconds = rebuild_public_json(target_date)
        stats["rebuiltPublicJson"] = True
        stats["publicJsonBuildSeconds"] = build_seconds
        stats["publicJsonBuild"] = build_metrics

    report = render_report(args, stats, samples, target_date)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report, encoding="utf-8")
    print(report)
    print(f"Wrote report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
