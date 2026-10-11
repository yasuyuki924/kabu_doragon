from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from src.data_source.inactive_codes import (
    INACTIVE_REASON_DELISTED,
    INACTIVE_REASON_JPX_CONFIRMED,
    INACTIVE_REASON_MASTER_MISSING,
    build_inactive_registry,
    summarize_inactive_codes,
    write_inactive_codes,
)


class InactiveCodesTest(unittest.TestCase):
    def test_build_inactive_registry_prefers_jpx_confirmation(self) -> None:
        items = build_inactive_registry(
            candidate_entries=[
                {"code": "1788", "name": "三東工業社", "market": "スタンダード"},
                {"code": "2293", "name": "滝沢ハム", "market": "スタンダード"},
                {"code": "9258", "name": "ＣＳ−Ｃ", "market": "グロース"},
            ],
            active_codes={"9258"},
            as_of_date="2026-04-24",
            existing_lookup={},
            jpx_lookup={
                "1788": {
                    "code": "1788",
                    "name": "三東工業社",
                    "market": "スタンダード",
                    "effectiveDate": "2026-04-24",
                    "source": "jpx_delisted",
                },
                "9258": {
                    "code": "9258",
                    "name": "ＣＳ−Ｃ",
                    "market": "グロース",
                    "effectiveDate": "2026-04-24",
                    "source": "jpx_delisted",
                },
            },
            checked_at="2026-04-24T19:00:00+09:00",
        )
        by_code = {item["code"]: item for item in items}

        self.assertEqual(by_code["1788"]["reason"], INACTIVE_REASON_JPX_CONFIRMED)
        self.assertIn(INACTIVE_REASON_DELISTED, by_code["1788"]["reasonCodes"])
        self.assertIn(INACTIVE_REASON_MASTER_MISSING, by_code["1788"]["reasonCodes"])

        self.assertEqual(by_code["2293"]["reason"], INACTIVE_REASON_MASTER_MISSING)
        self.assertEqual(by_code["2293"]["effectiveDate"], "2026-04-24")

        self.assertEqual(by_code["9258"]["reason"], INACTIVE_REASON_JPX_CONFIRMED)
        self.assertNotIn(INACTIVE_REASON_MASTER_MISSING, by_code["9258"]["reasonCodes"])

    def test_summarize_inactive_codes_respects_effective_date(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "inactive_codes.json"
            write_inactive_codes(
                [
                    {
                        "code": "1788",
                        "name": "三東工業社",
                        "market": "スタンダード",
                        "reason": INACTIVE_REASON_JPX_CONFIRMED,
                        "reasonCodes": [INACTIVE_REASON_DELISTED, INACTIVE_REASON_JPX_CONFIRMED],
                        "source": "jpx_delisted",
                        "effectiveDate": "2026-04-24",
                        "detectedAt": "2026-04-24T19:00:00+09:00",
                        "lastCheckedAt": "2026-04-24T19:00:00+09:00",
                    },
                    {
                        "code": "2293",
                        "name": "滝沢ハム",
                        "market": "スタンダード",
                        "reason": INACTIVE_REASON_MASTER_MISSING,
                        "reasonCodes": [INACTIVE_REASON_MASTER_MISSING],
                        "source": "jquants_master",
                        "effectiveDate": "2026-04-25",
                        "detectedAt": "2026-04-24T19:00:00+09:00",
                        "lastCheckedAt": "2026-04-24T19:00:00+09:00",
                    },
                ],
                as_of_date="2026-04-24",
                jpx_fetch_ok=True,
                path=path,
            )

            summary = summarize_inactive_codes("2026-04-24", path=path)
            self.assertEqual(summary["count"], 1)
            self.assertEqual(summary["codes"], ["1788"])
            self.assertEqual(summary["confirmedCount"], 1)


if __name__ == "__main__":
    unittest.main()
