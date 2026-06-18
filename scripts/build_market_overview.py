#!/usr/bin/env python3
from __future__ import annotations

import argparse
from numbers import Real

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
from src.app.shared_view_data import load_inactive_summary, load_records_by_date, resolve_explicit_dates, resolve_selected_dates
from src.app.shared_view_data import STALE_TOLERANCE_BUSINESS_DAYS


def build_data_quality_summary(records: list[dict[str, object]], stale_tolerance_business_days: int) -> dict[str, int]:
    matched_count = 0
    stale_count = 0
    empty_count = 0
    stale_1d_count = 0
    stale_2p_count = 0
    for record in records:
        quality = record.get("dataQuality") if isinstance(record, dict) else None
        quality = quality if isinstance(quality, dict) else {}
        reasons = quality.get("reasonCodes")
        reason_codes = {str(item) for item in reasons} if isinstance(reasons, list) else set()
        stale_days = quality.get("staleBusinessDays")
        stale_days = int(stale_days) if isinstance(stale_days, Real) and stale_days >= 0 else 0
        if "NO_OHLCV" in reason_codes:
            empty_count += 1
            continue
        if "STALE_ND" in reason_codes and stale_days > stale_tolerance_business_days:
            stale_count += 1
            if stale_days == 1:
                stale_1d_count += 1
            elif stale_days >= 2:
                stale_2p_count += 1
            continue
        matched_count += 1
    return {
        "matchedCount": matched_count,
        "staleCount": stale_count,
        "emptyCount": empty_count,
        "stale1dCount": stale_1d_count,
        "stale2pCount": stale_2p_count,
    }


def with_default_data_quality(records: list[dict[str, object]], selected_date: str) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for record in records:
        if not isinstance(record, dict):
            continue
        if isinstance(record.get("dataQuality"), dict):
            normalized.append(record)
            continue
        row_date = str(record.get("date") or "").strip()
        reason_codes: list[str] = []
        stale_days = 0
        if row_date and selected_date and row_date < selected_date:
            reason_codes.append("STALE_ND")
            stale_days = 1
        normalized.append(
            {
                **record,
                "dataQuality": {
                    "lastDataDate": row_date or None,
                    "reasonCodes": reason_codes,
                    "staleBusinessDays": stale_days,
                },
            }
        )
    return normalized


def is_fresh_record(record: dict[str, object], selected_date: str) -> bool:
    row_date = str(record.get("date") or "").strip()
    if not row_date or row_date != selected_date:
        return False
    quality = record.get("dataQuality")
    if not isinstance(quality, dict):
        return True
    reasons = quality.get("reasonCodes")
    reason_codes = {str(item).strip() for item in reasons} if isinstance(reasons, list) else set()
    if "NO_OHLCV" in reason_codes or "STALE_ND" in reason_codes:
        return False
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build date-based market overview JSON files")
    parser.add_argument("--days", type=int, default=60, help="Recent trading dates to build")
    parser.add_argument("--end-date", help="Build until this date")
    parser.add_argument("--from-date", help="Build from this date forward")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--dates", help="Comma separated trading dates to build")
    return parser.parse_args()


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

            if suffix == "":
                raw_records = sorted(per_date.get(date_value, []), key=lambda item: str(item.get("code") or ""))
                records = [record for record in raw_records if is_fresh_record(record, date_value)]
                data_quality_summary = build_data_quality_summary(raw_records, STALE_TOLERANCE_BUSINESS_DAYS)
                inactive_summary = load_inactive_summary(date_value)
            else:
                records = sorted(with_default_data_quality(cached, date_value), key=lambda item: str(item.get("code") or ""))
                data_quality_summary = build_data_quality_summary(records, STALE_TOLERANCE_BUSINESS_DAYS)
                inactive_summary = {"count": 0, "confirmedCount": 0, "candidateCount": 0, "codes": [], "sample": []}
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
                "staleToleranceBusinessDays": STALE_TOLERANCE_BUSINESS_DAYS,
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
                "dataQualitySummary": data_quality_summary,
                "inactiveSummary": inactive_summary,
                "inactiveCount": int(inactive_summary.get("count") or 0),
                "activeUniverseCount": len(raw_records) if suffix == "" else len(records),
                "totalUniverseCount": len(raw_records) if suffix == "" else len(records),
                "records": records,
            }
            write_json(OVERVIEW_DIR / date_value / f"market_pulse{suffix}.json", payload)
            print(f"built overview{suffix}: {date_value} ({len(records)} records)")

    write_json(MANIFEST_JSON, build_manifest_payload(all_dates))
    print(f"wrote manifest: {MANIFEST_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
