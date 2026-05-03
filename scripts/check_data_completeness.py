#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import sys

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.app.shared_view_data import load_records_by_date  # noqa: E402
from src.app.shared_view_data import load_inactive_summary  # noqa: E402
from src.common.paths import MANIFEST_JSON  # noqa: E402
from src.common.io import load_json_dict  # noqa: E402

EXIT_OK = 0
EXIT_FAIL = 20


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check latest-date completeness for quality gate")
    parser.add_argument("--date", default="", help="Target date. Defaults to manifest.latestDate")
    parser.add_argument("--min-match-ratio", type=float, default=0.98)
    parser.add_argument("--min-match-count", type=int, default=0)
    parser.add_argument("--max-stale-count", type=int, default=0)
    parser.add_argument("--json-path", default="data/update_quality_gate.json")
    return parser.parse_args()


def select_target_date(raw_date: str) -> str:
    if str(raw_date or "").strip():
        return str(raw_date).strip()
    manifest = load_json_dict(MANIFEST_JSON)
    return str(manifest.get("latestDate") or "").strip()


def summarize(selected_date: str) -> dict[str, object]:
    records = load_records_by_date([selected_date]).get(selected_date, []) if selected_date else []
    inactive_summary = load_inactive_summary(selected_date) if selected_date else {"count": 0}
    total = len(records)
    matched = 0
    stale = 0
    empty = 0
    for record in records:
        quality = record.get("dataQuality") if isinstance(record, dict) else None
        quality = quality if isinstance(quality, dict) else {}
        reasons = quality.get("reasonCodes")
        reason_codes = {str(item).strip() for item in reasons} if isinstance(reasons, list) else set()
        row_date = str(record.get("date") or "").strip()
        if "NO_OHLCV" in reason_codes:
            empty += 1
            continue
        if "STALE_ND" in reason_codes or row_date != selected_date:
            stale += 1
            continue
        matched += 1
    ratio = (matched / total) if total > 0 else 0.0
    return {
        "date": selected_date,
        "totalCount": total,
        "activeCount": total,
        "inactiveCount": int(inactive_summary.get("count") or 0),
        "matchedCount": matched,
        "staleCount": stale,
        "emptyCount": empty,
        "matchRatio": round(ratio, 6),
    }


def main() -> int:
    args = parse_args()
    target_date = select_target_date(args.date)
    payload = summarize(target_date)
    passed = (
        bool(target_date)
        and payload["totalCount"] > 0
        and payload["matchedCount"] >= args.min_match_count
        and payload["staleCount"] <= args.max_stale_count
        and float(payload["matchRatio"]) >= float(args.min_match_ratio)
    )
    output = {
        "checkedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "passed": passed,
        "thresholds": {
            "minMatchRatio": args.min_match_ratio,
            "minMatchCount": args.min_match_count,
            "maxStaleCount": args.max_stale_count,
        },
        "summary": payload,
    }
    out_path = (ROOT / args.json_path).resolve() if not Path(args.json_path).is_absolute() else Path(args.json_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        "quality-gate "
        f"status={'PASS' if passed else 'FAIL'} "
        f"date={payload['date'] or '-'} "
        f"matched={payload['matchedCount']}/{payload['totalCount']} "
        f"stale={payload['staleCount']} empty={payload['emptyCount']} "
        f"ratio={payload['matchRatio']:.4f}"
    )
    print(json.dumps(output, ensure_ascii=False))
    return EXIT_OK if passed else EXIT_FAIL


if __name__ == "__main__":
    raise SystemExit(main())
