#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the local daily build pipeline")
    parser.add_argument("--skip-fetch", action="store_true")
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--limit", type=int, default=0, help="Limit tickers for testing when building ticker JSON")
    parser.add_argument("--end-date", help="Build until this date")
    return parser.parse_args()


def run_step(*args: str) -> None:
    cmd = [sys.executable, *args]
    subprocess.run(cmd, check=True, cwd=ROOT)


def main() -> int:
    args = parse_args()

    if not args.skip_fetch:
        fetch_args = ["scripts/fetch_prices.py", "--universe", "tse", "--segments", "prime,standard,growth"]
        run_step(*fetch_args)

    ticker_args = ["scripts/build_ticker_data.py"]
    if args.codes:
        ticker_args.extend(["--codes", args.codes])
    if args.limit > 0:
        ticker_args.extend(["--limit", str(args.limit)])
    run_step(*ticker_args)

    ranking_args = ["scripts/build_rankings.py", "--days", str(args.days)]
    overview_args = ["scripts/build_market_overview.py", "--days", str(args.days)]
    if args.codes:
        ranking_args.extend(["--codes", args.codes])
        overview_args.extend(["--codes", args.codes])
    if args.end_date:
        ranking_args.extend(["--end-date", args.end_date])
        overview_args.extend(["--end-date", args.end_date])

    run_step(*ranking_args)
    run_step(*overview_args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
