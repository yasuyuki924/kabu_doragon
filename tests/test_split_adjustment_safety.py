from __future__ import annotations

import dataclasses
import hashlib
import json
import shutil
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import yaml

from scripts.build_split_repair_candidate import build_candidate, write_json
from scripts.check_split_adjustment import check_dataset, event_digest
from scripts.check_split_adjustment import main as check_main
from scripts.fetch_split_action_inventory import fetch_inventory
from scripts.export_public_cache_snapshot import export_snapshot
from scripts.migrate_split_cache_candidate import migrate_candidate
from scripts.repair_split_overviews import repair_overviews
from src.jquants_provider import (
    apply_corporate_actions, default_paths, flush_pending_price_data,
    read_ohlcv_rows, sync_prices, write_corporate_action_events, write_ohlcv_rows,
)


def row(day, close, volume=100):
    return {"date": day, "open": close, "high": close, "low": close, "close": close, "volume": volume}


def event(code="4667", factor=3, day="2026-09-29"):
    return {"code": code, "effectiveDate": day, "factor": factor,
            "adjFactor": 1 / factor, "type": "split", "preShares": 1, "postShares": factor}


class SplitSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.data = self.root / "data"
        self.raw = [row("2026-09-25", 3300), row("2026-09-28", 3295), row("2026-09-29", 1032)]
        self.actions = [event()]
        self.put_dataset()

    def tearDown(self):
        self.temp.cleanup()

    def put_dataset(self):
        write_ohlcv_rows(self.data / "ohlcv_raw/4667.csv", self.raw)
        write_ohlcv_rows(self.data / "ohlcv/4667.csv", apply_corporate_actions(self.raw, self.actions))
        write_corporate_action_events(self.data / "corporate_actions/4667.json", code="4667", events=self.actions)
        write_json(self.data / "manifest.json", {"latestDate": "2026-09-29"})
        write_json(self.data / "public_json/ticker_meta/4667.json", {
            "code": "4667", "name": "Test", "market": "standard",
        })

    def paths(self, data):
        return dataclasses.replace(default_paths(), data_dir=data, ohlcv_dir=data / "ohlcv",
                                   ohlcv_raw_dir=data / "ohlcv_raw", corporate_actions_dir=data / "corporate_actions")

    def seal(self):
        state = check_dataset(self.data, ["4667"])
        write_json(self.data / "split_adjustment_state.json", state)

    def test_restored_cache_keeps_split_on_next_day_and_duplicate_update(self):
        self.seal()
        restored = self.root / "restored"
        shutil.copytree(self.data, restored)
        check_dataset(restored, ["4667"], require_state=True)
        next_day = row("2026-09-30", 1040)
        flush_pending_price_data(self.paths(restored), {"4667": [next_day]}, {})
        check_dataset(restored, ["4667"], require_state=True)
        before = (restored / "ohlcv/4667.csv").read_bytes()
        flush_pending_price_data(self.paths(restored), {"4667": [next_day]}, {})
        self.assertEqual(before, (restored / "ohlcv/4667.csv").read_bytes())
        self.assertAlmostEqual(read_ohlcv_rows(restored / "ohlcv/4667.csv")[1]["close"], 1098.3333)

    def test_lost_metadata_is_blocked_before_mutation(self):
        self.seal()
        (self.data / "corporate_actions/4667.json").unlink()
        before = (self.data / "ohlcv/4667.csv").read_bytes()
        with self.assertRaisesRegex(ValueError, "missing/changed"):
            check_dataset(self.data, ["4667"], require_state=True)
        self.assertEqual(before, (self.data / "ohlcv/4667.csv").read_bytes())

    def test_legacy_cache_without_certificate_requires_explicit_migration(self):
        with self.assertRaisesRegex(ValueError, "explicit isolated migration"):
            check_dataset(self.data, ["4667"], require_state=True)

    def test_empty_certificate_does_not_pass(self):
        write_json(self.data / "split_adjustment_state.json", {"schemaVersion": 1, "actionDigests": {}})
        with self.assertRaisesRegex(ValueError, "incomplete code coverage"):
            check_dataset(self.data, ["4667"], require_state=True)

    def test_metadata_loss_after_update_is_also_blocked_before_sealing(self):
        self.seal()
        (self.data / "corporate_actions/4667.json").unlink()
        write_ohlcv_rows(self.data / "ohlcv/4667.csv", self.raw)
        with self.assertRaisesRegex(ValueError, "previously verified"):
            check_dataset(self.data, ["4667"])

    def test_official_non_split_price_jump_does_not_block_verified_cache(self):
        self.raw = [row("2026-09-25", 1), row("2026-09-28", 2), row("2026-09-29", 2)]
        self.actions = []
        self.put_dataset()
        inventory = {"source": "jquants-v2", "coverage": {"4667": {"fromDate": "2026-09-25", "toDate": "2026-09-29"}},
                     "actionDigests": {"4667": event_digest([])}}
        state = check_dataset(self.data, ["4667"], official_inventory=inventory)
        write_json(self.data / "split_adjustment_state.json", state)
        check_dataset(self.data, ["4667"], require_state=True)

    def test_missing_api_adjustment_factor_stops_before_price_writes(self):
        class Client:
            def get_eq_bars_daily(inner, **kwargs):
                return pd.DataFrame([{"Code": "46670", "Date": "2026-09-30", "O": 1040, "H": 1040,
                                      "L": 1040, "C": 1040, "Vo": 100}])
        before = (self.data / "ohlcv_raw/4667.csv").read_bytes()
        with patch("src.jquants_provider.fetch_trading_dates", return_value=[date(2026, 9, 30)]):
            with self.assertRaisesRegex(ValueError, "adjustment factors"):
                sync_prices(Client(), "v2", self.paths(self.data), ["4667"], date(2026, 9, 30), date(2026, 9, 30), 1)
        self.assertEqual(before, (self.data / "ohlcv_raw/4667.csv").read_bytes())

    def test_already_broken_cache_without_metadata_cannot_be_sealed(self):
        (self.data / "corporate_actions/4667.json").unlink()
        write_ohlcv_rows(self.data / "ohlcv/4667.csv", self.raw)
        with self.assertRaisesRegex(ValueError, "unexplained price scale"):
            check_dataset(self.data, ["4667"])

    def test_double_adjusted_and_wrong_date_are_blocked(self):
        wrong = [event(day="2026-09-30")]
        self.raw.append(row("2026-09-30", 1040))
        self.actions = wrong
        self.put_dataset()
        with self.assertRaisesRegex(ValueError, "unexplained price scale"):
            check_dataset(self.data, ["4667"])

    def test_multiple_splits_are_applied_once_from_raw(self):
        raw = [row("2026-03-27", 600), row("2026-03-30", 300), row("2026-09-29", 100)]
        actions = [event(factor=2, day="2026-03-30"), event(factor=3)]
        adjusted = apply_corporate_actions(raw, actions)
        self.assertEqual([value["close"] for value in adjusted], [100, 100, 100])
        self.assertEqual([value["volume"] for value in adjusted], [600, 300, 100])

    def test_generated_timestamp_does_not_invalidate_action_digest(self):
        self.assertEqual(event_digest(self.actions), event_digest([{**self.actions[0], "generatedAt": "changed"}]))
        self.assertEqual(event_digest(self.actions), event_digest([{**self.actions[0], "factor": 3.0000000003}]))

    def test_candidate_checks_all_prices_volume_and_ma(self):
        output = self.root / "candidate"
        report = build_candidate(self.data, self.data / "corporate_actions", output, ["4667"], [])
        self.assertTrue(report["candidateOnly"])
        check_dataset(output / "data", ["4667"], public=True)
        chart = output / "data/public_json/ticker_recent/1y/ohlcv_ma/4667.json"
        payload = json.loads(chart.read_text())
        payload["ohlcv"][-1]["ma200"] = 999
        write_json(chart, payload)
        with self.assertRaisesRegex(ValueError, "MA200"):
            check_dataset(output / "data", ["4667"], public=True)

    def test_candidate_refuses_source_overlap_and_existing_output(self):
        with self.assertRaisesRegex(ValueError, "new and separate"):
            build_candidate(self.data, self.data / "corporate_actions", self.data / "candidate", ["4667"], [])
        with self.assertRaisesRegex(ValueError, "new and separate"):
            build_candidate(self.data, self.data / "corporate_actions", self.root, ["4667"], [])

    def test_all_three_overviews_keep_unrelated_records(self):
        untouched = {"code": "7203", "date": "2026-09-29", "close": 2500, "changePercent": 4.2}
        for filename in ("market_pulse.json", "market_pulse_weekly.json", "market_pulse_monthly.json"):
            write_json(self.data / "public_json/overview_lite/2026-09-29" / filename, {
                "date": "2026-09-29", "records": [
                    {"code": "4667", "date": "2026-09-29", "changePercent": -68.68}, untouched,
                ],
            })
        result = repair_overviews(self.data, ["4667"])
        self.assertEqual(result["fileCount"], 3)
        for path in (self.data / "public_json/overview_lite/2026-09-29").glob("*.json"):
            payload = json.loads(path.read_text())
            self.assertEqual(payload["records"][1], untouched)
            expected = -6.1818 if path.name == "market_pulse_monthly.json" else -6.0395
            self.assertAlmostEqual(payload["records"][0]["changePercent"], expected, places=3)
            self.assertIn("strategyMatches", payload["records"][0])

    def test_overview_validation_failure_leaves_existing_files_unchanged(self):
        valid = self.data / "public_json/overview_lite/2026-09-29/market_pulse.json"
        invalid = self.data / "public_json/overview_lite/2026-10-01/market_pulse.json"
        for path in (valid, invalid):
            write_json(path, {"date": path.parent.name, "records": [{"code": "4667"}]})
        before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in (valid, invalid)}
        with self.assertRaisesRegex(ValueError, "no matching OHLCV"):
            repair_overviews(self.data, ["4667"])
        after = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in (valid, invalid)}
        self.assertEqual(before, after)
        self.assertFalse(list(self.data.rglob(".split-*.tmp")))

    def test_first_sealing_requires_official_inventory(self):
        output = self.root / "candidate"
        build_candidate(self.data, self.data / "corporate_actions", output, ["4667"], [])
        with patch("sys.argv", ["check_split_adjustment.py", "--data-dir", str(output / "data"), "--public", "--seal"]):
            self.assertEqual(check_main(), 1)
        self.assertFalse((output / "data/split_adjustment_state.json").exists())

    def test_official_inventory_covers_every_retained_date_and_does_not_write_prices(self):
        calls = []
        class Client:
            def get_eq_bars_daily(inner, *, date_yyyymmdd):
                calls.append(date_yyyymmdd)
                day = f"{date_yyyymmdd[:4]}-{date_yyyymmdd[4:6]}-{date_yyyymmdd[6:]}"
                return pd.DataFrame([{"Code": "46670", "Date": day,
                                      "AdjFactor": 1 / 3 if day == "2026-09-29" else 1}])
        before = (self.data / "ohlcv_raw/4667.csv").read_bytes()
        inventory = fetch_inventory(Client(), self.data, self.root / "inventory", ["4667"])
        self.assertEqual(calls, ["20260925", "20260928", "20260929"])
        self.assertEqual(before, (self.data / "ohlcv_raw/4667.csv").read_bytes())
        self.assertEqual(inventory["actionDigests"]["4667"], event_digest(self.actions))
        output = self.root / "candidate"
        build_candidate(self.data, self.data / "corporate_actions", output, ["4667"], [])
        with patch("sys.argv", ["check_split_adjustment.py", "--data-dir", str(output / "data"), "--public", "--seal",
                                "--bootstrap-inventory", str(self.root / "inventory/action_inventory.json")]):
            self.assertEqual(check_main(), 0)
        check_dataset(output / "data", ["4667"], require_state=True, public=True)

    def test_incomplete_official_response_cannot_produce_inventory(self):
        class Client:
            def get_eq_bars_daily(inner, **kwargs):
                return pd.DataFrame([{"Code": "72030", "Date": "2026-09-25", "AdjFactor": 1}])
        with self.assertRaisesRegex(ValueError, "coverage missing"):
            fetch_inventory(Client(), self.data, self.root / "inventory", ["4667"])
        self.assertFalse((self.root / "inventory").exists())

    def test_nonfinite_official_factor_cannot_produce_inventory(self):
        class Client:
            def get_eq_bars_daily(inner, **kwargs):
                return pd.DataFrame([{"Code": "46670", "Date": "2026-09-25", "AdjFactor": float("inf")}])
        with self.assertRaisesRegex(ValueError, "coverage missing"):
            fetch_inventory(Client(), self.data, self.root / "inventory", ["4667"])
        self.assertFalse((self.root / "inventory").exists())

    def test_interrupted_inventory_resumes_receipts_without_certifying_partial_work(self):
        calls = []
        class Client:
            fail = True
            def get_eq_bars_daily(inner, *, date_yyyymmdd):
                calls.append(date_yyyymmdd)
                if inner.fail and date_yyyymmdd == "20260928":
                    raise RuntimeError("fixture interruption")
                day = f"{date_yyyymmdd[:4]}-{date_yyyymmdd[4:6]}-{date_yyyymmdd[6:]}"
                return pd.DataFrame([{"Code": "46670", "Date": day,
                                      "AdjFactor": 1 / 3 if day == "2026-09-29" else 1}])
        client = Client()
        output, receipts = self.root / "inventory", self.root / "receipts"
        with self.assertRaisesRegex(RuntimeError, "interruption"):
            fetch_inventory(client, self.data, output, ["4667"], receipt_dir=receipts)
        self.assertFalse(output.exists())
        self.assertTrue((receipts / "2026-09-25.json").exists())
        client.fail = False
        inventory = fetch_inventory(client, self.data, output, ["4667"], receipt_dir=receipts)
        self.assertEqual(calls.count("20260925"), 1)
        self.assertEqual(inventory["actionDigests"]["4667"], event_digest(self.actions))

    def test_inventory_receipts_cannot_overlap_source(self):
        with self.assertRaisesRegex(ValueError, "receipts must be separate"):
            fetch_inventory(None, self.data, self.root / "inventory", ["4667"], receipt_dir=self.data / "receipts")

    def test_workflow_blocks_legacy_before_fetch_and_seals_before_save(self):
        workflow = yaml.safe_load((Path(__file__).resolve().parents[1] / ".github/workflows/pages.yml").read_text())
        steps = workflow["jobs"]["build"]["steps"]
        positions = {step["name"]: index for index, step in enumerate(steps)}
        self.assertLess(positions["Validate restored split metadata before any data writes"],
                        positions["Incremental public JSON from J-Quants"])
        self.assertLess(positions["Validate and seal candidate before cache save or publication"],
                        positions["Save generated public data cache"])
        for name in ("Restore generated public data cache", "Save generated public data cache"):
            step = steps[positions[name]]
            self.assertIn("data/corporate_actions", step["with"]["path"])
            self.assertIn("data/split_adjustment_state.json", step["with"]["path"])
            self.assertIn("kabu-pages-split-v1-", step["with"]["key"])
        restored = steps[positions["Restore generated public data cache"]]
        self.assertNotIn("kabu-pages-data-", restored["with"]["restore-keys"])

    def test_export_does_not_mutate_source_or_accept_wrong_cache(self):
        source = self.root / "export-source"
        write_ohlcv_rows(source / "ohlcv_raw/4667.csv", self.raw)
        write_json(source / "manifest.json", {"latestDate": "2026-09-29"})
        before = (source / "ohlcv_raw/4667.csv").read_bytes()
        key = "kabu-pages-data-Linux-main-123"
        report = export_snapshot(source, self.root / "export-output", key, key)
        self.assertTrue(report["sourceFilesUnchanged"])
        self.assertEqual(before, (source / "ohlcv_raw/4667.csv").read_bytes())
        with self.assertRaisesRegex(ValueError, "exact matching"):
            export_snapshot(source, self.root / "wrong-output", key, key + "4")
        self.assertFalse((self.root / "wrong-output").exists())

    def test_export_rejects_unexpected_files_and_symlinks(self):
        source = self.root / "export-source"
        source.mkdir()
        (source / ".env").write_text("fixture")
        key = "kabu-pages-data-Linux-main-123"
        with self.assertRaisesRegex(ValueError, "outside"):
            export_snapshot(source, self.root / "export-output", key, key)
        (source / ".env").unlink()
        (source / "ohlcv_raw").symlink_to(self.data / "ohlcv_raw", target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlinks"):
            export_snapshot(source, self.root / "export-output", key, key)

    def test_export_workflow_cannot_deploy_or_cancel_production(self):
        workflow = yaml.safe_load((Path(__file__).resolve().parents[1] / ".github/workflows/pages.yml").read_text())
        export = workflow["jobs"]["export-cache"]
        self.assertEqual(export["permissions"], {"contents": "read"})
        self.assertNotIn("environment", export)
        self.assertIn("split-cache-export-", workflow["concurrency"]["group"])
        self.assertIn("export_legacy_cache", workflow["jobs"]["build"]["if"])
        for step in export["steps"]:
            self.assertNotIn("deploy", step.get("uses", ""))
            self.assertNotIn("cache/save", step.get("uses", ""))
            self.assertNotIn("secrets.", json.dumps(step))

    def test_full_snapshot_migration_repairs_only_affected_prices_and_preserves_raw_bytes(self):
        source = self.root / "snapshot"
        inventory_root = self.root / "official"
        codes = ["4667", "6327", "7162", "7203", "9983"]
        days = []
        day = date(2025, 1, 1)
        while day <= date(2026, 9, 29):
            if day.weekday() < 5:
                days.append(day.isoformat())
            day += timedelta(days=1)
        coverage, digests = {}, {}
        from scripts.build_split_repair_candidate import write_ticker_candidate
        for code in codes:
            rows = [row(day, 3295 if code == "4667" and day < "2026-09-29" else 1032 if code == "4667" else 100) for day in days]
            for directory in ("ohlcv_raw", "ohlcv"):
                write_ohlcv_rows(source / directory / f"{code}.csv", rows)
            write_json(source / "public_json/ticker_meta" / f"{code}.json", {"code": code, "name": code, "market": "standard"})
            write_ticker_candidate(source, code, rows, "fixture")
            events = [event()] if code == "4667" else []
            write_json(inventory_root / "corporate_actions" / f"{code}.json", {"code": code, "events": events})
            coverage[code] = {"fromDate": days[0], "toDate": days[-1]}
            digests[code] = event_digest(events)
        write_json(source / "manifest.json", {"latestDate": days[-1]})
        (source / "watchlist.json").write_text(json.dumps([{"ticker": code} for code in codes]))
        write_json(inventory_root / "action_inventory.json", {"source": "jquants-v2", "coverage": coverage, "actionDigests": digests})
        before = {str(path.relative_to(source)): path.read_bytes() for path in source.rglob("*") if path.is_file()}
        output = self.root / "migration"
        report = migrate_candidate(source, inventory_root, output)
        self.assertEqual(report["changedCodes"], ["4667"])
        self.assertTrue(report["rawFilesByteIdentical"])
        check_dataset(output / "data", codes, require_state=True, public=True)
        for name, original in before.items():
            self.assertEqual((source / name).read_bytes(), original)
            if name.startswith("ohlcv_raw/") or (name.startswith("ohlcv/") and "4667" not in name):
                self.assertEqual((output / "data" / name).read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
