from __future__ import annotations

import unittest
from datetime import date, timedelta

from src.indicators.core import build_enriched_rows
from src.screening.strategy_presets import STRATEGY_PRESET_MAP


def make_row(day: date, close: float, volume: int = 1000) -> dict[str, float | int | str]:
    return {
        "date": day.isoformat(),
        "open": close * 0.98,
        "high": close * 1.03,
        "low": close * 0.96,
        "close": close,
        "volume": volume,
    }


def strong_pullback_rows() -> list[dict[str, float | int | str]]:
    start = date(2026, 1, 1)
    prices: list[float] = []
    prices.extend([100.0] * 25)
    prices.extend(100.0 + index * (100.0 / 29.0) for index in range(30))
    prices.extend(200.0 - index * (45.0 / 19.0) for index in range(20))
    prices.extend([156.0, 158.0, 160.0, 162.0, 164.0])
    return [
        make_row(start + timedelta(days=index), close, 1000 if index < 55 else 900)
        for index, close in enumerate(prices)
    ]


class StrongTrendPullbackStrategyTest(unittest.TestCase):
    def test_build_enriched_rows_adds_strong_trend_pullback_match(self) -> None:
        latest = build_enriched_rows(strong_pullback_rows())[-1]

        self.assertTrue(latest["strongTrendPullbackReboundCandidate"])
        self.assertIn("strong_trend_pullback_rebound", latest["strategyMatches"])
        self.assertGreater(float(latest["strongTrendPullbackReboundScore"] or 0), 55)
        self.assertEqual(latest["strongTrendPullbackReboundType"], "normal_pullback")
        self.assertEqual(latest["strongTrendPullbackReboundLabel"], "ma75_rebound")
        self.assertGreater(float(latest["strongTrendPullbackReboundRisePct"] or 0), 30)
        self.assertGreater(float(latest["strongTrendPullbackReboundDropPct"] or 0), 15)
        self.assertIn("strong_trend_pullback_rebound", latest["strategyMetrics"])
        self.assertIn("strong_trend_pullback_rebound", latest["strategyReasons"])

    def test_sideways_rows_do_not_match(self) -> None:
        start = date(2026, 1, 1)
        rows = [make_row(start + timedelta(days=index), 100.0 + (index % 3), 1000) for index in range(90)]
        latest = build_enriched_rows(rows)[-1]

        self.assertFalse(latest["strongTrendPullbackReboundCandidate"])
        self.assertNotIn("strong_trend_pullback_rebound", latest["strategyMatches"])

    def test_strategy_preset_is_registered(self) -> None:
        preset = STRATEGY_PRESET_MAP["strong_trend_pullback_rebound"]

        self.assertEqual(preset.params["timeframe"], "daily")
        self.assertIn("pullbackType", preset.displayMetrics)


if __name__ == "__main__":
    unittest.main()
