from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from time import perf_counter

from src.data_source.local_data import discover_available_dates, load_update_state


ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT_FETCH = "scripts/fetch_prices.py"
SCRIPT_TICKERS = "scripts/build_ticker_data.py"
SCRIPT_RANKINGS = "scripts/build_rankings.py"
SCRIPT_OVERVIEW = "scripts/build_market_overview.py"
SCRIPT_UPDATE_SUMMARY = "scripts/generate_update_summary.py"


def run_step(*args: str) -> float:
    cmd = [sys.executable, *args]
    start = perf_counter()
    subprocess.run(cmd, check=True, cwd=ROOT)
    return perf_counter() - start


def build_daily_pipeline(args) -> int:
    total_start = perf_counter()
    codes_mode = bool(args.codes)
    update_state = load_update_state() if not args.full_rebuild and not args.codes else {}
    incremental_dates = [str(item).strip() for item in update_state.get("updatedDates") or [] if str(item).strip()]
    adjusted_date_from = str(update_state.get("adjustedDateFrom") or "").strip() or None

    if not args.skip_fetch:
        fetch_args = [
            SCRIPT_FETCH,
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
        if args.codes:
            fetch_args.extend(["--codes", args.codes])
        fetch_elapsed = run_step(*fetch_args)
        print(f"timing fetch={fetch_elapsed:.1f}s")

    ticker_args = [SCRIPT_TICKERS]
    if args.codes:
        ticker_args.extend(["--codes", args.codes])
    elif args.full_rebuild:
        ticker_args.extend(["--all", "--cache-recent-months", "3"])
    else:
        ticker_args.append("--use-update-state")
    if args.limit > 0:
        ticker_args.extend(["--limit", str(args.limit)])
    ticker_elapsed = run_step(*ticker_args)
    print(f"timing tickers={ticker_elapsed:.1f}s")

    ranking_args, overview_args = _build_shared_view_args(args, incremental_dates, adjusted_date_from)
    should_refresh_shared_views = _should_refresh_shared_views(args, codes_mode, incremental_dates, adjusted_date_from)
    if should_refresh_shared_views:
        rankings_elapsed = run_step(*ranking_args)
        print(f"timing rankings={rankings_elapsed:.1f}s")
        overview_elapsed = run_step(*overview_args)
        print(f"timing overview={overview_elapsed:.1f}s")
        summary_elapsed = run_step(SCRIPT_UPDATE_SUMMARY)
        print(f"timing update_summary={summary_elapsed:.1f}s")
    else:
        if codes_mode:
            print("timing rankings=0.0s (skipped: --codes safe mode)")
            print("timing overview=0.0s (skipped: --codes safe mode)")
            print("timing update_summary=0.0s (skipped: --codes safe mode)")
        else:
            print("timing rankings=0.0s (skipped)")
            print("timing overview=0.0s (skipped)")
            print("timing update_summary=0.0s (skipped)")

    print(f"timing total={perf_counter() - total_start:.1f}s")
    return 0


def _build_shared_view_args(
    args,
    incremental_dates: list[str],
    adjusted_date_from: str | None,
) -> tuple[list[str], list[str]]:
    ranking_args = [SCRIPT_RANKINGS]
    overview_args = [SCRIPT_OVERVIEW]

    if args.full_rebuild or args.codes:
        if args.full_rebuild and not args.codes:
            recent_dates = discover_available_dates()
            recent_count = len(recent_dates)
            recent_end_date = recent_dates[-1] if recent_dates else None
            ranking_args.extend(["--days", str(recent_count)])
            overview_args.extend(["--days", str(recent_count)])
            if recent_end_date:
                ranking_args.extend(["--end-date", recent_end_date])
                overview_args.extend(["--end-date", recent_end_date])
        else:
            ranking_args.extend(["--days", str(args.days)])
            overview_args.extend(["--days", str(args.days)])
    elif adjusted_date_from:
        ranking_args.extend(["--from-date", adjusted_date_from])
        overview_args.extend(["--from-date", adjusted_date_from])
    elif incremental_dates:
        ranking_args.extend(["--dates", "__UPDATE_STATE__"])
        overview_args.extend(["--dates", "__UPDATE_STATE__"])
    else:
        ranking_args.extend(["--days", str(args.days)])
        overview_args.extend(["--days", str(args.days)])

    if args.codes:
        ranking_args.extend(["--codes", args.codes])
        overview_args.extend(["--codes", args.codes])
    if args.end_date and not (args.full_rebuild and not args.codes):
        ranking_args.extend(["--end-date", args.end_date])
        overview_args.extend(["--end-date", args.end_date])
    return ranking_args, overview_args


def _should_refresh_shared_views(
    args,
    codes_mode: bool,
    incremental_dates: list[str],
    adjusted_date_from: str | None,
) -> bool:
    if args.full_rebuild:
        return True
    if codes_mode:
        return bool(args.include_shared_views)
    return bool(incremental_dates or adjusted_date_from)
