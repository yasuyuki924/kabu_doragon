#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from jquantsapi import Client, ClientV2
from requests.exceptions import HTTPError, RetryError


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OHLCV_DIR = DATA_DIR / "ohlcv"
WATCHLIST_JSON = DATA_DIR / "watchlist.json"
THEME_MAP_JSON = DATA_DIR / "theme_map.json"
SUMMARY_JSON = DATA_DIR / "market_summary.json"
SYNC_STATE_JSON = DATA_DIR / "jquants_sync_state.json"
NIKKEI_COMPONENTS_CSV = DATA_DIR / "nikkei225_components.csv"

SEGMENT_LABELS = {
    "prime": "プライム",
    "standard": "スタンダード",
    "growth": "グロース",
}
MARKET_TO_SEGMENT = {value: key for key, value in SEGMENT_LABELS.items()}
SUPPORTED_MARKETS = set(MARKET_TO_SEGMENT)


@dataclass(frozen=True)
class ProviderPaths:
    root: Path
    data_dir: Path
    ohlcv_dir: Path
    watchlist_json: Path
    theme_map_json: Path
    summary_json: Path
    sync_state_json: Path
    nikkei_components_csv: Path
    manifest_json: Path


@dataclass(frozen=True)
class AuthConfig:
    api_key: str
    refresh_token: str
    mail_address: str
    password: str
    plan: str


def default_paths() -> ProviderPaths:
    return ProviderPaths(
        root=ROOT,
        data_dir=DATA_DIR,
        ohlcv_dir=OHLCV_DIR,
        watchlist_json=WATCHLIST_JSON,
        theme_map_json=THEME_MAP_JSON,
        summary_json=SUMMARY_JSON,
        sync_state_json=SYNC_STATE_JSON,
        nikkei_components_csv=NIKKEI_COMPONENTS_CSV,
        manifest_json=DATA_DIR / "manifest.json",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch watchlist and OHLCV data from J-Quants")
    parser.add_argument("--universe", choices=["nikkei225", "tse"], default="tse")
    parser.add_argument("--segments", default="prime,standard,growth")
    parser.add_argument("--history-years", type=int, default=5)
    parser.add_argument("--full-refresh", action="store_true")
    parser.add_argument("--skip-price-download", action="store_true")
    parser.add_argument("--max-tickers", type=int, default=0, help="Limit tickers for testing")
    parser.add_argument("--codes", help="Comma separated repo-format codes for testing")
    parser.add_argument("--chunk-days", type=int, default=180, help="Bulk sync range chunk size")
    return parser.parse_args()


def parse_segments(value: str) -> list[str]:
    segments = [item.strip().lower() for item in value.split(",") if item.strip()]
    invalid = [item for item in segments if item not in SEGMENT_LABELS]
    if invalid:
        raise ValueError(f"invalid segments: {', '.join(invalid)}")
    return segments


def parse_codes(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip().upper() for item in value.split(",") if item.strip()]


def today_jst() -> str:
    return datetime.now().astimezone().date().isoformat()


def load_auth_config(root: Path) -> AuthConfig:
    load_dotenv(root / ".env", override=False)
    api_key = os.environ.get("JQUANTS_API_KEY", "").strip()
    refresh_token = os.environ.get("JQUANTS_API_REFRESH_TOKEN", "").strip()
    mail_address = os.environ.get("JQUANTS_API_MAIL_ADDRESS", "").strip()
    password = os.environ.get("JQUANTS_API_PASSWORD", "").strip()
    plan = os.environ.get("JQUANTS_PLAN", "light").strip().lower() or "light"

    if not api_key and not refresh_token and not (mail_address and password):
        raise ValueError(
            "J-Quants credentials are missing. Set JQUANTS_API_KEY or JQUANTS_API_REFRESH_TOKEN or JQUANTS_API_MAIL_ADDRESS/JQUANTS_API_PASSWORD."
        )

    return AuthConfig(
        api_key=api_key,
        refresh_token=refresh_token,
        mail_address=mail_address,
        password=password,
        plan=plan,
    )


def build_client(config: AuthConfig) -> tuple[object, str]:
    if config.api_key:
        return ClientV2(api_key=config.api_key), "v2"
    return (
        Client(
            refresh_token=config.refresh_token or None,
            mail_address=config.mail_address or None,
            password=config.password or None,
        ),
        "v1",
    )


def load_theme_map(path: Path) -> dict[str, object]:
    if not path.exists():
        return {"version": 1, "updatedAt": today_jst(), "themes": []}
    with path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        return {"version": 1, "updatedAt": today_jst(), "themes": []}
    if not isinstance(payload.get("themes"), list):
        payload["themes"] = []
    return payload


def build_theme_lookup(theme_map: dict[str, object]) -> dict[str, list[str]]:
    items = theme_map.get("themes", [])
    if not isinstance(items, list):
        return {}
    lookup: dict[str, list[str]] = {}
    seen_theme_names: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or item.get("label") or "").strip()
        codes = item.get("codes") or []
        if not name or not isinstance(codes, list):
            continue
        if name in seen_theme_names:
            raise ValueError(f"theme_map.json に重複テーマ名があります: {name}")
        seen_theme_names.add(name)
        for code in codes:
            normalized = normalize_repo_code(code)
            if not normalized:
                continue
            lookup.setdefault(normalized, [])
            if name not in lookup[normalized]:
                lookup[normalized].append(name)
    return lookup


def normalize_repo_code(value: object) -> str:
    text = str(value or "").strip().upper()
    if text.endswith(".0"):
        text = text[:-2]
    if len(text) == 5 and text.endswith("0"):
        return text[:-1]
    return text


def normalize_api_code(value: object) -> str:
    text = normalize_repo_code(value)
    if not text:
        return ""
    if len(text) == 5:
        return text
    if len(text) == 4:
        return f"{text}0"
    return text


def dedupe_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for tag in tags:
        normalized = str(tag or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalized)
    return out


def segment_from_market_name(value: object) -> str:
    return MARKET_TO_SEGMENT.get(str(value or "").strip(), "")


def read_nikkei_codes(path: Path) -> set[str]:
    if not path.exists():
        return set()
    codes: set[str] = set()
    with path.open("r", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        next(reader, None)
        for fields in reader:
            if not fields:
                continue
            code = normalize_repo_code(fields[0])
            if code:
                codes.add(code)
    return codes


def master_frame_to_records(frame: pd.DataFrame, api_version: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for row in frame.to_dict("records"):
        if api_version == "v2":
            code = normalize_repo_code(row.get("Code"))
            name = str(row.get("CoName") or "").strip()
            market = str(row.get("MktNm") or "").strip()
            sector = str(row.get("S33Nm") or "").strip()
            industry = str(row.get("S17Nm") or "").strip()
        else:
            code = normalize_repo_code(row.get("Code"))
            name = str(row.get("CompanyName") or "").strip()
            market = str(row.get("MarketCodeName") or "").strip()
            sector = str(row.get("Sector33CodeName") or "").strip()
            industry = str(row.get("Sector17CodeName") or "").strip()
        if not code or not name:
            continue
        records.append(
            {
                "code": code,
                "name": name,
                "market": market,
                "market_slug": segment_from_market_name(market),
                "sector": "" if sector in {"", "その他"} else sector,
                "industry": "" if industry in {"", "その他"} else industry,
            }
        )
    return records


def select_components(
    master_records: list[dict[str, str]],
    universe: str,
    selected_segments: list[str],
    max_tickers: int,
    codes: list[str],
    nikkei_codes: set[str],
) -> list[dict[str, str]]:
    allowed_codes = set(codes)
    out: list[dict[str, str]] = []
    for row in master_records:
        market_slug = row["market_slug"]
        if universe == "tse":
            if market_slug not in selected_segments:
                continue
        else:
            if row["code"] not in nikkei_codes:
                continue
        if allowed_codes and row["code"] not in allowed_codes:
            continue
        if universe == "nikkei225" and market_slug not in selected_segments and market_slug:
            pass
        out.append(row)
    out.sort(key=lambda item: item["code"])
    if max_tickers > 0:
        out = out[:max_tickers]
    return out


def build_watchlist(
    components: list[dict[str, str]],
    universe: str,
    theme_lookup: dict[str, list[str]],
) -> list[dict[str, object]]:
    watchlist: list[dict[str, object]] = []
    for row in components:
        tags = [universe, row["market_slug"], row["sector"], row["industry"]]
        watchlist.append(
            {
                "ticker": row["code"],
                "name": row["name"],
                "market": row["market"],
                "tags": dedupe_tags(tags),
                "links": {
                    "quote": f"https://finance.yahoo.co.jp/quote/{row['code']}.T",
                },
                "sector": row["sector"],
                "industry": row["industry"],
                "themes": list(theme_lookup.get(row["code"], [])),
            }
        )
    return watchlist


def coerce_frame_dates(frame: pd.DataFrame) -> pd.DataFrame:
    if "Date" in frame.columns:
        frame = frame.copy()
        frame["Date"] = pd.to_datetime(frame["Date"], errors="coerce")
        frame = frame[frame["Date"].notna()]
    return frame


def frame_to_ohlcv_rows(frame: pd.DataFrame, api_version: str) -> dict[str, list[dict[str, float | int | str]]]:
    if frame.empty:
        return {}
    frame = coerce_frame_dates(frame)
    rows_by_code: dict[str, list[dict[str, float | int | str]]] = {}
    for row in frame.to_dict("records"):
        code = normalize_repo_code(row.get("Code"))
        if not code:
            continue
        if api_version == "v2":
            open_value = row.get("O")
            high_value = row.get("H")
            low_value = row.get("L")
            close_value = row.get("C")
            volume_value = row.get("Vo")
        else:
            open_value = row.get("Open")
            high_value = row.get("High")
            low_value = row.get("Low")
            close_value = row.get("Close")
            volume_value = row.get("Volume")
        if open_value is None or high_value is None or low_value is None or close_value is None:
            continue
        if pd.isna(open_value) or pd.isna(high_value) or pd.isna(low_value) or pd.isna(close_value):
            continue
        if volume_value is None or pd.isna(volume_value):
            volume_value = 0
        row_date = row.get("Date")
        if isinstance(row_date, pd.Timestamp):
            date_text = row_date.strftime("%Y-%m-%d")
        else:
            date_text = pd.to_datetime(row_date, errors="coerce").strftime("%Y-%m-%d")
        rows_by_code.setdefault(code, []).append(
            {
                "date": date_text,
                "open": round(float(open_value), 4),
                "high": round(float(high_value), 4),
                "low": round(float(low_value), 4),
                "close": round(float(close_value), 4),
                "volume": int(float(volume_value or 0)),
            }
        )
    for code, rows in rows_by_code.items():
        rows_by_code[code] = sorted(rows, key=lambda item: item["date"])
    return rows_by_code


def read_ohlcv_rows(path: Path) -> list[dict[str, float | int | str]]:
    if not path.exists():
        return []
    rows: list[dict[str, float | int | str]] = []
    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows.append(
                {
                    "date": str(row["date"]),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": int(float(row["volume"])),
                }
            )
    return rows


def merge_ohlcv_rows(
    existing_rows: list[dict[str, float | int | str]],
    new_rows: list[dict[str, float | int | str]],
) -> list[dict[str, float | int | str]]:
    merged = {str(row["date"]): row for row in existing_rows}
    for row in new_rows:
        merged[str(row["date"])] = row
    return [merged[key] for key in sorted(merged)]


def write_ohlcv_rows(path: Path, rows: list[dict[str, float | int | str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["date", "open", "high", "low", "close", "volume"])
        writer.writeheader()
        writer.writerows(rows)


def flush_pending_rows(
    paths: ProviderPaths,
    pending_rows_by_code: dict[str, list[dict[str, float | int | str]]],
) -> None:
    for code, pending_rows in pending_rows_by_code.items():
        if not pending_rows:
            continue
        path = paths.ohlcv_dir / f"{code}.csv"
        merged = merge_ohlcv_rows(read_ohlcv_rows(path), pending_rows)
        write_ohlcv_rows(path, merged)
    pending_rows_by_code.clear()


def load_sync_state(path: Path) -> dict[str, object]:
    if not path.exists():
        return {
            "provider": "jquants",
            "plan": "light",
            "universe": "tse",
            "segments": ["prime", "standard", "growth"],
            "lastSuccessfulDate": None,
            "syncedAt": None,
        }
    with path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        return {}
    return payload


def load_manifest(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    return payload if isinstance(payload, dict) else {}


def current_repo_latest_date(paths: ProviderPaths) -> str | None:
    latest = load_manifest(paths.manifest_json).get("latestDate")
    text = str(latest or "").strip()
    return text or None


def current_sync_latest_date(paths: ProviderPaths) -> str | None:
    latest = load_sync_state(paths.sync_state_json).get("lastSuccessfulDate")
    text = str(latest or "").strip()
    return text or None


def resolve_latest_trading_date(client: object, api_version: str, as_of: date | None = None) -> str:
    today = as_of or datetime.now().astimezone().date()
    trading_dates = fetch_trading_dates(client, api_version, today - timedelta(days=14), today)
    if not trading_dates:
        raise ValueError("No recent trading dates returned from J-Quants calendar.")
    return trading_dates[-1].isoformat()


def is_target_date_reflected(paths: ProviderPaths, target_date: str) -> bool:
    return current_repo_latest_date(paths) == target_date and current_sync_latest_date(paths) == target_date


def write_sync_state(
    path: Path,
    *,
    plan: str,
    universe: str,
    segments: list[str],
    last_successful_date: str | None,
) -> None:
    payload = {
        "provider": "jquants",
        "plan": plan,
        "universe": universe,
        "segments": segments,
        "lastSuccessfulDate": last_successful_date,
        "syncedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def compute_sync_window(
    state: dict[str, object],
    *,
    plan: str,
    history_years: int,
    full_refresh: bool,
) -> tuple[date, date]:
    today = datetime.now().astimezone().date()
    max_years = 2 if plan == "free" else max(1, history_years)
    clamped_years = min(history_years, max_years) if history_years > 0 else max_years
    end_date = today - timedelta(days=84) if plan == "free" else today
    if full_refresh or not state.get("lastSuccessfulDate"):
        start_date = end_date - timedelta(days=365 * clamped_years)
        return start_date, end_date

    try:
        last_successful = datetime.strptime(str(state["lastSuccessfulDate"]), "%Y-%m-%d").date()
    except Exception:
        start_date = end_date - timedelta(days=365 * clamped_years)
        return start_date, end_date

    start_date = max(end_date - timedelta(days=365 * clamped_years), last_successful - timedelta(days=7))
    return start_date, end_date


def chunk_date_ranges(start_date: date, end_date: date, chunk_days: int) -> list[tuple[date, date]]:
    if start_date > end_date:
        return []
    chunk_size = max(1, chunk_days)
    ranges: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        chunk_end = min(end_date, cursor + timedelta(days=chunk_size - 1))
        ranges.append((cursor, chunk_end))
        cursor = chunk_end + timedelta(days=1)
    return ranges


def format_yyyymmdd(value: date) -> str:
    return value.strftime("%Y-%m-%d")


def fetch_trading_dates(client: object, api_version: str, start_date: date, end_date: date) -> list[date]:
    if api_version != "v2":
        cursor = start_date
        out: list[date] = []
        while cursor <= end_date:
            out.append(cursor)
            cursor += timedelta(days=1)
        return out

    frame = client.get_mkt_calendar(
        from_yyyymmdd=format_yyyymmdd(start_date),
        to_yyyymmdd=format_yyyymmdd(end_date),
    )
    if frame.empty:
        return []
    dates: list[date] = []
    for row in frame.to_dict("records"):
        if str(row.get("HolDiv", "")).strip() != "1":
            continue
        row_date = row.get("Date")
        parsed = pd.to_datetime(row_date, errors="coerce")
        if pd.isna(parsed):
            continue
        dates.append(parsed.date())
    return dates


def fetch_master_frame(client: object, api_version: str) -> pd.DataFrame:
    if api_version == "v2":
        return client.get_eq_master()
    return client.get_listed_info()


def fetch_bars_frame(
    client: object,
    api_version: str,
    *,
    code: str,
    from_date: date,
    to_date: date,
) -> pd.DataFrame:
    if api_version == "v2":
        return client.get_eq_bars_daily(
            code=code,
            from_yyyymmdd=format_yyyymmdd(from_date),
            to_yyyymmdd=format_yyyymmdd(to_date),
        )
    return client.get_prices_daily_quotes(
        code=normalize_repo_code(code),
        from_yyyymmdd=format_yyyymmdd(from_date),
        to_yyyymmdd=format_yyyymmdd(to_date),
    )


def sync_prices(
    client: object,
    api_version: str,
    paths: ProviderPaths,
    codes: list[str],
    start_date: date,
    end_date: date,
    chunk_days: int,
) -> str | None:
    latest_date: str | None = None
    code_set = set(codes)
    if api_version == "v2":
        trading_dates = fetch_trading_dates(client, api_version, start_date, end_date)
        total = len(trading_dates)
        pending_rows_by_code: dict[str, list[dict[str, float | int | str]]] = {}
        flush_interval = 20
        for index, trading_date in enumerate(trading_dates, start=1):
            print(f"syncing {format_yyyymmdd(trading_date)} ({index}/{total})")
            frame = None
            delay_seconds = 15
            for attempt in range(5):
                try:
                    frame = client.get_eq_bars_daily(date_yyyymmdd=format_yyyymmdd(trading_date))
                    break
                except (RetryError, HTTPError) as exc:
                    message = str(exc)
                    if "429" not in message or attempt == 4:
                        raise
                    print(f"  rate limited on {format_yyyymmdd(trading_date)}, retrying in {delay_seconds}s")
                    time.sleep(delay_seconds)
                    delay_seconds *= 2
            if frame is None:
                raise RuntimeError(f"failed to fetch {format_yyyymmdd(trading_date)}")
            if frame.empty:
                continue
            if "Code" in frame.columns:
                frame = frame[frame["Code"].map(normalize_repo_code).isin(code_set)]
            rows_by_code = frame_to_ohlcv_rows(frame, api_version)
            if not rows_by_code:
                continue
            for code, new_rows in rows_by_code.items():
                pending_rows_by_code.setdefault(code, []).extend(new_rows)
                latest_date = new_rows[-1]["date"]
            print(f"  updated {len(rows_by_code)} tickers")
            if index % flush_interval == 0:
                flush_pending_rows(paths, pending_rows_by_code)
        flush_pending_rows(paths, pending_rows_by_code)
        return latest_date

    pending_rows_by_code: dict[str, list[dict[str, float | int | str]]] = {}
    for chunk_start, chunk_end in chunk_date_ranges(start_date, end_date, chunk_days):
        print(f"syncing {format_yyyymmdd(chunk_start)}..{format_yyyymmdd(chunk_end)}")
        rows_by_code: dict[str, list[dict[str, float | int | str]]] = {}
        for code in codes:
            frame = fetch_bars_frame(client, api_version, code=code, from_date=chunk_start, to_date=chunk_end)
            if frame.empty:
                continue
            rows_by_code.update(frame_to_ohlcv_rows(frame, api_version))
        if not rows_by_code:
            continue
        for code, new_rows in rows_by_code.items():
            pending_rows_by_code.setdefault(code, []).extend(new_rows)
            latest_date = new_rows[-1]["date"]
        print(f"  updated {len(rows_by_code)} tickers")
    flush_pending_rows(paths, pending_rows_by_code)
    return latest_date


def calculate_summary_metrics(rows: list[dict[str, float | int | str]]) -> dict[str, float | str | None]:
    if not rows:
        return {
            "latestDate": None,
            "latestClose": None,
            "latestVolume": None,
            "changePercent": None,
            "distanceToMa25": None,
            "distanceToMa75": None,
            "distanceToMa200": None,
            "volumeRatio25": None,
            "rci12": None,
            "rci24": None,
            "rci48": None,
            "rangePosition52w": None,
        }

    closes = [float(row["close"]) for row in rows]
    volumes = [float(row["volume"]) for row in rows]
    highs = [float(row["high"]) for row in rows[-252:]]
    lows = [float(row["low"]) for row in rows[-252:]]
    latest = rows[-1]
    previous = rows[-2] if len(rows) >= 2 else None
    latest_close = float(latest["close"])
    latest_volume = int(float(latest["volume"]))
    change_percent = (
        ((latest_close - float(previous["close"])) / float(previous["close"])) * 100
        if previous and float(previous["close"]) != 0
        else None
    )
    ma25 = latest_moving_average(closes, 25)
    ma75 = latest_moving_average(closes, 75)
    ma200 = latest_moving_average(closes, 200)
    volume_ma25 = latest_moving_average(volumes, 25)
    highest_52w = max(highs) if highs else None
    lowest_52w = min(lows) if lows else None
    range_position = (
        ((latest_close - lowest_52w) / (highest_52w - lowest_52w)) * 100
        if highest_52w is not None and lowest_52w is not None and highest_52w != lowest_52w
        else None
    )
    return {
        "latestDate": str(latest["date"]),
        "latestClose": latest_close,
        "latestVolume": latest_volume,
        "changePercent": change_percent,
        "distanceToMa25": distance_from_baseline(latest_close, ma25),
        "distanceToMa75": distance_from_baseline(latest_close, ma75),
        "distanceToMa200": distance_from_baseline(latest_close, ma200),
        "volumeRatio25": (latest_volume / volume_ma25) if volume_ma25 not in {None, 0} else None,
        "rci12": calculate_rci_series(closes, 12)[-1],
        "rci24": calculate_rci_series(closes, 24)[-1],
        "rci48": calculate_rci_series(closes, 48)[-1],
        "rangePosition52w": range_position,
    }


def latest_moving_average(values: list[float], window_size: int) -> float | None:
    if len(values) < window_size:
        return None
    return round(sum(values[-window_size:]) / window_size, 2)


def distance_from_baseline(value: float | None, baseline: float | None) -> float | None:
    if value is None or baseline in {None, 0}:
        return None
    return ((value - baseline) / baseline) * 100


def rank_values(values: list[float]) -> list[float]:
    indexed = sorted(enumerate(values), key=lambda item: item[1])
    ranks = [0.0] * len(values)
    cursor = 0
    while cursor < len(indexed):
        end = cursor
        while end + 1 < len(indexed) and indexed[end + 1][1] == indexed[cursor][1]:
            end += 1
        average_rank = (cursor + end + 2) / 2
        for index in range(cursor, end + 1):
            ranks[indexed[index][0]] = average_rank
        cursor = end + 1
    return ranks


def calculate_rci(values: list[float]) -> float:
    length = len(values)
    time_ranks = list(range(1, length + 1))
    price_ranks = rank_values(values)
    sum_squared = 0.0
    for index, time_rank in enumerate(time_ranks):
        diff = time_rank - price_ranks[index]
        sum_squared += diff * diff
    return round((1 - (6 * sum_squared) / (length * (length * length - 1))) * 100, 2)


def calculate_rci_series(values: list[float], window_size: int) -> list[float | None]:
    out: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < window_size:
            out.append(None)
            continue
        out.append(calculate_rci(values[index - window_size + 1 : index + 1]))
    return out


def write_summary(paths: ProviderPaths, watchlist: list[dict[str, object]], universe: str) -> None:
    records = []
    for item in watchlist:
        ticker = str(item["ticker"])
        metrics = calculate_summary_metrics(read_ohlcv_rows(paths.ohlcv_dir / f"{ticker}.csv"))
        records.append({"ticker": ticker, **metrics})
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "universe": universe,
        "recordCount": len(records),
        "records": records,
    }
    paths.summary_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def run_sync(args: argparse.Namespace, paths: ProviderPaths | None = None) -> int:
    paths = paths or default_paths()
    config = load_auth_config(paths.root)
    client, api_version = build_client(config)
    selected_segments = parse_segments(args.segments)
    selected_codes = parse_codes(args.codes)

    if config.plan == "free":
        print("warning: J-Quants Free is delayed by 12 weeks and is not suitable for latest daily updates.")

    master_frame = fetch_master_frame(client, api_version)
    master_records = master_frame_to_records(master_frame, api_version)
    nikkei_codes = read_nikkei_codes(paths.nikkei_components_csv)
    components = select_components(
        master_records,
        universe=args.universe,
        selected_segments=selected_segments,
        max_tickers=args.max_tickers,
        codes=selected_codes,
        nikkei_codes=nikkei_codes,
    )
    if not components:
        raise ValueError("No components matched the selected universe/segments.")

    theme_lookup = build_theme_lookup(load_theme_map(paths.theme_map_json))
    watchlist = build_watchlist(components, args.universe, theme_lookup)
    paths.watchlist_json.write_text(json.dumps(watchlist, ensure_ascii=False, indent=2), encoding="utf-8")

    state = load_sync_state(paths.sync_state_json)
    start_date, end_date = compute_sync_window(
        state,
        plan=config.plan,
        history_years=args.history_years,
        full_refresh=args.full_refresh,
    )

    latest_date = None
    if not args.skip_price_download:
        latest_date = sync_prices(
            client,
            api_version,
            paths,
            [item["ticker"] for item in watchlist],
            start_date,
            end_date,
            args.chunk_days,
        )

    write_summary(paths, watchlist, args.universe)
    write_sync_state(
        paths.sync_state_json,
        plan=config.plan,
        universe=args.universe,
        segments=selected_segments,
        last_successful_date=latest_date or state.get("lastSuccessfulDate"),
    )
    print(f"done ({len(watchlist)} tickers)")
    return 0


def main() -> int:
    return run_sync(parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
