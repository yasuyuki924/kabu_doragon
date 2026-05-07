#!/usr/bin/env python3
"""Check integrity of data/ohlcv CSV files for representative tickers.

Exit codes:
  0 - all checks passed
  1 - integrity issues found
  2 - usage error
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OHLCV_DIR = ROOT / "data" / "ohlcv"
MANIFEST_JSON = ROOT / "data" / "manifest.json"

REPRESENTATIVE_CODES = ["6327", "7162", "7203", "9983", "8301"]

# Minimum rows expected for a ticker with ~5y of data.
# ~250 trading days/year * 5y = 1250. Use 200 as a loose lower bound.
MIN_ROWS_ACTIVE = 200
# Minimum rows for a 1-year window (≈250 days). Used for recency check.
MIN_ROWS_RECENT_1Y = 200
# Maximum tolerated gap between consecutive dates (calendar days).
MAX_GAP_DAYS = 10


def load_manifest_latest() -> str:
    try:
        return str(json.loads(MANIFEST_JSON.read_text()).get("latestDate") or "").strip()
    except Exception:
        return ""


def check_ticker(code: str, manifest_latest: str) -> dict:
    result: dict = {"code": code, "ok": True, "issues": [], "warnings": []}
    f = OHLCV_DIR / f"{code}.csv"
    if not f.exists():
        result["ok"] = False
        result["issues"].append(f"file not found: {f}")
        return result

    try:
        rows = list(csv.DictReader(f.open(encoding="utf-8")))
    except Exception as e:
        result["ok"] = False
        result["issues"].append(f"read error: {e}")
        return result

    result["row_count"] = len(rows)
    if not rows:
        result["ok"] = False
        result["issues"].append("file is empty")
        return result

    dates = [r.get("date", "") for r in rows if r.get("date")]
    dates_sorted = sorted(dates)
    result["first_date"] = dates_sorted[0] if dates_sorted else ""
    result["last_date"] = dates_sorted[-1] if dates_sorted else ""

    # Row count check
    if len(rows) < MIN_ROWS_ACTIVE:
        result["ok"] = False
        result["issues"].append(f"too few rows: {len(rows)} < {MIN_ROWS_ACTIVE}")

    # Recency check: last date should be within 10 calendar days of manifest.latestDate
    if manifest_latest and result["last_date"]:
        try:
            last_dt = datetime.strptime(result["last_date"], "%Y-%m-%d").date()
            manifest_dt = datetime.strptime(manifest_latest, "%Y-%m-%d").date()
            gap = (manifest_dt - last_dt).days
            result["lag_days"] = gap
            if gap > 10:
                result["ok"] = False
                result["issues"].append(
                    f"data too stale: last={result['last_date']} manifest={manifest_latest} gap={gap}d"
                )
        except ValueError:
            result["warnings"].append("could not parse dates for recency check")

    # Recent 1-year rows check (dates in last 365 calendar days relative to last_date)
    if result.get("last_date"):
        try:
            cutoff = datetime.strptime(result["last_date"], "%Y-%m-%d").date() - timedelta(days=365)
            recent_count = sum(
                1 for d in dates
                if d and datetime.strptime(d, "%Y-%m-%d").date() >= cutoff
            )
            result["recent_1y_rows"] = recent_count
            if recent_count < MIN_ROWS_RECENT_1Y:
                result["ok"] = False
                result["issues"].append(
                    f"too few recent rows (1y): {recent_count} < {MIN_ROWS_RECENT_1Y}"
                )
        except ValueError:
            result["warnings"].append("could not compute recent row count")

    # Gap check: find the largest gap between consecutive trading dates
    if len(dates_sorted) >= 2:
        max_gap = 0
        max_gap_pair: tuple[str, str] = ("", "")
        for i in range(1, len(dates_sorted)):
            try:
                a = datetime.strptime(dates_sorted[i - 1], "%Y-%m-%d").date()
                b = datetime.strptime(dates_sorted[i], "%Y-%m-%d").date()
                gap = (b - a).days
                if gap > max_gap:
                    max_gap = gap
                    max_gap_pair = (dates_sorted[i - 1], dates_sorted[i])
            except ValueError:
                continue
        result["max_consecutive_gap_days"] = max_gap
        result["max_gap_pair"] = max_gap_pair
        if max_gap > MAX_GAP_DAYS:
            result["ok"] = False
            result["issues"].append(
                f"large date gap: {max_gap}d between {max_gap_pair[0]} and {max_gap_pair[1]}"
            )

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Check OHLCV integrity for representative tickers")
    parser.add_argument(
        "--codes",
        nargs="+",
        default=REPRESENTATIVE_CODES,
        help="ticker codes to check (default: representative set)",
    )
    parser.add_argument("--summary", action="store_true", help="print JSON summary to stdout")
    parser.add_argument("--quiet", action="store_true", help="suppress non-error output")
    args = parser.parse_args()

    manifest_latest = load_manifest_latest()
    results = [check_ticker(code, manifest_latest) for code in args.codes]

    failed = [r for r in results if not r["ok"]]
    passed = [r for r in results if r["ok"]]

    summary = {
        "manifest_latest": manifest_latest,
        "checked": len(results),
        "passed": len(passed),
        "failed": len(failed),
        "results": results,
    }

    if args.summary:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 1 if failed else 0

    if not args.quiet:
        print(f"[check_ohlcv_integrity] manifest.latestDate={manifest_latest or '-'}")
        for r in results:
            status = "OK " if r["ok"] else "NG "
            detail = (
                f"rows={r.get('row_count','?')} "
                f"last={r.get('last_date','?')} "
                f"lag={r.get('lag_days','?')}d "
                f"1y={r.get('recent_1y_rows','?')} "
                f"maxgap={r.get('max_consecutive_gap_days','?')}d"
            )
            print(f"  [{status}] {r['code']:6s} {detail}")
            for issue in r.get("issues", []):
                print(f"         ISSUE: {issue}")
            for warn in r.get("warnings", []):
                print(f"         WARN:  {warn}")

    if failed:
        if not args.quiet:
            print(f"[check_ohlcv_integrity] FAIL: {len(failed)} ticker(s) have issues")
        return 1

    if not args.quiet:
        print(f"[check_ohlcv_integrity] OK: all {len(passed)} tickers passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
