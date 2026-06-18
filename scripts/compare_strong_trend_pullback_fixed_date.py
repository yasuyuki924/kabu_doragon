#!/usr/bin/env python3
"""Compare Python and legacy JS-equivalent strong trend pullback results."""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
import csv
import json
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.indicators.core import build_enriched_rows

LOOKBACK_BARS = 60
MIN_RISE_PCT = 30
MIN_DROP_PCT = 15
MAX_DROP_PCT = 45
DEEP_DROP_PCT = 30


def finite_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and number not in {float("inf"), float("-inf")} else None


def round_number(value: Any, digits: int = 4) -> float | None:
    number = finite_number(value)
    return round(number, digits) if number is not None else None


def distance_pct_from_baseline(value: Any, baseline: Any) -> float | None:
    number = finite_number(value)
    base = finite_number(baseline)
    if number is None or base in {None, 0}:
        return None
    return ((number - base) / base) * 100


def average_rows(rows: list[dict[str, Any]], key: str) -> float | None:
    values = [value for row in rows if (value := finite_number(row.get(key))) is not None]
    return sum(values) / len(values) if values else None


def lower_wick_ratio(row: dict[str, Any]) -> float | None:
    open_value = finite_number(row.get("open"))
    close = finite_number(row.get("close"))
    low = finite_number(row.get("low"))
    high = finite_number(row.get("high"))
    if open_value is None or close is None or low is None or high is None or high <= low:
        return None
    return (min(open_value, close) - low) / (high - low)


def legacy_js_match(rows: list[dict[str, Any]], selected_date: str) -> dict[str, Any] | None:
    eligible = [row for row in rows if row.get("date") and (not selected_date or row["date"] <= selected_date)]
    if len(eligible) < LOOKBACK_BARS + 10:
        return None

    current = eligible[-1]
    current_close = finite_number(current.get("close"))
    current_ma5 = finite_number(current.get("ma5"))
    current_ma25 = finite_number(current.get("ma25"))
    current_ma75 = finite_number(current.get("ma75"))
    if current_close is None or current_ma5 is None or current_ma75 is None or current_close < current_ma5:
        return None

    trend_window = eligible[-LOOKBACK_BARS:]
    low_index = -1
    low = float("inf")
    high_index = -1
    high = float("-inf")
    rise_pct = float("-inf")
    for index, row in enumerate(trend_window):
        row_low = finite_number(row.get("low"))
        if row_low is not None and row_low < low:
            low = row_low
            low_index = index
        row_high = finite_number(row.get("high"))
        if row_high is not None and low_index >= 0 and index >= low_index:
            candidate_rise_pct = ((row_high - low) / low) * 100
            if candidate_rise_pct > rise_pct:
                rise_pct = candidate_rise_pct
                high = row_high
                high_index = index

    if not (low > 0) or not (high > 0) or high_index <= low_index or rise_pct < MIN_RISE_PCT:
        return None

    pullback_rows = trend_window[high_index + 1 :]
    if not pullback_rows:
        return None

    current_drawdown_pct = ((high - current_close) / high) * 100
    if current_drawdown_pct < MIN_DROP_PCT or current_drawdown_pct > MAX_DROP_PCT:
        return None

    old_ma75 = finite_number(eligible[max(0, len(eligible) - 21)].get("ma75"))
    ma75_slope_pct = ((current_ma75 - old_ma75) / old_ma75) * 100 if old_ma75 and current_ma75 else None
    if ma75_slope_pct is not None and ma75_slope_pct < -3:
        return None

    distance_to_ma75 = distance_pct_from_baseline(current_close, current_ma75)
    if distance_to_ma75 is not None and distance_to_ma75 < -8:
        return None

    def touches_ma(row: dict[str, Any], ma_key: str, threshold: float) -> bool:
        ma_value = finite_number(row.get(ma_key))
        if not ma_value:
            return False
        low_distance = abs(distance_pct_from_baseline(row.get("low"), ma_value) or float("inf"))
        close_distance = abs(distance_pct_from_baseline(row.get("close"), ma_value) or float("inf"))
        return min(low_distance, close_distance) <= threshold

    pullback_touches_ma25 = any(touches_ma(row, "ma25", 3.0) for row in pullback_rows)
    pullback_touches_ma75 = any(touches_ma(row, "ma75", 5.0) for row in pullback_rows)
    if not pullback_touches_ma25 and not pullback_touches_ma75:
        return None

    previous = eligible[-2] if len(eligible) >= 2 else {}
    previous_ma5 = finite_number(previous.get("ma5"))
    ma5_slope_up = previous_ma5 is not None and current_ma5 >= previous_ma5
    recent5_high = max((finite_number(row.get("high")) or float("-inf") for row in eligible[-6:-1]), default=float("-inf"))
    recent10_high = max((finite_number(row.get("high")) or float("-inf") for row in eligible[-11:-1]), default=float("-inf"))
    close_breaks5_high = recent5_high != float("-inf") and current_close > recent5_high
    close_breaks10_high = recent10_high != float("-inf") and current_close > recent10_high
    volume20 = average_rows(eligible[-21:-1], "volume")
    current_volume = finite_number(current.get("volume"))
    volume_ratio20 = current_volume / volume20 if volume20 and current_volume is not None else None
    rise_segment = trend_window[low_index : high_index + 1]
    rise_above_ma25_ratio = (
        sum(1 for row in rise_segment if finite_number(row.get("close")) is not None and finite_number(row.get("ma25")) is not None and float(row["close"]) > float(row["ma25"]))
        / len(rise_segment)
        if rise_segment
        else 0
    )
    pullback_volume = average_rows(pullback_rows[-10:], "volume")
    rise_volume = average_rows(rise_segment[-10:], "volume")
    volume_cooled = pullback_volume is not None and rise_volume is not None and pullback_volume <= rise_volume * 0.9
    has_lower_wick = max((lower_wick_ratio(row) or 0 for row in pullback_rows[-10:]), default=0) >= 0.35
    pullback_type = "deep_reset_pullback" if current_drawdown_pct >= DEEP_DROP_PCT else "normal_pullback"
    rebound_label = (
        "deep_reset_rebound"
        if pullback_type == "deep_reset_pullback"
        else "ma25_rebound"
        if pullback_touches_ma25 and current_ma25 is not None and current_close >= current_ma25
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
    score += 10 if pullback_touches_ma25 else 0
    score += 10 if pullback_touches_ma75 else 0
    score += 5 if current_close >= current_ma5 else 0
    score += 6 if current_ma25 is not None and current_close >= current_ma25 else 0
    score += 4 if current_close >= current_ma75 else 0
    score += 4 if ma5_slope_up else 0
    score += 5 if close_breaks5_high else 0
    score += 4 if close_breaks10_high else 0
    score += 8 if volume_ratio20 is not None and volume_ratio20 >= 1.2 else 5 if volume_ratio20 is not None and volume_ratio20 >= 1 else 0
    score += 4 if volume_cooled else 0
    score += 4 if has_lower_wick else 0
    score += min(10, rise_above_ma25_ratio * 10)
    score += 5 if ma75_slope_pct is None or ma75_slope_pct >= 0 else 2
    if pullback_type == "deep_reset_pullback":
        score = min(score, 82)
    if score < (48 if pullback_type == "deep_reset_pullback" else 55):
        return None

    return {
        "score": round_number(min(100, score)),
        "pullbackType": pullback_type,
        "reboundLabel": rebound_label,
        "risePct": round_number(rise_pct),
        "dropPct": round_number(current_drawdown_pct),
        "lowDate": trend_window[low_index].get("date") or None,
        "highDate": trend_window[high_index].get("date") or None,
        "distanceToMa25": round_number(distance_pct_from_baseline(current_close, current_ma25)) if current_ma25 else None,
        "distanceToMa75": round_number(distance_to_ma75),
        "ma75SlopePct": round_number(ma75_slope_pct),
        "volumeRatio20": round_number(volume_ratio20),
        "riseAboveMa25Ratio": round_number(rise_above_ma25_ratio),
        "touchedMa25": pullback_touches_ma25,
        "touchedMa75": pullback_touches_ma75,
        "closeBreaks5High": close_breaks5_high,
        "closeBreaks10High": close_breaks10_high,
    }


def load_rows(path: Path, selected_date: str, history_bars: int) -> list[dict[str, float | str]]:
    rows: list[dict[str, float | str]] = []
    with path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("date") and row["date"] <= selected_date:
                rows.append(
                    {
                        "date": row["date"],
                        "open": float(row["open"]),
                        "high": float(row["high"]),
                        "low": float(row["low"]),
                        "close": float(row["close"]),
                        "volume": float(row["volume"]),
                    }
                )
    return rows[-history_bars:]


def compare_code(args: tuple[str, str, int]) -> tuple[str, bool, dict[str, Any] | None, dict[str, Any] | None]:
    path_text, selected_date, history_bars = args
    path = Path(path_text)
    raw_rows = load_rows(path, selected_date, history_bars)
    if len(raw_rows) < LOOKBACK_BARS + 10:
        return path.stem, False, None, None
    enriched = build_enriched_rows(raw_rows)
    if not enriched or enriched[-1].get("date") != selected_date:
        return path.stem, False, None, None
    python_metrics = enriched[-1].get("strongTrendPullbackRebound") or {}
    python_result = python_metrics if isinstance(python_metrics, dict) and python_metrics.get("detected") else None
    js_result = legacy_js_match(enriched[-(LOOKBACK_BARS + 10) :], selected_date)
    return path.stem, True, python_result, js_result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--data-dir", type=Path, default=Path("data/ohlcv"))
    parser.add_argument("--history-bars", type=int, default=160)
    parser.add_argument("--limit-diffs", type=int, default=20)
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    args = parser.parse_args()

    python_results: dict[str, dict[str, Any]] = {}
    js_results: dict[str, dict[str, Any]] = {}
    scanned = 0
    worker_args = [(str(path), args.date, args.history_bars) for path in sorted(args.data_dir.glob("*.csv"))]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        for code, was_scanned, python_metrics, js_metrics in executor.map(compare_code, worker_args, chunksize=16):
            if not was_scanned:
                continue
            scanned += 1
            if python_metrics:
                python_results[code] = python_metrics
            if js_metrics:
                js_results[code] = js_metrics

    python_codes = set(python_results)
    js_codes = set(js_results)
    metric_keys = [
        "score",
        "pullbackType",
        "reboundLabel",
        "risePct",
        "dropPct",
        "lowDate",
        "highDate",
        "distanceToMa25",
        "distanceToMa75",
        "ma75SlopePct",
        "volumeRatio20",
        "riseAboveMa25Ratio",
        "touchedMa25",
        "touchedMa75",
        "closeBreaks5High",
        "closeBreaks10High",
    ]
    metric_diffs = []
    for code in sorted(python_codes & js_codes):
        diffs = {}
        for key in metric_keys:
            py_value = python_results[code].get(key)
            js_value = js_results[code].get(key)
            if isinstance(py_value, (int, float)) or isinstance(js_value, (int, float)):
                if py_value is None or js_value is None or abs(float(py_value) - float(js_value)) > 0.0001:
                    diffs[key] = [py_value, js_value]
            elif py_value != js_value:
                diffs[key] = [py_value, js_value]
        if diffs:
            metric_diffs.append({"code": code, "diffs": diffs})

    report = {
        "date": args.date,
        "dataDir": str(args.data_dir),
        "scannedCodes": scanned,
        "pythonCount": len(python_results),
        "legacyJsCount": len(js_results),
        "onlyPythonCount": len(python_codes - js_codes),
        "onlyPython": sorted(python_codes - js_codes),
        "onlyLegacyJsCount": len(js_codes - python_codes),
        "onlyLegacyJs": sorted(js_codes - python_codes),
        "metricDiffCount": len(metric_diffs),
        "metricDiffSample": metric_diffs[: args.limit_diffs],
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report["onlyPythonCount"] or report["onlyLegacyJsCount"] or report["metricDiffCount"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
