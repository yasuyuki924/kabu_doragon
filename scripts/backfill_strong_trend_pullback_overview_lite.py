from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.indicators.core import detect_strong_trend_pullback_rebound
from src.screening.strategy_presets import STRATEGY_PRESET_MAP


STRATEGY_ID = "strong_trend_pullback_rebound"
TOP_LEVEL_KEYS = [
    "strongTrendPullbackRebound",
    "strongTrendPullbackReboundCandidate",
    "strongTrendPullbackReboundScore",
    "strongTrendPullbackReboundType",
    "strongTrendPullbackReboundLabel",
    "strongTrendPullbackReboundRisePct",
    "strongTrendPullbackReboundDropPct",
    "strongTrendPullbackReboundVolumeRatio20",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill Python strong trend pullback rebound results into overview_lite market_pulse JSON."
    )
    parser.add_argument("--overview-dir", default=str(ROOT / "data/public_json/overview_lite"))
    parser.add_argument("--ohlcv-dir", default=str(ROOT / "data/ohlcv"))
    parser.add_argument("--date", action="append", help="Limit to a YYYY-MM-DD date. Can be passed multiple times.")
    parser.add_argument("--dry-run", action="store_true", help="Calculate counts without writing files.")
    return parser.parse_args()


def to_float(value: object) -> float | None:
    if value in {None, ""}:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def read_ohlcv_rows(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            row: dict[str, object] = {"date": raw.get("date") or ""}
            valid = True
            for key in ("open", "high", "low", "close", "volume"):
                value = to_float(raw.get(key))
                if value is None:
                    valid = False
                    break
                row[key] = value
            if valid and row["date"]:
                rows.append(row)
    return rows


def add_moving_averages(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    windows = (5, 25, 75)
    sums = {window: 0.0 for window in windows}
    closes: list[float] = []
    enriched: list[dict[str, object]] = []
    for row in rows:
        close = float(row["close"])
        closes.append(close)
        current = dict(row)
        for window in windows:
            sums[window] += close
            if len(closes) > window:
                sums[window] -= closes[-window - 1]
            current[f"ma{window}"] = round(sums[window] / window, 4) if len(closes) >= window else None
        enriched.append(current)
    return enriched


def strategy_reasons(metrics: dict[str, Any]) -> list[str]:
    score = float(metrics.get("score") or 0)
    pullback_type = str(metrics.get("pullbackType") or "")
    type_label = "深押しリセット" if pullback_type == "deep_reset_pullback" else "通常押し目"
    reasons: list[str] = []
    if metrics.get("risePct") is not None:
        reasons.append(f"{type_label} / 上昇 +{float(metrics['risePct']):.1f}%")
    if metrics.get("dropPct") is not None:
        reasons.append(f"高値から -{float(metrics['dropPct']):.1f}% / Score {score:.0f}")
    if metrics.get("reboundLabel"):
        reasons.append(str(metrics["reboundLabel"]))
    return reasons


def metrics_with_params(metrics: dict[str, Any]) -> dict[str, Any]:
    params = STRATEGY_PRESET_MAP[STRATEGY_ID].params
    return {
        **metrics,
        "lookbackBars": params["lookbackBars"],
        "minRisePct": params["minRisePct"],
        "minDropPct": params["minDropPct"],
        "deepDropPct": params["deepDropPct"],
        "maxDropPct": params["maxDropPct"],
    }


def set_detected(record: dict[str, Any], metrics: dict[str, Any]) -> bool:
    changed = False
    full_metrics = metrics_with_params(metrics)

    updates = {
        "strongTrendPullbackRebound": metrics,
        "strongTrendPullbackReboundCandidate": True,
        "strongTrendPullbackReboundScore": metrics.get("score"),
        "strongTrendPullbackReboundType": metrics.get("pullbackType"),
        "strongTrendPullbackReboundLabel": metrics.get("reboundLabel"),
        "strongTrendPullbackReboundRisePct": metrics.get("risePct"),
        "strongTrendPullbackReboundDropPct": metrics.get("dropPct"),
        "strongTrendPullbackReboundVolumeRatio20": metrics.get("volumeRatio20"),
    }
    for key, value in updates.items():
        if record.get(key) != value:
            record[key] = value
            changed = True

    matches = list(record.get("strategyMatches") or [])
    if STRATEGY_ID not in matches:
        matches.append(STRATEGY_ID)
        record["strategyMatches"] = matches
        changed = True

    scores = dict(record.get("strategyScores") or {})
    if scores.get(STRATEGY_ID) != metrics.get("score"):
        scores[STRATEGY_ID] = metrics.get("score")
        record["strategyScores"] = scores
        changed = True

    reasons = dict(record.get("strategyReasons") or {})
    next_reasons = strategy_reasons(metrics)
    if reasons.get(STRATEGY_ID) != next_reasons:
        reasons[STRATEGY_ID] = next_reasons
        record["strategyReasons"] = reasons
        changed = True

    strategy_metrics = dict(record.get("strategyMetrics") or {})
    if strategy_metrics.get(STRATEGY_ID) != full_metrics:
        strategy_metrics[STRATEGY_ID] = full_metrics
        record["strategyMetrics"] = strategy_metrics
        changed = True

    return changed


def set_not_detected(record: dict[str, Any]) -> bool:
    changed = False
    for key in TOP_LEVEL_KEYS:
        if key in record:
            del record[key]
            changed = True

    matches = list(record.get("strategyMatches") or [])
    if STRATEGY_ID in matches:
        record["strategyMatches"] = [item for item in matches if item != STRATEGY_ID]
        changed = True

    for map_key in ("strategyScores", "strategyMetrics"):
        value = dict(record.get(map_key) or {})
        if STRATEGY_ID in value:
            del value[STRATEGY_ID]
            record[map_key] = value
            changed = True

    reasons = dict(record.get("strategyReasons") or {})
    if STRATEGY_ID in reasons:
        del reasons[STRATEGY_ID]
        record["strategyReasons"] = reasons
        changed = True

    return changed


def load_overview_files(overview_dir: Path, selected_dates: set[str] | None) -> dict[str, dict[str, Any]]:
    files: dict[str, dict[str, Any]] = {}
    for path in sorted(overview_dir.glob("*/market_pulse.json")):
        date = path.parent.name
        if selected_dates is not None and date not in selected_dates:
            continue
        files[date] = json.loads(path.read_text(encoding="utf-8"))
    return files


def main() -> int:
    args = parse_args()
    overview_dir = Path(args.overview_dir)
    ohlcv_dir = Path(args.ohlcv_dir)
    selected_dates = set(args.date) if args.date else None
    overview_by_date = load_overview_files(overview_dir, selected_dates)
    if not overview_by_date:
        print("No overview_lite market_pulse.json files found.")
        return 1

    records_by_date_code: dict[str, dict[str, dict[str, Any]]] = {}
    codes: set[str] = set()
    for date, payload in overview_by_date.items():
        records = payload.get("records") or []
        by_code: dict[str, dict[str, Any]] = {}
        for record in records:
            code = str(record.get("code") or "")
            if not code:
                continue
            by_code[code] = record
            codes.add(code)
        records_by_date_code[date] = by_code

    target_dates = set(records_by_date_code)
    detected_by_date: dict[str, int] = {date: 0 for date in target_dates}
    changed_by_date: dict[str, int] = {date: 0 for date in target_dates}
    processed_codes = 0
    missing_ohlcv = 0

    for code in sorted(codes):
        path = ohlcv_dir / f"{code}.csv"
        if not path.exists():
            missing_ohlcv += 1
            continue
        rows = add_moving_averages(read_ohlcv_rows(path))
        index_by_date = {str(row["date"]): index for index, row in enumerate(rows)}
        code_dates = [date for date in target_dates if code in records_by_date_code[date]]
        if not code_dates:
            continue
        processed_codes += 1
        for date in code_dates:
            record = records_by_date_code[date][code]
            index = index_by_date.get(date)
            metrics = {"detected": False}
            if index is not None:
                prior_rows = rows[max(0, index - 80) : index]
                metrics = detect_strong_trend_pullback_rebound(prior_rows, rows[index])
            if metrics.get("detected"):
                detected_by_date[date] += 1
                if set_detected(record, metrics):
                    changed_by_date[date] += 1
            elif set_not_detected(record):
                changed_by_date[date] += 1

    changed_files = 0
    for date, payload in overview_by_date.items():
        if changed_by_date[date] <= 0:
            continue
        changed_files += 1
        payload["source"] = payload.get("source") or "overview_lite"
        if not args.dry_run:
            path = overview_dir / date / "market_pulse.json"
            path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(
        json.dumps(
            {
                "dryRun": args.dry_run,
                "dates": len(overview_by_date),
                "codes": len(codes),
                "processedCodes": processed_codes,
                "missingOhlcv": missing_ohlcv,
                "changedFiles": changed_files,
                "detectedByDate": dict(sorted(detected_by_date.items())),
                "changedByDate": dict(sorted(changed_by_date.items())),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
