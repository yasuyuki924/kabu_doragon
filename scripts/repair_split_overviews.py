#!/usr/bin/env python3
"""Replace only split-affected records in existing daily/weekly/monthly overviews."""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path

from src.data_source.local_data import build_daily_record
from src.indicators.core import build_enriched_rows
from src.jquants_provider import read_ohlcv_rows


def repair_overviews(data_dir: Path, codes: list[str]) -> dict:
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
    staged = []
    record_count = 0
    try:
        for filename, timeframe in (
            ("market_pulse.json", "daily"),
            ("market_pulse_weekly.json", "weekly"),
            ("market_pulse_monthly.json", "monthly"),
        ):
            for path in sorted(root.glob(f"*/{filename}")):
                payload = json.loads(path.read_text(encoding="utf-8"))
                day = str(payload["date"])
                if day != path.parent.name:
                    raise ValueError(f"overview date/path mismatch: {path}")
                record_codes = [str(record.get("code", "")) for record in payload["records"]]
                if len(record_codes) != len(set(record_codes)):
                    raise ValueError(f"duplicate overview codes: {path}")
                records = []
                changed = 0
                for record in payload["records"]:
                    code = str(record.get("code", ""))
                    if code not in prepared:
                        records.append(record)
                        continue
                    rows, meta, enriched = prepared[code]
                    row = enriched.get(day)
                    if row is None:
                        raise ValueError(f"{code}: overview {day} has no matching OHLCV row")
                    if timeframe != "daily":
                        row = build_period_overview_row(row, rows, target_date=day, timeframe=timeframe)
                        if row is None:
                            raise ValueError(f"{code}: no {timeframe} row for {day}")
                    records.append(build_daily_record(meta, row))
                    changed += 1
                if not changed:
                    continue
                # Stage every replacement before touching an existing overview file.
                updated = {
                    **payload,
                    **build_overview_payload(records, target_date=day, updated_at=now,
                                             source="split_adjustment_repair", timeframe=timeframe),
                }
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                                 prefix=".split-", suffix=".tmp", delete=False) as file:
                    temporary = Path(file.name)
                    staged.append((temporary, path))
                    json.dump(updated, file, ensure_ascii=False, separators=(",", ":"))
                record_count += changed
        for temporary, path in staged:
            os.replace(temporary, path)
        return {"codeCount": len(prepared), "fileCount": len(staged), "recordCount": record_count}
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)
