#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import RANKINGS_DIR, discover_available_dates, iter_ticker_payloads, parse_codes, select_dates, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build date-based ranking JSON files")
    parser.add_argument("--days", type=int, default=60, help="Recent trading dates to build")
    parser.add_argument("--limit", type=int, default=50, help="Rows per ranking")
    parser.add_argument("--end-date", help="Build until this date")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    return parser.parse_args()


def score_watch_candidate(record: dict[str, object]) -> float:
    change = max(float(record.get("changePercent") or 0), 0.0)
    distance = max(float(record.get("distanceToMa25") or 0), 0.0)
    volume_ratio = float(record.get("volumeRatio25") or 0)
    rci12 = max(float(record.get("rci12") or 0), 0.0)
    new_high_bonus = 4.0 if record.get("newHigh52w") else 0.0
    return change * 1.6 + distance * 0.9 + volume_ratio * 5.0 + (rci12 / 20.0) + new_high_bonus


def pick_top(records: list[dict[str, object]], key: str, reverse: bool, limit: int) -> list[dict[str, object]]:
    items = [record for record in records if record.get(key) is not None]
    items.sort(key=lambda item: float(item.get(key) or 0), reverse=reverse)
    return items[:limit]


def normalize_item(rank: int, record: dict[str, object]) -> dict[str, object]:
    return {
        "rank": rank,
        "code": record["code"],
        "name": record["name"],
        "market": record["market"],
        "sector": record["sector"],
        "industry": record["industry"],
        "tags": record.get("tags", []),
        "close": record.get("close"),
        "change": record.get("change"),
        "changePercent": record.get("changePercent"),
        "volume": record.get("volume"),
        "volumeRatio25": record.get("volumeRatio25"),
        "distanceToMa25": record.get("distanceToMa25"),
        "distanceToMa75": record.get("distanceToMa75"),
        "distanceToMa200": record.get("distanceToMa200"),
        "rci12": record.get("rci12"),
        "rci24": record.get("rci24"),
        "rci48": record.get("rci48"),
        "rangePosition52w": record.get("rangePosition52w"),
        "newHigh52w": record.get("newHigh52w"),
        "links": record.get("links", {}),
    }


def build_ranking_payload(date_value: str, name: str, items: list[dict[str, object]]) -> dict[str, object]:
    return {
        "date": date_value,
        "ranking": name,
        "count": len(items),
        "items": [normalize_item(index + 1, record) for index, record in enumerate(items)],
    }


def main() -> int:
    args = parse_args()
    codes = parse_codes(args.codes)
    all_dates = discover_available_dates()
    selected_dates = select_dates(all_dates, args.days, args.end_date)
    selected_date_set = set(selected_dates)
    payloads = iter_ticker_payloads(codes)

    per_date: dict[str, list[dict[str, object]]] = {date_value: [] for date_value in selected_dates}
    for payload in payloads:
        meta = {
            "code": payload["code"],
            "name": payload["name"],
            "market": payload["market"],
            "sector": payload.get("sector", ""),
            "industry": payload.get("industry", ""),
            "tags": payload.get("tags", []),
            "links": payload.get("links", {}),
        }
        for row in payload.get("ohlcv", []):
            date_value = str(row["date"])
            if date_value not in selected_date_set:
                continue
            per_date[date_value].append({**meta, **row})

    for date_value in selected_dates:
        records = per_date[date_value]
        gainers = pick_top(records, "changePercent", True, args.limit)
        losers = pick_top(records, "changePercent", False, args.limit)
        volume_spike = pick_top(records, "volumeRatio25", True, args.limit)
        new_high = [record for record in records if record.get("newHigh52w")]
        new_high.sort(
            key=lambda item: (
                float(item.get("changePercent") or 0),
                float(item.get("distanceToMa25") or 0),
                float(item.get("close") or 0),
            ),
            reverse=True,
        )
        new_high = new_high[: args.limit]
        deviation25 = pick_top(records, "distanceToMa25", True, args.limit)
        watch_candidates = sorted(records, key=score_watch_candidate, reverse=True)[: args.limit]

        output_dir = RANKINGS_DIR / date_value
        write_json(output_dir / "gainers.json", build_ranking_payload(date_value, "値上がり率", gainers))
        write_json(output_dir / "losers.json", build_ranking_payload(date_value, "値下がり率", losers))
        write_json(output_dir / "volume_spike.json", build_ranking_payload(date_value, "出来高増加", volume_spike))
        write_json(output_dir / "new_high.json", build_ranking_payload(date_value, "新高値", new_high))
        write_json(output_dir / "deviation25.json", build_ranking_payload(date_value, "25日線乖離", deviation25))
        write_json(
            output_dir / "watch_candidates.json",
            build_ranking_payload(date_value, "監視候補", watch_candidates),
        )
        print(f"built rankings: {date_value} ({len(records)} records)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

