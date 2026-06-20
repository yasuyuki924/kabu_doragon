#!/usr/bin/env python3
"""Backfill strategy fields from daily overview_lite into weekly/monthly files."""

from __future__ import annotations

import argparse
import gzip
import json
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
OVERVIEW_LITE_DIR = ROOT / "data" / "public_json" / "overview_lite"

STRATEGY_KEYS = (
    "strategyMatches",
    "strategyScores",
    "strategyReasons",
    "strategyExcludedReasons",
    "strategyMetrics",
    "minerviniTrendTemplateCandidate",
    "stanWeinsteinStage2Candidate",
    "turtleDonchianBreakoutCandidate",
    "canSlimCandidate",
    "rsi2PullbackCandidate",
    "highPullback30",
    "highPullback30Candidate",
    "highPullback30DropRate",
    "highPullback30HighDate",
    "highPullback30LowDate",
    "highPullback30BarsToLow",
    "strongTrendPullbackRebound",
    "strongTrendPullbackReboundCandidate",
    "strongTrendPullbackReboundScore",
    "strongTrendPullbackReboundType",
    "strongTrendPullbackReboundLabel",
    "strongTrendPullbackReboundRisePct",
    "strongTrendPullbackReboundDropPct",
    "strongTrendPullbackReboundVolumeRatio20",
    "trendTurnCandidate",
    "trendTurnBreakoutDate",
    "trendTurnDaysAfterBreakout",
    "trendTurnRangePct",
    "trendTurnAboveMa75Ratio",
    "trendTurnScore",
    "trendTurnReason",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--overview-dir", default=str(OVERVIEW_LITE_DIR))
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        if path.name.endswith(".gz"):
            payload = json.loads(gzip.decompress(path.read_bytes()))
        else:
            payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def write_compact_json(path: Path, payload: dict[str, Any]) -> None:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if path.name.endswith(".gz"):
        path.write_bytes(gzip.compress(raw, compresslevel=9))
    else:
        path.write_bytes(raw)


def preferred_payload_path(date_dir: Path, filename: str) -> Path | None:
    gz_path = date_dir / f"{filename}.gz"
    if gz_path.exists():
        return gz_path
    json_path = date_dir / filename
    if json_path.exists():
        return json_path
    return None


def strategy_count(payload: dict[str, Any]) -> int:
    records = payload.get("records")
    if not isinstance(records, list):
        return 0
    return sum(1 for record in records if isinstance(record, dict) and record.get("strategyMatches"))


def backfill_file(period_path: Path, daily_by_code: dict[str, dict[str, Any]], *, dry_run: bool) -> dict[str, int | str]:
    payload = read_json(period_path)
    if not payload:
        return {"path": str(period_path), "records": 0, "patched": 0, "before": 0, "after": 0}
    records = payload.get("records")
    if not isinstance(records, list):
        return {"path": str(period_path), "records": 0, "patched": 0, "before": 0, "after": 0}

    before = strategy_count(payload)
    patched = 0
    for record in records:
        if not isinstance(record, dict):
            continue
        code = str(record.get("code") or "").strip()
        daily_record = daily_by_code.get(code)
        if not daily_record:
            continue
        changed = False
        for key in STRATEGY_KEYS:
            if key in daily_record and record.get(key) != daily_record.get(key):
                record[key] = daily_record.get(key)
                changed = True
        if changed:
            patched += 1

    after = strategy_count(payload)
    if patched:
        payload["strategyBackfilledAt"] = datetime.now().astimezone().isoformat(timespec="seconds")
        payload["strategyBackfilledFrom"] = "market_pulse.json"
        if not dry_run:
            write_compact_json(period_path, payload)
    return {"path": str(period_path), "records": len(records), "patched": patched, "before": before, "after": after}


def main() -> int:
    args = parse_args()
    overview_dir = Path(args.overview_dir)
    metrics = {
        "dates": 0,
        "periodFiles": 0,
        "patchedFiles": 0,
        "patchedRecords": 0,
        "strategyRowsBefore": 0,
        "strategyRowsAfter": 0,
        "missingDaily": 0,
    }

    for date_dir in sorted(path for path in overview_dir.iterdir() if path.is_dir()):
        daily_path = preferred_payload_path(date_dir, "market_pulse.json")
        daily_payload = read_json(daily_path) if daily_path else None
        if not daily_payload:
            metrics["missingDaily"] += 1
            continue
        daily_records = daily_payload.get("records")
        if not isinstance(daily_records, list):
            metrics["missingDaily"] += 1
            continue
        daily_by_code = {
            str(record.get("code") or "").strip(): record
            for record in daily_records
            if isinstance(record, dict) and str(record.get("code") or "").strip()
        }
        metrics["dates"] += 1
        for filename in ("market_pulse_weekly.json", "market_pulse_monthly.json"):
            period_path = preferred_payload_path(date_dir, filename)
            if not period_path:
                continue
            result = backfill_file(period_path, daily_by_code, dry_run=args.dry_run)
            metrics["periodFiles"] += 1
            metrics["patchedRecords"] += int(result["patched"])
            metrics["strategyRowsBefore"] += int(result["before"])
            metrics["strategyRowsAfter"] += int(result["after"])
            if int(result["patched"]):
                metrics["patchedFiles"] += 1

    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
