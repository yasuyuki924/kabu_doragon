#!/usr/bin/env python3
"""Migrate an immutable public cache snapshot into a separate verified candidate."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.build_split_repair_candidate import digest, write_json, write_ticker_candidate
from scripts.check_ohlcv_integrity import check_ticker, REPRESENTATIVE_CODES
from scripts.check_split_adjustment import active_codes, check_dataset, event_digest, load_events, validate_rows
from scripts.repair_split_overviews import repair_overviews
from src.jquants_provider import apply_corporate_actions, read_ohlcv_rows, write_ohlcv_rows


def migrate_candidate(source: Path, inventory_root: Path, output: Path) -> dict:
    source, inventory_root, output = source.resolve(), inventory_root.resolve(), output.resolve()
    if output.exists() or output.is_relative_to(source) or source.is_relative_to(output):
        raise ValueError("migration output must be new and separate from the immutable source snapshot")
    codes = active_codes(source)
    if not codes:
        raise ValueError("snapshot has no active codes")
    inventory = json.loads((inventory_root / "action_inventory.json").read_text())
    if inventory.get("source") != "jquants-v2":
        raise ValueError("migration requires a completed official action inventory")
    manifest = json.loads((source / "manifest.json").read_text())
    for code in REPRESENTATIVE_CODES:
        result = check_ticker(code, manifest["latestDate"], source / "ohlcv_raw")
        if not result["ok"]:
            raise ValueError(f"{code}: raw integrity blocked migration: {result['issues']}")
    changed = {}
    for code in codes:
        raw = read_ohlcv_rows(source / "ohlcv_raw" / f"{code}.csv")
        validate_rows(code, raw)
        if raw[-1]["date"] > manifest["latestDate"]:
            raise ValueError("source snapshot is changing or ahead of its manifest")
        events = load_events(inventory_root / "corporate_actions" / f"{code}.json")
        coverage = inventory.get("coverage", {}).get(code, {})
        if (coverage.get("fromDate", "9999") > raw[0]["date"] or
                coverage.get("toDate", "") < raw[-1]["date"] or
                inventory.get("actionDigests", {}).get(code) != event_digest(events)):
            raise ValueError(f"{code}: incomplete/conflicting official action inventory")
        expected = apply_corporate_actions(raw, events)
        if expected != read_ohlcv_rows(source / "ohlcv" / f"{code}.csv"):
            changed[code] = expected
    # Copy a snapshot only after metadata coverage and representative raw checks pass.
    source_hashes = {str(path.relative_to(source)): digest(path) for path in source.rglob("*") if path.is_file()}
    size = sum((source / name).stat().st_size for name in source_hashes)
    output.parent.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(output.parent).free < size * 2 + 100_000_000:
        raise ValueError("insufficient space for the candidate and staged overview replacements")
    data = output / "data"
    shutil.copytree(source, data)
    for code in codes:
        target = data / "corporate_actions" / f"{code}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(inventory_root / "corporate_actions" / f"{code}.json", target)
    for code, rows in changed.items():
        write_ohlcv_rows(data / "ohlcv" / f"{code}.csv", rows)
    check_dataset(data, codes, official_inventory=inventory)
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    for code, rows in changed.items():
        write_ticker_candidate(data, code, rows, now)
    overview_metrics = repair_overviews(data, sorted(changed))
    state = check_dataset(data, codes, public=True, official_inventory=inventory)
    for name, old_digest in source_hashes.items():
        if digest(source / name) != old_digest:
            raise ValueError(f"immutable source changed during migration: {name}")
        if name.startswith("ohlcv_raw/") and digest(data / name) != old_digest:
            raise ValueError(f"raw history changed in candidate: {name}")
    # Certification is the last step; an interrupted candidate is never usable.
    write_json(data / "split_adjustment_state.json", state)
    report = {"status": "candidate_validated", "candidateOnly": True, "codeCount": len(codes),
              "changedCodes": sorted(changed), "overviews": overview_metrics,
              "sourceFilesUnchanged": len(source_hashes), "rawFilesByteIdentical": True,
              "officialActionCoverageVerified": True, "latestDate": manifest["latestDate"]}
    write_json(output / "migration_report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-data-dir", type=Path, required=True, help="Immutable extracted public cache, not a running local dataset")
    parser.add_argument("--inventory-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(migrate_candidate(args.source_data_dir, args.inventory_dir, args.output_dir)))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"[BLOCKED] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
