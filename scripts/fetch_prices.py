#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch OHLCV CSVs and refresh watchlist from the existing fetcher")
    parser.add_argument("--universe", choices=["nikkei225", "tse"], default="tse")
    parser.add_argument("--segments", default="prime,standard,growth")
    parser.add_argument("--period", default="5y")
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--pause", type=float, default=0.6)
    parser.add_argument("--skip-price-download", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cmd = [
        sys.executable,
        str(ROOT / "src" / "fetch_nikkei225.py"),
        "--universe",
        args.universe,
        "--segments",
        args.segments,
        "--period",
        args.period,
        "--batch-size",
        str(args.batch_size),
        "--pause",
        str(args.pause),
    ]
    if args.skip_price_download:
        cmd.append("--skip-price-download")
    return subprocess.run(cmd, check=False, cwd=ROOT).returncode


if __name__ == "__main__":
    raise SystemExit(main())

