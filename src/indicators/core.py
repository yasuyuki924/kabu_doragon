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
    ref_days_below_ma75=10,
    below_ma75_window=30,
    below_ma75_min_count=15,
    above_ma75_window=5,
    above_ma75_min_count=3,
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

        ref_index = index - TREND_TURN_THRESHOLDS.ref_days_below_ma75
        if ref_index >= 0 and ma75 is not None and ma_map[75][ref_index] is not None and float(rows[ref_index]["close"]) < float(ma_map[75][ref_index]):
            below_window_start = index - TREND_TURN_THRESHOLDS.below_ma75_window + 1
            above_window_start = index - TREND_TURN_THRESHOLDS.above_ma75_window + 1
            if below_window_start >= 0 and above_window_start >= 0:
                below_count = 0
                above_count = 0
                below_window_valid = True
                above_window_valid = True

                for pos in range(below_window_start, index + 1):
                    pos_ma75 = ma_map[75][pos]
                    if pos_ma75 is None:
                        below_window_valid = False
                        break
                    if float(rows[pos]["close"]) < float(pos_ma75):
                        below_count += 1

                for pos in range(above_window_start, index + 1):
                    pos_ma75 = ma_map[75][pos]
                    if pos_ma75 is None:
                        above_window_valid = False
                        break
                    if float(rows[pos]["close"]) > float(pos_ma75):
                        above_count += 1

                if below_window_valid and above_window_valid and below_count >= TREND_TURN_THRESHOLDS.below_ma75_min_count and above_count >= TREND_TURN_THRESHOLDS.above_ma75_min_count:
                    trend_turn_candidate = True
                    trend_turn_range_pct = float(below_count)
                    trend_turn_above_ma75_ratio = round(above_count / TREND_TURN_THRESHOLDS.above_ma75_window, 4)
                    trend_turn_score = int(below_count + above_count)
                    trend_turn_reason = "|".join(
                        [
                            "10日目前MA75下",
                            f"30日中{below_count}日MA75下",
                            f"5日中{above_count}日MA75上",
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
        }
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
