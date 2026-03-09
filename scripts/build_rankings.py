#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import (
    RANKINGS_DIR,
    discover_available_dates,
    load_daily_records,
    iter_ticker_payloads,
    load_update_state,
    parse_codes,
    select_dates,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build date-based ranking JSON files")
    parser.add_argument("--days", type=int, default=60, help="Recent trading dates to build")
    parser.add_argument("--limit", type=int, default=50, help="Rows per ranking")
    parser.add_argument("--end-date", help="Build until this date")
    parser.add_argument("--from-date", help="Build from this date forward")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--dates", help="Comma separated trading dates to build")
    return parser.parse_args()


def score_watch_candidate(record: dict[str, object]) -> float:
    change = max(float(record.get("changePercent") or 0), 0.0)
    distance = max(float(record.get("distanceToMa25") or 0), 0.0)
    volume_ratio = float(record.get("volumeRatio25") or 0)
    rci12 = max(float(record.get("rci12") or 0), 0.0)
    new_high_bonus = 4.0 if record.get("newHigh52w") else 0.0
    return change * 1.6 + distance * 0.9 + volume_ratio * 5.0 + (rci12 / 20.0) + new_high_bonus


def compute_lower_shadow_metrics(record: dict[str, object]) -> dict[str, object] | None:
    open_price = record.get("open")
    high_price = record.get("high")
    low_price = record.get("low")
    close_price = record.get("close")
    if any(value is None for value in [open_price, high_price, low_price, close_price]):
        return {
            "body": None,
            "lowerShadow": None,
            "upperShadow": None,
            "range": None,
            "lowerShadowRatio": None,
            "isLowerShadow": False,
            "shadowStrength": "none",
            "reason": "missing OHLC",
            "strengthPriority": 3,
        }

    open_value = float(open_price)
    high_value = float(high_price)
    low_value = float(low_price)
    close_value = float(close_price)
    price_range = high_value - low_value
    if price_range <= 0:
        return {
            "body": round(abs(close_value - open_value), 6),
            "lowerShadow": round(min(open_value, close_value) - low_value, 6),
            "upperShadow": round(high_value - max(open_value, close_value), 6),
            "range": round(price_range, 6),
            "lowerShadowRatio": None,
            "isLowerShadow": False,
            "shadowStrength": "none",
            "reason": "range is zero",
            "strengthPriority": 3,
        }

    body_size = abs(close_value - open_value)
    body_high = max(open_value, close_value)
    body_low = min(open_value, close_value)
    lower_shadow = body_low - low_value
    upper_shadow = high_value - body_high
    lower_shadow_ratio = lower_shadow / price_range
    if lower_shadow <= 0:
        return {
            "body": round(body_size, 6),
            "lowerShadow": round(lower_shadow, 6),
            "upperShadow": round(upper_shadow, 6),
            "range": round(price_range, 6),
            "lowerShadowRatio": round(lower_shadow_ratio, 6),
            "isLowerShadow": False,
            "shadowStrength": "none",
            "reason": "no lower shadow",
            "strengthPriority": 3,
        }

    if lower_shadow >= body_size * 3.0 and lower_shadow_ratio >= 0.45 and upper_shadow <= lower_shadow * 0.6:
        shadow_strength = "strong"
        strength_priority = 0
    elif lower_shadow >= body_size * 2.0 and lower_shadow_ratio >= 0.35:
        shadow_strength = "medium"
        strength_priority = 1
    elif lower_shadow >= body_size * 1.2 and lower_shadow_ratio >= 0.25:
        shadow_strength = "weak"
        strength_priority = 2
    else:
        shadow_strength = "none"
        strength_priority = 3

    is_lower_shadow = (
        lower_shadow > 0
        and price_range > 0
        and lower_shadow >= body_size * 2.0
        and lower_shadow_ratio >= 0.35
        and upper_shadow <= lower_shadow * 0.8
    )

    if is_lower_shadow:
        reason = (
            "strong: lower shadow dominates with small upper shadow"
            if shadow_strength == "strong"
            else "medium: long lower shadow and clear rebound shape"
        )
    elif shadow_strength == "weak":
        reason = "weak lower shadow only"
    elif lower_shadow < body_size * 2.0:
        reason = "lower shadow too short vs body"
    elif lower_shadow_ratio < 0.35:
        reason = "lower shadow ratio too small"
    elif upper_shadow > lower_shadow * 0.8:
        reason = "upper shadow too large"
    else:
        reason = "does not meet lower shadow rule"

    return {
        "body": round(body_size, 6),
        "lowerShadow": round(lower_shadow, 6),
        "upperShadow": round(upper_shadow, 6),
        "range": round(price_range, 6),
        "lowerShadowRatio": round(lower_shadow_ratio, 6),
        "isLowerShadow": is_lower_shadow,
        "shadowStrength": shadow_strength,
        "reason": reason,
        "strengthPriority": strength_priority,
    }


def is_lower_shadow_candidate(record: dict[str, object]) -> bool:
    metrics = compute_lower_shadow_metrics(record)
    return metrics is not None and bool(metrics.get("isLowerShadow"))


def sort_lower_shadow_records(records: list[dict[str, object]]) -> list[dict[str, object]]:
    items = []
    for record in records:
        metrics = compute_lower_shadow_metrics(record)
        if metrics is None or not metrics.get("isLowerShadow"):
            continue
        items.append({**record, **metrics})
    items.sort(
        key=lambda item: (
            int(item.get("strengthPriority") or 3),
            -float(item.get("lowerShadowRatio") or 0),
            -float(item.get("lowerShadow") or 0),
            str(item.get("code") or ""),
        )
    )
    return items


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
        "themes": record.get("themes", []),
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
        "open": record.get("open"),
        "high": record.get("high"),
        "low": record.get("low"),
        "body": record.get("body"),
        "lowerShadow": record.get("lowerShadow"),
        "upperShadow": record.get("upperShadow"),
        "range": record.get("range"),
        "lowerShadowRatio": record.get("lowerShadowRatio"),
        "isLowerShadow": record.get("isLowerShadow"),
        "shadowStrength": record.get("shadowStrength"),
        "reason": record.get("reason"),
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
    explicit_dates = parse_codes(args.dates)
    if args.dates == "__UPDATE_STATE__":
        explicit_dates = [str(item) for item in load_update_state().get("updatedDates") or []]
    selected_dates = [date_value for date_value in (explicit_dates or []) if date_value in set(all_dates)]
    if not selected_dates:
        if args.from_date:
            selected_dates = [date_value for date_value in all_dates if date_value >= args.from_date]
            if args.end_date:
                selected_dates = [date_value for date_value in selected_dates if date_value <= args.end_date]
        else:
            selected_dates = select_dates(all_dates, args.days, args.end_date)
    selected_date_set = set(selected_dates)
    per_date: dict[str, list[dict[str, object]]] = {date_value: [] for date_value in selected_dates}
    missing_dates: list[str] = []
    for date_value in selected_dates:
        cached = load_daily_records(date_value, codes)
        if cached is None:
            missing_dates.append(date_value)
            continue
        per_date[date_value] = cached

    if missing_dates:
        payloads = iter_ticker_payloads(codes)
        missing_date_set = set(missing_dates)
        for payload in payloads:
            meta = {
                "code": payload["code"],
                "name": payload["name"],
                "market": payload["market"],
                "sector": payload.get("sector", ""),
                "industry": payload.get("industry", ""),
                "themes": payload.get("themes", []),
                "tags": payload.get("tags", []),
                "links": payload.get("links", {}),
            }
            for row in payload.get("ohlcv", []):
                date_value = str(row["date"])
                if date_value not in missing_date_set or date_value not in selected_date_set:
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
        deviation75 = pick_top(records, "distanceToMa75", True, args.limit)
        deviation200 = pick_top(records, "distanceToMa200", True, args.limit)
        lower_shadow = sort_lower_shadow_records(records)[: args.limit]
        watch_candidates = sorted(records, key=score_watch_candidate, reverse=True)[: args.limit]

        output_dir = RANKINGS_DIR / date_value
        write_json(output_dir / "gainers.json", build_ranking_payload(date_value, "値上がり率", gainers))
        write_json(output_dir / "losers.json", build_ranking_payload(date_value, "値下がり率", losers))
        write_json(output_dir / "volume_spike.json", build_ranking_payload(date_value, "出来高増加", volume_spike))
        write_json(output_dir / "new_high.json", build_ranking_payload(date_value, "新高値", new_high))
        write_json(output_dir / "deviation25.json", build_ranking_payload(date_value, "25日線乖離", deviation25))
        write_json(output_dir / "deviation75.json", build_ranking_payload(date_value, "75日線乖離", deviation75))
        write_json(output_dir / "deviation200.json", build_ranking_payload(date_value, "200日線乖離", deviation200))
        write_json(output_dir / "lower_shadow.json", build_ranking_payload(date_value, "下ひげ", lower_shadow))
        write_json(
            output_dir / "watch_candidates.json",
            build_ranking_payload(date_value, "監視候補", watch_candidates),
        )
        print(f"built rankings: {date_value} ({len(records)} records)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
