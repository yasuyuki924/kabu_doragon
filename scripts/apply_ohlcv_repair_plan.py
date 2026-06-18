#!/usr/bin/env python3
"""Apply reviewed OHLCV repair candidates with backups.

Default mode is dry-run. Use --apply to write data/ohlcv and public_json files.
The script never touches data/ohlcv_raw.
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

import check_all_ohlcv_quality as quality


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OHLCV_DIR = ROOT / "data" / "ohlcv"
DEFAULT_PUBLIC_JSON_DIR = ROOT / "data" / "public_json" / "ticker_recent" / "1y" / "ohlcv_ma"
DEFAULT_REPORTS_DIR = ROOT / "reports"
DEFAULT_REPAIR_SOURCE_DIR = ROOT / "data" / "recheck_ohlcv_adjusted"
MA_WINDOWS = (5, 25, 75, 200)
OHLCV_FIELDS = ("date", "open", "high", "low", "close", "volume")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quality-report", type=Path, help="Quality report JSON to use as the repair plan source.")
    parser.add_argument("--repair-source-dir", type=Path, default=DEFAULT_REPAIR_SOURCE_DIR)
    parser.add_argument("--ohlcv-dir", type=Path, default=DEFAULT_OHLCV_DIR)
    parser.add_argument("--public-json-dir", type=Path, default=DEFAULT_PUBLIC_JSON_DIR)
    parser.add_argument("--reports-dir", type=Path, default=DEFAULT_REPORTS_DIR)
    parser.add_argument("--codes", default="", help="Optional comma-separated subset of codes to repair.")
    parser.add_argument("--apply", action="store_true", help="Write repaired files. Without this flag, only report.")
    parser.add_argument(
        "--keep-backups",
        action="store_true",
        help="Keep backup files after a successful apply. By default successful backups are deleted to avoid bloat.",
    )
    parser.add_argument("--recent-rows", type=int, default=245, help="Rows to keep in ticker_recent public_json.")
    return parser.parse_args()


def parse_codes(raw: str) -> set[str]:
    return {item.strip() for item in raw.split(",") if item.strip()}


def format_number(value: float) -> float | int:
    rounded = round(float(value), 4)
    return int(rounded) if rounded.is_integer() else rounded


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
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
                    "volume": int(float(row["volume"])),
                }
            )


def moving_average(values: list[float], index: int, window: int) -> float:
    subset = values[max(0, index - window + 1) : index + 1]
    return sum(subset) / len(subset)


def enrich_for_public_json(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    closes = [float(row["close"]) for row in rows]
    enriched = []
    for index, row in enumerate(rows):
        item = {
            "date": row["date"],
            "open": format_number(float(row["open"])),
            "high": format_number(float(row["high"])),
            "low": format_number(float(row["low"])),
            "close": format_number(float(row["close"])),
            "volume": int(float(row["volume"])),
        }
        for window in MA_WINDOWS:
            item[f"ma{window}"] = format_number(moving_average(closes, index, window))
        enriched.append(item)
    return enriched


def write_public_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"ohlcv": rows}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def merge_candidate_with_tail(
    candidate_rows: list[dict[str, Any]],
    current_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not candidate_rows:
        return current_rows
    candidate_last = str(candidate_rows[-1]["date"])
    tail = [row for row in current_rows if str(row.get("date") or "") > candidate_last]
    merged = [*candidate_rows, *tail]
    return sorted(merged, key=lambda row: str(row["date"]))


def backup_file(path: Path, backup_root: Path, label: str) -> str | None:
    if not path.exists():
        return None
    target = backup_root / label / path.name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
    return quality.compact_path(target)


def load_quality_report(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def latest_quality_report(reports_dir: Path) -> Path:
    candidates = sorted(reports_dir.glob("kabudragon_ohlcv_quality_*.json"))
    if not candidates:
        raise FileNotFoundError(f"quality report not found in {reports_dir}")
    return candidates[-1]


def plan_items_from_report(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item for item in (payload.get("repairPlan") or {}).get("items") or []
        if item.get("status") == "ready_for_dry_run_review"
    ]


def apply_or_plan(args: argparse.Namespace) -> dict[str, Any]:
    report_path = args.quality_report or latest_quality_report(args.reports_dir)
    report_payload = load_quality_report(report_path)
    selected_codes = parse_codes(args.codes)
    items = plan_items_from_report(report_payload)
    if selected_codes:
        items = [item for item in items if str(item.get("code")) in selected_codes]

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = args.reports_dir / f"ohlcv_repair_backup_{stamp}"
    repaired = []
    skipped = []

    for item in items:
        code = str(item.get("code") or "")
        source_path = args.repair_source_dir / f"{code}.csv"
        ohlcv_path = args.ohlcv_dir / f"{code}.csv"
        public_path = args.public_json_dir / f"{code}.json"
        if not source_path.exists() or not ohlcv_path.exists():
            skipped.append({"code": code, "reason": "missing source or current ohlcv"})
            continue
        candidate_rows = quality.read_csv_rows(source_path)
        current_rows = quality.read_csv_rows(ohlcv_path)
        public_rows = quality.read_public_json_rows(public_path) if public_path.exists() else []
        repaired_rows = merge_candidate_with_tail(candidate_rows, current_rows)
        enriched_rows = enrich_for_public_json(repaired_rows)
        recent_rows = enriched_rows[-args.recent_rows :]
        current_changes = quality.changed_dates(current_rows, repaired_rows)
        public_changes = quality.changed_dates(public_rows, recent_rows)
        backup = {}
        if args.apply:
            backup["ohlcv"] = backup_file(ohlcv_path, backup_root, "ohlcv")
            backup["publicJson"] = backup_file(public_path, backup_root, "public_json")
            write_csv(ohlcv_path, repaired_rows)
            write_public_json(public_path, recent_rows)
        repaired.append(
            {
                "code": code,
                "mode": "apply" if args.apply else "dry-run",
                "repairSource": quality.compact_path(source_path),
                "ohlcvPath": quality.compact_path(ohlcv_path),
                "publicJsonPath": quality.compact_path(public_path),
                "candidateRows": len(candidate_rows),
                "candidateStartDate": candidate_rows[0]["date"] if candidate_rows else None,
                "candidateEndDate": candidate_rows[-1]["date"] if candidate_rows else None,
                "tailRowsAfterCandidate": len(repaired_rows) - len(candidate_rows),
                "outputOhlcvRows": len(repaired_rows),
                "outputPublicRows": len(recent_rows),
                "currentChangedRows": len(current_changes),
                "publicChangedRows": len(public_changes),
                "sampleCurrentChanges": current_changes[:5],
                "samplePublicChanges": public_changes[:5],
                "backup": backup,
            }
        )

    metrics = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "mode": "apply" if args.apply else "dry-run",
        "qualityReport": quality.compact_path(report_path),
        "backupDir": quality.compact_path(backup_root) if args.apply else None,
        "backupDirDeleted": False,
        "backupPolicy": "keep" if args.keep_backups else "delete_after_success",
        "requestedCodes": sorted(selected_codes),
        "candidateCount": len(items),
        "repairedCount": len(repaired),
        "skippedCount": len(skipped),
        "repaired": repaired,
        "skipped": skipped,
    }
    if args.apply and not args.keep_backups and backup_root.exists():
        shutil.rmtree(backup_root)
        metrics["backupDirDeleted"] = True
    return metrics


def write_report(reports_dir: Path, metrics: dict[str, Any]) -> tuple[Path, Path]:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = reports_dir / f"kabudragon_ohlcv_repair_{stamp}.json"
    md_path = reports_dir / f"kabudragon_ohlcv_repair_{stamp}.md"
    reports_dir.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# KabuDragon OHLCV Repair Report",
        "",
        f"- generatedAt: {metrics['generatedAt']}",
        f"- mode: {metrics['mode']}",
        f"- qualityReport: `{metrics['qualityReport']}`",
        f"- backupDir: `{metrics['backupDir']}`",
        f"- backupPolicy: {metrics['backupPolicy']}",
        f"- backupDirDeleted: {metrics['backupDirDeleted']}",
        f"- candidateCount: {metrics['candidateCount']}",
        f"- repairedCount: {metrics['repairedCount']}",
        f"- skippedCount: {metrics['skippedCount']}",
        "",
        "## Repaired",
        "",
    ]
    for item in metrics["repaired"]:
        lines.append(
            f"- {item['code']}: currentChangedRows={item['currentChangedRows']} "
            f"publicChangedRows={item['publicChangedRows']} "
            f"candidate={item['candidateStartDate']}..{item['candidateEndDate']} "
            f"tail={item['tailRowsAfterCandidate']}"
        )
    if metrics["skipped"]:
        lines.extend(["", "## Skipped", ""])
        for item in metrics["skipped"]:
            lines.append(f"- {item['code']}: {item['reason']}")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path, md_path


def main() -> int:
    args = parse_args()
    metrics = apply_or_plan(args)
    json_path, md_path = write_report(args.reports_dir, metrics)
    print(
        "[apply_ohlcv_repair_plan] "
        f"mode={metrics['mode']} candidates={metrics['candidateCount']} "
        f"repaired={metrics['repairedCount']} skipped={metrics['skippedCount']}"
    )
    if metrics["backupDir"]:
        print(f"  backup_dir={metrics['backupDir']}")
    print(f"  report_json={quality.compact_path(json_path)}")
    print(f"  report_md={quality.compact_path(md_path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
