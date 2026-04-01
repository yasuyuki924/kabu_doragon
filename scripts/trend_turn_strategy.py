#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import math

import pandas as pd


@dataclass(frozen=True)
class Ma75TurnThresholds:
    """Thresholds for the ベース・リカバリー screening."""

    ref_days_below_ma75: int = 10
    below_ma75_window: int = 30
    below_ma75_min_count: int = 15
    above_ma75_window: int = 5
    above_ma75_min_count: int = 3


DEFAULT_THRESHOLDS = Ma75TurnThresholds()

OUTPUT_COLUMNS = [
    "code",
    "name",
    "breakout_date",
    "days_after_breakout",
    "range_pct",
    "above_ma75_ratio",
    "score",
    "reason",
]


def _empty_result() -> "pd.DataFrame":
    return pd.DataFrame(columns=OUTPUT_COLUMNS)


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(out):
        return None
    return out


def prepare_ma75_turn_features(
    df: "pd.DataFrame",
    thresholds: Ma75TurnThresholds = DEFAULT_THRESHOLDS,
) -> "pd.DataFrame":
    """Prepare rolling MA and helper columns for the ベース・リカバリー.

    Required columns:
    - date, open, high, low, close, volume
    """
    required = {"date", "open", "high", "low", "close", "volume"}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    out = df.copy()
    out = out.sort_values("date").reset_index(drop=True)

    for column in ["open", "high", "low", "close", "volume"]:
        out[column] = pd.to_numeric(out[column], errors="coerce")

    out["ma5"] = out["close"].rolling(5).mean()
    out["ma25"] = out["close"].rolling(25).mean()
    out["ma75"] = out["close"].rolling(75).mean()
    out["above_ma75"] = out["close"] > out["ma75"]
    out["below_ma75"] = out["close"] < out["ma75"]
    return out


def score_ma75_turn_candidate(
    df: "pd.DataFrame",
    thresholds: Ma75TurnThresholds = DEFAULT_THRESHOLDS,
) -> dict[str, Any]:
    """Score a valid ベース・リカバリー candidate using the requested MA75 counts."""
    latest_idx = int(df.index[-1])
    below_start = latest_idx - thresholds.below_ma75_window + 1
    above_start = latest_idx - thresholds.above_ma75_window + 1
    if below_start < 0 or above_start < 0:
        return {
            "range_pct": None,
            "above_ma75_ratio": None,
            "score": 0,
            "reason": "",
        }

    below_window = df.iloc[below_start : latest_idx + 1].copy()
    above_window = df.iloc[above_start : latest_idx + 1].copy()
    below_count = int(below_window["below_ma75"].fillna(False).sum())
    above_count = int(above_window["above_ma75"].fillna(False).sum())
    above_ma75_ratio = above_count / thresholds.above_ma75_window if thresholds.above_ma75_window else None
    score = int(below_count + above_count)
    reasons = [
        f"10日目前MA75下",
        f"30日中{below_count}日MA75下",
        f"5日中{above_count}日MA75上",
    ]

    return {
        "range_pct": float(below_count),
        "above_ma75_ratio": round(above_ma75_ratio, 4) if above_ma75_ratio is not None else None,
        "score": score,
        "reason": "|".join(reasons),
    }


def screen_ma75_turn_candidates(
    df: "pd.DataFrame",
    thresholds: Ma75TurnThresholds = DEFAULT_THRESHOLDS,
) -> "pd.DataFrame":
    """Screen one-stock daily DataFrame for ベース・リカバリー candidates."""
    featured = prepare_ma75_turn_features(df, thresholds=thresholds)
    if featured.empty:
        return _empty_result()

    latest_idx = int(featured.index[-1])
    required_history = max(75, thresholds.below_ma75_window, thresholds.ref_days_below_ma75)
    if latest_idx < required_history - 1:
        return _empty_result()

    latest = featured.iloc[latest_idx]
    ref_idx = latest_idx - thresholds.ref_days_below_ma75
    ref_row = featured.iloc[ref_idx]

    latest_close = _safe_float(latest["close"])
    latest_ma75 = _safe_float(latest["ma75"])
    ref_close = _safe_float(ref_row["close"])
    ref_ma75 = _safe_float(ref_row["ma75"])

    if None in {latest_close, latest_ma75, ref_close, ref_ma75}:
        return _empty_result()

    assert latest_close is not None
    assert latest_ma75 is not None
    assert ref_close is not None
    assert ref_ma75 is not None

    if not (ref_close < ref_ma75):
        return _empty_result()
    below_window = featured.iloc[latest_idx - thresholds.below_ma75_window + 1 : latest_idx + 1].copy()
    above_window = featured.iloc[latest_idx - thresholds.above_ma75_window + 1 : latest_idx + 1].copy()
    if below_window["ma75"].isna().any() or above_window["ma75"].isna().any():
        return _empty_result()
    below_count = int(below_window["below_ma75"].fillna(False).sum())
    above_count = int(above_window["above_ma75"].fillna(False).sum())
    if below_count < thresholds.below_ma75_min_count:
        return _empty_result()
    if above_count < thresholds.above_ma75_min_count:
        return _empty_result()
    scored = score_ma75_turn_candidate(featured, thresholds=thresholds)
    code = str(featured.iloc[-1].get("code") or "").strip()
    name = str(featured.iloc[-1].get("name") or "").strip()

    result = pd.DataFrame(
        [
            {
                "code": code,
                "name": name,
                "breakout_date": None,
                "days_after_breakout": None,
                "range_pct": scored["range_pct"],
                "above_ma75_ratio": scored["above_ma75_ratio"],
                "score": int(scored["score"]),
                "reason": str(scored["reason"] or ""),
            }
        ],
        columns=OUTPUT_COLUMNS,
    )
    return result


if __name__ == "__main__":
    sample_df = pd.DataFrame(
        [
            {"date": f"2026-01-{day:02d}", "open": 900 + day, "high": 920 + day, "low": 890 + day, "close": 895 + day, "volume": 200000}
            for day in range(1, 32)
        ]
        + [
            {"date": f"2026-02-{day:02d}", "open": 930 + day, "high": 950 + day, "low": 920 + day, "close": 935 + day, "volume": 260000}
            for day in range(1, 29)
        ]
        + [
            {"date": f"2026-03-{day:02d}", "open": 970 + day, "high": 1000 + day, "low": 965 + day, "close": 980 + day, "volume": 320000}
            for day in range(1, 31)
        ]
    )
    sample_df["code"] = "9999"
    sample_df["name"] = "サンプル銘柄"

    one_result = screen_ma75_turn_candidates(sample_df)
    print("single symbol result:")
    print(one_result)

    multi_df = pd.concat(
        [
            sample_df,
            sample_df.assign(code="8888", name="別サンプル", close=sample_df["close"] * 0.96),
        ],
        ignore_index=True,
    )
    grouped = (
        multi_df.groupby("code", group_keys=False)
        .apply(screen_ma75_turn_candidates, include_groups=False)
        .reset_index(drop=True)
    )
    print("\ngrouped screening result:")
    print(grouped)
