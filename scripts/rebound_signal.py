#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

import math
@dataclass(frozen=True)
class ReboundThresholds:
    """Thresholds for lower-wick and rebound signal classification.

    Keep this as a single configuration object so future conditions
    (volume, MA deviation, next-day breakout, etc.) can be added safely.
    """

    lower_ratio_min: float = 0.40
    lower_vs_body_min: float = 1.20
    close_pos_min: float = 0.50

    strong_lower_ratio_min: float = 0.50
    strong_lower_vs_body_min: float = 1.50
    strong_body_ratio_max: float = 0.35
    strong_upper_vs_lower_max: float = 0.50
    strong_close_pos_min: float = 0.55


DEFAULT_THRESHOLDS = ReboundThresholds()


def _safe_float(value: Any) -> float | None:
    """Convert value to float and return None for missing/invalid values."""
    if value is None:
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(out):
        return None
    return out


def compute_candle_metrics(candle: Mapping[str, Any]) -> dict[str, float | None]:
    """Compute candle metrics used for lower-wick screening.

    Expected keys in `candle`: open, high, low, close.

    Returns a dictionary with:
    - range
    - body
    - lower_wick
    - upper_wick
    - lower_ratio
    - upper_ratio
    - body_ratio
    - close_pos

    Ratios are None when range <= 0 or when required values are missing.
    """
    open_price = _safe_float(candle.get("open"))
    high_price = _safe_float(candle.get("high"))
    low_price = _safe_float(candle.get("low"))
    close_price = _safe_float(candle.get("close"))

    if None in {open_price, high_price, low_price, close_price}:
        return {
            "range": None,
            "body": None,
            "lower_wick": None,
            "upper_wick": None,
            "lower_ratio": None,
            "upper_ratio": None,
            "body_ratio": None,
            "close_pos": None,
        }

    assert open_price is not None
    assert high_price is not None
    assert low_price is not None
    assert close_price is not None

    price_range = high_price - low_price
    body = abs(close_price - open_price)
    lower_wick = min(open_price, close_price) - low_price
    upper_wick = high_price - max(open_price, close_price)

    if price_range <= 0:
        lower_ratio = None
        upper_ratio = None
        body_ratio = None
        close_pos = None
    else:
        lower_ratio = lower_wick / price_range
        upper_ratio = upper_wick / price_range
        body_ratio = body / price_range
        close_pos = (close_price - low_price) / price_range

    return {
        "range": price_range,
        "body": body,
        "lower_wick": lower_wick,
        "upper_wick": upper_wick,
        "lower_ratio": lower_ratio,
        "upper_ratio": upper_ratio,
        "body_ratio": body_ratio,
        "close_pos": close_pos,
    }


def is_lower_wick(
    metrics: Mapping[str, Any],
    thresholds: ReboundThresholds = DEFAULT_THRESHOLDS,
) -> bool:
    """Return True when the candle matches a generic lower-wick shape."""
    lower_ratio = _safe_float(metrics.get("lower_ratio"))
    lower_wick = _safe_float(metrics.get("lower_wick"))
    body = _safe_float(metrics.get("body"))
    close_pos = _safe_float(metrics.get("close_pos"))
    upper_wick = _safe_float(metrics.get("upper_wick"))

    if None in {lower_ratio, lower_wick, body, close_pos, upper_wick}:
        return False

    assert lower_ratio is not None
    assert lower_wick is not None
    assert body is not None
    assert close_pos is not None
    assert upper_wick is not None

    return (
        lower_ratio >= thresholds.lower_ratio_min
        and lower_wick >= body * thresholds.lower_vs_body_min
        and close_pos >= thresholds.close_pos_min
        and upper_wick <= lower_wick
    )


def is_strong_hammer_like(
    metrics: Mapping[str, Any],
    thresholds: ReboundThresholds = DEFAULT_THRESHOLDS,
) -> bool:
    """Return True when the candle matches a stronger hammer-like pattern."""
    lower_ratio = _safe_float(metrics.get("lower_ratio"))
    lower_wick = _safe_float(metrics.get("lower_wick"))
    body = _safe_float(metrics.get("body"))
    body_ratio = _safe_float(metrics.get("body_ratio"))
    upper_wick = _safe_float(metrics.get("upper_wick"))
    close_pos = _safe_float(metrics.get("close_pos"))

    if None in {lower_ratio, lower_wick, body, body_ratio, upper_wick, close_pos}:
        return False

    assert lower_ratio is not None
    assert lower_wick is not None
    assert body is not None
    assert body_ratio is not None
    assert upper_wick is not None
    assert close_pos is not None

    return (
        lower_ratio >= thresholds.strong_lower_ratio_min
        and lower_wick >= body * thresholds.strong_lower_vs_body_min
        and body_ratio <= thresholds.strong_body_ratio_max
        and upper_wick <= lower_wick * thresholds.strong_upper_vs_lower_max
        and close_pos >= thresholds.strong_close_pos_min
    )


def classify_rebound_signal(
    candle: Mapping[str, Any],
    thresholds: ReboundThresholds = DEFAULT_THRESHOLDS,
) -> dict[str, Any]:
    """Classify rebound signal from OHLC and context columns.

    Expected additional fields in `candle`:
    - prev_open
    - prev_close
    - ma5

    Category rules:
    - strong_rebound: strong_hammer_like and prev_bear and below_ma5
    - rebound_candidate: lower_wick and (prev_bear or below_ma5)
    - lower_wick_only: lower_wick only
    - none: otherwise
    """
    metrics = compute_candle_metrics(candle)
    lower_wick_flag = is_lower_wick(metrics, thresholds=thresholds)
    strong_hammer_flag = is_strong_hammer_like(metrics, thresholds=thresholds)

    prev_open = _safe_float(candle.get("prev_open"))
    prev_close = _safe_float(candle.get("prev_close"))
    ma5 = _safe_float(candle.get("ma5"))
    close_price = _safe_float(candle.get("close"))

    prev_bear = bool(
        prev_open is not None
        and prev_close is not None
        and prev_close < prev_open
    )
    below_ma5 = bool(
        close_price is not None
        and ma5 is not None
        and close_price < ma5
    )

    if strong_hammer_flag and prev_bear and below_ma5:
        category = "strong_rebound"
    elif lower_wick_flag and (prev_bear or below_ma5):
        category = "rebound_candidate"
    elif lower_wick_flag:
        category = "lower_wick_only"
    else:
        category = "none"

    return {
        "category": category,
        "lower_wick": lower_wick_flag,
        "strong_hammer_like": strong_hammer_flag,
        "prev_bear": prev_bear,
        "below_ma5": below_ma5,
        "metrics": metrics,
    }


def apply_rebound_signal(
    df: "pd.DataFrame",
    thresholds: ReboundThresholds = DEFAULT_THRESHOLDS,
) -> "pd.DataFrame":
    """Apply rebound signal classification to a DataFrame.

    Required columns:
    - open, high, low, close, prev_open, prev_close, ma5

    Added columns:
    - signal_category
    - lower_wick_flag
    - strong_hammer_flag
    - prev_bear_flag
    - below_ma5_flag
    - range
    - body
    - lower_wick
    - upper_wick
    - lower_ratio
    - upper_ratio
    - body_ratio
    - close_pos
    """
    import pandas as pd

    required = {"open", "high", "low", "close", "prev_open", "prev_close", "ma5"}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    out = df.copy()

    results = [
        classify_rebound_signal(row, thresholds=thresholds)
        for row in out.to_dict(orient="records")
    ]

    out["signal_category"] = [item["category"] for item in results]
    out["lower_wick_flag"] = [bool(item["lower_wick"]) for item in results]
    out["strong_hammer_flag"] = [bool(item["strong_hammer_like"]) for item in results]
    out["prev_bear_flag"] = [bool(item["prev_bear"]) for item in results]
    out["below_ma5_flag"] = [bool(item["below_ma5"]) for item in results]

    metric_keys = [
        "range",
        "body",
        "lower_wick",
        "upper_wick",
        "lower_ratio",
        "upper_ratio",
        "body_ratio",
        "close_pos",
    ]
    for key in metric_keys:
        out[key] = [item["metrics"].get(key) for item in results]

    return out


if __name__ == "__main__":
    # Single-candle example
    one_candle = {
        "open": 1000,
        "high": 1030,
        "low": 920,
        "close": 1015,
        "prev_open": 1025,
        "prev_close": 995,
        "ma5": 1020,
    }
    one_result = classify_rebound_signal(one_candle)
    print("single candle result:")
    print(one_result)

    # DataFrame screening example
    sample_df = pd.DataFrame(
        [
            {
                "open": 1000,
                "high": 1030,
                "low": 920,
                "close": 1015,
                "prev_open": 1025,
                "prev_close": 995,
                "ma5": 1020,
            },
            {
                "open": 1200,
                "high": 1210,
                "low": 1180,
                "close": 1185,
                "prev_open": 1170,
                "prev_close": 1190,
                "ma5": 1188,
            },
        ]
    )
    screened = apply_rebound_signal(sample_df)
    print("\nDataFrame screening result:")
    print(
        screened[
            [
                "signal_category",
                "lower_wick_flag",
                "strong_hammer_flag",
                "prev_bear_flag",
                "below_ma5_flag",
                "range",
                "body",
                "lower_wick",
                "upper_wick",
                "lower_ratio",
                "upper_ratio",
                "body_ratio",
                "close_pos",
            ]
        ]
    )
