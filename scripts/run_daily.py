#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.app.daily_runner import build_daily_pipeline  # noqa: E402


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
    parser.add_argument(
        "--include-shared-views",
        action="store_true",
        help="When used with --codes, also rebuild rankings/overview shared JSON files",
    )
    return parser.parse_args()


def main() -> int:
    return build_daily_pipeline(parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
