#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fetch_nikkei225 import load_nikkei225_components, load_tse_components, normalize_history
from src.data_source.inactive_codes import (
    build_inactive_registry,
    fetch_jpx_delisted_lookup,
    load_existing_watchlist_candidates,
    load_inactive_lookup,
    load_retry_pending_candidates,
    write_inactive_codes,
)
from jquants_provider import (
    ProviderPaths,
    apply_corporate_actions,
    build_inactive_candidate_entries,
    build_theme_lookup,
    build_watchlist,
    current_repo_latest_date,
    default_paths,
    load_am_target_codes,
    load_sync_state,
    load_theme_map,
    merge_ohlcv_rows,
    parse_codes,
    parse_segments,
    read_corporate_action_events,
    read_ohlcv_rows,
    write_ohlcv_rows,
    write_summary,
    write_update_state,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch OHLCV data from yfinance with repo-compatible storage")
    parser.add_argument("--universe", choices=["nikkei225", "tse"], default="tse")
    parser.add_argument("--segments", default="prime,standard,growth")
    parser.add_argument("--history-years", type=int, default=5)
    parser.add_argument("--full-refresh", action="store_true")
    parser.add_argument("--skip-price-download", action="store_true")
    parser.add_argument("--max-tickers", type=int, default=0)
    parser.add_argument("--codes", help="Comma separated repo-format codes for testing")
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--pause", type=float, default=0.6)
    parser.add_argument("--overlap-days", type=int, default=7)
    parser.add_argument("--intraday-snapshot", action="store_true", help="Fetch delayed provisional current-day bars")
    parser.add_argument("--intraday-limit", type=int, default=300)
    return parser.parse_args()


def normalize_components(
    universe: str,
    segments: list[str],
    selected_codes: list[str],
    max_tickers: int,
) -> list[dict[str, str]]:
    components = load_nikkei225_components() if universe == "nikkei225" else load_tse_components(segments)
    if selected_codes:
        allowed = set(selected_codes)
        components = [row for row in components if str(row.get("code") or "") in allowed]
    components.sort(key=lambda item: str(item.get("code") or ""))
    if max_tickers > 0:
        components = components[:max_tickers]
    return components


def write_sync_state(
    path: Path,
    *,
    universe: str,
    segments: list[str],
    last_successful_date: str | None,
) -> None:
    payload = {
        "provider": "yfinance",
        "plan": "public",
        "universe": universe,
        "segments": segments,
        "lastSuccessfulDate": last_successful_date,
        "syncedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def compute_sync_window(state: dict[str, object], *, history_years: int, full_refresh: bool, overlap_days: int) -> tuple[date, date]:
    today = datetime.now().astimezone().date()
    clamped_years = max(1, history_years)
    if full_refresh or not state.get("lastSuccessfulDate"):
        return today - timedelta(days=365 * clamped_years), today
    try:
        last_successful = datetime.strptime(str(state["lastSuccessfulDate"]), "%Y-%m-%d").date()
    except Exception:
        return today - timedelta(days=365 * clamped_years), today
    start_date = max(today - timedelta(days=365 * clamped_years), last_successful - timedelta(days=max(1, overlap_days)))
    return start_date, today


def batch_download_range(tickers: list[str], start_date: date, end_date: date) -> dict[str, pd.DataFrame]:
    if not tickers:
        return {}
    frame = yf.download(
        tickers=" ".join(tickers),
        start=start_date.isoformat(),
        end=(end_date + timedelta(days=1)).isoformat(),
        interval="1d",
        auto_adjust=False,
        progress=False,
        group_by="ticker",
        threads=True,
    )
    out: dict[str, pd.DataFrame] = {}
    if frame.empty:
        return out
    for ticker in tickers:
        try:
            source = frame[ticker].copy() if isinstance(frame.columns, pd.MultiIndex) else frame.copy()
            out[ticker] = normalize_history(source)
        except Exception:
            out[ticker] = pd.DataFrame()
    return out


def batch_download_intraday(tickers: list[str], *, period: str = "5d", interval: str = "5m") -> dict[str, pd.DataFrame]:
    if not tickers:
        return {}
    frame = yf.download(
        tickers=" ".join(tickers),
        period=period,
        interval=interval,
        auto_adjust=False,
        progress=False,
        group_by="ticker",
        threads=True,
        prepost=False,
    )
    out: dict[str, pd.DataFrame] = {}
    if frame.empty:
        return out
    for ticker in tickers:
        try:
            source = frame[ticker].copy() if isinstance(frame.columns, pd.MultiIndex) else frame.copy()
            out[ticker] = source
        except Exception:
            out[ticker] = pd.DataFrame()
    return out


def frame_to_rows(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    if frame is None or frame.empty:
        return []
    rows: list[dict[str, float | int | str]] = []
    for record in frame.to_dict("records"):
        try:
            rows.append(
                {
                    "date": str(record["date"]),
                    "open": round(float(record["open"]), 4),
                    "high": round(float(record["high"]), 4),
                    "low": round(float(record["low"]), 4),
                    "close": round(float(record["close"]), 4),
                    "volume": int(float(record.get("volume") or 0)),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return rows


def intraday_frame_to_snapshot_row(frame: pd.DataFrame, *, target_date: str) -> dict[str, float | int | str] | None:
    if frame is None or frame.empty:
        return None
    source = frame.copy().reset_index()
    if source.empty:
        return None
    datetime_column = "Datetime" if "Datetime" in source.columns else source.columns[0]
    source = source.rename(
        columns={
            datetime_column: "datetime",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )
    keep = ["datetime", "open", "high", "low", "close", "volume"]
    source = source[[column for column in keep if column in source.columns]].dropna(subset=["datetime", "open", "high", "low", "close"])
    if source.empty:
        return None
    timestamps = pd.to_datetime(source["datetime"], errors="coerce")
    if timestamps.isna().all():
        return None
    if getattr(timestamps.dt, "tz", None) is None:
        timestamps = timestamps.dt.tz_localize("Asia/Tokyo", nonexistent="shift_forward", ambiguous="NaT")
    else:
        timestamps = timestamps.dt.tz_convert("Asia/Tokyo")
    source["datetime"] = timestamps
    source = source.dropna(subset=["datetime"]).sort_values("datetime")
    if source.empty:
        return None
    source["date"] = source["datetime"].dt.strftime("%Y-%m-%d")
    today_rows = source[source["date"] == target_date]
    if today_rows.empty:
        return None
    first_row = today_rows.iloc[0]
    last_row = today_rows.iloc[-1]
    return {
        "date": target_date,
        "open": round(float(first_row["open"]), 4),
        "high": round(float(today_rows["high"].max()), 4),
        "low": round(float(today_rows["low"].min()), 4),
        "close": round(float(last_row["close"]), 4),
        "volume": int(float(today_rows["volume"].fillna(0).sum())),
    }


def upsert_adjusted_rows(paths: ProviderPaths, code: str, new_rows: list[dict[str, float | int | str]]) -> bool:
    raw_path = paths.ohlcv_raw_dir / f"{code}.csv"
    adjusted_path = paths.ohlcv_dir / f"{code}.csv"
    event_path = paths.corporate_actions_dir / f"{code}.json"
    existing_raw_rows = read_ohlcv_rows(raw_path)
    merged_raw_rows = merge_ohlcv_rows(existing_raw_rows, new_rows)
    if merged_raw_rows == existing_raw_rows:
        return False
    write_ohlcv_rows(raw_path, merged_raw_rows)
    events = read_corporate_action_events(event_path)
    adjusted_rows = apply_corporate_actions(
        merged_raw_rows,
        events,
        code=code,
        auto_correct_effective_dates=True,
    )
    write_ohlcv_rows(adjusted_path, adjusted_rows)
    return True


def sync_prices(
    paths: ProviderPaths,
    codes: list[str],
    *,
    start_date: date,
    end_date: date,
    batch_size: int,
    pause_seconds: float,
) -> tuple[str | None, set[str], set[str]]:
    latest_date: str | None = None
    updated_dates: set[str] = set()
    updated_codes: set[str] = set()
    tickers = [f"{code}.T" for code in codes]
    total = len(tickers)
    batch_total = math.ceil(total / batch_size) if total else 0
    for batch_index in range(batch_total):
        start = batch_index * batch_size
        end = min(start + batch_size, total)
        batch = tickers[start:end]
        print(f"[{batch_index + 1}/{batch_total}] downloading {start + 1}-{end} / {total}")
        result = batch_download_range(batch, start_date, end_date)
        for ticker in batch:
            code = ticker[:-2]
            rows = frame_to_rows(result.get(ticker, pd.DataFrame()))
            if not rows:
                continue
            changed = upsert_adjusted_rows(paths, code, rows)
            if not changed:
                continue
            latest_date = max(latest_date or rows[-1]["date"], rows[-1]["date"])
            updated_codes.add(code)
            updated_dates.update(str(row["date"]) for row in rows)
            print(f"  updated {code}: {len(rows)} rows")
        if pause_seconds > 0:
            time.sleep(pause_seconds)
    return latest_date, updated_dates, updated_codes


def write_current_snapshot_state(
    path: Path,
    *,
    snapshot_date: str | None,
    snapshot_type: str,
    active: bool,
    status: str | None = None,
    stale_after_close: bool = False,
    final_retry_at: str | None = None,
) -> None:
    resolved_status = status
    if not resolved_status:
        if snapshot_type == "daily":
            resolved_status = "finalized"
        elif snapshot_type == "yf_intraday":
            resolved_status = "intraday"
        else:
            resolved_status = snapshot_type or ""
    payload = {
        "date": snapshot_date,
        "snapshotType": snapshot_type,
        "active": active,
        "status": resolved_status,
        "staleAfterClose": stale_after_close,
        "finalRetryAt": final_retry_at,
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_yf_snapshot(
    path: Path,
    *,
    snapshot_date: str,
    rows_by_code: dict[str, dict[str, float | int | str]],
    requested_count: int,
    succeeded_count: int,
) -> None:
    records = []
    for code in sorted(rows_by_code):
        row = rows_by_code[code]
        records.append(
            {
                "code": code,
                "date": snapshot_date,
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row["volume"],
            }
        )
    payload = {
        "date": snapshot_date,
        "snapshotType": "yf_intraday",
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "coverage": {
            "requested": requested_count,
            "succeeded": succeeded_count,
        },
        "records": records,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def sync_intraday_snapshot(
    paths: ProviderPaths,
    codes: list[str],
    *,
    batch_size: int,
    pause_seconds: float,
) -> tuple[str, set[str], bool]:
    target_date = datetime.now().astimezone().date().isoformat()
    start_date = datetime.now().astimezone().date() - timedelta(days=7)
    rows_by_code: dict[str, dict[str, float | int | str]] = {}
    tickers = [f"{code}.T" for code in codes]
    total = len(tickers)
    batch_total = math.ceil(total / batch_size) if total else 0
    for batch_index in range(batch_total):
        start = batch_index * batch_size
        end = min(start + batch_size, total)
        batch = tickers[start:end]
        result = batch_download_range(batch, start_date, datetime.now().astimezone().date())
        for ticker in batch:
            code = ticker[:-2]
            rows = frame_to_rows(result.get(ticker, pd.DataFrame()))
            if not rows or str(rows[-1]["date"]) != target_date:
                continue
            rows_by_code[code] = rows[-1]
        if pause_seconds > 0:
            time.sleep(pause_seconds)

    if len(rows_by_code) < total:
        missing_tickers = [ticker for ticker in tickers if ticker[:-2] not in rows_by_code]
        missing_total = len(missing_tickers)
        missing_batch_total = math.ceil(missing_total / batch_size) if missing_total else 0
        for batch_index in range(missing_batch_total):
            start = batch_index * batch_size
            end = min(start + batch_size, missing_total)
            batch = missing_tickers[start:end]
            result = batch_download_intraday(batch)
            for ticker in batch:
                code = ticker[:-2]
                snapshot_row = intraday_frame_to_snapshot_row(result.get(ticker, pd.DataFrame()), target_date=target_date)
                if snapshot_row is None:
                    continue
                rows_by_code[code] = snapshot_row
            if pause_seconds > 0:
                time.sleep(pause_seconds)
    succeeded = len(rows_by_code)
    write_yf_snapshot(
        paths.intraday_dir / "yf_snapshot.json",
        snapshot_date=target_date,
        rows_by_code=rows_by_code,
        requested_count=total,
        succeeded_count=succeeded,
    )
    write_current_snapshot_state(
        paths.current_snapshot_state_json,
        snapshot_date=target_date,
        snapshot_type="yf_intraday",
        active=succeeded > 0,
        status="intraday",
    )
    return target_date, set(rows_by_code), succeeded > 0


def run_sync(args: argparse.Namespace) -> int:
    paths = default_paths()
    selected_segments = parse_segments(args.segments)
    selected_codes = parse_codes(args.codes)
    components = normalize_components(args.universe, selected_segments, selected_codes, args.max_tickers)
    current_components_all = normalize_components(args.universe, selected_segments, [], 0)
    jpx_lookup = fetch_jpx_delisted_lookup()
    inactive_items = build_inactive_registry(
        candidate_entries=build_inactive_candidate_entries(
            current_components_all,
            load_existing_watchlist_candidates(paths.watchlist_json),
            load_retry_pending_candidates(paths.retry_pending_json),
        ),
        active_codes={str(item["code"]) for item in current_components_all},
        as_of_date=datetime.now().astimezone().date().isoformat(),
        existing_lookup=load_inactive_lookup(paths.inactive_codes_json),
        jpx_lookup=jpx_lookup,
        checked_at=datetime.now().astimezone().isoformat(timespec="seconds"),
    )
    write_inactive_codes(
        inactive_items,
        as_of_date=datetime.now().astimezone().date().isoformat(),
        jpx_fetch_ok=bool(jpx_lookup),
        path=paths.inactive_codes_json,
    )
    inactive_codes = {str(item["code"]) for item in inactive_items}
    components = [row for row in components if str(row.get("code") or "") not in inactive_codes]
    current_components_all = [row for row in current_components_all if str(row.get("code") or "") not in inactive_codes]
    if not components:
        raise ValueError("No active components matched the selected universe/segments.")

    theme_lookup = build_theme_lookup(load_theme_map(paths.theme_map_json))
    sync_watchlist = build_watchlist(components, args.universe, theme_lookup)
    persisted_watchlist = sync_watchlist
    if selected_codes:
        persisted_components = current_components_all
        persisted_watchlist = build_watchlist(persisted_components, args.universe, theme_lookup)
    paths.watchlist_json.write_text(json.dumps(persisted_watchlist, ensure_ascii=False, indent=2), encoding="utf-8")

    state = load_sync_state(paths.sync_state_json)
    latest_date = None
    updated_dates: set[str] = set()
    updated_codes: set[str] = set()

    if args.intraday_snapshot:
        target_codes = selected_codes or load_am_target_codes(paths, limit=max(1, args.intraday_limit))
        if args.max_tickers > 0:
            target_codes = target_codes[: args.max_tickers]
        latest_date, updated_codes, active = sync_intraday_snapshot(
            paths,
            target_codes,
            batch_size=args.batch_size,
            pause_seconds=args.pause,
        )
        updated_dates = {latest_date} if active and latest_date else set()
        write_update_state(
            paths.update_state_json,
            snapshot_type="yf_intraday",
            updated_dates=updated_dates,
            updated_codes=updated_codes,
            adjusted_codes=[],
            adjusted_date_from=None,
        )
        write_summary(paths, persisted_watchlist, args.universe)
        print(f"done intraday ({len(updated_codes)} tickers)")
        return 0 if active else 10

    if not args.skip_price_download:
        start_date, end_date = compute_sync_window(
            state,
            history_years=args.history_years,
            full_refresh=args.full_refresh,
            overlap_days=args.overlap_days,
        )
        latest_date, updated_dates, updated_codes = sync_prices(
            paths,
            [item["ticker"] for item in sync_watchlist],
            start_date=start_date,
            end_date=end_date,
            batch_size=max(1, args.batch_size),
            pause_seconds=args.pause,
        )

    write_summary(paths, persisted_watchlist, args.universe)
    if not args.skip_price_download:
        write_update_state(
            paths.update_state_json,
            snapshot_type="daily",
            updated_dates=updated_dates,
            updated_codes=updated_codes,
            adjusted_codes=[],
            adjusted_date_from=None,
        )
        write_sync_state(
            paths.sync_state_json,
            universe=args.universe,
            segments=selected_segments,
            last_successful_date=latest_date or state.get("lastSuccessfulDate"),
        )
    print(f"done ({len(sync_watchlist)} tickers)")
    return 0


def main() -> int:
    return run_sync(parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
