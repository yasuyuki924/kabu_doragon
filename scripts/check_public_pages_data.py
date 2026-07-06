#!/usr/bin/env python3
"""Verify the deployed GitHub Pages public data from the public URL."""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any


REPRESENTATIVE_CODES = ("6327", "7162", "7203", "9983")
MIN_PUBLIC_JSON_ROWS = 100


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="GitHub Pages base URL, e.g. https://.../kabu_doragon/")
    parser.add_argument("--retries", type=int, default=6, help="Retry count while Pages propagation catches up.")
    parser.add_argument("--sleep", type=float, default=10.0, help="Seconds between retries.")
    return parser.parse_args()


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"Accept-Encoding": "identity"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def fetch_json(base_url: str, path: str) -> Any:
    raw = fetch_bytes(f"{base_url.rstrip('/')}/{path.lstrip('/')}")
    if path.endswith(".gz"):
        raw = gzip.decompress(raw)
    return json.loads(raw)


def url_exists(base_url: str, path: str) -> bool:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    try:
        fetch_bytes(url)
        return True
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return False
        raise


def check_once(base_url: str) -> list[str]:
    issues: list[str] = []
    manifest = fetch_json(base_url, "data/manifest.json")
    health = fetch_json(base_url, "data/update_health.json")
    overview_index = fetch_json(base_url, "data/public_json/overview_lite/index.json")

    latest_date = str(manifest.get("latestDate") or "").strip()
    if not latest_date:
        issues.append("manifest.latestDate is empty")

    health_status = str(health.get("status") or "").strip()
    if health_status not in {"success", "skipped"}:
        issues.append(f"update_health.status is not success/skipped: {health_status or '-'}")

    health_manifest = health.get("manifest") if isinstance(health.get("manifest"), dict) else {}
    health_latest = str(health_manifest.get("latestDate") or "").strip()
    if latest_date and health_latest and latest_date != health_latest:
        issues.append(f"manifest.latestDate={latest_date} != update_health.manifest.latestDate={health_latest}")

    details = health.get("details") if isinstance(health.get("details"), dict) else {}
    updated_dates = sorted(set(str(item) for item in details.get("updatedDates") or [] if str(item).strip()))
    if not updated_dates:
        available_dates = [str(item) for item in manifest.get("availableDates") or [] if str(item).strip()]
        updated_dates = [date for date in available_dates if latest_date and date <= latest_date][-10:]
        try:
            indexed_daily_dates = sorted(str(item) for item in overview_index.get("daily") or [] if str(item).strip())
            reference_payload = fetch_json(base_url, "data/public_json/ticker_recent/1y/ohlcv_ma/7203.json.gz")
            reference_rows = reference_payload.get("ohlcv") if isinstance(reference_payload, dict) else []
            reference_dates = [
                str(row.get("date"))
                for row in reference_rows
                if isinstance(row, dict) and row.get("date") and latest_date and str(row.get("date")) <= latest_date
            ]
            previous_indexed_date = ""
            for date in indexed_daily_dates:
                if latest_date and date < latest_date and date in reference_dates:
                    previous_indexed_date = date
            if previous_indexed_date:
                reference_dates = [date for date in reference_dates if previous_indexed_date < date <= latest_date]
            else:
                reference_dates = reference_dates[-10:]
            updated_dates = sorted(set(reference_dates or updated_dates))
        except Exception as exc:
            issues.append(f"failed to load reference public_json/7203 dates: {type(exc).__name__}: {exc}")
    if latest_date and latest_date not in updated_dates:
        updated_dates.append(latest_date)
        updated_dates = sorted(set(updated_dates))

    for key, filename in (
        ("daily", "market_pulse.json.gz"),
        ("weekly", "market_pulse_weekly.json.gz"),
        ("monthly", "market_pulse_monthly.json.gz"),
    ):
        dates = [str(item) for item in overview_index.get(key) or [] if str(item).strip()]
        if latest_date and latest_date not in dates:
            issues.append(f"overview_lite/index.json {key} missing latestDate={latest_date}")
        for updated_date in updated_dates:
            if updated_date not in dates:
                issues.append(f"overview_lite/index.json {key} missing updatedDate={updated_date}")
            path = f"data/public_json/overview_lite/{updated_date}/{filename}"
            if not url_exists(base_url, path):
                issues.append(f"public overview_lite file missing: {path}")

    for code in REPRESENTATIVE_CODES:
        path = f"data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json.gz"
        payload = fetch_json(base_url, path)
        rows = payload.get("ohlcv") if isinstance(payload, dict) else None
        if not isinstance(rows, list):
            issues.append(f"public_json/{code} has no ohlcv rows")
            continue
        if len(rows) < MIN_PUBLIC_JSON_ROWS:
            issues.append(f"public_json/{code} has too few rows: {len(rows)}")
        last_date = str(rows[-1].get("date") or "").strip() if rows and isinstance(rows[-1], dict) else ""
        if latest_date and last_date != latest_date:
            issues.append(f"public_json/{code} lastDate={last_date or '-'} != manifest.latestDate={latest_date}")

    return issues


def main() -> int:
    args = parse_args()
    attempts = max(1, args.retries)
    last_issues: list[str] = []
    for attempt in range(1, attempts + 1):
        try:
            last_issues = check_once(args.base_url)
        except Exception as exc:
            last_issues = [f"{type(exc).__name__}: {exc}"]
        if not last_issues:
            print(f"[OK] public Pages data verified: {args.base_url}")
            return 0
        print(f"[WARN] public Pages data check failed attempt={attempt}/{attempts}")
        for issue in last_issues:
            print(f"  - {issue}")
        if attempt < attempts:
            time.sleep(max(0.0, args.sleep))

    print("[FAIL] public Pages data verification failed")
    return 1


if __name__ == "__main__":
    sys.exit(main())
