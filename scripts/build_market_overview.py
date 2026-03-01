#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import (
    MANIFEST_JSON,
    OVERVIEW_DIR,
    build_manifest_payload,
    discover_available_dates,
    iter_ticker_payloads,
    parse_codes,
    select_dates,
    summarize_sector_strength,
    summarize_tag_counts,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build date-based market overview JSON files")
    parser.add_argument("--days", type=int, default=60, help="Recent trading dates to build")
    parser.add_argument("--end-date", help="Build until this date")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    codes = parse_codes(args.codes)
    all_dates = discover_available_dates()
    selected_dates = select_dates(all_dates, args.days, args.end_date)
    selected_date_set = set(selected_dates)
    payloads = iter_ticker_payloads(codes)

    per_date: dict[str, list[dict[str, object]]] = {date_value: [] for date_value in selected_dates}
    for payload in payloads:
        meta = {
            "code": payload["code"],
            "name": payload["name"],
            "market": payload["market"],
            "sector": payload.get("sector", ""),
            "industry": payload.get("industry", ""),
            "tags": payload.get("tags", []),
            "links": payload.get("links", {}),
        }
        for row in payload.get("ohlcv", []):
            date_value = str(row["date"])
            if date_value not in selected_date_set:
                continue
            per_date[date_value].append({**meta, **row})

    for date_value in selected_dates:
        records = sorted(per_date[date_value], key=lambda item: str(item["code"]))
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
            "tagBreadth": summarize_tag_counts(records)[:12],
            "records": records,
        }
        write_json(OVERVIEW_DIR / date_value / "market_pulse.json", payload)
        print(f"built overview: {date_value} ({len(records)} records)")

    write_json(MANIFEST_JSON, build_manifest_payload(selected_dates))
    print(f"wrote manifest: {MANIFEST_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

