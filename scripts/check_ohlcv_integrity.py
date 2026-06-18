#!/usr/bin/env python3
"""Check integrity of data/ohlcv (and optionally data/ohlcv_raw) CSV files.

Use --check-raw to also validate data/ohlcv_raw alongside data/ohlcv.
This is important because sync_prices reads from ohlcv_raw as its source
of truth; a gap in ohlcv_raw will be silently propagated to ohlcv on
the next incremental update even if ohlcv itself was repaired.

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
OHLCV_RAW_DIR = ROOT / "data" / "ohlcv_raw"
MANIFEST_JSON = ROOT / "data" / "manifest.json"

# Failure in any of these codes = blocked (exit 1).
REPRESENTATIVE_CODES = ["6327", "7162", "7203", "9983"]
# Failure here = warning only (not blocking).
# 8301 has a known structural gap (2026-03-26〜04-20) caused by data source issues;
# treating it as a hard blocker would prevent valid updates from running.
WARN_ONLY_CODES = ["8301"]

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


def check_ticker(code: str, manifest_latest: str, ohlcv_dir: Path = OHLCV_DIR) -> dict:
    result: dict = {"code": code, "ok": True, "issues": [], "warnings": []}
    f = ohlcv_dir / f"{code}.csv"
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


def _print_results(
    results: list[dict],
    label: str,
    quiet: bool,
    warn_only_set: set[str] | None = None,
) -> list[dict]:
    """Print results. Returns only the blocking failures (excludes warn-only codes)."""
    if warn_only_set is None:
        warn_only_set = set()
    blocking_failed = []
    if not quiet:
        print(f"  --- {label} ---")
        for r in results:
            is_warn_only = r["code"] in warn_only_set
            if not r["ok"] and is_warn_only:
                status = "W! "  # warn-only failure
            else:
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
                tag = "WARN(known)" if is_warn_only else "ISSUE"
                print(f"         {tag}: {issue}")
            for warn in r.get("warnings", []):
                print(f"         WARN:  {warn}")
        if warn_only_set:
            blocked_codes = sorted(warn_only_set & {r["code"] for r in results})
            if blocked_codes:
                print(f"  [NOTE] {','.join(blocked_codes)} is warn-only — failure does not block update")
    blocking_failed = [r for r in results if not r["ok"] and r["code"] not in warn_only_set]
    return blocking_failed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check OHLCV integrity for representative tickers"
    )
    parser.add_argument(
        "--codes",
        nargs="+",
        default=None,
        help=(
            "Ticker codes to check (default: REPRESENTATIVE_CODES + WARN_ONLY_CODES). "
            "When specified explicitly, all codes are treated as blocking."
        ),
    )
    parser.add_argument("--summary", action="store_true", help="print JSON summary to stdout")
    parser.add_argument("--quiet", action="store_true", help="suppress non-error output")
    parser.add_argument(
        "--check-raw",
        action="store_true",
        help=(
            "Also check data/ohlcv_raw alongside data/ohlcv. "
            "Important: sync_prices uses ohlcv_raw as its source; "
            "a gap there will re-break ohlcv on the next incremental update."
        ),
    )
    args = parser.parse_args()

    # When --codes is specified, treat all as blocking; otherwise use built-in split.
    if args.codes:
        codes_to_check = args.codes
        effective_warn_only: set[str] = set()
    else:
        codes_to_check = REPRESENTATIVE_CODES + WARN_ONLY_CODES
        effective_warn_only = set(WARN_ONLY_CODES)

    manifest_latest = load_manifest_latest()
    results = [check_ticker(code, manifest_latest, OHLCV_DIR) for code in codes_to_check]

    raw_results: list[dict] = []
    if args.check_raw:
        raw_results = [
            {**check_ticker(code, manifest_latest, OHLCV_RAW_DIR), "dir": "ohlcv_raw"}
            for code in codes_to_check
        ]

    all_failed = [r for r in results if not r["ok"]]
    all_raw_failed = [r for r in raw_results if not r["ok"]]
    blocking_failed = [r for r in all_failed if r["code"] not in effective_warn_only]
    blocking_raw_failed = [r for r in all_raw_failed if r["code"] not in effective_warn_only]

    if args.summary:
        summary: dict = {
            "manifest_latest": manifest_latest,
            "warn_only_codes": sorted(effective_warn_only),
            "ohlcv": {
                "checked": len(results),
                "passed": len([r for r in results if r["ok"]]),
                "failed": len(all_failed),
                "blocking_failed": len(blocking_failed),
                "results": results,
            },
        }
        if args.check_raw:
            summary["ohlcv_raw"] = {
                "checked": len(raw_results),
                "passed": len([r for r in raw_results if r["ok"]]),
                "failed": len(all_raw_failed),
                "blocking_failed": len(blocking_raw_failed),
                "results": raw_results,
            }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 1 if (blocking_failed or blocking_raw_failed) else 0

    if not args.quiet:
        print(f"[check_ohlcv_integrity] manifest.latestDate={manifest_latest or '-'}")
    _print_results(results, "data/ohlcv", args.quiet, effective_warn_only)
    if args.check_raw:
        _print_results(raw_results, "data/ohlcv_raw", args.quiet, effective_warn_only)

    any_blocking_failed = blocking_failed or blocking_raw_failed
    if any_blocking_failed:
        if not args.quiet:
            parts = []
            if blocking_failed:
                parts.append(f"ohlcv:{len(blocking_failed)}")
            if blocking_raw_failed:
                parts.append(f"ohlcv_raw:{len(blocking_raw_failed)}")
            print(f"[check_ohlcv_integrity] FAIL: {' '.join(parts)} ticker(s) have blocking issues")
        return 1

    if not args.quiet:
        warn_count = len([r for r in all_failed + all_raw_failed if r["code"] in effective_warn_only])
        label = "ohlcv+ohlcv_raw" if args.check_raw else "ohlcv"
        warn_suffix = f" ({warn_count} warn-only)" if warn_count else ""
        print(f"[check_ohlcv_integrity] OK: all blocking tickers passed ({label}){warn_suffix}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
