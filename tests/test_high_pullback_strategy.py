from __future__ import annotations

import unittest
from datetime import date, timedelta

from src.indicators.core import build_enriched_rows
from src.screening.strategy_presets import STRATEGY_PRESET_MAP


def make_row(day: date, close: float, high: float | None = None, low: float | None = None) -> dict[str, float | int | str]:
    return {
        "date": day.isoformat(),
        "open": close,
        "high": high if high is not None else close * 1.01,
        "low": low if low is not None else close * 0.99,
        "close": close,
        "volume": 1000,
    }


class HighPullbackStrategyTest(unittest.TestCase):
    def test_build_enriched_rows_adds_high_pullback_match(self) -> None:
        start = date(2025, 1, 1)
        rows = [make_row(start + timedelta(days=index), 100.0) for index in range(199)]
        rows.append(make_row(start + timedelta(days=199), 100.0, high=200.0, low=198.0))
        rows.append(make_row(start + timedelta(days=200), 130.0, high=132.0, low=130.0))
        rows.append(make_row(start + timedelta(days=201), 138.0, high=140.0, low=138.0))

        latest = build_enriched_rows(rows)[-1]

        self.assertTrue(latest["highPullback30Candidate"])
        self.assertIn("high_pullback_30", latest["strategyMatches"])
        self.assertIn("high_pullback_30", latest["strategyMetrics"])
        self.assertIn("high_pullback_30", latest["strategyReasons"])
        self.assertEqual(latest["highPullback30HighDate"], rows[199]["date"])
        self.assertEqual(latest["highPullback30LowDate"], rows[200]["date"])
        self.assertGreaterEqual(float(latest["highPullback30DropRate"] or 0), 30)

    def test_old_pullback_low_does_not_match(self) -> None:
        start = date(2025, 1, 1)
        rows = [make_row(start + timedelta(days=index), 100.0) for index in range(199)]
        rows.append(make_row(start + timedelta(days=199), 100.0, high=200.0, low=198.0))
        rows.append(make_row(start + timedelta(days=200), 130.0, high=132.0, low=130.0))
        rows.extend(make_row(start + timedelta(days=201 + index), 138.0) for index in range(5))

        latest = build_enriched_rows(rows)[-1]

        self.assertFalse(latest["highPullback30Candidate"])
        self.assertNotIn("high_pullback_30", latest["strategyMatches"])

    def test_strategy_preset_is_registered(self) -> None:
        preset = STRATEGY_PRESET_MAP["high_pullback_30"]

        self.assertEqual(preset.params["timeframe"], "daily")
        self.assertIn("dropRate", preset.displayMetrics)


if __name__ == "__main__":
    unittest.main()
