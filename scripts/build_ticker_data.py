#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import (
    TICKERS_DIR,
    apply_snapshot_row,
    build_daily_record,
    build_enriched_rows,
    load_am_snapshot_lookup,
    load_ohlcv_rows,
    load_update_state,
    load_watchlist,
    merge_daily_records,
    parse_codes,
    resolve_current_snapshot_context,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build per-ticker JSON files from local OHLCV CSVs")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of tickers for testing")
    parser.add_argument("--use-update-state", action="store_true", help="Build only codes from data/update_state.json")
    parser.add_argument("--all", action="store_true", help="Build all ticker payloads")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    code_filter = set(parse_codes(args.codes) or [])
    update_state = load_update_state() if args.use_update_state else {}
    if args.use_update_state and not code_filter:
        code_filter = set(update_state.get("updatedCodes") or [])
    cache_dates = {str(item).strip() for item in update_state.get("updatedDates") or [] if str(item).strip()}
    watchlist = load_watchlist()
    snapshot_context = resolve_current_snapshot_context()
    snapshot_date = str(snapshot_context.get("date") or "").strip()
    snapshot_lookup = load_am_snapshot_lookup(snapshot_date) if snapshot_context.get("useAmSnapshot") else {}
    items = watchlist
    if code_filter:
        items = [item for item in items if str(item.get("ticker")) in code_filter]
    elif args.use_update_state:
        items = []
    elif not args.all and not args.use_update_state:
        items = watchlist
    if args.limit > 0:
        items = items[: args.limit]

    TICKERS_DIR.mkdir(parents=True, exist_ok=True)

    built = 0
    date_updates: dict[str, dict[str, dict[str, object]]] = {date_value: {} for date_value in sorted(cache_dates)}
    for item in items:
        code = str(item["ticker"])
        rows = load_ohlcv_rows(code)
        if snapshot_lookup:
            rows = apply_snapshot_row(rows, code, {**snapshot_context, "lookup": snapshot_lookup})
        if not rows:
            continue
        enriched_rows = build_enriched_rows(rows)
        payload_snapshot_type = None
        payload_snapshot_date = None
        if snapshot_date and any(str(row["date"]) == snapshot_date for row in rows) and snapshot_context.get("type"):
            payload_snapshot_type = snapshot_context.get("type")
            payload_snapshot_date = snapshot_date
        meta = {
            "code": code,
            "name": item["name"],
            "market": item["market"],
            "sector": item.get("sector", ""),
            "industry": item.get("industry", ""),
            "themes": item.get("themes", []),
            "tags": item.get("tags", []),
            "links": item.get("links", {}),
        }
        payload = {
            **meta,
            "snapshotType": payload_snapshot_type,
            "snapshotDate": payload_snapshot_date,
            "ohlcv": enriched_rows,
        }
        write_json(TICKERS_DIR / f"{code}.json", payload)
        if cache_dates:
            for row in enriched_rows:
                date_value = str(row["date"])
                if date_value in date_updates:
                    date_updates[date_value][code] = build_daily_record(meta, row)
        built += 1
        if built % 250 == 0:
            print(f"built {built} tickers")

    for date_value, updates in date_updates.items():
        merge_daily_records(
            date_value,
            updates,
            snapshot_context.get("type") if date_value == snapshot_date else None,
        )
        print(f"updated daily cache: {date_value} ({len(updates)} records)")

    print(f"done: {built} tickers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
