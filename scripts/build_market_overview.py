#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import (
    MANIFEST_JSON,
    OVERVIEW_DIR,
    build_manifest_payload,
    load_daily_records,
    parse_codes,
    summarize_sector_strength,
    summarize_tag_counts,
    summarize_theme_counts,
    write_json,
)
from src.app.shared_view_data import load_records_by_date, resolve_explicit_dates, resolve_selected_dates


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build date-based market overview JSON files")
    parser.add_argument("--days", type=int, default=60, help="Recent trading dates to build")
    parser.add_argument("--end-date", help="Build until this date")
    parser.add_argument("--from-date", help="Build from this date forward")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--dates", help="Comma separated trading dates to build")
    return parser.parse_args()


def _reason_codes(record: dict[str, object]) -> set[str]:
    data_quality = record.get("dataQuality")
    if not isinstance(data_quality, dict):
        return set()
    raw_codes = data_quality.get("reasonCodes")
    if not isinstance(raw_codes, list):
        return set()
    return {str(item).strip() for item in raw_codes if str(item).strip()}


def is_fresh_record(record: dict[str, object], selected_date: str) -> bool:
    if str(record.get("date") or "").strip() != selected_date:
        return False
    reason_codes = _reason_codes(record)
    return "NO_OHLCV" not in reason_codes and "STALE_ND" not in reason_codes


def summarize_data_quality(records: list[dict[str, object]], selected_date: str) -> dict[str, object]:
    total = len(records)
    matched = 0
    stale = 0
    no_ohlcv = 0
    for record in records:
        reason_codes = _reason_codes(record)
        if "NO_OHLCV" in reason_codes:
            no_ohlcv += 1
            continue
        if is_fresh_record(record, selected_date):
            matched += 1
            continue
        stale += 1
    ratio = (matched / total) if total > 0 else 0.0
    return {
        "targetDate": selected_date,
        "totalCount": total,
        "matchedCount": matched,
        "staleCount": stale,
        "noOhlcvCount": no_ohlcv,
        "matchedRatio": round(ratio, 6),
    }


def main() -> int:
    args = parse_args()
    codes = parse_codes(args.codes)
    if codes:
        print(f"warning: partial overview build for {len(codes)} code(s); shared overview/manifest JSON will be overwritten")
    explicit_dates = resolve_explicit_dates(args.dates)
    all_dates, selected_dates = resolve_selected_dates(
        days=args.days,
        end_date=args.end_date,
        from_date=args.from_date,
        explicit_dates=explicit_dates,
    )
    per_date = load_records_by_date(selected_dates, codes)

    for date_value in selected_dates:
        for suffix in ["", "_weekly", "_monthly"]:
            cached = load_daily_records(date_value + suffix, codes)
            if cached is None:
                continue

            raw_records = list(per_date.get(date_value) or [])
            quality_summary = summarize_data_quality(raw_records, date_value) if suffix == "" else None
            if suffix == "":
                records = [record for record in raw_records if is_fresh_record(record, date_value)]
            else:
                records = list(cached)
            records = sorted(records, key=lambda item: str(item.get("code") or ""))
            rise_count = sum(1 for item in records if float(item.get("changePercent") or 0) > 0)
            fall_count = sum(1 for item in records if float(item.get("changePercent") or 0) < 0)
            flat_count = len(records) - rise_count - fall_count
            above_ma25 = sum(1 for item in records if float(item.get("distanceToMa25") or 0) > 0)
            above_ma75 = sum(1 for item in records if float(item.get("distanceToMa75") or 0) > 0)
            above_ma200 = sum(1 for item in records if float(item.get("distanceToMa200") or 0) > 0)
            volume_spike_count = sum(1 for item in records if float(item.get("volumeRatio25") or 0) >= 2.0)
            average_change = (
                sum(float(item.get("changePercent") or 0) for item in records) / len(records) if records else None
            )
            payload = {
                "date": date_value,
                "recordCount": len(records),
                "riseCount": rise_count,
                "fallCount": fall_count,
                "flatCount": flat_count,
                "aboveMa25Count": above_ma25,
                "aboveMa75Count": above_ma75,
                "aboveMa200Count": above_ma200,
                "averageChangePercent": round(average_change, 4) if average_change is not None else None,
                "volumeSpikeCount": volume_spike_count,
                "sectorBreadth": summarize_sector_strength(records)[:12],
                "themeBreadth": summarize_theme_counts(records)[:12],
                "tagBreadth": summarize_tag_counts(records)[:12],
                "totalUniverseCount": len(raw_records) if suffix == "" else len(records),
                "dataQualitySummary": quality_summary,
                "records": records,
            }
            write_json(OVERVIEW_DIR / date_value / f"market_pulse{suffix}.json", payload)
            print(f"built overview{suffix}: {date_value} ({len(records)} records)")

    write_json(MANIFEST_JSON, build_manifest_payload(all_dates))
    print(f"wrote manifest: {MANIFEST_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
