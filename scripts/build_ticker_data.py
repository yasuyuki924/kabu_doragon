#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import (
    TICKERS_DIR,
    apply_snapshot_row,
    apply_period_overview_metrics,
    build_daily_record,
    build_enriched_rows,
    build_wtd_mtd_bars,
    discover_available_dates,
    load_ohlcv_rows,
    load_ohlcv_rows_prefer_adjusted,
    load_snapshot_lookup,
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
    parser.add_argument("--cache-days", help="Comma separated trading dates to refresh in daily_records")
    parser.add_argument("--cache-recent-months", type=int, default=0, help="Refresh recent N calendar months in daily_records")
    parser.add_argument("--prefer-adjusted", action="store_true", help="Use data/ohlcv_adjusted when a per-code file exists")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    code_filter = set(parse_codes(args.codes) or [])
    update_state = load_update_state() if args.use_update_state else {}
    if args.use_update_state and not code_filter:
        code_filter = set(update_state.get("updatedCodes") or []) | set(update_state.get("adjustedCodes") or [])
    cache_dates = {str(item).strip() for item in update_state.get("updatedDates") or [] if str(item).strip()}
    cache_dates.update(str(item).strip() for item in (parse_codes(args.cache_days) or []) if str(item).strip())
    adjusted_date_from = str(update_state.get("adjustedDateFrom") or "").strip()
    watchlist = load_watchlist()
    snapshot_context = resolve_current_snapshot_context()
    snapshot_date = str(snapshot_context.get("date") or "").strip()
    snapshot_lookup = load_snapshot_lookup(str(snapshot_context.get("type") or "").strip(), snapshot_date) if snapshot_context.get("useSnapshot") else {}
    if adjusted_date_from:
        cache_dates.update(date_value for date_value in discover_available_dates() if date_value >= adjusted_date_from)
    if args.cache_recent_months > 0:
        cache_dates.update(discover_available_dates(args.cache_recent_months))
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
    date_updates_weekly: dict[str, dict[str, dict[str, object]]] = {f"{date_value}_weekly": {} for date_value in sorted(cache_dates)}
    date_updates_monthly: dict[str, dict[str, dict[str, object]]] = {f"{date_value}_monthly": {} for date_value in sorted(cache_dates)}
    for item in items:
        code = str(item["ticker"])
        rows = load_ohlcv_rows_prefer_adjusted(code) if args.prefer_adjusted else load_ohlcv_rows(code)
        if snapshot_lookup:
            rows = apply_snapshot_row(rows, code, {**snapshot_context, "lookup": snapshot_lookup})
        if not rows:
            continue
        wtd_rows, mtd_rows = build_wtd_mtd_bars(rows)
        enriched_rows = build_enriched_rows(rows)
        enriched_wtd_rows = apply_period_overview_metrics(build_enriched_rows(wtd_rows), enriched_rows, "weekly")
        enriched_mtd_rows = apply_period_overview_metrics(build_enriched_rows(mtd_rows), enriched_rows, "monthly")
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
            for i, row in enumerate(enriched_rows):
                date_value = str(row["date"])
                if date_value in date_updates:
                    date_updates[date_value][code] = build_daily_record(meta, row)
                    date_updates_weekly[f"{date_value}_weekly"][code] = build_daily_record(meta, enriched_wtd_rows[i])
                    date_updates_monthly[f"{date_value}_monthly"][code] = build_daily_record(meta, enriched_mtd_rows[i])
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

    for date_value, updates in date_updates_weekly.items():
        if updates:
            merge_daily_records(date_value, updates, None)
            
    for date_value, updates in date_updates_monthly.items():
        if updates:
            merge_daily_records(date_value, updates, None)

    print(f"done: {built} tickers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
