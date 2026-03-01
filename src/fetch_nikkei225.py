#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import math
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
NIKKEI_COMPONENTS_CSV = ROOT / "data" / "nikkei225_components.csv"
TSE_COMPONENTS_CSV = ROOT / "data" / "tse_listed_components.csv"
WATCHLIST_JSON = ROOT / "data" / "watchlist.json"
SUMMARY_JSON = ROOT / "data" / "market_summary.json"
OHLCV_DIR = ROOT / "data" / "ohlcv"
YAHOO_QUOTE_URL = "https://finance.yahoo.co.jp/quote/{code}.T"
JPX_LISTINGS_XLS_URL = "https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls"
JPX_DELISTED_URL = "https://www.jpx.co.jp/listing/stocks/delisted/index.html"
TITLE_PATTERN = re.compile(r"<title>\s*(.*?)\s*</title>", re.IGNORECASE | re.DOTALL)
TABLE_ROW_PATTERN = re.compile(r"<tr[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
TABLE_CELL_PATTERN = re.compile(r"<td[^>]*>(.*?)</td>", re.IGNORECASE | re.DOTALL)
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")

SEGMENT_LABELS = {
    "prime": "プライム",
    "standard": "スタンダード",
    "growth": "グロース",
}
JPX_SEGMENT_MAP = {
    "プライム（内国株式）": "prime",
    "スタンダード（内国株式）": "standard",
    "グロース（内国株式）": "growth",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Market data fetcher for Nikkei 225 / TSE equities")
    parser.add_argument("--universe", choices=["nikkei225", "tse"], default="nikkei225")
    parser.add_argument("--segments", default="prime,standard,growth", help="Used only with --universe tse")
    parser.add_argument("--period", default="10y", help="yfinance history period, e.g. 1y, 5y, 10y, max")
    parser.add_argument("--batch-size", type=int, default=30, help="Number of tickers per batch download")
    parser.add_argument("--pause", type=float, default=0.6, help="Pause seconds between batches")
    parser.add_argument("--max-tickers", type=int, default=0, help="Limit number of constituents for testing")
    parser.add_argument(
        "--skip-price-download",
        action="store_true",
        help="Only rebuild watchlist/components/summary from existing OHLCV files",
    )
    return parser.parse_args()


def load_nikkei225_components() -> list[dict[str, str]]:
    components: list[dict[str, str]] = []
    with NIKKEI_COMPONENTS_CSV.open("r", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        next(reader, None)
        for fields in reader:
            if len(fields) < 4:
                continue
            code = fields[0].strip()
            industry = fields[-1].strip()
            sector = fields[-2].strip()
            name = ",".join(part.strip() for part in fields[1:-2]).strip()
            components.append(
                {
                    "code": code,
                    "name": name,
                    "market": "TSE",
                    "market_slug": "tse",
                    "sector": sector,
                    "industry": industry,
                }
            )
    return components


def load_tse_components(selected_segments: list[str]) -> list[dict[str, str]]:
    delisted_codes = load_delisted_codes()
    request = Request(JPX_LISTINGS_XLS_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        data = response.read()

    frame = pd.read_excel(io.BytesIO(data))
    normalized = frame.rename(
        columns={
            "日付": "source_date",
            "コード": "code",
            "銘柄名": "name",
            "市場・商品区分": "market_raw",
            "33業種区分": "sector",
            "17業種区分": "industry",
        }
    )

    items: list[dict[str, str]] = []
    for row in normalized.to_dict("records"):
        market_raw = str(row.get("market_raw", "")).strip()
        segment = JPX_SEGMENT_MAP.get(market_raw)
        if segment not in selected_segments:
            continue

        code = str(row.get("code", "")).strip()
        name = str(row.get("name", "")).strip()
        if not code or not name:
            continue
        if code in delisted_codes:
            continue

        items.append(
            {
                "source_date": str(row.get("source_date", "")).strip(),
                "code": code,
                "name": name,
                "market": SEGMENT_LABELS[segment],
                "market_slug": segment,
                "sector": clean_classification(row.get("sector")),
                "industry": clean_classification(row.get("industry")),
            }
        )

    write_tse_components_csv(items)
    return items


def load_delisted_codes() -> set[str]:
    today = datetime.now().date()
    request = Request(JPX_DELISTED_URL, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urlopen(request, timeout=30) as response:
            page_html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return set()

    delisted_codes: set[str] = set()
    for row_html in TABLE_ROW_PATTERN.findall(page_html):
        cells = [strip_html(cell) for cell in TABLE_CELL_PATTERN.findall(row_html)]
        if len(cells) < 3:
            continue
        delisted_on = parse_jpx_date(cells[0])
        code = cells[2]
        if code and delisted_on and delisted_on <= today:
            delisted_codes.add(code)

    return delisted_codes


def parse_jpx_date(value: object) -> datetime.date | None:
    text = str(value or "").strip()
    if not text:
        return None

    for fmt in ("%Y/%m/%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def strip_html(value: str) -> str:
    return html.unescape(HTML_TAG_PATTERN.sub("", value)).replace("\xa0", " ").strip()


def write_tse_components_csv(components: list[dict[str, str]]) -> None:
    with TSE_COMPONENTS_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["source_date", "code", "name", "market", "market_slug", "sector", "industry"],
        )
        writer.writeheader()
        writer.writerows(components)


def clean_classification(value: object) -> str:
    text = str(value or "").strip()
    return "" if text in {"", "-", "nan"} else text


def make_watchlist(components: list[dict[str, str]], universe: str) -> list[dict[str, object]]:
    watchlist = []
    for row in components:
        code = row["code"]
        market_slug = row["market_slug"]
        sector = slugify(row["sector"]) if row["sector"] else "unknown-sector"
        industry = slugify(row["industry"]) if row["industry"] else "unknown-industry"
        name = row["name"]
        if universe == "nikkei225":
            name = resolve_japanese_name(code) or name

        tags = [universe, market_slug, sector, industry]
        links = {
            "quote": f"https://finance.yahoo.co.jp/quote/{code}.T",
        }
        if universe == "nikkei225":
            tags.insert(1, "nikkei225")
            links["nikkei"] = "https://indexes.nikkei.co.jp/nkave/index/component?idx=nk225"

        watchlist.append(
            {
                "ticker": code,
                "name": name,
                "market": row["market"],
                "tags": dedupe_tags(tags),
                "links": links,
                "sector": row["sector"],
                "industry": row["industry"],
            }
        )
    return watchlist


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


def slugify(text: str) -> str:
    return (
        text.lower()
        .replace("&", "and")
        .replace("/", "-")
        .replace(",", "")
        .replace(".", "")
        .replace(" ", "-")
    )


def resolve_japanese_name(code: str) -> str | None:
    request = Request(
        YAHOO_QUOTE_URL.format(code=code),
        headers={"User-Agent": "Mozilla/5.0"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except (TimeoutError, URLError):
        return None

    title_match = TITLE_PATTERN.search(html)
    if not title_match:
        return None

    title = title_match.group(1).strip()
    name = title.split("【", 1)[0].strip()
    if not name or "Yahoo!ファイナンス" in name:
        return None
    return name


def batch_download(tickers: list[str], period: str) -> dict[str, pd.DataFrame]:
    if not tickers:
        return {}

    frame = yf.download(
        tickers=" ".join(tickers),
        period=period,
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
            if isinstance(frame.columns, pd.MultiIndex):
                data = frame[ticker].copy()
            else:
                data = frame.copy()
            out[ticker] = normalize_history(data)
        except Exception:
            out[ticker] = pd.DataFrame()
    return out


def normalize_history(data: pd.DataFrame) -> pd.DataFrame:
    if data is None or data.empty:
        return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])

    frame = data.copy()
    frame = frame.reset_index()
    if "Date" not in frame.columns:
        frame = frame.rename(columns={frame.columns[0]: "Date"})
    frame = frame.rename(
        columns={
            "Date": "date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )
    frame["date"] = pd.to_datetime(frame["date"]).dt.strftime("%Y-%m-%d")
    keep = ["date", "open", "high", "low", "close", "volume"]
    frame = frame[keep].dropna(subset=["date", "open", "high", "low", "close"])
    frame["volume"] = frame["volume"].fillna(0).astype("int64")
    return frame


def save_history(code: str, data: pd.DataFrame) -> None:
    OHLCV_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OHLCV_DIR / f"{code}.csv"
    data.to_csv(out_path, index=False)


def fallback_single_download(ticker: str, period: str) -> pd.DataFrame:
    stock = yf.Ticker(ticker)
    data = stock.history(period=period, interval="1d", auto_adjust=False)
    return normalize_history(data)


def load_history_rows(code: str) -> list[dict[str, float | str]]:
    path = OHLCV_DIR / f"{code}.csv"
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        rows = []
        for row in reader:
            rows.append(
                {
                    "date": row["date"],
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                }
            )
    return rows


def moving_average(values: list[float], window_size: int) -> list[float | None]:
    out: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < window_size:
            out.append(None)
            continue
        window_values = values[index - window_size + 1 : index + 1]
        out.append(round(sum(window_values) / window_size, 2))
    return out


def latest_moving_average(values: list[float], window_size: int) -> float | None:
    series = moving_average(values, window_size)
    return series[-1] if series else None


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


def calculate_rci_series(closes: list[float], window_size: int) -> list[float | None]:
    out: list[float | None] = []
    for index in range(len(closes)):
        if index + 1 < window_size:
            out.append(None)
            continue
        out.append(calculate_rci(closes[index - window_size + 1 : index + 1]))
    return out


def calculate_summary_metrics(rows: list[dict[str, float | str]]) -> dict[str, float | str | None]:
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
    range_position_52w = (
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
        "rangePosition52w": range_position_52w,
    }


def write_summary(watchlist: list[dict[str, object]], universe: str) -> None:
    records = []
    for item in watchlist:
        ticker = str(item["ticker"])
        metrics = calculate_summary_metrics(load_history_rows(ticker))
        records.append(
            {
                "ticker": ticker,
                **metrics,
            }
        )

    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "universe": universe,
        "recordCount": len(records),
        "records": records,
    }
    SUMMARY_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_segments(value: str) -> list[str]:
    segments = [item.strip().lower() for item in value.split(",") if item.strip()]
    allowed = set(SEGMENT_LABELS)
    invalid = [item for item in segments if item not in allowed]
    if invalid:
        raise ValueError(f"invalid segments: {', '.join(invalid)}")
    return segments


def main() -> int:
    args = parse_args()
    selected_segments = parse_segments(args.segments)

    if args.universe == "nikkei225":
        components = load_nikkei225_components()
    else:
        components = load_tse_components(selected_segments)

    if args.max_tickers > 0:
        components = components[: args.max_tickers]

    watchlist = make_watchlist(components, args.universe)
    WATCHLIST_JSON.write_text(json.dumps(watchlist, ensure_ascii=False, indent=2), encoding="utf-8")

    if not args.skip_price_download:
        tickers = [f"{row['code']}.T" for row in components]
        total = len(tickers)
        failures: list[str] = []
        batch_total = math.ceil(total / args.batch_size) if total else 0

        for batch_index in range(batch_total):
            start = batch_index * args.batch_size
            end = min(start + args.batch_size, total)
            batch = tickers[start:end]
            print(f"[{batch_index + 1}/{batch_total}] downloading {start + 1}-{end} / {total}")
            result = batch_download(batch, args.period)

            for ticker in batch:
                code = ticker.replace(".T", "")
                frame = result.get(ticker, pd.DataFrame())
                if frame.empty:
                    try:
                        frame = fallback_single_download(ticker, args.period)
                    except Exception as exc:  # noqa: BLE001
                        print(f"  failed {ticker}: {exc}")
                        failures.append(code)
                        continue
                save_history(code, frame)
                print(f"  saved {code}: {len(frame)} rows")

            time.sleep(args.pause)

        write_summary(watchlist, args.universe)

        if failures:
            print(f"done with failures: {', '.join(failures)}")
            return 1
    else:
        write_summary(watchlist, args.universe)

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
