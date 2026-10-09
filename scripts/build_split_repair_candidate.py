#!/usr/bin/env python3
"""Build a bounded, isolated repair candidate without changing source data."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.check_ohlcv_integrity import check_ticker
from scripts.check_split_adjustment import check_dataset, check_raw_events, load_events, validate_rows
from scripts.incremental_jquants_update import DETAIL_ROW_KEYS, OHLCV_KEYS, format_number
from scripts.repair_split_overviews import repair_overviews
from src.indicators.core import build_enriched_rows
from src.jquants_provider import apply_corporate_actions, read_ohlcv_rows, write_ohlcv_rows


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def write_ticker_candidate(data: Path, code: str, adjusted: list[dict], updated_at: str) -> None:
    enriched = build_enriched_rows(adjusted)[-245:]
    chart = [{key: int(row[key]) if key == "volume" else row[key] if key == "date"
              else format_number(row.get(key)) for key in OHLCV_KEYS} for row in enriched]
    write_json(data / "public_json/ticker_recent/1y/ohlcv_ma" / f"{code}.json", {"ohlcv": chart})
    details = [{key: row.get(key) for key in DETAIL_ROW_KEYS if key in row} for row in enriched]
    write_json(data / "public_json/ticker_detail_recent/1y" / f"{code}.json", {
        "code": code, "range": "1y", "updatedAt": updated_at,
        "startDate": details[0]["date"], "endDate": details[-1]["date"], "rows": details,
    })


def build_candidate(source: Path, actions_dir: Path, output: Path, codes: list[str],
                    overview_dates: list[str]) -> dict:
    source, actions_dir, output = source.resolve(), actions_dir.resolve(), output.resolve()
    if output.exists() or output.is_relative_to(source) or source.is_relative_to(output):
        raise ValueError("candidate output must be new and separate from source data")
    manifest = json.loads((source / "manifest.json").read_text())
    latest = manifest["latestDate"]
    source_hashes = {}
    prepared = {}
    for code in sorted(set(codes)):
        raw_path = source / "ohlcv_raw" / f"{code}.csv"
        action_path = actions_dir / f"{code}.json"
        raw = read_ohlcv_rows(raw_path)
        validate_rows(code, raw)
        # New listings may have short history; date gaps still block this repair.
        if len(raw) >= 200:
            integrity = check_ticker(code, latest, source / "ohlcv_raw")
            if not integrity["ok"]:
                raise ValueError(f"{code}: raw integrity failed: {integrity['issues']}")
        events = load_events(action_path)
        check_raw_events(code, raw, events)
        adjusted = apply_corporate_actions(raw, events)
        meta_path = source / "public_json/ticker_meta" / f"{code}.json"
        meta = json.loads(meta_path.read_text())
        if raw[-1]["date"] != latest:
            raise ValueError(f"{code}: raw last date differs from manifest")
        prepared[code] = (raw, adjusted, events, meta)
        for path in (raw_path, meta_path, action_path):
            if path.exists():
                source_hashes[str(path)] = digest(path)
    output.mkdir(parents=True)
    data = output / "data"
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    for code, (raw, adjusted, events, meta) in prepared.items():
        write_ohlcv_rows(data / "ohlcv_raw" / f"{code}.csv", raw)
        write_ohlcv_rows(data / "ohlcv" / f"{code}.csv", adjusted)
        write_json(data / "corporate_actions" / f"{code}.json", {"code": code, "events": events})
        write_json(data / "public_json/ticker_meta" / f"{code}.json", meta)
    # Every raw/adjusted candidate must pass before any chart is generated.
    check_dataset(data, sorted(prepared))
    for code, (_, adjusted, _, _) in prepared.items():
        write_ticker_candidate(data, code, adjusted, now)
    copied = []
    for day in overview_dates:
        for filename in ("market_pulse.json", "market_pulse_weekly.json", "market_pulse_monthly.json"):
            original = source / "public_json/overview_lite" / day / filename
            if not original.exists():
                raise ValueError(f"missing source overview: {original}")
            target = data / original.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(original, target)
            source_hashes[str(original)] = digest(original)
            copied.append((original, target))
    metrics = repair_overviews(data, sorted(prepared))
    codes_set = set(prepared)
    for original, target in copied:
        before, after = json.loads(original.read_text()), json.loads(target.read_text())
        untouched_before = [record for record in before["records"] if str(record.get("code")) not in codes_set]
        untouched_after = [record for record in after["records"] if str(record.get("code")) not in codes_set]
        if untouched_before != untouched_after:
            raise ValueError(f"unrelated overview records changed: {original}")
    check_dataset(data, sorted(prepared), public=True)
    for path, expected in source_hashes.items():
        if digest(Path(path)) != expected:
            raise ValueError(f"source changed during candidate build: {path}")
    write_json(data / "manifest.json", manifest)
    for filename in ("update_health.json", "update_summary.json", "jquants_sync_state.json"):
        path = source / filename
        if path.exists():
            shutil.copy2(path, data / filename)
    write_json(data / "public_json/overview_lite/index.json", {
        "generatedAt": now, "daily": overview_dates, "weekly": overview_dates, "monthly": overview_dates,
    })
    report = {
        "status": "candidate_validated", "candidateOnly": True, "latestDate": latest,
        "codes": sorted(prepared), "overviewDates": overview_dates, "overviews": metrics,
        "sourceFilesUnchanged": len(source_hashes), "actionSource": str(actions_dir),
        "limitation": "Existing local action metadata; official revalidation and full cache migration required before publication.",
    }
    write_json(output / "candidate_report.json", report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-data-dir", required=True, type=Path)
    parser.add_argument("--actions-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--codes", required=True)
    parser.add_argument("--overview-dates", default="", help="Comma-separated retained dates for a bounded rehearsal")
    args = parser.parse_args()
    try:
        report = build_candidate(args.source_data_dir, args.actions_dir, args.output_dir,
                                 [value.strip().upper() for value in args.codes.split(",") if value.strip()],
                                 [value.strip() for value in args.overview_dates.split(",") if value.strip()])
        print(json.dumps(report, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"[BLOCKED] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
