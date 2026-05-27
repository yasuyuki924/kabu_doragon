from __future__ import annotations

import unittest
from datetime import date, timedelta

from src.indicators.core import build_enriched_rows
from src.screening.strategy_presets import STRATEGY_PRESET_MAP


def make_row(day: date, close: float, volume: int = 1000) -> dict[str, float | int | str]:
    return {
        "date": day.isoformat(),
        "open": close,
        "high": close * 1.01,
        "low": close * 0.99,
        "close": close,
        "volume": volume,
    }


class TrendTurnStrategyTest(unittest.TestCase):
    def test_build_enriched_rows_adds_trend_turn_match(self) -> None:
        start = date(2025, 1, 1)
        prices = [100.0] * 200 + [90.0] * 120 + [96.0]
        latest = build_enriched_rows([make_row(start + timedelta(days=index), close) for index, close in enumerate(prices)])[-1]

        self.assertTrue(latest["trendTurnCandidate"])
        self.assertIn("trend_turn", latest["strategyMatches"])
        self.assertIn("trend_turn", latest["strategyMetrics"])
        self.assertIn("trend_turn", latest["strategyReasons"])
        self.assertEqual(latest["strategyMetrics"]["trend_turn"]["lookbackDays"], 120)
        self.assertGreater(float(latest["strategyScores"]["trend_turn"]), 0)

    def test_non_breakout_rows_do_not_match(self) -> None:
        start = date(2025, 1, 1)
        prices = [100.0] * 200 + [90.0] * 121
        latest = build_enriched_rows([make_row(start + timedelta(days=index), close) for index, close in enumerate(prices)])[-1]

        self.assertFalse(latest["trendTurnCandidate"])
        self.assertNotIn("trend_turn", latest["strategyMatches"])

    def test_strategy_preset_is_registered(self) -> None:
        preset = STRATEGY_PRESET_MAP["trend_turn"]

        self.assertEqual(preset.params["timeframe"], "daily")
        self.assertIn("distanceToMa200", preset.displayMetrics)


if __name__ == "__main__":
    unittest.main()
