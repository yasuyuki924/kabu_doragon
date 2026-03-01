from __future__ import annotations

import csv
import json
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WATCHLIST_JSON = DATA_DIR / "watchlist.json"
OHLCV_DIR = DATA_DIR / "ohlcv"
TICKERS_DIR = DATA_DIR / "tickers"
RANKINGS_DIR = DATA_DIR / "rankings"
OVERVIEW_DIR = DATA_DIR / "overview"
MANIFEST_JSON = DATA_DIR / "manifest.json"

MA_WINDOWS = (5, 25, 75, 200)
VOLUME_MA_WINDOWS = (5, 25)
RCI_WINDOWS = (12, 24, 48)


def load_watchlist() -> list[dict[str, object]]:
    with WATCHLIST_JSON.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_ohlcv_rows(code: str) -> list[dict[str, float | int | str]]:
    path = OHLCV_DIR / f"{code}.csv"
    if not path.exists():
        return []

    rows: list[dict[str, float | int | str]] = []
    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows.append(
                {
                    "date": row["date"],
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": int(float(row["volume"])),
                }
            )
    return rows


def load_ticker_payload(code: str) -> dict[str, object] | None:
    path = TICKERS_DIR / f"{code}.json"
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def iter_ticker_payloads(codes: list[str] | None = None) -> list[dict[str, object]]:
    if codes:
        payloads = [load_ticker_payload(code) for code in codes]
        return [payload for payload in payloads if payload]

    payloads = []
    for path in sorted(TICKERS_DIR.glob("*.json")):
        if path.name == "index.json":
            continue
        with path.open("r", encoding="utf-8") as fh:
            payloads.append(json.load(fh))
    return payloads


def discover_available_dates() -> list[str]:
    for path in sorted(OHLCV_DIR.glob("*.csv")):
        rows = load_ohlcv_rows(path.stem)
        if rows:
            return [str(row["date"]) for row in rows]
    return []


def select_dates(all_dates: list[str], days: int, end_date: str | None = None) -> list[str]:
    if not all_dates:
        return []

    if end_date and end_date in all_dates:
        end_index = all_dates.index(end_date) + 1
        clipped = all_dates[:end_index]
    elif end_date:
        clipped = [item for item in all_dates if item <= end_date]
    else:
        clipped = all_dates

    if days <= 0 or days >= len(clipped):
        return clipped
    return clipped[-days:]


def moving_average(values: list[float], window_size: int) -> list[float | None]:
    out: list[float | None] = []
    running = 0.0
    for index, value in enumerate(values):
        running += value
        if index >= window_size:
            running -= values[index - window_size]
        if index + 1 < window_size:
            out.append(None)
            continue
        out.append(round(running / window_size, 4))
    return out


def latest_moving_average(values: list[float], window_size: int, index: int) -> float | None:
    if index + 1 < window_size:
        return None
    window = values[index - window_size + 1 : index + 1]
    return round(sum(window) / window_size, 4)


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


def build_enriched_rows(rows: list[dict[str, float | int | str]]) -> list[dict[str, float | int | str | bool | None]]:
    if not rows:
        return []

    closes = [float(row["close"]) for row in rows]
    volumes = [float(row["volume"]) for row in rows]
    highs = [float(row["high"]) for row in rows]
    lows = [float(row["low"]) for row in rows]

    ma_map = {window: moving_average(closes, window) for window in MA_WINDOWS}
    volume_ma_map = {window: moving_average(volumes, window) for window in VOLUME_MA_WINDOWS}
    rci_map = {window: calculate_rci_series(closes, window) for window in RCI_WINDOWS}

    enriched: list[dict[str, float | int | str | bool | None]] = []
    for index, row in enumerate(rows):
        close = float(row["close"])
        volume = int(row["volume"])
        previous_close = float(rows[index - 1]["close"]) if index > 0 else None
        change = close - previous_close if previous_close is not None else None
        change_percent = ((change / previous_close) * 100) if previous_close not in {None, 0} else None

        highest_52w = max(highs[max(0, index - 251) : index + 1])
        lowest_52w = min(lows[max(0, index - 251) : index + 1])
        range_position_52w = (
            ((close - lowest_52w) / (highest_52w - lowest_52w)) * 100 if highest_52w != lowest_52w else None
        )
        new_high_52w = close >= highest_52w if highest_52w else False

        ma5 = ma_map[5][index]
        ma25 = ma_map[25][index]
        ma75 = ma_map[75][index]
        ma200 = ma_map[200][index]
        volume_ma5 = volume_ma_map[5][index]
        volume_ma25 = volume_ma_map[25][index]

        enriched.append(
            {
                "date": row["date"],
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": close,
                "volume": volume,
                "change": round(change, 4) if change is not None else None,
                "changePercent": round(change_percent, 4) if change_percent is not None else None,
                "ma5": ma5,
                "ma25": ma25,
                "ma75": ma75,
                "ma200": ma200,
                "volumeMa5": volume_ma5,
                "volumeMa25": volume_ma25,
                "distanceToMa25": round(distance_from_baseline(close, ma25), 4) if ma25 else None,
                "distanceToMa75": round(distance_from_baseline(close, ma75), 4) if ma75 else None,
                "distanceToMa200": round(distance_from_baseline(close, ma200), 4) if ma200 else None,
                "volumeRatio25": round(volume / volume_ma25, 4) if volume_ma25 not in {None, 0} else None,
                "rci12": rci_map[12][index],
                "rci24": rci_map[24][index],
                "rci48": rci_map[48][index],
                "rangePosition52w": round(range_position_52w, 4) if range_position_52w is not None else None,
                "newHigh52w": bool(new_high_52w),
            }
        )
    return enriched


def summarize_sector_strength(records: list[dict[str, object]]) -> list[dict[str, object]]:
    grouped: dict[str, dict[str, float | int]] = {}
    for record in records:
        sector = str(record.get("sector") or record.get("market") or "未分類")
        grouped.setdefault(sector, {"count": 0, "sum": 0.0})
        change = record.get("changePercent")
        grouped[sector]["count"] += 1
        grouped[sector]["sum"] += float(change or 0)
    rows = []
    for sector, values in grouped.items():
        count = int(values["count"])
        average_change = (float(values["sum"]) / count) if count else 0.0
        rows.append({"label": sector, "count": count, "averageChangePercent": round(average_change, 4)})
    return sorted(rows, key=lambda item: (item["averageChangePercent"], item["count"]), reverse=True)


def summarize_tag_counts(records: list[dict[str, object]]) -> list[dict[str, object]]:
    counts: dict[str, int] = {}
    for record in records:
        for tag in record.get("tags") or []:
            normalized = str(tag).strip()
            if not normalized:
                continue
            counts[normalized] = counts.get(normalized, 0) + 1
    return [
        {"label": tag, "count": count}
        for tag, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: object) -> None:
    ensure_parent(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def build_manifest_payload(available_dates: list[str]) -> dict[str, object]:
    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "latestDate": available_dates[-1] if available_dates else None,
        "availableDates": available_dates,
        "rankingFiles": [
            "gainers",
            "losers",
            "volume_spike",
            "new_high",
            "deviation25",
            "watch_candidates",
        ],
    }


def parse_codes(value: str | None) -> list[str] | None:
    if not value:
        return None
    codes = [item.strip() for item in value.split(",") if item.strip()]
    return codes or None


def today_jst() -> str:
    return datetime.now().strftime("%Y-%m-%d")

