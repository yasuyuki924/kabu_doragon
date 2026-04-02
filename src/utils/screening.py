from __future__ import annotations

from typing import Any


def is_above_ma(close: float | None, ma_value: float | None) -> bool:
    return close is not None and ma_value is not None and close > ma_value


def is_ma_stack(*values: float | None) -> bool:
    finite = [value for value in values if value is not None]
    if len(finite) != len(values):
        return False
    return all(float(values[index]) > float(values[index + 1]) for index in range(len(values) - 1))


def is_trend_aligned(close: float | None, *ma_values: float | None) -> bool:
    if close is None or any(value is None for value in ma_values):
        return False
    return close > float(ma_values[0]) and is_ma_stack(*ma_values)


def is_near_high(close: float | None, high_value: float | None, min_ratio: float) -> bool:
    if close is None or high_value in {None, 0}:
        return False
    return (close / float(high_value)) >= min_ratio


def has_liquidity(turnover_ma5: float | None, volume_ratio25: float | None, min_turnover: float, min_volume_ratio: float) -> bool:
    turnover_ok = turnover_ma5 is not None and turnover_ma5 >= min_turnover
    volume_ok = volume_ratio25 is not None and volume_ratio25 >= min_volume_ratio
    return turnover_ok or volume_ok


def detect_base(
    highs: list[float],
    lows: list[float],
    index: int,
    window_min: int,
    window_max: int,
    range_max_pct: float,
) -> dict[str, Any]:
    best: dict[str, Any] = {
        "detected": False,
        "window": None,
        "high": None,
        "low": None,
        "range_pct": None,
    }
    if index + 1 < window_min:
        return best
    for window in range(window_min, min(window_max, index + 1) + 1):
        window_high = max(highs[index - window + 1 : index + 1])
        window_low = min(lows[index - window + 1 : index + 1])
        if window_low <= 0:
            continue
        range_pct = ((window_high - window_low) / window_low) * 100
        if range_pct <= range_max_pct:
            best = {
                "detected": True,
                "window": window,
                "high": round(window_high, 4),
                "low": round(window_low, 4),
                "range_pct": round(range_pct, 4),
            }
    return best


def is_breakout_candidate(close: float | None, breakout_level: float | None, max_distance_pct: float) -> bool:
    if close is None or breakout_level in {None, 0}:
        return False
    distance_pct = ((float(breakout_level) - close) / float(breakout_level)) * 100
    return distance_pct <= max_distance_pct


def is_donchian_breakout(close: float | None, high_price: float | None, breakout_level: float | None, use_close: bool, use_high: bool) -> bool:
    if breakout_level is None:
        return False
    close_ok = use_close and close is not None and close >= breakout_level
    high_ok = use_high and high_price is not None and high_price >= breakout_level
    return close_ok or high_ok


def is_stage2_candidate(close: float | None, long_ma: float | None, long_ma_slope_pct: float | None) -> bool:
    return is_above_ma(close, long_ma) and long_ma_slope_pct is not None and long_ma_slope_pct > 0


def is_rsi_pullback(close: float | None, trend_ma: float | None, rsi_value: float | None, threshold: float) -> bool:
    return is_above_ma(close, trend_ma) and rsi_value is not None and rsi_value <= threshold
