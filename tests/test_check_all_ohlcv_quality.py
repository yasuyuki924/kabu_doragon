from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = ROOT / "scripts" / "check_all_ohlcv_quality.py"

spec = importlib.util.spec_from_file_location("check_all_ohlcv_quality", MODULE_PATH)
quality = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = quality
assert spec.loader is not None
spec.loader.exec_module(quality)


def row(date: str, close: float) -> dict:
    return {
        "date": date,
        "open": close,
        "high": close,
        "low": close,
        "close": close,
        "volume": 1000,
    }


class CheckAllOhlcvQualityTest(unittest.TestCase):
    def test_check_rows_detects_paired_split_like_jump(self) -> None:
        rows = [
            row("2026-03-19", 1000),
            row("2026-03-23", 200),
            row("2026-03-24", 205),
            row("2026-03-25", 210),
            row("2026-03-30", 1050),
        ]

        issues = quality.check_rows(
            "9999",
            "ohlcv",
            rows,
            min_rows=1,
            max_gap_days=10,
            paired_window=10,
            split_low_ratio=0.35,
            single_day_extreme_ratio=0.55,
        )

        self.assertTrue(any(item.kind == "paired_split_like_jump" for item in issues))

    def test_public_json_alignment_detects_close_mismatch(self) -> None:
        ohlcv_rows = [row("2026-05-01", 100), row("2026-05-02", 102)]
        public_rows = [row("2026-05-01", 100), row("2026-05-02", 90)]

        issues = quality.check_public_json_alignment(
            "9999",
            ohlcv_rows,
            public_rows,
            tolerance_pct=0.05,
        )

        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].kind, "close_mismatch")
        self.assertEqual(issues[0].severity, "critical")

    def test_repair_plan_compares_candidate_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repair_dir = Path(tmp) / "repair"
            repair_dir.mkdir()
            (repair_dir / "9999.csv").write_text(
                "\n".join(
                    [
                        "date,open,high,low,close,volume",
                        "2026-03-19,1000,1000,1000,1000,1000",
                        "2026-03-23,980,980,980,980,1200",
                        "2026-03-24,990,990,990,990,1300",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            issues = [
                quality.Issue(
                    code="9999",
                    source="ohlcv",
                    severity="critical",
                    kind="paired_split_like_jump",
                    message="test",
                    date="2026-03-23",
                    extra=None,
                )
            ]
            current_rows = {
                "9999": [
                    row("2026-03-19", 1000),
                    row("2026-03-23", 200),
                    row("2026-03-24", 210),
                    row("2026-03-30", 1050),
                ]
            }
            public_rows = {"9999": [row("2026-03-23", 200), row("2026-03-24", 210)]}

            plan = quality.build_repair_plan(issues, repair_dir, current_rows, public_rows)

        self.assertEqual(plan["codeCount"], 1)
        self.assertEqual(plan["readyCodeCount"], 1)
        item = plan["items"][0]
        self.assertEqual(item["status"], "ready_for_dry_run_review")
        self.assertEqual(item["currentChangedRows"], 2)
        self.assertEqual(item["publicChangedRows"], 2)
        self.assertEqual(item["coveredIssueDates"], ["2026-03-23"])
        self.assertEqual(item["currentTailRowsAfterCandidate"], 1)

    def test_load_active_codes_reads_watchlist_tickers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "watchlist.json"
            path.write_text(
                '[{"ticker":"4022"},{"code":"9600"},"7203"]',
                encoding="utf-8",
            )

            codes = quality.load_active_codes(path)

        self.assertEqual(codes, {"4022", "9600", "7203"})


if __name__ == "__main__":
    unittest.main()
