from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from src.utils.screening import (
    detect_base,
    has_liquidity,
    is_above_ma,
    is_breakout_candidate,
    is_donchian_breakout,
    is_ma_stack,
    is_near_high,
    is_rsi_pullback,
    is_stage2_candidate,
)


StrategyMetrics = dict[str, float | int | str | bool | None]


@dataclass(frozen=True)
class StrategyMatchResult:
    matched: bool
    score: float
    reasons: list[str]
    excluded: bool
    excludedReasons: list[str]
    metrics: StrategyMetrics
    tags: list[str]


@dataclass(frozen=True)
class StrategyPreset:
    id: str
    name: str
    description: str
    params: dict[str, Any]
    displayMetrics: list[str]
    reasonTemplates: dict[str, str]
    evaluate: Callable[[dict[str, Any]], StrategyMatchResult]

    def sortScore(self, match: StrategyMatchResult) -> float:
        return float(match.score)


def _round(value: float | None, digits: int = 4) -> float | None:
    return round(value, digits) if value is not None else None


def _base_result(metrics: StrategyMetrics | None = None) -> StrategyMatchResult:
    return StrategyMatchResult(False, 0.0, [], False, [], metrics or {}, [])


def _with_result(
    matched: bool,
    score: float,
    reasons: list[str],
    excluded: bool,
    excluded_reasons: list[str],
    metrics: StrategyMetrics,
    tags: list[str] | None = None,
) -> StrategyMatchResult:
    return StrategyMatchResult(
        matched=matched,
        score=round(score, 4),
        reasons=reasons,
        excluded=excluded,
        excludedReasons=excluded_reasons,
        metrics=metrics,
        tags=tags or [],
    )


def evaluate_minervini(context: dict[str, Any]) -> StrategyMatchResult:
    row = context["row"]
    params = context["params"]
    close = row.get("close")
    ma50 = row.get("ma50")
    ma150 = row.get("ma150")
    ma200 = row.get("ma200")
    near_high_ratio = row.get("near52wHighRatio")
    recovery_from_low = row.get("recoveryFrom52wLowPct")
    turnover_ma5 = row.get("turnoverMa5")
    volume_ratio25 = row.get("volumeRatio25")
    ma200_slope_pct = row.get("ma200SlopePct")
    base_info = row.get("base10to30") or {}
    distance_to_base_high = row.get("distanceToBaseHighPct")
    distance_to_prev_high = row.get("distanceToPrevHighPct")
    recent_volatility = row.get("volatility20Pct")

    metrics: StrategyMetrics = {
        "distanceTo52wHighPct": row.get("distanceTo52wHighPct"),
        "recoveryFrom52wLowPct": recovery_from_low,
        "maStackAligned": is_ma_stack(ma50, ma150, ma200),
        "ma200SlopePct": ma200_slope_pct,
        "basePeriodDays": base_info.get("window"),
        "distanceToBaseHighPct": distance_to_base_high,
    }
    reasons: list[str] = []
    excluded: list[str] = []
    score = 0.0

    if close is None:
        return _base_result(metrics)
    if close < params["minClose"]:
        excluded.append("低位株を除外")
    if not has_liquidity(turnover_ma5, volume_ratio25, params["minTurnoverMa5"], params["minVolumeRatio25"]):
        excluded.append("流動性不足を除外")
    if row.get("unstableBelowMa200Days", 0) > params["unstableBelowMa200MaxDays"]:
        excluded.append("200日線下の不安定推移を除外")
    if recent_volatility is not None and recent_volatility > params["maxVolatility20Pct"]:
        excluded.append("急騰後の乱高下を除外")
    if excluded:
        return _with_result(False, 0.0, [], True, excluded, metrics)

    above_all_ma = all(is_above_ma(close, ma_value) for ma_value in [ma50, ma150, ma200])
    stack_ok = is_ma_stack(ma50, ma150, ma200)
    ma200_up = ma200_slope_pct is not None and ma200_slope_pct > 0
    near_high_ok = near_high_ratio is not None and near_high_ratio >= params["near52wHighMinRatio"]
    recovery_ok = recovery_from_low is not None and recovery_from_low >= params["minRecoveryFrom52wLowPct"]
    base_ok = bool(base_info.get("detected"))
    breakout_distance = min(
        [value for value in [distance_to_base_high, distance_to_prev_high] if value is not None],
        default=None,
    )
    breakout_ok = breakout_distance is not None and breakout_distance <= params["breakoutProximityMaxPct"]

    if above_all_ma:
        reasons.append("株価が50日・150日・200日線の上")
        score += 3
    if stack_ok:
        reasons.append("移動平均線が理想的な順列")
        score += 3
    if ma200_up:
        reasons.append(f"200日線が上向き ({ma200_slope_pct:+.1f}%)")
        score += 2
    if near_high_ok:
        reasons.append(f"52週高値まで残り{row.get('distanceTo52wHighPct', 0):.1f}%")
        score += 2
    if recovery_ok:
        reasons.append(f"52週安値から{recovery_from_low:.1f}%回復")
        score += 1

    if base_ok:
        reasons.append(f"高値圏で{base_info.get('window')}日間の持ち合い")
        score += 2
    if breakout_ok:
        reasons.append(f"レンジ上限まで残り{breakout_distance:.1f}%でブレイク候補")
        score += 2

    matched = above_all_ma and stack_ok and ma200_up and near_high_ok and recovery_ok
    return _with_result(matched, score, reasons, False, [], metrics, ["trend", "breakout"])


def evaluate_stage2(context: dict[str, Any]) -> StrategyMatchResult:
    row = context["row"]
    params = context["params"]
    long_ma_key = f"ma{params['longMaWindow']}"
    long_ma = row.get(long_ma_key)
    long_ma_slope = row.get(f"{long_ma_key}SlopePct")
    base_info = row.get("base20to60") or {}
    distance_to_base_high = row.get("distanceToMidBaseHighPct")
    distance_to_long_ma = row.get(f"distanceTo{long_ma_key[0].upper()}{long_ma_key[1:]}") or row.get("distanceToLongMaPct")
    metrics: StrategyMetrics = {
        "stage": "Stage 2" if is_stage2_candidate(row.get("close"), long_ma, long_ma_slope) else "None",
        "distanceToLongMaPct": distance_to_long_ma,
        "longMaSlopePct": long_ma_slope,
        "basePeriodDays": base_info.get("window"),
        "distanceToBaseHighPct": distance_to_base_high,
    }
    reasons: list[str] = []
    excluded: list[str] = []
    score = 0.0

    if row.get("close", 0) < params["minClose"]:
        excluded.append("低位株を除外")
    if not has_liquidity(row.get("turnoverMa5"), row.get("volumeRatio25"), params["minTurnoverMa5"], params["minVolumeRatio25"]):
        excluded.append("流動性不足を除外")
    if long_ma_slope is None or long_ma_slope <= 0:
        excluded.append("長期線が横ばい以下")
    if row.get("close") is not None and long_ma is not None and row["close"] <= long_ma:
        excluded.append("長期線の下で推移")
    if distance_to_long_ma is not None and distance_to_long_ma > params["maxDistanceToLongMaPct"]:
        excluded.append("長期線から離れすぎ")
    if row.get("volatility20Pct") is not None and row["volatility20Pct"] > params["maxVolatility20Pct"]:
        excluded.append("天井圏の乱高下を除外")
    if excluded:
        return _with_result(False, 0.0, [], True, excluded, metrics)

    above_long_ma = is_above_ma(row.get("close"), long_ma)
    long_ma_up = long_ma_slope is not None and long_ma_slope > 0
    base_ok = bool(base_info.get("detected"))
    breakout_ok = is_breakout_candidate(row.get("close"), base_info.get("high"), params["breakoutProximityMaxPct"])

    if above_long_ma:
        reasons.append(f"{params['longMaWindow']}日線の上で推移")
        score += 2
    if long_ma_up:
        reasons.append(f"{params['longMaWindow']}日線が上向き")
        score += 2
    if base_ok:
        reasons.append(f"{base_info.get('window')}日ベースの上限付近")
        score += 2
    if breakout_ok:
        reasons.append("中期ブレイク候補")
        score += 2
    if row.get("volumeRatio25") is not None and row["volumeRatio25"] >= params["volumeBoostThreshold"]:
        reasons.append(f"出来高倍率 {row['volumeRatio25']:.1f}倍")
        score += 1
    if reasons:
        reasons.insert(0, "Stage 2 候補")
        score += 1
    matched = above_long_ma and long_ma_up and base_ok and breakout_ok
    return _with_result(matched, score, reasons, False, [], metrics, ["trend", "stage2"])


def evaluate_turtle(context: dict[str, Any]) -> StrategyMatchResult:
    row = context["row"]
    params = context["params"]
    periods = params["breakoutPeriods"]
    breakout_hits: list[tuple[int, float | None, str]] = []
    for period in periods:
        level = row.get(f"donchian{period}High")
        if is_donchian_breakout(row.get("close"), row.get("high"), level, params["useCloseBreakout"], params["useHighBreakout"]):
            breakout_hits.append((period, level, f"{period}日高値更新"))
    metrics: StrategyMetrics = {
        "breakoutPeriod": breakout_hits[0][0] if breakout_hits else None,
        "breakoutDistancePct": row.get("distanceToDonchian20Pct") if breakout_hits and breakout_hits[0][0] == 20 else row.get("distanceToDonchian55Pct"),
        "volumeRatio25": row.get("volumeRatio25"),
        "preBreakoutRangePct": row.get("base10to20", {}).get("range_pct"),
    }
    excluded: list[str] = []
    reasons: list[str] = []
    score = 0.0

    if row.get("close", 0) < params["minClose"]:
        excluded.append("低位株を除外")
    if not has_liquidity(row.get("turnoverMa5"), row.get("volumeRatio25"), params["minTurnoverMa5"], params["minVolumeRatio25"]):
        excluded.append("低流動性銘柄を除外")
    if row.get("upperWick3dAvg") is not None and row["upperWick3dAvg"] > params["maxUpperWickRatio"]:
        excluded.append("長い上ヒゲ連発を除外")
    if not breakout_hits:
        return _with_result(False, 0.0, [], False, [], metrics)
    if params["volumeBoostRequired"] and (row.get("volumeRatio25") or 0) < params["volumeBoostThreshold"]:
        excluded.append("出来高不足のブレイクを除外")
    if row.get("newHigh20dCount10") is not None and row["newHigh20dCount10"] > params["maxRecentBreakoutCount"]:
        excluded.append("連続急騰後の追いかけを除外")
    if excluded:
        return _with_result(False, 0.0, [], True, excluded, metrics)

    close_above_ma50 = is_above_ma(row.get("close"), row.get("ma50"))
    close_above_ma150 = is_above_ma(row.get("close"), row.get("ma150"))
    base_info = row.get("base10to20") or {}
    base_ok = bool(base_info.get("detected"))

    for _, level, label in breakout_hits:
        reasons.append(label)
        if level not in {None, 0} and row.get("close") is not None:
            update_pct = ((float(row["close"]) - float(level)) / float(level)) * 100
            reasons.append(f"高値更新幅 {update_pct:+.1f}%")
        score += 2
    if row.get("volumeRatio25") is not None and row["volumeRatio25"] >= params["volumeBoostThreshold"]:
        reasons.append(f"出来高倍率 {row['volumeRatio25']:.1f}倍")
        score += 1.5
    if close_above_ma50:
        reasons.append("50日線の上で推移")
        score += 0.5
    if close_above_ma150:
        reasons.append("150日線の上で推移")
        score += 0.5
    if base_ok:
        reasons.append("レンジ収縮後の上放れ")
        score += 1.5

    matched = bool(breakout_hits)
    return _with_result(matched, score, reasons, False, [], metrics, ["trend", "breakout", "turtle"])


def evaluate_can_slim(context: dict[str, Any]) -> StrategyMatchResult:
    row = context["row"]
    params = context["params"]
    base_info = row.get("base20to60") or {}
    metrics: StrategyMetrics = {
        "fundamentalMode": "technical_optional",
        "distanceTo52wHighPct": row.get("distanceTo52wHighPct"),
        "turnoverMa5": row.get("turnoverMa5"),
        "basePeriodDays": base_info.get("window"),
        "distanceToBaseHighPct": row.get("distanceToMidBaseHighPct"),
    }
    excluded: list[str] = []
    reasons: list[str] = []
    score = 0.0

    if row.get("close", 0) < params["minClose"]:
        excluded.append("低位株を除外")
    if not has_liquidity(row.get("turnoverMa5"), row.get("volumeRatio25"), params["minTurnoverMa5"], params["minVolumeRatio25"]):
        excluded.append("流動性不足を除外")
    if row.get("volatility20Pct") is not None and row["volatility20Pct"] > params["maxVolatility20Pct"]:
        excluded.append("テーマ先行の急騰を減点・除外")
    if excluded:
        return _with_result(False, 0.0, [], True, excluded, metrics)

    high_ok = is_near_high(row.get("close"), row.get("high52w"), params["near52wHighMinRatio"])
    turnover_ok = row.get("turnoverMa5") is not None and row["turnoverMa5"] >= params["minTurnoverMa5"]
    volume_ok = row.get("volumeRatio25") is not None and row["volumeRatio25"] >= params["volumeBoostThreshold"]
    breakout_ok = base_info.get("detected") and is_breakout_candidate(row.get("close"), base_info.get("high"), params["breakoutProximityMaxPct"])
    trend_ok = is_ma_stack(row.get("ma50"), row.get("ma150"), row.get("ma200"))

    if high_ok:
        reasons.append("高値圏で推移")
        score += 2
    if turnover_ok:
        reasons.append("売買代金が増加")
        score += 1.5
    if volume_ok:
        reasons.append("需給良好")
        score += 1.5
    if breakout_ok:
        reasons.append("ベース上抜け候補")
        score += 2
    if trend_ok:
        reasons.append("トレンドが上向き")
        score += 1
    matched = high_ok and breakout_ok and (turnover_ok or volume_ok) and trend_ok
    return _with_result(matched, score, reasons, False, [], metrics, ["growth", "canslim"])


def evaluate_rsi2_pullback(context: dict[str, Any]) -> StrategyMatchResult:
    row = context["row"]
    params = context["params"]
    trend_ma = row.get(params["trendFilter"])
    rsi2 = row.get("rsi2")
    metrics: StrategyMetrics = {
        "rsi2": rsi2,
        "consecutiveDownDays": row.get("consecutiveDownDays"),
        "distanceToMa50": row.get("distanceToMa50"),
        "distanceToMa150": row.get("distanceToMa150"),
        "pullbackDepthPct": row.get("distanceToMa50") if params["trendFilter"] == "ma50" else row.get("distanceToMa150"),
    }
    excluded: list[str] = []
    reasons: list[str] = []
    score = 0.0

    if row.get("close", 0) < params["minClose"]:
        excluded.append("低位株を除外")
    if not has_liquidity(row.get("turnoverMa5"), row.get("volumeRatio25"), params["minTurnoverMa5"], params["minVolumeRatio25"]):
        excluded.append("板薄銘柄を除外")
    if row.get("ma200SlopePct") is not None and row["ma200SlopePct"] <= 0:
        excluded.append("長期トレンドが下向き")
    if row.get("changePercent") is not None and row["changePercent"] <= params["maxSingleDayDropPct"]:
        excluded.append("悪材料急落を除外")
    if excluded:
        return _with_result(False, 0.0, [], True, excluded, metrics)

    trend_ok = row.get("ma200SlopePct") is not None and row["ma200SlopePct"] > 0 and is_above_ma(row.get("close"), trend_ma)
    rsi_ok = rsi2 is not None and rsi2 <= params["rsiThreshold"]
    down_days_ok = row.get("consecutiveDownDays", 0) >= params["minConsecutiveDownDays"]

    if is_rsi_pullback(row.get("close"), trend_ma, rsi2, params["rsiThreshold"]):
        reasons.append("上昇トレンド内の短期売られすぎ")
        score += 2
    if rsi_ok:
        reasons.append(f"RSI(2) = {rsi2:.1f}")
        score += 2
    if down_days_ok:
        reasons.append(f"陰線{row['consecutiveDownDays']}本続き")
        score += 1
    pullback_depth = metrics["pullbackDepthPct"]
    if pullback_depth is not None:
        reasons.append(f"{params['trendFilter'].upper()}から {pullback_depth:+.1f}% の押し目")
        score += 1
    if row.get("volumeRatio25") is not None and row["volumeRatio25"] >= params["minVolumeRatio25"]:
        score += 0.5
    if reasons:
        reasons.append("押し目候補")
    matched = trend_ok and rsi_ok and down_days_ok
    return _with_result(matched, score, reasons, False, [], metrics, ["pullback", "mean_reversion"])


def evaluate_high_pullback_30(context: dict[str, Any]) -> StrategyMatchResult:
    row = context["row"]
    params = context["params"]
    metrics = dict(row.get("highPullback30") or {})
    if not metrics.get("detected"):
        return _base_result(metrics)

    drop_rate = metrics.get("dropRate")
    bars_to_low = metrics.get("barsToLow")
    current_drawdown = metrics.get("currentDrawdownPct")
    reasons: list[str] = []
    score = float(drop_rate or 0)
    if drop_rate is not None:
        reasons.append(f"200本最高値から{drop_rate:.1f}%調整")
    if bars_to_low is not None:
        reasons.append(f"高値後{bars_to_low}本で安値形成")
    if metrics.get("barsSinceLow") is not None:
        reasons.append(f"下落達成から{metrics['barsSinceLow']}本以内")
    if current_drawdown is not None:
        reasons.append(f"現在値は高値から{current_drawdown:.1f}%下")

    return _with_result(
        True,
        score,
        reasons,
        False,
        [],
        {
            **metrics,
            "lookbackBars": params["lookbackBars"],
            "lookaheadBars": params["lookaheadBars"],
            "recentAchievementBars": params["recentAchievementBars"],
            "minDropPct": params["minDropPct"],
        },
        ["daily_only", "pullback", "reset"],
    )


STRATEGY_PRESETS: list[StrategyPreset] = [
    StrategyPreset(
        id="minervini_trend_template",
        name="Minervini Trend Template",
        description="高値圏の強い上昇トレンドとベース形成を重視するブレイク候補。",
        params={
            "minClose": 300.0,
            "minTurnoverMa5": 100_000_000.0,
            "minVolumeRatio25": 1.0,
            "near52wHighMinRatio": 0.85,
            "minRecoveryFrom52wLowPct": 30.0,
            "breakoutProximityMaxPct": 3.0,
            "maxVolatility20Pct": 18.0,
            "unstableBelowMa200MaxDays": 3,
        },
        displayMetrics=[
            "distanceTo52wHighPct",
            "recoveryFrom52wLowPct",
            "ma200SlopePct",
            "basePeriodDays",
            "distanceToBaseHighPct",
        ],
        reasonTemplates={},
        evaluate=evaluate_minervini,
    ),
    StrategyPreset(
        id="stan_weinstein_stage2",
        name="Stan Weinstein Stage Analysis",
        description="長期線の上昇と中期ベースからの Stage 2 移行候補。",
        params={
            "longMaWindow": 150,
            "minClose": 300.0,
            "minTurnoverMa5": 100_000_000.0,
            "minVolumeRatio25": 0.9,
            "breakoutProximityMaxPct": 3.0,
            "volumeBoostThreshold": 1.3,
            "maxDistanceToLongMaPct": 25.0,
            "maxVolatility20Pct": 20.0,
        },
        displayMetrics=["stage", "distanceToLongMaPct", "longMaSlopePct", "basePeriodDays", "distanceToBaseHighPct"],
        reasonTemplates={},
        evaluate=evaluate_stage2,
    ),
    StrategyPreset(
        id="turtle_donchian_breakout",
        name="Turtle Trading / Donchian Breakout",
        description="20日または55日高値更新を機械的に拾うブレイクアウト戦略。",
        params={
            "breakoutPeriods": [20, 55],
            "useCloseBreakout": True,
            "useHighBreakout": True,
            "volumeBoostRequired": False,
            "volumeBoostThreshold": 1.3,
            "minClose": 200.0,
            "minTurnoverMa5": 80_000_000.0,
            "minVolumeRatio25": 0.8,
            "maxUpperWickRatio": 0.45,
            "maxRecentBreakoutCount": 4,
        },
        displayMetrics=["breakoutPeriod", "breakoutDistancePct", "volumeRatio25", "preBreakoutRangePct"],
        reasonTemplates={},
        evaluate=evaluate_turtle,
    ),
    StrategyPreset(
        id="can_slim",
        name="CAN SLIM",
        description="業績データ未接続時は高値圏・需給・ブレイクを重視する technical-first 実装。",
        params={
            "minClose": 300.0,
            "minTurnoverMa5": 120_000_000.0,
            "minVolumeRatio25": 1.0,
            "near52wHighMinRatio": 0.88,
            "breakoutProximityMaxPct": 3.0,
            "volumeBoostThreshold": 1.4,
            "maxVolatility20Pct": 22.0,
        },
        displayMetrics=["fundamentalMode", "distanceTo52wHighPct", "turnoverMa5", "basePeriodDays", "distanceToBaseHighPct"],
        reasonTemplates={},
        evaluate=evaluate_can_slim,
    ),
    StrategyPreset(
        id="rsi2_pullback",
        name="RSI(2) Pullback",
        description="上昇トレンド内の短期押し目を RSI(2) と陰線継続で拾う。",
        params={
            "rsiPeriod": 2,
            "rsiThreshold": 10.0,
            "rsiThresholdOptions": [5, 10, 15],
            "trendFilter": "ma50",
            "minClose": 200.0,
            "minTurnoverMa5": 80_000_000.0,
            "minVolumeRatio25": 0.8,
            "minConsecutiveDownDays": 2,
            "maxSingleDayDropPct": -8.0,
        },
        displayMetrics=["rsi2", "consecutiveDownDays", "distanceToMa50", "distanceToMa150", "pullbackDepthPct"],
        reasonTemplates={},
        evaluate=evaluate_rsi2_pullback,
    ),
    StrategyPreset(
        id="high_pullback_30",
        name="High Pullback 30%",
        description="直近200本高値の後、10本以内に30%以上調整し、その達成日が直近5本以内の銘柄を拾う。",
        params={
            "lookbackBars": 200,
            "lookaheadBars": 10,
            "recentAchievementBars": 5,
            "minDropPct": 30.0,
            "timeframe": "daily",
        },
        displayMetrics=[
            "highest200",
            "highDate",
            "afterLow",
            "afterLowDate",
            "barsToLow",
            "barsSinceLow",
            "dropRate",
            "currentClose",
            "currentDrawdownPct",
        ],
        reasonTemplates={},
        evaluate=evaluate_high_pullback_30,
    ),
]

STRATEGY_PRESET_MAP = {preset.id: preset for preset in STRATEGY_PRESETS}


def evaluate_strategies(row: dict[str, Any]) -> dict[str, StrategyMatchResult]:
    results: dict[str, StrategyMatchResult] = {}
    for preset in STRATEGY_PRESETS:
        results[preset.id] = preset.evaluate({"row": row, "params": preset.params})
    return results
