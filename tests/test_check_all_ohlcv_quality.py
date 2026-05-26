from __future__ import annotations

import importlib.util
import json
import subprocess
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

    def test_build_ui_summary_keeps_only_actionable_samples(self) -> None:
        payload = {
            "generatedAt": "2026-05-26T18:00:00",
            "summary": {
                "issueCount": 2,
                "criticalCount": 1,
                "warningCount": 1,
                "byKind": {"ohlc_inconsistent": 1, "large_date_gap": 1},
            },
            "triage": {
                "counts": {
                    "repair_first": 1,
                    "gate_candidate": 0,
                    "manual_review": 0,
                    "observe": 1,
                }
            },
            "activeCodes": {"count": 10},
            "issues": [
                {
                    "code": "9600",
                    "source": "ohlcv",
                    "severity": "critical",
                    "kind": "ohlc_inconsistent",
                    "date": "2022-05-17",
                    "message": "bad ohlc",
                },
                {
                    "code": "1301",
                    "source": "ohlcv",
                    "severity": "warning",
                    "kind": "large_date_gap",
                    "date": "2022-05-06",
                    "message": "gap",
                },
            ],
        }

        summary = quality.build_ui_summary(payload)

        self.assertEqual(summary["status"], "WARN")
        self.assertEqual(summary["actionableCount"], 1)
        self.assertEqual(len(summary["samples"]), 1)
        self.assertEqual(summary["samples"][0]["code"], "9600")

    def test_warning_mode_writes_ui_summary_without_stopping_on_bad_dummy_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ohlcv_dir = root / "ohlcv"
            public_dir = root / "public_json"
            repair_dir = root / "repair"
            reports_dir = root / "reports"
            summary_path = root / "ohlcv_quality_summary.json"
            for path in [ohlcv_dir, public_dir, repair_dir, reports_dir]:
                path.mkdir(parents=True)
            (root / "watchlist.json").write_text('[{"ticker":"9999"}]', encoding="utf-8")
            (ohlcv_dir / "9999.csv").write_text(
                "\n".join(
                    [
                        "date,open,high,low,close,volume",
                        "2026-05-20,100,101,99,100,1000",
                        "2026-05-21,100,101,99,102,1000",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            result = subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
                    "--ohlcv-dir",
                    str(ohlcv_dir),
                    "--public-json-dir",
                    str(public_dir),
                    "--active-codes-path",
                    str(root / "watchlist.json"),
                    "--repair-source-dir",
                    str(repair_dir),
                    "--reports-dir",
                    str(reports_dir),
                    "--summary-json",
                    str(summary_path),
                    "--no-report",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            report_files = list(reports_dir.glob("*"))

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(summary["status"], "WARN")
        self.assertEqual(summary["actionableCount"], 1)
        self.assertEqual(summary["samples"][0]["code"], "9999")
        self.assertEqual(summary["samples"][0]["kind"], "ohlc_inconsistent")
        self.assertEqual(report_files, [])

    def test_warning_mode_writes_ok_summary_for_clean_dummy_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ohlcv_dir = root / "ohlcv"
            public_dir = root / "public_json"
            repair_dir = root / "repair"
            reports_dir = root / "reports"
            summary_path = root / "ohlcv_quality_summary.json"
            for path in [ohlcv_dir, public_dir, repair_dir, reports_dir]:
                path.mkdir(parents=True)
            (root / "watchlist.json").write_text('[{"ticker":"9999"}]', encoding="utf-8")
            (ohlcv_dir / "9999.csv").write_text(
                "\n".join(
                    [
                        "date,open,high,low,close,volume",
                        "2026-05-20,100,101,99,100,1000",
                        "2026-05-21,100,102,99,101,1100",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            result = subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
                    "--ohlcv-dir",
                    str(ohlcv_dir),
                    "--public-json-dir",
                    str(public_dir),
                    "--active-codes-path",
                    str(root / "watchlist.json"),
                    "--repair-source-dir",
                    str(repair_dir),
                    "--reports-dir",
                    str(reports_dir),
                    "--summary-json",
                    str(summary_path),
                    "--no-report",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            report_files = list(reports_dir.glob("*"))

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(summary["status"], "OK")
        self.assertEqual(summary["actionableCount"], 0)
        self.assertEqual(summary["samples"], [])
        self.assertEqual(report_files, [])


if __name__ == "__main__":
    unittest.main()
