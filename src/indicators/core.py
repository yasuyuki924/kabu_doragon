from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from rebound_signal import classify_rebound_signal
from src.screening.strategy_presets import STRATEGY_PRESETS, evaluate_strategies
from src.utils.screening import detect_base
from src.utils.indicators import (
    breakout_distance_pct,
    consecutive_down_days,
    distance_pct,
    latest_moving_average,
    moving_average,
    recovery_from_low_pct,
    rolling_high,
    rsi,
    slope_pct,
    upper_wick_ratio,
    volatility_range_pct,
)


MA_WINDOWS = (5, 25, 50, 75, 140, 150, 160, 200)
VOLUME_MA_WINDOWS = (5, 20, 25)
RCI_WINDOWS = (12, 24, 48)
TREND_TURN_THRESHOLDS = SimpleNamespace(
    ma200_lookback_days=120,
    max_above_ma200_count=10,
)
HIGH_PULLBACK_THRESHOLDS = SimpleNamespace(
    lookback_bars=200,
    lookahead_bars=10,
    recent_achievement_bars=5,
    min_drop_pct=30.0,
)
STRONG_TREND_PULLBACK_THRESHOLDS = SimpleNamespace(
    lookback_bars=60,
    min_rise_pct=30.0,
    min_drop_pct=15.0,
    deep_drop_pct=30.0,
    max_drop_pct=45.0,
)


def distance_from_baseline(value: float | None, baseline: float | None) -> float | None:
    return distance_pct(value, baseline)


def rank_values(values: list[float]) -> list[float]:
    indexed = sorted(enumerate(values), key=lambda item: item[1])
    ranks = [0.0] * len(values)
    cursor = 0
    while cursor < len(indexed):
        end = cursor
        while end + 1 < len(indexed) and indexed[end + 1][1] == indexed[cursor][1]:
            end += 1
        average_rank = (cursor + end + 2) / 2
        for index in range(cursor, end + 1):
            ranks[indexed[index][0]] = average_rank
        cursor = end + 1
    return ranks


def calculate_rci(values: list[float]) -> float:
    length = len(values)
    time_ranks = list(range(1, length + 1))
    price_ranks = rank_values(values)
    sum_squared = 0.0
    for index, time_rank in enumerate(time_ranks):
        diff = time_rank - price_ranks[index]
        sum_squared += diff * diff
    return round((1 - (6 * sum_squared) / (length * (length * length - 1))) * 100, 2)


def calculate_rci_series(values: list[float], window_size: int) -> list[float | None]:
    out: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < window_size:
            out.append(None)
            continue
        out.append(calculate_rci(values[index - window_size + 1 : index + 1]))
    return out


def build_wtd_mtd_bars(
    rows: list[dict[str, float | int | str]],
) -> tuple[list[dict[str, float | int | str]], list[dict[str, float | int | str]]]:
    wtd_rows: list[dict[str, float | int | str]] = []
    mtd_rows: list[dict[str, float | int | str]] = []

    current_week = None
    week_open = week_high = week_low = week_vol = 0.0

    current_month = None
    month_open = month_high = month_low = month_vol = 0.0

    for row in rows:
        current_date = datetime.strptime(str(row["date"]), "%Y-%m-%d").date()
        week_str = f"{current_date.isocalendar()[0]}-W{current_date.isocalendar()[1]:02d}"
        month_str = f"{current_date.year}-{current_date.month:02d}"

        open_val = float(row["open"])
        high_val = float(row["high"])
        low_val = float(row["low"])
        close_val = float(row["close"])
        vol_val = int(row["volume"])

        if current_week != week_str:
            current_week = week_str
            week_open = open_val
            week_high = high_val
            week_low = low_val
            week_vol = vol_val
        else:
            week_high = max(week_high, high_val)
            week_low = min(week_low, low_val)
            week_vol += vol_val

        wtd_rows.append(
            {"date": row["date"], "open": week_open, "high": week_high, "low": week_low, "close": close_val, "volume": week_vol}
        )

        if current_month != month_str:
            current_month = month_str
            month_open = open_val
            month_high = high_val
            month_low = low_val
            month_vol = vol_val
        else:
            month_high = max(month_high, high_val)
            month_low = min(month_low, low_val)
            month_vol += vol_val

        mtd_rows.append(
            {"date": row["date"], "open": month_open, "high": month_high, "low": month_low, "close": close_val, "volume": month_vol}
        )

    return wtd_rows, mtd_rows


def apply_period_change_from_open(
    rows: list[dict[str, float | int | str | bool | None]],
) -> list[dict[str, float | int | str | bool | None]]:
    adjusted: list[dict[str, float | int | str | bool | None]] = []
    for row in rows:
        open_price = float(row.get("open") or 0)
        close = float(row.get("close") or 0)
        change = close - open_price if open_price else None
        adjusted.append(
            {
                **row,
                "change": round(change, 4) if change is not None else None,
                "changePercent": round((change / open_price) * 100, 4) if change is not None and open_price else None,
            }
        )
    return adjusted


def apply_period_overview_metrics(
    period_rows: list[dict[str, float | int | str | bool | None]],
    daily_rows: list[dict[str, float | int | str | bool | None]],
    timeframe: str,
) -> list[dict[str, float | int | str | bool | None]]:
    adjusted: list[dict[str, float | int | str | bool | None]] = []
    current_period = None
    period_start_index = 0
    for index, row in enumerate(period_rows):
        current_date = datetime.strptime(str(row["date"]), "%Y-%m-%d").date()
        period_key = (
            current_date.isocalendar()[:2]
            if timeframe == "weekly"
            else (current_date.year, current_date.month)
        )
        if current_period != period_key:
            current_period = period_key
            period_start_index = index
        daily_row = daily_rows[index] if index < len(daily_rows) else {}
        period_days = index - period_start_index + 1
        open_price = float(row.get("open") or 0)
        close = float(row.get("close") or 0)
        change = close - open_price if open_price else None
        daily_volume_ma25 = float(daily_row.get("volumeMa25") or 0)
        volume_base = daily_volume_ma25 * period_days
        volume = float(row.get("volume") or 0)
        adjusted.append(
            {
                **row,
                "change": round(change, 4) if change is not None else None,
                "changePercent": round((change / open_price) * 100, 4) if change is not None and open_price else None,
                "volumeRatio25": round(volume / volume_base, 4) if volume_base else None,
            }
        )
    return adjusted


def detect_high_pullback_30(
    rows: list[dict[str, float | int | str]],
    index: int,
) -> dict[str, float | int | str | bool | None]:
    lookback = HIGH_PULLBACK_THRESHOLDS.lookback_bars
    lookahead = HIGH_PULLBACK_THRESHOLDS.lookahead_bars
    if index + 1 < lookback:
        return {"detected": False}
    window_start = index - lookback + 1
    high_index = -1
    highest = 0.0
    for pos in range(window_start, index + 1):
        high = float(rows[pos]["high"])
        if high >= highest:
            highest = high
            high_index = pos
    if high_index < 0 or highest <= 0:
        return {"detected": False}
    low_start = high_index + 1
    low_end = min(index, high_index + lookahead)
    if low_start > low_end:
        return {"detected": False}
    low_index = -1
    after_low = float("inf")
    for pos in range(low_start, low_end + 1):
        low = float(rows[pos]["low"])
        if low < after_low:
            after_low = low
            low_index = pos
    if low_index < 0:
        return {"detected": False}
    drop_rate = ((highest - after_low) / highest) * 100
    if drop_rate < HIGH_PULLBACK_THRESHOLDS.min_drop_pct:
        return {"detected": False}
    bars_since_low = index - low_index
    if bars_since_low >= HIGH_PULLBACK_THRESHOLDS.recent_achievement_bars:
        return {"detected": False}
    close = float(rows[index]["close"])
    return {
        "detected": True,
        "highest200": round(highest, 4),
        "highDate": str(rows[high_index]["date"]),
        "afterLow": round(after_low, 4),
        "afterLowDate": str(rows[low_index]["date"]),
        "barsToLow": low_index - high_index,
        "barsSinceLow": bars_since_low,
        "dropRate": round(drop_rate, 4),
        "currentClose": round(close, 4),
        "currentDrawdownPct": round(((highest - close) / highest) * 100, 4),
    }


def average_field(rows: list[dict[str, object]], field: str) -> float | None:
    values = []
    for row in rows:
        value = row.get(field)
        try:
            numeric = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        values.append(numeric)
    return sum(values) / len(values) if values else None


def lower_wick_ratio(row: dict[str, object]) -> float | None:
    try:
        open_price = float(row["open"])  # type: ignore[arg-type]
        high_price = float(row["high"])  # type: ignore[arg-type]
        low_price = float(row["low"])  # type: ignore[arg-type]
        close = float(row["close"])  # type: ignore[arg-type]
    except (KeyError, TypeError, ValueError):
        return None
    if high_price <= low_price:
        return None
    return (min(open_price, close) - low_price) / (high_price - low_price)


def detect_strong_trend_pullback_rebound(
    rows: list[dict[str, object]],
    current_row: dict[str, object] | None = None,
) -> dict[str, float | int | str | bool | None]:
    lookback = STRONG_TREND_PULLBACK_THRESHOLDS.lookback_bars
    row_count = len(rows) + (1 if current_row is not None else 0)
    if row_count < lookback + 10:
        return {"detected": False}

    current = current_row or rows[-1]
    current_close = current.get("close")
    current_ma5 = current.get("ma5")
    current_ma25 = current.get("ma25")
    current_ma75 = current.get("ma75")
    if current_close is None or current_ma5 is None or current_ma75 is None:
        return {"detected": False}
    current_close = float(current_close)
    current_ma5 = float(current_ma5)
    current_ma75 = float(current_ma75)
    current_ma25_value = float(current_ma25) if current_ma25 is not None else None
    if current_close < current_ma5:
        return {"detected": False}

    trend_window = (rows[-(lookback - 1) :] + [current]) if current_row is not None else rows[-lookback:]
    low_index = -1
    low = float("inf")
    high_index = -1
    high = float("-inf")
    rise_pct = float("-inf")
    for index, row in enumerate(trend_window):
        row_low = row.get("low")
        if row_low is not None and float(row_low) < low:
            low = float(row_low)
            low_index = index
        row_high = row.get("high")
        if row_high is not None and low_index >= 0 and index >= low_index:
            row_high_value = float(row_high)
            candidate_rise_pct = ((row_high_value - low) / low) * 100
            if candidate_rise_pct > rise_pct:
                rise_pct = candidate_rise_pct
                high = row_high_value
                high_index = index
    if not (low > 0) or not (high > 0) or high_index <= low_index or rise_pct < STRONG_TREND_PULLBACK_THRESHOLDS.min_rise_pct:
        return {"detected": False}

    pullback_rows = trend_window[high_index + 1 :]
    if not pullback_rows:
        return {"detected": False}
    current_drawdown_pct = ((high - current_close) / high) * 100
    if (
        current_drawdown_pct < STRONG_TREND_PULLBACK_THRESHOLDS.min_drop_pct
        or current_drawdown_pct > STRONG_TREND_PULLBACK_THRESHOLDS.max_drop_pct
    ):
        return {"detected": False}

    old_ma75_index = max(0, row_count - 21)
    old_ma75 = (current if old_ma75_index >= len(rows) else rows[old_ma75_index]).get("ma75")
    ma75_slope_pct = ((current_ma75 - float(old_ma75)) / float(old_ma75)) * 100 if old_ma75 not in {None, 0} else None
    if ma75_slope_pct is not None and ma75_slope_pct < -3:
        return {"detected": False}
    distance_to_ma75 = distance_from_baseline(current_close, current_ma75)
    if distance_to_ma75 is not None and distance_to_ma75 < -8:
        return {"detected": False}

    def touches_ma(row: dict[str, object], ma_key: str, threshold: float) -> bool:
        ma_value = row.get(ma_key)
        if ma_value in {None, 0}:
            return False
        low_distance = distance_from_baseline(float(row["low"]), float(ma_value))
        close_distance = distance_from_baseline(float(row["close"]), float(ma_value))
        distances = [abs(value) for value in [low_distance, close_distance] if value is not None]
        return bool(distances) and min(distances) <= threshold

    pullback_touches_ma25 = any(touches_ma(row, "ma25", 3.0) for row in pullback_rows)
    pullback_touches_ma75 = any(touches_ma(row, "ma75", 5.0) for row in pullback_rows)
    if not pullback_touches_ma25 and not pullback_touches_ma75:
        return {"detected": False}

    previous = rows[-1] if current_row is not None and rows else rows[-2] if len(rows) >= 2 else {}
    ma5_slope_up = previous.get("ma5") is not None and current_ma5 >= float(previous["ma5"])  # type: ignore[arg-type]
    recent5_rows = rows[-5:] if current_row is not None else rows[-6:-1]
    recent10_rows = rows[-10:] if current_row is not None else rows[-11:-1]
    recent5_high = max((float(row.get("high") or float("-inf")) for row in recent5_rows), default=float("-inf"))
    recent10_high = max((float(row.get("high") or float("-inf")) for row in recent10_rows), default=float("-inf"))
    close_breaks5_high = recent5_high != float("-inf") and current_close > recent5_high
    close_breaks10_high = recent10_high != float("-inf") and current_close > recent10_high
    volume20_rows = rows[-20:] if current_row is not None else rows[-21:-1]
    volume20 = average_field(volume20_rows, "volume")
    current_volume = current.get("volume")
    volume_ratio20 = float(current_volume) / volume20 if volume20 and current_volume is not None else None
    rise_segment = trend_window[low_index : high_index + 1]
    rise_above_ma25_ratio = (
        sum(1 for row in rise_segment if row.get("ma25") is not None and float(row["close"]) > float(row["ma25"])) / len(rise_segment)
        if rise_segment
        else 0.0
    )
    pullback_volume = average_field(pullback_rows[-10:], "volume")
    rise_volume = average_field(rise_segment[-10:], "volume")
    volume_cooled = pullback_volume is not None and rise_volume is not None and pullback_volume <= rise_volume * 0.9
    max_lower_wick = max((lower_wick_ratio(row) or 0.0 for row in pullback_rows[-10:]), default=0.0)
    has_lower_wick = max_lower_wick >= 0.35

    pullback_type = (
        "deep_reset_pullback"
        if current_drawdown_pct >= STRONG_TREND_PULLBACK_THRESHOLDS.deep_drop_pct
        else "normal_pullback"
    )
    rebound_label = (
        "deep_reset_rebound"
        if pullback_type == "deep_reset_pullback"
        else "ma25_rebound"
        if pullback_touches_ma25 and current_ma25_value is not None and current_close >= current_ma25_value
        else "ma75_rebound"
    )

    score = min(15, max(0, ((rise_pct - 30) / 50) * 15 + 6))
    if current_drawdown_pct < 18:
        score += 14
    elif current_drawdown_pct < 25:
        score += 20
    elif current_drawdown_pct < 30:
        score += 16
    elif current_drawdown_pct < 35:
        score += 12
    else:
        score += 8
    if pullback_touches_ma25:
        score += 10
    if pullback_touches_ma75:
        score += 10
    if current_close >= current_ma5:
        score += 5
    if current_ma25_value is not None and current_close >= current_ma25_value:
        score += 6
    if current_close >= current_ma75:
        score += 4
    if ma5_slope_up:
        score += 4
    if close_breaks5_high:
        score += 5
    if close_breaks10_high:
        score += 4
    if volume_ratio20 is not None and volume_ratio20 >= 1.2:
        score += 8
    elif volume_ratio20 is not None and volume_ratio20 >= 1:
        score += 5
    if volume_cooled:
        score += 4
    if has_lower_wick:
        score += 4
    score += min(10, rise_above_ma25_ratio * 10)
    score += 5 if ma75_slope_pct is None or ma75_slope_pct >= 0 else 2
    if pullback_type == "deep_reset_pullback":
        score = min(score, 82)
    if score < (48 if pullback_type == "deep_reset_pullback" else 55):
        return {"detected": False}

    return {
        "detected": True,
        "score": round(min(100, score), 4),
        "pullbackType": pullback_type,
        "reboundLabel": rebound_label,
        "risePct": round(rise_pct, 4),
        "dropPct": round(current_drawdown_pct, 4),
        "lowDate": str(trend_window[low_index].get("date") or ""),
        "highDate": str(trend_window[high_index].get("date") or ""),
        "high": round(high, 4),
        "low": round(low, 4),
        "distanceToMa25": round(distance_from_baseline(current_close, current_ma25_value), 4) if current_ma25_value else None,
        "distanceToMa75": round(distance_to_ma75, 4) if distance_to_ma75 is not None else None,
        "ma75SlopePct": round(ma75_slope_pct, 4) if ma75_slope_pct is not None else None,
        "volumeRatio20": round(volume_ratio20, 4) if volume_ratio20 is not None else None,
        "riseAboveMa25Ratio": round(rise_above_ma25_ratio, 4),
        "touchedMa25": pullback_touches_ma25,
        "touchedMa75": pullback_touches_ma75,
        "closeBreaks5High": close_breaks5_high,
        "closeBreaks10High": close_breaks10_high,
    }


def build_enriched_rows(rows: list[dict[str, float | int | str]]) -> list[dict[str, float | int | str | bool | None]]:
    if not rows:
        return []

    closes = [float(row["close"]) for row in rows]
    volumes = [float(row["volume"]) for row in rows]
    highs = [float(row["high"]) for row in rows]
    lows = [float(row["low"]) for row in rows]

    turnovers = [float(row["close"]) * float(row["volume"]) for row in rows]
    ma_map = {window: moving_average(closes, window) for window in MA_WINDOWS}
    volume_ma_map = {window: moving_average(volumes, window) for window in VOLUME_MA_WINDOWS}
    turnover_ma_map = {window: moving_average(turnovers, window) for window in VOLUME_MA_WINDOWS}
    rci_map = {window: calculate_rci_series(closes, window) for window in RCI_WINDOWS}
    rsi2_map = rsi(closes, 2)
    high_20_map = rolling_high(closes, 20)
    high_55_map = rolling_high(closes, 55)

    enriched: list[dict[str, float | int | str | bool | None]] = []
    for index, row in enumerate(rows):
        close = float(row["close"])
        open_price = float(row["open"])
        high_price = float(row["high"])
        low_price = float(row["low"])
        volume = int(row["volume"])
        previous_close = float(rows[index - 1]["close"]) if index > 0 else None
        previous_open = float(rows[index - 1]["open"]) if index > 0 else None
        previous_high = float(rows[index - 1]["high"]) if index > 0 else None
        change = close - previous_close if previous_close is not None else None
        change_percent = ((change / previous_close) * 100) if previous_close not in {None, 0} else None

        highest_52w = max(highs[max(0, index - 251) : index + 1])
        lowest_52w = min(lows[max(0, index - 251) : index + 1])
        window_start = max(0, index - 19)
        bullish_closes_20d = [
            float(rows[pos]["close"])
            for pos in range(window_start, index + 1)
            if float(rows[pos]["close"]) >= float(rows[pos]["open"])
        ]
        range_position_52w = ((close - lowest_52w) / (highest_52w - lowest_52w)) * 100 if highest_52w not in {None} and lowest_52w is not None and highest_52w != lowest_52w else None
        new_high_52w = close >= highest_52w if highest_52w else False
        today_bullish = close >= open_price
        highest_20d_bullish_close = max(bullish_closes_20d) if bullish_closes_20d else None
        new_high_20d = bool(today_bullish and highest_20d_bullish_close is not None and close >= highest_20d_bullish_close)
        past_bullish_closes_20d = [
            float(rows[pos]["close"])
            for pos in range(max(0, index - 20), index)
            if float(rows[pos]["close"]) >= float(rows[pos]["open"])
        ]
        highest_past_20d_bullish_close = max(past_bullish_closes_20d) if past_bullish_closes_20d else None
        bullish_close_breakout_20d = bool(
            today_bullish
            and highest_past_20d_bullish_close is not None
            and close > highest_past_20d_bullish_close
        )

        ma5 = ma_map[5][index]
        ma25 = ma_map[25][index]
        ma50 = ma_map[50][index]
        ma75 = ma_map[75][index]
        ma140 = ma_map[140][index]
        ma150 = ma_map[150][index]
        ma160 = ma_map[160][index]
        ma200 = ma_map[200][index]
        volume_ma5 = volume_ma_map[5][index]
        volume_ma20 = volume_ma_map[20][index]
        volume_ma25 = volume_ma_map[25][index]
        turnover = turnovers[index]
        turnover_ma5 = turnover_ma_map[5][index]
        ma140_slope_pct = slope_pct(ma_map[140], index, 20)
        ma150_slope_pct = slope_pct(ma_map[150], index, 20)
        ma160_slope_pct = slope_pct(ma_map[160], index, 20)
        ma200_slope_pct = slope_pct(ma_map[200], index, 20)
        recovery_from_52w_low_pct = recovery_from_low_pct(close, lowest_52w)
        distance_to_52w_high_pct = breakout_distance_pct(close, highest_52w)
        near_52w_high_ratio = round(close / highest_52w, 4) if highest_52w not in {None, 0} else None
        donchian20_high = high_20_map[index - 1] if index > 0 else None
        donchian55_high = high_55_map[index - 1] if index > 0 else None
        distance_to_donchian20_pct = breakout_distance_pct(close, donchian20_high)
        distance_to_donchian55_pct = breakout_distance_pct(close, donchian55_high)
        base10to20 = detect_base(highs, lows, index, 10, 20, 12.0)
        base10to30 = detect_base(highs, lows, index, 10, 30, 12.0)
        base20to60 = detect_base(highs, lows, index, 20, 60, 18.0)
        distance_to_base_high_pct = breakout_distance_pct(close, base10to30.get("high"))
        distance_to_mid_base_high_pct = breakout_distance_pct(close, base20to60.get("high"))
        distance_to_prev_high_pct = breakout_distance_pct(close, previous_high)
        volatility20_pct = volatility_range_pct(highs, lows, index, 20)
        unstable_below_ma200_days = 0
        unstable_window_start = max(0, index - 19)
        for pos in range(unstable_window_start, index + 1):
            pos_ma200 = ma_map[200][pos]
            if pos_ma200 is None:
                continue
            if float(rows[pos]["close"]) < float(pos_ma200) * 0.95:
                unstable_below_ma200_days += 1
        upper_wick3d_values = []
        for pos in range(max(0, index - 2), index + 1):
            ratio = upper_wick_ratio(float(rows[pos]["open"]), float(rows[pos]["high"]), float(rows[pos]["close"]), float(rows[pos]["low"]))
            if ratio is not None:
                upper_wick3d_values.append(ratio)
        upper_wick_3d_avg = round(sum(upper_wick3d_values) / len(upper_wick3d_values), 4) if upper_wick3d_values else None
        new_high20d_count10 = 0
        for pos in range(max(0, index - 9), index + 1):
            level = high_20_map[pos - 1] if pos > 0 else None
            if level is not None and float(rows[pos]["high"]) >= level:
                new_high20d_count10 += 1
        distance_to_ma50 = distance_from_baseline(close, ma50) if ma50 else None
        distance_to_ma150 = distance_from_baseline(close, ma150) if ma150 else None
        distance_to_ma140 = distance_from_baseline(close, ma140) if ma140 else None
        distance_to_ma160 = distance_from_baseline(close, ma160) if ma160 else None
        rebound_signal = classify_rebound_signal(
            {
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "prev_open": previous_open,
                "prev_close": previous_close,
                "ma5": ma5,
            }
        )

        trend_turn_candidate = False
        trend_turn_breakout_date = None
        trend_turn_days_after_breakout = None
        trend_turn_range_pct = None
        trend_turn_above_ma75_ratio = None
        trend_turn_score = 0
        trend_turn_reason = ""
        high_pullback_30 = detect_high_pullback_30(rows, index)

        prev_index = index - 1
        lookback_start = index - TREND_TURN_THRESHOLDS.ma200_lookback_days
        if (
            prev_index >= 0
            and lookback_start >= 0
            and ma200 is not None
            and ma_map[200][prev_index] is not None
            and close > float(ma200)
            and float(rows[prev_index]["close"]) <= float(ma_map[200][prev_index])
        ):
            above_count = 0
            lookback_valid = True
            for pos in range(lookback_start, index):
                pos_ma200 = ma_map[200][pos]
                if pos_ma200 is None:
                    lookback_valid = False
                    break
                if float(rows[pos]["close"]) > float(pos_ma200):
                    above_count += 1

            if lookback_valid and above_count <= TREND_TURN_THRESHOLDS.max_above_ma200_count:
                ma200_distance = distance_from_baseline(close, ma200)
                trend_turn_candidate = True
                trend_turn_breakout_date = str(row["date"])
                trend_turn_days_after_breakout = 0
                trend_turn_range_pct = float(above_count)
                trend_turn_above_ma75_ratio = round(above_count / TREND_TURN_THRESHOLDS.ma200_lookback_days, 4)
                trend_turn_score = int(TREND_TURN_THRESHOLDS.ma200_lookback_days - above_count)
                trend_turn_reason = "|".join(
                    [
                        "今日MA200上抜け",
                        f"120日中{above_count}日MA200上",
                        f"MA200乖離{ma200_distance:.1f}%" if ma200_distance is not None else "MA200乖離-",
                    ]
                )

        base_row = {
            "date": row["date"],
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close,
            "volume": volume,
            "turnover": round(turnover, 4),
            "change": round(change, 4) if change is not None else None,
            "changePercent": round(change_percent, 4) if change_percent is not None else None,
            "ma5": ma5,
            "ma25": ma25,
            "ma50": ma50,
            "ma75": ma75,
            "ma140": ma140,
            "ma150": ma150,
            "ma160": ma160,
            "ma200": ma200,
            "ma140SlopePct": ma140_slope_pct,
            "ma150SlopePct": ma150_slope_pct,
            "ma160SlopePct": ma160_slope_pct,
            "ma200SlopePct": ma200_slope_pct,
            "volumeMa5": volume_ma5,
            "volumeMa20": volume_ma20,
            "volumeMa25": volume_ma25,
            "turnoverMa5": round(turnover_ma5, 4) if turnover_ma5 is not None else None,
            "distanceToMa25": round(distance_from_baseline(close, ma25), 4) if ma25 else None,
            "distanceToMa50": round(distance_to_ma50, 4) if distance_to_ma50 is not None else None,
            "distanceToMa75": round(distance_from_baseline(close, ma75), 4) if ma75 else None,
            "distanceToMa140": round(distance_to_ma140, 4) if distance_to_ma140 is not None else None,
            "distanceToMa150": round(distance_to_ma150, 4) if distance_to_ma150 is not None else None,
            "distanceToMa160": round(distance_to_ma160, 4) if distance_to_ma160 is not None else None,
            "distanceToMa200": round(distance_from_baseline(close, ma200), 4) if ma200 else None,
            "volumeRatio25": round(volume / volume_ma25, 4) if volume_ma25 not in {None, 0} else None,
            "rci12": rci_map[12][index],
            "rci24": rci_map[24][index],
            "rci48": rci_map[48][index],
            "rsi2": rsi2_map[index],
            "consecutiveDownDays": consecutive_down_days(closes, index),
            "rangePosition52w": round(range_position_52w, 4) if range_position_52w is not None else None,
            "high52w": highest_52w,
            "low52w": lowest_52w,
            "distanceTo52wHighPct": distance_to_52w_high_pct,
            "near52wHighRatio": near_52w_high_ratio,
            "recoveryFrom52wLowPct": recovery_from_52w_low_pct,
            "newHigh52w": bool(new_high_52w),
            "newHigh20d": bool(new_high_20d),
            "bullishCloseBreakout20d": bool(bullish_close_breakout_20d),
            "donchian20High": donchian20_high,
            "donchian55High": donchian55_high,
            "distanceToDonchian20Pct": distance_to_donchian20_pct,
            "distanceToDonchian55Pct": distance_to_donchian55_pct,
            "base10to20": base10to20,
            "base10to30": base10to30,
            "base20to60": base20to60,
            "distanceToBaseHighPct": distance_to_base_high_pct,
            "distanceToMidBaseHighPct": distance_to_mid_base_high_pct,
            "distanceToPrevHighPct": distance_to_prev_high_pct,
            "volatility20Pct": volatility20_pct,
            "unstableBelowMa200Days": unstable_below_ma200_days,
            "upperWick3dAvg": upper_wick_3d_avg,
            "newHigh20dCount10": new_high20d_count10,
            "signalCategory": str(rebound_signal["category"]),
            "lowerWickFlag": bool(rebound_signal["lower_wick"]),
            "strongHammerFlag": bool(rebound_signal["strong_hammer_like"]),
            "prevBearFlag": bool(rebound_signal["prev_bear"]),
            "belowMa5Flag": bool(rebound_signal["below_ma5"]),
            "trendTurnCandidate": bool(trend_turn_candidate),
            "trendTurnBreakoutDate": trend_turn_breakout_date,
            "trendTurnDaysAfterBreakout": trend_turn_days_after_breakout,
            "trendTurnRangePct": trend_turn_range_pct,
            "trendTurnAboveMa75Ratio": trend_turn_above_ma75_ratio,
            "trendTurnScore": int(trend_turn_score),
            "trendTurnReason": trend_turn_reason,
            "highPullback30": high_pullback_30,
            "highPullback30Candidate": bool(high_pullback_30.get("detected")),
            "highPullback30DropRate": high_pullback_30.get("dropRate"),
            "highPullback30HighDate": high_pullback_30.get("highDate"),
            "highPullback30LowDate": high_pullback_30.get("afterLowDate"),
            "highPullback30BarsToLow": high_pullback_30.get("barsToLow"),
        }
        strong_trend_pullback_rebound = detect_strong_trend_pullback_rebound(enriched, base_row)
        base_row.update(
            {
                "strongTrendPullbackRebound": strong_trend_pullback_rebound,
                "strongTrendPullbackReboundCandidate": bool(strong_trend_pullback_rebound.get("detected")),
                "strongTrendPullbackReboundScore": strong_trend_pullback_rebound.get("score"),
                "strongTrendPullbackReboundType": strong_trend_pullback_rebound.get("pullbackType"),
                "strongTrendPullbackReboundLabel": strong_trend_pullback_rebound.get("reboundLabel"),
                "strongTrendPullbackReboundRisePct": strong_trend_pullback_rebound.get("risePct"),
                "strongTrendPullbackReboundDropPct": strong_trend_pullback_rebound.get("dropPct"),
                "strongTrendPullbackReboundVolumeRatio20": strong_trend_pullback_rebound.get("volumeRatio20"),
            }
        )

        strategy_results = evaluate_strategies(base_row)
        strategy_matches = [strategy_id for strategy_id, result in strategy_results.items() if result.matched]
        strategy_scores = {strategy_id: result.score for strategy_id, result in strategy_results.items()}
        strategy_reasons = {strategy_id: result.reasons for strategy_id, result in strategy_results.items() if result.reasons}
        strategy_excluded_reasons = {
            strategy_id: result.excludedReasons for strategy_id, result in strategy_results.items() if result.excludedReasons
        }
        strategy_metrics = {strategy_id: result.metrics for strategy_id, result in strategy_results.items()}

        enriched.append(
            {
                **base_row,
                "strategyMatches": strategy_matches,
                "strategyScores": strategy_scores,
                "strategyReasons": strategy_reasons,
                "strategyExcludedReasons": strategy_excluded_reasons,
                "strategyMetrics": strategy_metrics,
                **{
                    f"{preset.id}Candidate": bool(strategy_results[preset.id].matched)
                    for preset in STRATEGY_PRESETS
                },
                **{
                    f"{preset.id}Score": strategy_results[preset.id].score
                    for preset in STRATEGY_PRESETS
                },
            }
        )
    return enriched
