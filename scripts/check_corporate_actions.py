#!/usr/bin/env python3
"""Detect J-Quants split/reverse-split action factors before KabuDragon rebuilds."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.data_source.local_data import load_watchlist  # noqa: E402
DEFAULT_ACTIONS_DIR = ROOT / "data" / "corporate_actions"
DEFAULT_OHLCV_DIR = ROOT / "data" / "ohlcv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codes", help="Comma separated codes. Default is the current watchlist.")
    parser.add_argument("--from-date", dest="from_date", help="ISO date. Defaults to yesterday.")
    parser.add_argument("--to-date", dest="to_date", help="ISO date. Defaults to today.")
    parser.add_argument("--actions-dir", type=Path, default=DEFAULT_ACTIONS_DIR)
    parser.add_argument("--fetch", action="store_true", help="Call J-Quants. Default is a plan-only dry-run.")
    parser.add_argument(
        "--write",
        action="store_true",
        help="Merge event-only JSON under data/corporate_actions. Requires --fetch.",
    )
    return parser.parse_args()


def parse_codes(raw: str | None) -> list[str]:
    if raw:
        return sorted({item.strip().upper() for item in raw.split(",") if item.strip()})
    try:
        codes = {str(item.get("ticker") or "").strip() for item in load_watchlist() if str(item.get("ticker") or "").strip()}
    except FileNotFoundError:
        codes = {path.stem for path in DEFAULT_OHLCV_DIR.glob("*.csv")}
    return sorted(codes)


def action_range(args: argparse.Namespace) -> tuple[date, date]:
    today = date.today()
    from_date = datetime.strptime(args.from_date, "%Y-%m-%d").date() if args.from_date else today - timedelta(days=1)
    to_date = datetime.strptime(args.to_date, "%Y-%m-%d").date() if args.to_date else today
    if from_date > to_date:
        raise ValueError("from-date must be on or before to-date")
    return from_date, to_date


def merge_events_by_code(events_by_code: dict[str, list[dict[str, Any]]], code: str, events: list[dict[str, Any]]) -> None:
    from src.jquants_provider import merge_corporate_action_events

    if not events:
        return
    events_by_code[code] = merge_corporate_action_events(events_by_code.get(code, []), events)


def main() -> int:
    args = parse_args()
    codes = parse_codes(args.codes)
    from_date, to_date = action_range(args)
    metrics: dict[str, Any] = {
        "mode": "write" if args.write else "fetch" if args.fetch else "dry-run",
        "range": {"fromDate": from_date.isoformat(), "toDate": to_date.isoformat()},
        "codeCount": len(codes),
        "actionsDir": str(args.actions_dir),
        "preventionFlow": [
            "fetch recent bars before price-publication rebuild",
            "extract AdjFactor != 1 events",
            "save event-only corporate_actions files",
            "mark event codes for adjusted OHLCV and downstream rebuild",
        ],
    }
    if args.write and not args.fetch:
        raise SystemExit("--write requires --fetch")
    if not args.fetch:
        print(json.dumps(metrics, ensure_ascii=False, indent=2))
        return 0

    from src.jquants_provider import (
        build_client,
        fetch_bars_frame,
        frame_to_corporate_action_events,
        load_auth_config,
        merge_corporate_action_events,
        read_corporate_action_events,
        write_corporate_action_events,
    )

    config = load_auth_config(ROOT)
    client, api_version = build_client(config)
    detected: dict[str, list[dict[str, Any]]] = {}
    for code in codes:
        frame = fetch_bars_frame(client, api_version, code=code, from_date=from_date, to_date=to_date)
        merge_events_by_code(detected, code, frame_to_corporate_action_events(frame, api_version).get(code, []))

    writes: list[dict[str, Any]] = []
    for code, new_events in sorted(detected.items()):
        path = args.actions_dir / f"{code}.json"
        existing = read_corporate_action_events(path)
        merged = merge_corporate_action_events(existing, new_events)
        if args.write and merged != existing:
            write_corporate_action_events(path, code=code, events=merged)
        writes.append(
            {
                "code": code,
                "detectedEvents": new_events,
                "existingEventCount": len(existing),
                "mergedEventCount": len(merged),
                "wouldWrite": merged != existing,
            }
        )
    metrics["apiVersion"] = api_version
    metrics["detectedCodeCount"] = len(detected)
    metrics["events"] = writes
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
