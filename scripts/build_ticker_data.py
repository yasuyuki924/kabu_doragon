#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import TICKERS_DIR, build_enriched_rows, load_ohlcv_rows, load_watchlist, parse_codes, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build per-ticker JSON files from local OHLCV CSVs")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of tickers for testing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    code_filter = set(parse_codes(args.codes) or [])
    watchlist = load_watchlist()
    items = watchlist
    if code_filter:
        items = [item for item in items if str(item.get("ticker")) in code_filter]
    if args.limit > 0:
        items = items[: args.limit]

    TICKERS_DIR.mkdir(parents=True, exist_ok=True)

    built = 0
    for item in items:
        code = str(item["ticker"])
        rows = load_ohlcv_rows(code)
        if not rows:
            continue
        payload = {
            "code": code,
            "name": item["name"],
            "market": item["market"],
            "sector": item.get("sector", ""),
            "industry": item.get("industry", ""),
            "tags": item.get("tags", []),
            "links": item.get("links", {}),
            "ohlcv": build_enriched_rows(rows),
        }
        write_json(TICKERS_DIR / f"{code}.json", payload)
        built += 1
        if built % 250 == 0:
            print(f"built {built} tickers")

    print(f"done: {built} tickers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

