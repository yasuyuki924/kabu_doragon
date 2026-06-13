#!/usr/bin/env python3
"""Build a small GitHub Pages site artifact for KabuDragon.

The full local data directory is intentionally too large for GitHub Pages.
This script copies only static frontend assets and trims public runtime JSON to
the recent window needed by the hosted scanner.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "_site"
DEFAULT_RECENT_DAYS = 45

STATIC_FILES = (
    "index.html",
    "ticker.html",
    "picked.html",
    "registered.html",
)
STATIC_DIRS = ("assets",)
DATA_FILES = (
    "manifest.json",
    "update_health.json",
    "ohlcv_quality_summary.json",
    "watchlist.json",
)
PUBLIC_JSON_DIRS = (
    "ticker_recent/1y/ohlcv_ma",
    "ticker_meta",
)

OVERVIEW_RECORD_KEYS = {
    "code",
    "name",
    "market",
    "sector",
    "industry",
    "tags",
    "themes",
    "links",
    "date",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "change",
    "changePercent",
    "distanceToMa25",
    "distanceToMa75",
    "distanceToMa200",
    "volumeRatio25",
    "turnover",
    "turnoverMa5",
    "dataQuality",
    "newHigh52w",
    "newHigh20d",
    "bullishCloseBreakout20d",
    "trendTurnCandidate",
    "trendTurnBreakoutDate",
    "trendTurnDaysAfterBreakout",
    "trendTurnRangePct",
    "trendTurnScore",
    "trendTurnAboveMa75Ratio",
    "trendTurnReason",
    "signalCategory",
    "strategyMatches",
    "strategyScores",
    "strategyReasons",
    "strategyExcludedReasons",
    "strategyMetrics",
    "highPullback30",
    "highPullback30Candidate",
    "highPullback30DropRate",
    "highPullback30HighDate",
    "highPullback30LowDate",
    "highPullback30BarsToLow",
    "strongTrendPullbackRebound",
    "strongTrendPullbackReboundCandidate",
    "strongTrendPullbackReboundScore",
    "strongTrendPullbackReboundType",
    "strongTrendPullbackReboundLabel",
    "strongTrendPullbackReboundRisePct",
    "strongTrendPullbackReboundDropPct",
    "strongTrendPullbackReboundVolumeRatio20",
    "watchCandidateScore",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--recent-days", type=int, default=DEFAULT_RECENT_DAYS)
    parser.add_argument("--max-bytes", type=int, default=900 * 1024 * 1024)
    return parser.parse_args()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def copy_file(source: Path, target: Path) -> bool:
    if not source.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return True


def copy_tree(source: Path, target: Path) -> int:
    if not source.exists():
        return 0
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)
    return sum(1 for path in target.rglob("*") if path.is_file())


def parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def selected_dates(index_payload: dict[str, Any], recent_days: int) -> dict[str, list[str]]:
    daily_dates = sorted(str(item) for item in index_payload.get("daily") or [] if str(item).strip())
    if not daily_dates:
        return {"daily": [], "weekly": [], "monthly": []}
    latest = parse_date(daily_dates[-1])
    cutoff = latest - timedelta(days=recent_days)
    selected: dict[str, list[str]] = {}
    for key in ("daily", "weekly", "monthly"):
        dates = sorted(str(item) for item in index_payload.get(key) or [] if str(item).strip())
        selected[key] = [date for date in dates if parse_date(date) >= cutoff]
        if daily_dates[-1] not in selected[key] and daily_dates[-1] in dates:
            selected[key].append(daily_dates[-1])
    return selected


def trim_record(record: Any) -> Any:
    if not isinstance(record, dict):
        return record
    return {key: record[key] for key in OVERVIEW_RECORD_KEYS if key in record}


def trim_overview_payload(payload: Any) -> Any:
    if not isinstance(payload, dict):
        return payload
    records = payload.get("records")
    if not isinstance(records, list):
        return payload
    return {**payload, "records": [trim_record(record) for record in records]}


def copy_overview_lite(source_root: Path, target_root: Path, recent_days: int) -> dict[str, Any]:
    index_path = source_root / "index.json"
    if not index_path.exists():
        return {"copiedFiles": 0, "dates": {"daily": [], "weekly": [], "monthly": []}}
    index_payload = read_json(index_path)
    dates_by_kind = selected_dates(index_payload if isinstance(index_payload, dict) else {}, recent_days)
    copied = 0
    filenames = {
        "daily": "market_pulse.json",
        "weekly": "market_pulse_weekly.json",
        "monthly": "market_pulse_monthly.json",
    }
    for kind, dates in dates_by_kind.items():
        filename = filenames[kind]
        for date in dates:
            source = source_root / date / filename
            if not source.exists():
                continue
            payload = trim_overview_payload(read_json(source))
            write_json(target_root / date / filename, payload)
            copied += 1
    next_index = {
        "generatedAt": index_payload.get("generatedAt") if isinstance(index_payload, dict) else "",
        **dates_by_kind,
    }
    write_json(target_root / "index.json", next_index)
    copied += 1
    return {"copiedFiles": copied, "dates": {key: len(value) for key, value in dates_by_kind.items()}}


def write_public_manifest_from_overview(index_payload: Any, target_path: Path) -> bool:
    if not isinstance(index_payload, dict):
        return False
    daily_dates = sorted(str(item) for item in index_payload.get("daily") or [] if str(item).strip())
    if not daily_dates:
        return False
    write_json(
        target_path,
        {
            "generatedAt": index_payload.get("generatedAt") or "",
            "latestDate": daily_dates[-1],
            "availableDates": daily_dates,
            "currentSnapshot": None,
        },
    )
    return True


def directory_size(path: Path) -> int:
    return sum(child.stat().st_size for child in path.rglob("*") if child.is_file())


def build_site(output: Path, recent_days: int, max_bytes: int) -> dict[str, Any]:
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    copied_files = 0
    for item in STATIC_FILES:
        copied_files += int(copy_file(ROOT / item, output / item))
    for item in STATIC_DIRS:
        copied_files += copy_tree(ROOT / item, output / item)
    (output / ".nojekyll").write_text("", encoding="utf-8")
    copied_files += 1

    data_source = ROOT / "data"
    data_target = output / "data"
    for item in DATA_FILES:
        copied_files += int(copy_file(data_source / item, data_target / item))
    if not copy_file(data_source / "theme_map.json", data_target / "theme_map.json"):
        write_json(data_target / "theme_map.json", {"version": 1, "updatedAt": "", "themes": []})
    copied_files += 1

    public_source = data_source / "public_json"
    public_target = data_target / "public_json"
    for item in PUBLIC_JSON_DIRS:
        copied_files += copy_tree(public_source / item, public_target / item)

    overview_metrics = copy_overview_lite(public_source / "overview_lite", public_target / "overview_lite", recent_days)
    copied_files += int(overview_metrics["copiedFiles"])
    overview_index = public_target / "overview_lite" / "index.json"
    if overview_index.exists() and write_public_manifest_from_overview(read_json(overview_index), data_target / "manifest.json"):
        copied_files += 1

    size = directory_size(output)
    metrics = {
        "output": str(output),
        "recentDays": recent_days,
        "copiedFiles": copied_files,
        "overviewLite": overview_metrics,
        "bytes": size,
        "sizeMiB": round(size / 1024 / 1024, 2),
        "maxBytes": max_bytes,
    }
    write_json(public_target / "pages_manifest.json", metrics)
    size = directory_size(output)
    metrics["bytes"] = size
    metrics["sizeMiB"] = round(size / 1024 / 1024, 2)
    write_json(public_target / "pages_manifest.json", metrics)
    if size > max_bytes:
        raise SystemExit(f"Pages artifact is too large: {size} bytes > {max_bytes} bytes")
    return metrics


def main() -> int:
    args = parse_args()
    metrics = build_site(args.output, args.recent_days, args.max_bytes)
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
