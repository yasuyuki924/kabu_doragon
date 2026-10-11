from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
MODULE_PATH = SCRIPTS_DIR / "apply_ohlcv_repair_plan.py"

spec = importlib.util.spec_from_file_location("apply_ohlcv_repair_plan", MODULE_PATH)
repair = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = repair
assert spec.loader is not None
spec.loader.exec_module(repair)


def row(date: str, close: float) -> dict:
    return {
        "date": date,
        "open": close,
        "high": close,
        "low": close,
        "close": close,
        "volume": 1000,
    }


class ApplyOhlcvRepairPlanTest(unittest.TestCase):
    def test_merge_candidate_with_tail_preserves_newer_current_rows(self) -> None:
        candidate = [row("2026-05-20", 100), row("2026-05-21", 101)]
        current = [
            row("2026-05-20", 20),
            row("2026-05-21", 21),
            row("2026-05-22", 102),
            row("2026-05-25", 103),
        ]

        merged = repair.merge_candidate_with_tail(candidate, current)

        self.assertEqual([item["date"] for item in merged], ["2026-05-20", "2026-05-21", "2026-05-22", "2026-05-25"])
        self.assertEqual(merged[0]["close"], 100)
        self.assertEqual(merged[-1]["close"], 103)

    def test_enrich_for_public_json_computes_ma_values(self) -> None:
        rows = [row("2026-05-20", 10), row("2026-05-21", 20), row("2026-05-22", 30)]

        enriched = repair.enrich_for_public_json(rows)

        self.assertEqual(enriched[-1]["ma5"], 20)
        self.assertEqual(enriched[-1]["ma25"], 20)
        self.assertEqual(enriched[-1]["close"], 30)

    def test_apply_deletes_successful_backups_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repair_dir = root / "repair"
            ohlcv_dir = root / "ohlcv"
            public_dir = root / "public"
            reports_dir = root / "reports"
            repair_dir.mkdir()
            ohlcv_dir.mkdir()
            public_dir.mkdir()
            reports_dir.mkdir()
            csv_text = "\n".join(
                [
                    "date,open,high,low,close,volume",
                    "2026-05-20,100,100,100,100,1000",
                    "2026-05-21,101,101,101,101,1000",
                ]
            ) + "\n"
            (repair_dir / "9999.csv").write_text(csv_text, encoding="utf-8")
            (ohlcv_dir / "9999.csv").write_text(csv_text.replace("101", "21"), encoding="utf-8")
            (public_dir / "9999.json").write_text(
                json.dumps({"ohlcv": [row("2026-05-20", 100), row("2026-05-21", 21)]}),
                encoding="utf-8",
            )
            report_path = root / "quality.json"
            report_path.write_text(
                json.dumps(
                    {
                        "repairPlan": {
                            "items": [
                                {
                                    "code": "9999",
                                    "status": "ready_for_dry_run_review",
                                }
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )
            args = type(
                "Args",
                (),
                {
                    "quality_report": report_path,
                    "reports_dir": reports_dir,
                    "repair_source_dir": repair_dir,
                    "ohlcv_dir": ohlcv_dir,
                    "public_json_dir": public_dir,
                    "codes": "",
                    "apply": True,
                    "keep_backups": False,
                    "recent_rows": 245,
                },
            )()

            metrics = repair.apply_or_plan(args)

        self.assertTrue(metrics["backupDirDeleted"])
        self.assertEqual(metrics["backupPolicy"], "delete_after_success")


if __name__ == "__main__":
    unittest.main()
