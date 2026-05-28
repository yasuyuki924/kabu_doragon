#!/usr/bin/env python3
"""Build lightweight public JSON for overview and ticker detail pages."""

from __future__ import annotations

import argparse
import json
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_OVERVIEW_INPUT = Path("data/overview")
DEFAULT_TICKERS_INPUT = Path("data/tickers")
DEFAULT_PUBLIC_JSON = Path("data/public_json")
DETAIL_RANGE = "1y"
OVERVIEW_RECORD_KEYS = (
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
)
DETAIL_ROW_KEYS = (
    "date",
    "change",
    "changePercent",
    "distanceToMa25",
    "distanceToMa75",
    "distanceToMa200",
    "volumeRatio25",
    "rci12",
    "rci24",
    "rci48",
    "rsi2",
    "rangePosition52w",
    "strategyMatches",
    "strategyScores",
    "strategyReasons",
    "strategyExcludedReasons",
    "strategyMetrics",
    "strongTrendPullbackRebound",
    "strongTrendPullbackReboundCandidate",
    "strongTrendPullbackReboundScore",
    "strongTrendPullbackReboundType",
    "strongTrendPullbackReboundLabel",
    "strongTrendPullbackReboundRisePct",
    "strongTrendPullbackReboundDropPct",
    "strongTrendPullbackReboundVolumeRatio20",
    "trendTurnReason",
    "trendTurnScore",
    "trendTurnAboveMa75Ratio",
)
META_KEYS = (
    "code",
    "name",
    "market",
    "sector",
    "industry",
    "tags",
    "themes",
    "links",
    "snapshotDate",
    "snapshotType",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--overview-input", type=Path, default=DEFAULT_OVERVIEW_INPUT)
    parser.add_argument("--tickers-input", type=Path, default=DEFAULT_TICKERS_INPUT)
    parser.add_argument("--public-json-dir", type=Path, default=DEFAULT_PUBLIC_JSON)
    parser.add_argument("--years", type=int, default=1)
    return parser.parse_args()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_compact_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def replace_json_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    for child in path.glob("*.json"):
        child.unlink()


def compute_bullish_close_breakout_20d(rows: list[dict], index: int) -> bool:
    today = rows[index]
    close_today = float(today["close"])
    open_today = float(today["open"])
    if close_today < open_today:
        return False
    past_valid_closes = [
        float(row["close"])
        for row in rows[max(0, index - 20) : index]
        if float(row["close"]) >= float(row["open"])
    ]
    return bool(past_valid_closes and close_today > max(past_valid_closes))


def load_bullish_close_breakout_flags(public_json_dir: Path) -> dict[tuple[str, str], bool]:
    ticker_recent_dir = public_json_dir / "ticker_recent" / "1y" / "ohlcv_ma"
    flags: dict[tuple[str, str], bool] = {}
    for ticker_path in sorted(ticker_recent_dir.glob("*.json")):
        payload = read_json(ticker_path)
        rows = payload.get("ohlcv") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            continue
        valid_rows = [
            row
            for row in rows
            if isinstance(row, dict)
            and row.get("date")
            and row.get("open") is not None
            and row.get("close") is not None
        ]
        for index, row in enumerate(valid_rows):
            flags[(ticker_path.stem, str(row["date"]))] = compute_bullish_close_breakout_20d(valid_rows, index)
    return flags


def apply_bullish_close_breakout_flags_to_overview_lite(public_json_dir: Path) -> dict:
    lite_root = public_json_dir / "overview_lite"
    started = time.perf_counter()
    flags = load_bullish_close_breakout_flags(public_json_dir)
    updated_files = 0
    updated_records = 0
    for lite_path in sorted(lite_root.glob("*/market_pulse.json")):
        payload = read_json(lite_path)
        records = payload.get("records") if isinstance(payload, dict) else None
        if not isinstance(records, list):
            continue
        changed = False
        date = lite_path.parent.name
        for record in records:
            if not isinstance(record, dict):
                continue
            code = str(record.get("code") or "")
            key = (code, str(record.get("date") or date))
            if key not in flags:
                continue
            value = bool(flags[key])
            if record.get("bullishCloseBreakout20d") != value:
                record["bullishCloseBreakout20d"] = value
                updated_records += 1
                changed = True
        if changed:
            write_compact_json(lite_path, payload)
            updated_files += 1
    return {
        "flagCount": len(flags),
        "updatedFiles": updated_files,
        "updatedRecords": updated_records,
        "seconds": time.perf_counter() - started,
    }


def build_overview_recent(overview_input: Path, public_json_dir: Path) -> dict:
    output_root = public_json_dir / "overview_recent"
    lite_root = public_json_dir / "overview_lite"
    copied = []
    lite_files = []
    started = time.perf_counter()
    for source in sorted(overview_input.glob("*/market_pulse*.json")):
        date_dir = source.parent.name
        target = output_root / date_dir / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        copied.append(target)
        payload = read_json(source)
        if isinstance(payload, dict) and isinstance(payload.get("records"), list):
            lite_payload = {
                **{key: value for key, value in payload.items() if key != "records"},
                "records": [
                    {key: record.get(key) for key in OVERVIEW_RECORD_KEYS if key in record}
                    for record in payload["records"]
                    if isinstance(record, dict)
                ],
            }
            lite_target = lite_root / date_dir / source.name
            write_compact_json(lite_target, lite_payload)
            lite_files.append(lite_target)
    return {
        "outputDir": str(output_root),
        "fileCount": len(copied),
        "totalBytes": sum(path.stat().st_size for path in copied),
        "liteOutputDir": str(lite_root),
        "liteFileCount": len(lite_files),
        "liteTotalBytes": sum(path.stat().st_size for path in lite_files),
        "seconds": time.perf_counter() - started,
    }


def build_ticker_detail(tickers_input: Path, public_json_dir: Path, years: int) -> dict:
    meta_dir = public_json_dir / "ticker_meta"
    detail_dir = public_json_dir / "ticker_detail_recent" / f"{years}y"
    if not tickers_input.exists():
        return {
            "metaOutputDir": str(meta_dir),
            "detailOutputDir": str(detail_dir),
            "skipped": True,
            "reason": f"missing input: {tickers_input}",
            "seconds": 0,
        }
    replace_json_dir(meta_dir)
    replace_json_dir(detail_dir)
    started = time.perf_counter()
    updated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    total_rows = 0
    samples = {}

    for ticker_path in sorted(tickers_input.glob("*.json")):
        payload = read_json(ticker_path)
        code = str(payload.get("code") or ticker_path.stem)
        rows = payload.get("ohlcv") if isinstance(payload.get("ohlcv"), list) else []
        recent_rows = rows[-245 * years :]
        meta = {key: payload.get(key) for key in META_KEYS if key in payload}
        meta["code"] = code
        meta["updatedAt"] = updated_at
        detail_rows = [{key: row.get(key) for key in DETAIL_ROW_KEYS if key in row} for row in recent_rows if isinstance(row, dict)]
        detail = {
            "code": code,
            "range": f"{years}y",
            "updatedAt": updated_at,
            "startDate": detail_rows[0].get("date") if detail_rows else None,
            "endDate": detail_rows[-1].get("date") if detail_rows else None,
            "rows": detail_rows,
        }
        write_compact_json(meta_dir / f"{code}.json", meta)
        write_compact_json(detail_dir / f"{code}.json", detail)
        total_rows += len(detail_rows)
        if code in {"6327", "7162", "4772"}:
            samples[code] = {
                "metaBytes": (meta_dir / f"{code}.json").stat().st_size,
                "detailBytes": (detail_dir / f"{code}.json").stat().st_size,
                "detailRows": len(detail_rows),
                "startDate": detail["startDate"],
                "endDate": detail["endDate"],
            }

    meta_files = sorted(meta_dir.glob("*.json"))
    detail_files = sorted(detail_dir.glob("*.json"))
    return {
        "metaOutputDir": str(meta_dir),
        "detailOutputDir": str(detail_dir),
        "metaFileCount": len(meta_files),
        "detailFileCount": len(detail_files),
        "detailRowCount": total_rows,
        "metaTotalBytes": sum(path.stat().st_size for path in meta_files),
        "detailTotalBytes": sum(path.stat().st_size for path in detail_files),
        "seconds": time.perf_counter() - started,
        "samples": samples,
    }


def main() -> int:
    args = parse_args()
    started = time.perf_counter()
    overview_metrics = build_overview_recent(args.overview_input, args.public_json_dir)
    ticker_metrics = build_ticker_detail(args.tickers_input, args.public_json_dir, args.years)
    breakout_metrics = apply_bullish_close_breakout_flags_to_overview_lite(args.public_json_dir)
    metrics = {
        "format": "overview_recent_and_ticker_detail_public_json",
        "overview": overview_metrics,
        "ticker": ticker_metrics,
        "bullishCloseBreakout20d": breakout_metrics,
        "seconds": time.perf_counter() - started,
    }
    metrics_path = args.public_json_dir / "lightweight_detail_metrics.json"
    write_compact_json(metrics_path, metrics)
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
