from __future__ import annotations

from typing import Literal


def moving_average(values: list[float], window_size: int) -> list[float | None]:
    out: list[float | None] = []
    running = 0.0
    for index, value in enumerate(values):
        running += value
        if index >= window_size:
            running -= values[index - window_size]
        if index + 1 < window_size:
            out.append(None)
            continue
        out.append(round(running / window_size, 4))
    return out


def latest_moving_average(values: list[float], window_size: int, index: int) -> float | None:
    if index + 1 < window_size:
        return None
    window = values[index - window_size + 1 : index + 1]
    return round(sum(window) / window_size, 4)


def distance_pct(value: float | None, baseline: float | None) -> float | None:
    if value is None or baseline in {None, 0}:
        return None
    return round(((value - baseline) / baseline) * 100, 4)


def recovery_from_low_pct(close: float | None, low_value: float | None) -> float | None:
    if close is None or low_value in {None, 0}:
        return None
    return round(((close / low_value) - 1) * 100, 4)


def slope_pct(series: list[float | None], index: int, lookback: int) -> float | None:
    if index < lookback:
        return None
    current = series[index]
    previous = series[index - lookback]
    if current is None or previous in {None, 0}:
        return None
    return round(((current - previous) / previous) * 100, 4)


def rolling_high(values: list[float], period: int) -> list[float | None]:
    out: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < period:
            out.append(None)
            continue
        out.append(round(max(values[index - period + 1 : index + 1]), 4))
    return out


def rolling_low(values: list[float], period: int) -> list[float | None]:
    out: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < period:
            out.append(None)
            continue
        out.append(round(min(values[index - period + 1 : index + 1]), 4))
    return out


def rsi(values: list[float], period: int) -> list[float | None]:
    if not values:
        return []
    gains = [0.0]
    losses = [0.0]
    for index in range(1, len(values)):
        change = values[index] - values[index - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))

    out: list[float | None] = []
    avg_gain = 0.0
    avg_loss = 0.0
    for index in range(len(values)):
        if index < period:
            out.append(None)
            continue
        if index == period:
            avg_gain = sum(gains[1 : period + 1]) / period
            avg_loss = sum(losses[1 : period + 1]) / period
        else:
            avg_gain = ((avg_gain * (period - 1)) + gains[index]) / period
            avg_loss = ((avg_loss * (period - 1)) + losses[index]) / period
        if avg_loss == 0:
            out.append(100.0)
            continue
        rs = avg_gain / avg_loss
        out.append(round(100 - (100 / (1 + rs)), 4))
    return out


def volatility_range_pct(highs: list[float], lows: list[float], index: int, window: int) -> float | None:
    if index + 1 < window:
        return None
    window_high = max(highs[index - window + 1 : index + 1])
    window_low = min(lows[index - window + 1 : index + 1])
    if window_low <= 0:
        return None
    return round(((window_high - window_low) / window_low) * 100, 4)


def base_range_pct(highs: list[float], lows: list[float], index: int, window: int) -> float | None:
    return volatility_range_pct(highs, lows, index, window)


def consecutive_down_days(closes: list[float], index: int) -> int:
    count = 0
    cursor = index
    while cursor > 0 and closes[cursor] < closes[cursor - 1]:
        count += 1
        cursor -= 1
    return count


def upper_wick_ratio(open_price: float, high_price: float, close_price: float, low_price: float) -> float | None:
    price_range = high_price - low_price
    if price_range <= 0:
        return None
    upper = high_price - max(open_price, close_price)
    return round(upper / price_range, 4)


def breakout_distance_pct(close: float | None, breakout_level: float | None) -> float | None:
    if close is None or breakout_level in {None, 0}:
        return None
    return round(((breakout_level - close) / breakout_level) * 100, 4)


def rolling_extreme(
    closes: list[float],
    highs: list[float],
    period: int,
    source: Literal["close", "high", "low"] = "close",
) -> list[float | None]:
    series = closes
    if source == "high":
        series = highs
    elif source == "low":
        raise ValueError("Use rolling_low for low source.")
    return rolling_high(series, period)
