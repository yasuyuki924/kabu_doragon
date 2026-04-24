#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from common import load_watchlist, write_json
from src.app.shared_view_data import load_records_by_date

FAIL_EXIT_CODE = 20


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check data completeness for a specific trading date")
    parser.add_argument("--date", required=True, help="Target trading date (YYYY-MM-DD)")
    parser.add_argument("--codes", help="Comma separated ticker codes to scope the check")
    parser.add_argument("--min-match-ratio", type=float, default=0.98)
    parser.add_argument("--max-stale-count", type=int, default=0)
    parser.add_argument("--json-path", default="data/update_quality_gate.json")
    return parser.parse_args()


def _parse_codes(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    values = [item.strip() for item in raw.split(",") if item.strip()]
    return values or None


def _reason_codes(record: dict[str, object]) -> set[str]:
    data_quality = record.get("dataQuality")
    if not isinstance(data_quality, dict):
        return set()
    raw_codes = data_quality.get("reasonCodes")
    if not isinstance(raw_codes, list):
        return set()
    return {str(item).strip() for item in raw_codes if str(item).strip()}


def _is_fresh(record: dict[str, object], target_date: str) -> bool:
    if str(record.get("date") or "").strip() != target_date:
        return False
    reason_codes = _reason_codes(record)
    return "NO_OHLCV" not in reason_codes and "STALE_ND" not in reason_codes


def main() -> int:
    args = parse_args()
    target_date = str(args.date).strip()
    codes = _parse_codes(args.codes)

    per_date = load_records_by_date([target_date], codes)
    records = list(per_date.get(target_date) or [])

    stale_count = 0
    empty_count = 0
    matched_count = 0
    for record in records:
        reason_codes = _reason_codes(record)
        if "NO_OHLCV" in reason_codes:
            empty_count += 1
            continue
        if _is_fresh(record, target_date):
            matched_count += 1
            continue
        stale_count += 1

    if codes:
        total_universe = len(codes)
    else:
        total_universe = len(load_watchlist())
    if total_universe <= 0:
        total_universe = len(records)

    match_ratio = (matched_count / total_universe) if total_universe > 0 else 0.0
    pass_ratio = match_ratio >= float(args.min_match_ratio)
    pass_stale = stale_count <= int(args.max_stale_count)
    gate_passed = bool(pass_ratio and pass_stale)

    payload = {
        "checkedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "targetDate": target_date,
        "totalUniverseCount": total_universe,
        "matchedCount": matched_count,
        "staleCount": stale_count,
        "noOhlcvCount": empty_count,
        "matchRatio": round(match_ratio, 6),
        "thresholds": {
            "minMatchRatio": float(args.min_match_ratio),
            "maxStaleCount": int(args.max_stale_count),
        },
        "passed": gate_passed,
    }

    json_path = Path(args.json_path)
    if not json_path.is_absolute():
        json_path = Path(__file__).resolve().parent.parent / json_path
    write_json(json_path, payload)

    status = "PASS" if gate_passed else "FAIL"
    print(
        f"{status}: date={target_date} matched={matched_count}/{total_universe} "
        f"stale={stale_count} no_ohlcv={empty_count} ratio={match_ratio:.5f}"
    )

    return 0 if gate_passed else FAIL_EXIT_CODE


if __name__ == "__main__":
    raise SystemExit(main())
