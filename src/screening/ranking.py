from __future__ import annotations

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


def sort_rebound_signal_records(records: list[dict[str, object]]) -> list[dict[str, object]]:
    priority = {"strong_rebound": 0, "rebound_candidate": 1, "lower_wick_only": 2}
    items = [record for record in records if str(record.get("signalCategory") or "") in priority]
    items.sort(
        key=lambda item: (
            priority.get(str(item.get("signalCategory") or ""), 9),
            -float(item.get("changePercent") or 0),
            -float(item.get("volumeRatio25") or 0),
            str(item.get("code") or ""),
        )
    )
    return items


def sort_trend_turn_records(records: list[dict[str, object]]) -> list[dict[str, object]]:
    items = [record for record in records if bool(record.get("trendTurnCandidate"))]
    items.sort(
        key=lambda item: (
            float(item.get("trendTurnRangePct") or 0),
            abs(float(item.get("distanceToMa200") or 0)),
            -float(item.get("volumeRatio25") or 0),
            -float(item.get("changePercent") or 0),
            str(item.get("code") or ""),
        )
    )
    return items


def sort_strategy_records(records: list[dict[str, object]], strategy_id: str) -> list[dict[str, object]]:
    items = [record for record in records if strategy_id in list(record.get("strategyMatches") or [])]
    items.sort(
        key=lambda item: (
            -float((item.get("strategyScores") or {}).get(strategy_id) or 0),
            -float(item.get("changePercent") or 0),
            -float(item.get("volumeRatio25") or 0),
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
        "signalCategory": record.get("signalCategory"),
        "lowerWickFlag": record.get("lowerWickFlag"),
        "strongHammerFlag": record.get("strongHammerFlag"),
        "prevBearFlag": record.get("prevBearFlag"),
        "belowMa5Flag": record.get("belowMa5Flag"),
        "trendTurnCandidate": record.get("trendTurnCandidate"),
        "trendTurnBreakoutDate": record.get("trendTurnBreakoutDate"),
        "trendTurnDaysAfterBreakout": record.get("trendTurnDaysAfterBreakout"),
        "trendTurnRangePct": record.get("trendTurnRangePct"),
        "trendTurnAboveMa75Ratio": record.get("trendTurnAboveMa75Ratio"),
        "trendTurnScore": record.get("trendTurnScore"),
        "trendTurnReason": record.get("trendTurnReason"),
        "ma50": record.get("ma50"),
        "ma150": record.get("ma150"),
        "ma140": record.get("ma140"),
        "ma160": record.get("ma160"),
        "ma140SlopePct": record.get("ma140SlopePct"),
        "ma150SlopePct": record.get("ma150SlopePct"),
        "ma160SlopePct": record.get("ma160SlopePct"),
        "ma200SlopePct": record.get("ma200SlopePct"),
        "distanceToMa50": record.get("distanceToMa50"),
        "distanceToMa140": record.get("distanceToMa140"),
        "distanceToMa150": record.get("distanceToMa150"),
        "distanceToMa160": record.get("distanceToMa160"),
        "rsi2": record.get("rsi2"),
        "consecutiveDownDays": record.get("consecutiveDownDays"),
        "high52w": record.get("high52w"),
        "low52w": record.get("low52w"),
        "distanceTo52wHighPct": record.get("distanceTo52wHighPct"),
        "near52wHighRatio": record.get("near52wHighRatio"),
        "recoveryFrom52wLowPct": record.get("recoveryFrom52wLowPct"),
        "donchian20High": record.get("donchian20High"),
        "donchian55High": record.get("donchian55High"),
        "distanceToDonchian20Pct": record.get("distanceToDonchian20Pct"),
        "distanceToDonchian55Pct": record.get("distanceToDonchian55Pct"),
        "base10to20": record.get("base10to20"),
        "base10to30": record.get("base10to30"),
        "base20to60": record.get("base20to60"),
        "distanceToBaseHighPct": record.get("distanceToBaseHighPct"),
        "distanceToMidBaseHighPct": record.get("distanceToMidBaseHighPct"),
        "distanceToPrevHighPct": record.get("distanceToPrevHighPct"),
        "volatility20Pct": record.get("volatility20Pct"),
        "strategyMatches": record.get("strategyMatches", []),
        "strategyScores": record.get("strategyScores", {}),
        "strategyReasons": record.get("strategyReasons", {}),
        "strategyExcludedReasons": record.get("strategyExcludedReasons", {}),
        "strategyMetrics": record.get("strategyMetrics", {}),
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
