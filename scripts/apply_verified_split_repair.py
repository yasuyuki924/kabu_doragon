#!/usr/bin/env python3
"""Apply a bounded split repair without copying the all-market dataset."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.build_split_repair_candidate import write_json, write_ticker_candidate
from scripts.check_ohlcv_integrity import REPRESENTATIVE_CODES, check_ticker
from scripts.check_split_adjustment import check_dataset, event_digest, load_events, validate_rows
from scripts.export_public_cache_snapshot import digest
from scripts.repair_split_overviews import repair_overviews, restore_overviews
from src.jquants_provider import apply_corporate_actions, read_ohlcv_rows, write_ohlcv_rows


def check_integrity(data: Path, codes: list[str]) -> None:
    latest = json.loads((data / "manifest.json").read_text())["latestDate"]
    for code in sorted(set(codes) | set(REPRESENTATIVE_CODES)):
        raw = read_ohlcv_rows(data / "ohlcv_raw" / f"{code}.csv")
        validate_rows(code, raw)
        if len(raw) >= 200 or code in REPRESENTATIVE_CODES:
            result = check_ticker(code, latest, data / "ohlcv_raw")
            if not result["ok"]:
                raise ValueError(f"raw integrity failed: {code} {result['issues']}")
    for code in REPRESENTATIVE_CODES:
        result = check_ticker(code, latest, data / "ohlcv")
        if not result["ok"]:
            raise ValueError(f"adjusted representative integrity failed: {code}")


def repair(data: Path, scope: dict, journal: Path, *, inventory_root: Path | None = None,
           overview_only: bool = False, profile: str = "local") -> dict:
    data, journal = data.resolve(), journal.resolve()
    if journal.exists() or journal.is_relative_to(data):
        raise ValueError("repair journal must be new and outside data")
    codes = sorted(set(scope["codes"]))
    start = scope["effectiveDate"]
    check_integrity(data, codes)
    raw_hashes = {code: digest(data / "ohlcv_raw" / f"{code}.csv")
                  for code in sorted(set(codes) | set(REPRESENTATIVE_CODES))}
    baseline = {}
    inventory = None
    if overview_only:
        check_dataset(data, codes, public=True)
    else:
        if inventory_root is None:
            raise ValueError("price repair requires a completed official inventory")
        inventory = json.loads((inventory_root / "action_inventory.json").read_text())
        if inventory.get("source") != "jquants-v2":
            raise ValueError("inventory is not official J-Quants v2 metadata")
        for code in codes:
            raw = read_ohlcv_rows(data / "ohlcv_raw" / f"{code}.csv")
            events = load_events(inventory_root / "corporate_actions" / f"{code}.json")
            coverage = inventory.get("coverage", {}).get(code, {})
            if (coverage.get("fromDate", "9999") > raw[0]["date"] or
                    coverage.get("toDate", "") < raw[-1]["date"] or
                    inventory.get("actionDigests", {}).get(code) != event_digest(events) or
                    start not in {event["effectiveDate"] for event in events}):
                raise ValueError(f"incomplete/conflicting scoped official inventory: {code}")
            baseline[code] = apply_corporate_actions(raw, events)
    selected = []
    if not overview_only:
        for code in codes:
            for parent, suffix in (("ohlcv", ".csv"), ("corporate_actions", ".json"),
                                   ("public_json/ticker_recent/1y/ohlcv_ma", ".json"),
                                   ("public_json/ticker_detail_recent/1y", ".json")):
                selected.append(data / parent / f"{code}{suffix}")
        selected.append(data / "split_adjustment_state.json")
    backup_size = sum(path.stat().st_size for path in selected if path.exists())
    if backup_size > 100_000_000:
        raise ValueError(f"price-only rollback budget exceeded: {backup_size}")
    journal.mkdir(parents=True)
    old_files = {}
    for path in selected:
        name = str(path.relative_to(data))
        old_files[name] = path.exists()
        if path.exists():
            target = journal / "files" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
    write_json(journal / "files.json", old_files)
    overview_journal = journal / "overview_rollback.json"
    try:
        if not overview_only:
            for code in codes:
                target = data / "corporate_actions" / f"{code}.json"
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(inventory_root / "corporate_actions" / target.name, target)
                write_ohlcv_rows(data / "ohlcv" / f"{code}.csv", baseline[code])
            check_dataset(data, codes, official_inventory=inventory)
            now = datetime.now().astimezone().isoformat(timespec="seconds")
            for code in codes:
                write_ticker_candidate(data, code, baseline[code], now)
        overview = repair_overviews(data, codes, start_date=start, journal_dir=journal)
        state = check_dataset(data, codes, public=True, official_inventory=inventory)
        if not overview_only:
            state.update({"scope": "explicit-codes", "scopeCodes": codes, "repairEffectiveDate": start})
            write_json(data / "split_adjustment_state.json", state)
        check_integrity(data, codes)
        for code, expected in raw_hashes.items():
            if digest(data / "ohlcv_raw" / f"{code}.csv") != expected:
                raise ValueError(f"raw data changed during repair: {code}")
        subprocess.run([sys.executable, str(ROOT / "scripts/check_daily_update_result.py"),
                        "--data-dir", str(data), "--profile", profile], check=True)
        report = {"status": "verified", "profile": profile, "repairCodes": codes,
                  "latestDate": json.loads((data / "manifest.json").read_text())["latestDate"],
                  "rawFilesUnchanged": True, "preSplitOverviewFilesUnchanged": True,
                  "overview": overview, "rollbackPriceBytes": backup_size,
                  "temporaryBytesUpperBound": backup_size + overview["temporaryPeakBytesUpperBound"],
                  "overviewOnly": overview_only}
        write_json(journal / "repair_report.json", report)
        return report
    except BaseException:
        if overview_journal.exists():
            restore_overviews(overview_journal)
        for name, existed in old_files.items():
            path = data / name
            if existed:
                shutil.copy2(journal / "files" / name, path)
            else:
                path.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--scope-file", type=Path, required=True)
    parser.add_argument("--inventory-dir", type=Path)
    parser.add_argument("--journal-dir", type=Path, required=True)
    parser.add_argument("--profile", choices=("local", "public"), default="local")
    parser.add_argument("--overview-only", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    scope = json.loads(args.scope_file.read_text())
    if not args.apply:
        print(json.dumps({"mode": "plan", "codeCount": len(scope["codes"]),
                          "overviewFrom": scope["effectiveDate"], "copiesEntireDataset": False}))
        return 0
    try:
        print(json.dumps(repair(args.data_dir, scope, args.journal_dir,
                                inventory_root=args.inventory_dir, overview_only=args.overview_only,
                                profile=args.profile)))
        return 0
    except Exception as exc:
        print(f"[BLOCKED] {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
