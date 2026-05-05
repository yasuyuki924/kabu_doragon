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
    "trendTurnCandidate",
    "trendTurnScore",
    "trendTurnAboveMa75Ratio",
    "signalCategory",
    "strategyMatches",
    "strategyScores",
    "strategyReasons",
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
    metrics = {
        "format": "overview_recent_and_ticker_detail_public_json",
        "overview": overview_metrics,
        "ticker": ticker_metrics,
        "seconds": time.perf_counter() - started,
    }
    metrics_path = args.public_json_dir / "lightweight_detail_metrics.json"
    write_compact_json(metrics_path, metrics)
    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
