#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime
from numbers import Real

from common import MANIFEST_JSON, OVERVIEW_DIR, UPDATE_SUMMARY_JSON, load_json_dict, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate data/update_summary.json from the latest overview.")
    parser.add_argument("--date", help="Target date. Defaults to manifest.latestDate")
    parser.add_argument("--top-failures", type=int, default=20, help="Max number of failure rows")
    parser.add_argument("--retry-attempts", type=int, default=0, help="Retry attempts")
    parser.add_argument("--retry-improved", type=int, default=0, help="Improved symbols after retry")
    parser.add_argument("--retry-remaining", type=int, default=0, help="Remaining symbols after retry")
    return parser.parse_args()


def compute_data_quality_summary(records: list[dict[str, object]], stale_tolerance_days: int) -> dict[str, int]:
    matched_count = 0
    stale_count = 0
    empty_count = 0
    stale_1d_count = 0
    stale_2p_count = 0
    for record in records:
        quality = record.get("dataQuality") if isinstance(record, dict) else None
        quality = quality if isinstance(quality, dict) else {}
        reasons = quality.get("reasonCodes")
        reason_codes = {str(item) for item in reasons} if isinstance(reasons, list) else set()
        stale_days = quality.get("staleBusinessDays")
        stale_days = int(stale_days) if isinstance(stale_days, Real) and stale_days >= 0 else 0
        if "NO_OHLCV" in reason_codes:
            empty_count += 1
            continue
        if "STALE_ND" in reason_codes and stale_days > stale_tolerance_days:
            stale_count += 1
            if stale_days == 1:
                stale_1d_count += 1
            elif stale_days >= 2:
                stale_2p_count += 1
            continue
        matched_count += 1
    return {
        "matchedCount": matched_count,
        "staleCount": stale_count,
        "emptyCount": empty_count,
        "stale1dCount": stale_1d_count,
        "stale2pCount": stale_2p_count,
    }


def build_top_failures(records: list[dict[str, object]], limit: int) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for record in records:
        code = str(record.get("code") or "").strip()
        if not code:
            continue
        quality = record.get("dataQuality") if isinstance(record, dict) else None
        quality = quality if isinstance(quality, dict) else {}
        reasons = quality.get("reasonCodes")
        reason_codes = [str(item) for item in reasons] if isinstance(reasons, list) else []
        stale_days = quality.get("staleBusinessDays")
        stale_days = int(stale_days) if isinstance(stale_days, Real) and stale_days >= 0 else 0
        for reason in reason_codes:
            rows.append(
                {
                    "code": code,
                    "reason": reason,
                    "staleBusinessDays": stale_days if reason == "STALE_ND" else None,
                }
            )
    priority_map = {
        "FETCH_FAIL": 0,
        "PARSE_FAIL": 1,
        "NO_OHLCV": 2,
        "STALE_ND": 3,
    }
    rows.sort(
        key=lambda item: (
            priority_map.get(str(item.get("reason") or ""), 99),
            -(int(item.get("staleBusinessDays") or 0)),
            str(item.get("code") or ""),
        )
    )
    return rows[: max(0, limit)]


def main() -> int:
    args = parse_args()
    manifest = load_json_dict(MANIFEST_JSON)
    selected_date = str(args.date or manifest.get("latestDate") or "").strip()
    if not selected_date:
        write_json(
            UPDATE_SUMMARY_JSON,
            {
                "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
                "date": None,
                "totalSymbols": 0,
                "inactiveCount": 0,
                "inactiveCodesSample": [],
                "matchedCount": 0,
                "staleCount": 0,
                "stale1dCount": 0,
                "stale2pCount": 0,
                "emptyCount": 0,
                "topFailures": [],
                "retry": {
                    "attempts": int(args.retry_attempts),
                    "improvedCount": int(args.retry_improved),
                    "remainingCount": int(args.retry_remaining),
                },
            },
        )
        return 0

    overview = load_json_dict(OVERVIEW_DIR / selected_date / "market_pulse.json")
    records = overview.get("records")
    records = records if isinstance(records, list) else []
    stale_tolerance = int(overview.get("staleToleranceBusinessDays") or 1)
    summary = overview.get("dataQualitySummary")
    if not isinstance(summary, dict):
        summary = compute_data_quality_summary([item for item in records if isinstance(item, dict)], stale_tolerance)
    payload = {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "date": selected_date,
        "totalSymbols": int(overview.get("activeUniverseCount") or overview.get("totalUniverseCount") or len(records)),
        "inactiveCount": int((overview.get("inactiveSummary") or {}).get("count") or 0),
        "inactiveCodesSample": list(((overview.get("inactiveSummary") or {}).get("codes") or [])[:10]),
        "matchedCount": int(summary.get("matchedCount") or 0),
        "staleCount": int(summary.get("staleCount") or 0),
        "stale1dCount": int(summary.get("stale1dCount") or 0),
        "stale2pCount": int(summary.get("stale2pCount") or 0),
        "emptyCount": int(summary.get("emptyCount") or 0),
        "topFailures": build_top_failures([item for item in records if isinstance(item, dict)], args.top_failures),
        "retry": {
            "attempts": int(args.retry_attempts),
            "improvedCount": int(args.retry_improved),
            "remainingCount": int(args.retry_remaining),
        },
    }
    write_json(UPDATE_SUMMARY_JSON, payload)
    print(f"wrote update summary: {UPDATE_SUMMARY_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
