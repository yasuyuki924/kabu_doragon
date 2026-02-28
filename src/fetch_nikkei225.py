#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
import time
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
COMPONENTS_CSV = ROOT / "data" / "nikkei225_components.csv"
WATCHLIST_JSON = ROOT / "data" / "watchlist.json"
OHLCV_DIR = ROOT / "data" / "ohlcv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Nikkei 225 daily data fetcher")
    parser.add_argument("--period", default="10y", help="yfinance history period, e.g. 5y, 10y, max")
    parser.add_argument("--batch-size", type=int, default=30, help="Number of tickers per batch download")
    parser.add_argument("--pause", type=float, default=0.6, help="Pause seconds between batches")
    parser.add_argument("--max-tickers", type=int, default=0, help="Limit number of constituents for testing")
    return parser.parse_args()


def load_components() -> list[dict[str, str]]:
    components: list[dict[str, str]] = []
    with COMPONENTS_CSV.open("r", encoding="utf-8") as fh:
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
                    "sector": sector,
                    "industry": industry,
                }
            )
    return components


def make_watchlist(components: list[dict[str, str]]) -> list[dict[str, object]]:
    watchlist = []
    for row in components:
        code = row["code"]
        sector = slugify(row["sector"])
        industry = slugify(row["industry"])
        watchlist.append(
            {
                "ticker": code,
                "name": row["name"],
                "market": "TSE",
                "tags": ["nikkei225", sector, industry],
                "links": {
                    "quote": f"https://finance.yahoo.co.jp/quote/{code}.T",
                    "nikkei": f"https://indexes.nikkei.co.jp/nkave/index/component?idx=nk225",
                },
                "sector": row["sector"],
                "industry": row["industry"],
            }
        )
    return watchlist


def slugify(text: str) -> str:
    return (
        text.lower()
        .replace("&", "and")
        .replace("/", "-")
        .replace(",", "")
        .replace(".", "")
        .replace(" ", "-")
    )


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


def main() -> int:
    args = parse_args()
    components = load_components()
    if args.max_tickers > 0:
        components = components[: args.max_tickers]

    watchlist = make_watchlist(components)
    WATCHLIST_JSON.write_text(json.dumps(watchlist, ensure_ascii=False, indent=2), encoding="utf-8")

    tickers = [f"{row['code']}.T" for row in components]
    total = len(tickers)
    failures: list[str] = []

    for batch_index in range(math.ceil(total / args.batch_size)):
        start = batch_index * args.batch_size
        end = min(start + args.batch_size, total)
        batch = tickers[start:end]
        print(f"[{batch_index + 1}/{math.ceil(total / args.batch_size)}] downloading {start + 1}-{end} / {total}")
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

    if failures:
        print(f"done with failures: {', '.join(failures)}")
        return 1

    print("done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
