from __future__ import annotations

import csv
import json
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WATCHLIST_JSON = DATA_DIR / "watchlist.json"
THEME_MAP_JSON = DATA_DIR / "theme_map.json"
OHLCV_DIR = DATA_DIR / "ohlcv"
INTRADAY_DIR = DATA_DIR / "intraday"
AM_SNAPSHOT_JSON = INTRADAY_DIR / "am_snapshot.json"
CURRENT_SNAPSHOT_STATE_JSON = DATA_DIR / "current_snapshot_state.json"
TICKERS_DIR = DATA_DIR / "tickers"
DAILY_RECORDS_DIR = DATA_DIR / "daily_records"
RANKINGS_DIR = DATA_DIR / "rankings"
OVERVIEW_DIR = DATA_DIR / "overview"
MANIFEST_JSON = DATA_DIR / "manifest.json"
JQUANTS_SYNC_STATE_JSON = DATA_DIR / "jquants_sync_state.json"
UPDATE_STATE_JSON = DATA_DIR / "update_state.json"

MA_WINDOWS = (5, 25, 75, 200)
VOLUME_MA_WINDOWS = (5, 25)
RCI_WINDOWS = (12, 24, 48)


def load_theme_map() -> dict[str, object]:
    if not THEME_MAP_JSON.exists():
        return {"version": 1, "updatedAt": today_jst(), "themes": []}
    with THEME_MAP_JSON.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        return {"version": 1, "updatedAt": today_jst(), "themes": []}
    themes = payload.get("themes")
    if not isinstance(themes, list):
        payload["themes"] = []
    return payload


def build_theme_lookup(theme_map: dict[str, object]) -> dict[str, list[str]]:
    items = theme_map.get("themes", [])
    if not isinstance(items, list):
        return {}

    ordered_items = [item for item in items if isinstance(item, dict)]
    lookup: dict[str, list[str]] = {}
    seen_theme_names: set[str] = set()
    for item in ordered_items:
        label = str(item.get("name") or item.get("label") or "").strip()
        codes = item.get("codes") or []
        if not label or not isinstance(codes, list):
            continue
        if label in seen_theme_names:
            raise ValueError(f"theme_map.json に重複テーマ名があります: {label}")
        seen_theme_names.add(label)
        for code in codes:
            normalized_code = str(code or "").strip()
            if not normalized_code:
                continue
            lookup.setdefault(normalized_code, [])
            if label not in lookup[normalized_code]:
                lookup[normalized_code].append(label)
    return lookup


def attach_themes(record: dict[str, object], lookup: dict[str, list[str]]) -> dict[str, object]:
    code = str(record.get("ticker") or record.get("code") or "").strip()
    themes = list(lookup.get(code, []))
    return {**record, "themes": themes}


def load_watchlist() -> list[dict[str, object]]:
    theme_lookup = build_theme_lookup(load_theme_map())
    with WATCHLIST_JSON.open("r", encoding="utf-8") as fh:
        records = json.load(fh)
    return [attach_themes(record, theme_lookup) for record in records]


def load_json_dict(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    return payload if isinstance(payload, dict) else {}


def load_update_state() -> dict[str, object]:
    payload = load_json_dict(UPDATE_STATE_JSON)
    updated_dates = payload.get("updatedDates")
    updated_codes = payload.get("updatedCodes")
    payload["updatedDates"] = [str(item).strip() for item in updated_dates] if isinstance(updated_dates, list) else []
    payload["updatedCodes"] = [str(item).strip() for item in updated_codes] if isinstance(updated_codes, list) else []
    return payload


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


def build_daily_record(meta: dict[str, object], row: dict[str, object]) -> dict[str, object]:
    return {
        "code": meta["code"],
        "name": meta["name"],
        "market": meta["market"],
        "sector": meta.get("sector", ""),
        "industry": meta.get("industry", ""),
        "themes": meta.get("themes", []),
        "tags": meta.get("tags", []),
        "links": meta.get("links", {}),
        "date": row["date"],
        "open": row.get("open"),
        "high": row.get("high"),
        "low": row.get("low"),
        "close": row.get("close"),
        "volume": row.get("volume"),
        "turnover": row.get("turnover"),
        "change": row.get("change"),
        "changePercent": row.get("changePercent"),
        "ma5": row.get("ma5"),
        "ma25": row.get("ma25"),
        "ma75": row.get("ma75"),
        "ma200": row.get("ma200"),
        "volumeMa5": row.get("volumeMa5"),
        "volumeMa25": row.get("volumeMa25"),
        "turnoverMa5": row.get("turnoverMa5"),
        "distanceToMa25": row.get("distanceToMa25"),
        "distanceToMa75": row.get("distanceToMa75"),
        "distanceToMa200": row.get("distanceToMa200"),
        "volumeRatio25": row.get("volumeRatio25"),
        "rci12": row.get("rci12"),
        "rci24": row.get("rci24"),
        "rci48": row.get("rci48"),
        "rangePosition52w": row.get("rangePosition52w"),
        "newHigh52w": row.get("newHigh52w"),
    }


def load_daily_records(date_value: str, codes: list[str] | None = None) -> list[dict[str, object]] | None:
    path = DAILY_RECORDS_DIR / f"{date_value}.json"
    payload = load_json_dict(path)
    records = payload.get("records")
    if not isinstance(records, list):
        return None
    normalized = [item for item in records if isinstance(item, dict)]
    if not codes:
        return normalized
    code_filter = set(codes)
    return [item for item in normalized if str(item.get("code") or "") in code_filter]


def merge_daily_records(
    date_value: str,
    updates: dict[str, dict[str, object]],
    snapshot_type: str | None = None,
) -> None:
    if not updates:
        return
    existing = load_daily_records(date_value) or []
    merged = {str(item.get("code") or ""): item for item in existing if str(item.get("code") or "").strip()}
    for code, record in updates.items():
        merged[str(code).strip()] = record
    payload: dict[str, object] = {
        "date": date_value,
        "recordCount": len(merged),
        "records": sorted(merged.values(), key=lambda item: str(item.get("code") or "")),
    }
    if snapshot_type:
        payload["snapshotType"] = snapshot_type
    write_json(DAILY_RECORDS_DIR / f"{date_value}.json", payload)


def discover_available_dates() -> list[str]:
    available_dates: list[str] | None = None
    for path in sorted(OHLCV_DIR.glob("*.csv")):
        rows = load_ohlcv_rows(path.stem)
        if rows:
            available_dates = [str(row["date"]) for row in rows]
            break
    if available_dates is None:
        available_dates = []

    snapshot_context = resolve_current_snapshot_context()
    snapshot_date = str(snapshot_context.get("date") or "").strip()
    if snapshot_context.get("useAmSnapshot") and snapshot_date and snapshot_date not in available_dates:
        available_dates.append(snapshot_date)
    return available_dates


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

    turnovers = [float(row["close"]) * float(row["volume"]) for row in rows]
    ma_map = {window: moving_average(closes, window) for window in MA_WINDOWS}
    volume_ma_map = {window: moving_average(volumes, window) for window in VOLUME_MA_WINDOWS}
    turnover_ma_map = {window: moving_average(turnovers, window) for window in VOLUME_MA_WINDOWS}
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
        turnover = turnovers[index]
        turnover_ma5 = turnover_ma_map[5][index]

        enriched.append(
            {
                "date": row["date"],
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": close,
                "volume": volume,
                "turnover": round(turnover, 4),
                "change": round(change, 4) if change is not None else None,
                "changePercent": round(change_percent, 4) if change_percent is not None else None,
                "ma5": ma5,
                "ma25": ma25,
                "ma75": ma75,
                "ma200": ma200,
                "volumeMa5": volume_ma5,
                "volumeMa25": volume_ma25,
                "turnoverMa5": round(turnover_ma5, 4) if turnover_ma5 is not None else None,
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


def summarize_theme_counts(records: list[dict[str, object]]) -> list[dict[str, object]]:
    counts: dict[str, int] = {}
    for record in records:
        for theme in record.get("themes") or []:
            label = str(theme or "").strip()
            if not label:
                continue
            counts[label] = counts.get(label, 0) + 1
    return [
        {"label": label, "count": count}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: object) -> None:
    ensure_parent(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def build_manifest_payload(available_dates: list[str]) -> dict[str, object]:
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "latestDate": available_dates[-1] if available_dates else None,
        "availableDates": available_dates,
        "rankingFiles": [
            "gainers",
            "losers",
            "volume_spike",
            "new_high",
            "deviation25",
            "deviation75",
            "deviation200",
            "watch_candidates",
        ],
    }
    snapshot_context = resolve_current_snapshot_context()
    if (
        snapshot_context.get("date")
        and snapshot_context.get("type")
        and snapshot_context.get("date") == payload["latestDate"]
    ):
        payload["currentSnapshot"] = {
            "date": snapshot_context["date"],
            "type": snapshot_context["type"],
        }
    return payload


def parse_codes(value: str | None) -> list[str] | None:
    if not value:
        return None
    codes = [item.strip() for item in value.split(",") if item.strip()]
    return codes or None


def today_jst() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def load_am_snapshot() -> dict[str, object]:
    payload = load_json_dict(AM_SNAPSHOT_JSON)
    records = payload.get("records")
    if not isinstance(records, list):
        payload["records"] = []
    return payload


def load_current_snapshot_state() -> dict[str, object]:
    payload = load_json_dict(CURRENT_SNAPSHOT_STATE_JSON)
    if not payload:
        return {
            "date": None,
            "snapshotType": "daily",
            "active": False,
            "generatedAt": None,
        }
    return payload


def current_sync_latest_date() -> str | None:
    latest = load_json_dict(JQUANTS_SYNC_STATE_JSON).get("lastSuccessfulDate")
    text = str(latest or "").strip()
    return text or None


def load_am_snapshot_lookup(snapshot_date: str) -> dict[str, dict[str, float | int | str]]:
    payload = load_am_snapshot()
    if str(payload.get("date") or "").strip() != snapshot_date:
        return {}
    lookup: dict[str, dict[str, float | int | str]] = {}
    for item in payload.get("records") or []:
        if not isinstance(item, dict):
            continue
        code = str(item.get("code") or "").strip()
        if not code:
            continue
        try:
            lookup[code] = {
                "date": snapshot_date,
                "open": float(item["open"]),
                "high": float(item["high"]),
                "low": float(item["low"]),
                "close": float(item["close"]),
                "volume": int(float(item.get("volume") or 0)),
            }
        except (KeyError, TypeError, ValueError):
            continue
    return lookup


def resolve_current_snapshot_context() -> dict[str, object]:
    state = load_current_snapshot_state()
    snapshot_date = str(state.get("date") or "").strip()
    snapshot_type = str(state.get("snapshotType") or "").strip().lower() or "daily"
    generated_at = state.get("generatedAt")
    active = bool(state.get("active"))
    sync_latest = current_sync_latest_date()

    if not snapshot_date:
        return {"date": None, "type": None, "generatedAt": generated_at, "useAmSnapshot": False}

    if snapshot_type == "am" and active:
        if sync_latest and sync_latest >= snapshot_date:
            return {
                "date": snapshot_date,
                "type": "daily",
                "generatedAt": generated_at,
                "useAmSnapshot": False,
            }
        if load_am_snapshot_lookup(snapshot_date):
            return {
                "date": snapshot_date,
                "type": "am",
                "generatedAt": generated_at,
                "useAmSnapshot": True,
            }
        return {"date": None, "type": None, "generatedAt": generated_at, "useAmSnapshot": False}

    if sync_latest and sync_latest >= snapshot_date:
        return {
            "date": snapshot_date,
            "type": "daily",
            "generatedAt": generated_at,
            "useAmSnapshot": False,
        }

    return {"date": None, "type": None, "generatedAt": generated_at, "useAmSnapshot": False}


def apply_snapshot_row(
    rows: list[dict[str, float | int | str]],
    code: str,
    snapshot_context: dict[str, object] | None = None,
) -> list[dict[str, float | int | str]]:
    context = snapshot_context or resolve_current_snapshot_context()
    if not context.get("useAmSnapshot"):
        return rows
    snapshot_date = str(context.get("date") or "").strip()
    if not snapshot_date:
        return rows
    snapshot_lookup = context.get("lookup")
    if not isinstance(snapshot_lookup, dict):
        snapshot_lookup = load_am_snapshot_lookup(snapshot_date)
    snapshot_row = snapshot_lookup.get(str(code).strip())
    if not snapshot_row:
        return rows
    merged = {str(row["date"]): dict(row) for row in rows}
    merged[snapshot_date] = snapshot_row
    return [merged[key] for key in sorted(merged)]
