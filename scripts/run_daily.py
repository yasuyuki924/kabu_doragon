#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from time import perf_counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
UPDATE_STATE_JSON = ROOT / "data" / "update_state.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local daily build pipeline")
    parser.add_argument("--skip-fetch", action="store_true")
    parser.add_argument("--provider", choices=["jquants", "yfinance"], default="jquants")
    parser.add_argument("--full-refresh", action="store_true")
    parser.add_argument("--history-years", type=int, default=5)
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--limit", type=int, default=0, help="Limit tickers for testing when building ticker JSON")
    parser.add_argument("--end-date", help="Build until this date")
    parser.add_argument("--full-rebuild", action="store_true")
    return parser.parse_args()


def run_step(*args: str) -> float:
    cmd = [sys.executable, *args]
    start = perf_counter()
    subprocess.run(cmd, check=True, cwd=ROOT)
    return perf_counter() - start


def load_update_state() -> dict[str, object]:
    if not UPDATE_STATE_JSON.exists():
        return {}
    return json.loads(UPDATE_STATE_JSON.read_text(encoding="utf-8"))


def main() -> int:
    args = parse_args()
    total_start = perf_counter()

    if not args.skip_fetch:
        fetch_args = [
            "scripts/fetch_prices.py",
            "--provider",
            args.provider,
            "--universe",
            "tse",
            "--segments",
            "prime,standard,growth",
            "--history-years",
            str(args.history_years),
        ]
        if args.full_refresh:
            fetch_args.append("--full-refresh")
        fetch_elapsed = run_step(*fetch_args)
        print(f"timing fetch={fetch_elapsed:.1f}s")

    incremental_dates: list[str] = []
    if not args.full_rebuild and not args.codes:
        update_state = load_update_state()
        incremental_dates = [str(item).strip() for item in update_state.get("updatedDates") or [] if str(item).strip()]

    ticker_args = ["scripts/build_ticker_data.py"]
    if args.codes:
        ticker_args.extend(["--codes", args.codes])
    elif args.full_rebuild:
        ticker_args.append("--all")
    else:
        ticker_args.append("--use-update-state")
    if args.limit > 0:
        ticker_args.extend(["--limit", str(args.limit)])
    ticker_elapsed = run_step(*ticker_args)
    print(f"timing tickers={ticker_elapsed:.1f}s")

    ranking_args = ["scripts/build_rankings.py"]
    overview_args = ["scripts/build_market_overview.py"]
    if args.full_rebuild or args.codes:
        ranking_args.extend(["--days", str(args.days)])
        overview_args.extend(["--days", str(args.days)])
    elif incremental_dates:
        ranking_args.extend(["--dates", ",".join(incremental_dates)])
        overview_args.extend(["--dates", ",".join(incremental_dates)])
    else:
        ranking_args.extend(["--days", str(args.days)])
        overview_args.extend(["--days", str(args.days)])
    if args.codes:
        ranking_args.extend(["--codes", args.codes])
        overview_args.extend(["--codes", args.codes])
    if args.end_date:
        ranking_args.extend(["--end-date", args.end_date])
        overview_args.extend(["--end-date", args.end_date])

    if args.full_rebuild or args.codes or incremental_dates:
        rankings_elapsed = run_step(*ranking_args)
        print(f"timing rankings={rankings_elapsed:.1f}s")
        overview_elapsed = run_step(*overview_args)
        print(f"timing overview={overview_elapsed:.1f}s")
    else:
        print("timing rankings=0.0s (skipped)")
        print("timing overview=0.0s (skipped)")
    print(f"timing total={perf_counter() - total_start:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
