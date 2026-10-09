#!/usr/bin/env python3
"""Replace only split-affected records in existing daily/weekly/monthly overviews."""

from __future__ import annotations

import json
import hashlib
import os
import tempfile
from datetime import datetime
from pathlib import Path
from contextlib import nullcontext

from src.data_source.local_data import build_daily_record
from src.indicators.core import build_enriched_rows
from src.jquants_provider import read_ohlcv_rows


def restore_overviews(journal_path: Path) -> None:
    journal = json.loads(journal_path.read_text())
    for item in reversed(journal):
        path = Path(item["path"])
        current = json.loads(path.read_text())
        records = [item["records"].get(str(record.get("code")), record) for record in current["records"]]
        restored = {key: records if key == "records" else item["headers"][key] for key in item["keys"]}
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".split-", suffix=".tmp", delete=False) as file:
            temporary = Path(file.name)
            try:
                json.dump(restored, file, ensure_ascii=False, separators=(",", ":"))
                file.close()
                os.replace(temporary, path)
            finally:
                temporary.unlink(missing_ok=True)


def repair_overviews(data_dir: Path, codes: list[str], *, start_date: str | None = None,
                     journal_dir: Path | None = None, max_temporary_bytes: int = 100_000_000) -> dict:
    from scripts.incremental_jquants_update import build_overview_payload, build_period_overview_row

    if not codes:
        return {"codeCount": 0, "fileCount": 0, "recordCount": 0}
    root = data_dir / "public_json/overview_lite"
    prepared = {}
    for code in sorted(set(codes)):
        rows = read_ohlcv_rows(data_dir / "ohlcv" / f"{code}.csv")
        meta = json.loads((data_dir / "public_json/ticker_meta" / f"{code}.json").read_text())
        prepared[code] = (rows, meta, {row["date"]: row for row in build_enriched_rows(rows)})
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    plans = []
    record_count = 0
    # Validate all selected snapshots before replacing any file. Journal target
    # records only; never duplicate the whole all-market overview history.
    context = nullcontext(str(journal_dir)) if journal_dir else tempfile.TemporaryDirectory(prefix="kabu-split-overview-")
    with context as directory:
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        journal_path = directory / "overview_rollback.json"
        if journal_path.exists():
            raise ValueError("overview journal already exists; inspect the previous operation")
        for filename, timeframe in (
            ("market_pulse.json", "daily"),
            ("market_pulse_weekly.json", "weekly"),
            ("market_pulse_monthly.json", "monthly"),
        ):
            for path in sorted(root.glob(f"*/{filename}")):
                if start_date and path.parent.name < start_date:
                    continue
                payload = json.loads(path.read_text(encoding="utf-8"))
                day = str(payload["date"])
                if day != path.parent.name:
                    raise ValueError(f"overview date/path mismatch: {path}")
                record_codes = [str(record.get("code", "")) for record in payload["records"]]
                if len(record_codes) != len(set(record_codes)):
                    raise ValueError(f"duplicate overview codes: {path}")
                replacements = {}
                originals = {}
                for record in payload["records"]:
                    code = str(record.get("code", ""))
                    if code not in prepared:
                        continue
                    rows, meta, enriched = prepared[code]
                    row = enriched.get(day)
                    if row is None:
                        raise ValueError(f"{code}: overview {day} has no matching OHLCV row")
                    if timeframe != "daily":
                        row = build_period_overview_row(row, rows, target_date=day, timeframe=timeframe)
                        if row is None:
                            raise ValueError(f"{code}: no {timeframe} row for {day}")
                    replacement = build_daily_record(meta, row)
                    if replacement != record:
                        replacements[code] = replacement
                        originals[code] = record
                if not replacements:
                    continue
                plans.append({"path": str(path.resolve()), "date": day, "timeframe": timeframe,
                              "hash": hashlib.sha256(path.read_bytes()).hexdigest(),
                              "keys": list(payload), "headers": {k: v for k, v in payload.items() if k != "records"},
                              "records": originals, "replacements": replacements})
        rollback = [{k: v for k, v in plan.items() if k != "replacements"} for plan in plans]
        journal_path.write_text(json.dumps(rollback, ensure_ascii=False, separators=(",", ":")))
        peak = journal_path.stat().st_size + max((Path(item["path"]).stat().st_size * 2 for item in plans), default=0)
        if peak > max_temporary_bytes:
            raise ValueError(f"bounded overview temporary budget exceeded: {peak}")
        applied = []
        try:
            for plan in plans:
                path = Path(plan["path"])
                if hashlib.sha256(path.read_bytes()).hexdigest() != plan["hash"]:
                    raise ValueError(f"overview changed concurrently: {path}")
                payload = json.loads(path.read_text())
                records = [plan["replacements"].get(str(record.get("code")), record) for record in payload["records"]]
                updated = {**payload, **build_overview_payload(records, target_date=plan["date"], updated_at=now,
                                                               source="split_adjustment_repair", timeframe=plan["timeframe"])}
                updated["records"] = records
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                                 prefix=".split-", suffix=".tmp", delete=False) as file:
                    temporary = Path(file.name)
                    try:
                        json.dump(updated, file, ensure_ascii=False, separators=(",", ":"))
                        file.close()
                        os.replace(temporary, path)
                    finally:
                        temporary.unlink(missing_ok=True)
                applied.append(plan)
                record_count += len(plan["replacements"])
        except BaseException:
            journal_path.write_text(json.dumps([{k: v for k, v in plan.items() if k != "replacements"} for plan in applied],
                                              ensure_ascii=False, separators=(",", ":")))
            restore_overviews(journal_path)
            raise
        return {"codeCount": len(prepared), "fileCount": len(plans), "recordCount": record_count,
                "startDate": start_date, "temporaryPeakBytesUpperBound": peak}
