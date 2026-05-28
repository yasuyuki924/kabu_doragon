from __future__ import annotations

import csv
import json

from src.common.io import load_json_dict, write_json
from src.common.paths import (
    DAILY_RECORDS_DIR,
    OHLCV_ADJUSTED_DIR,
    OHLCV_DIR,
    TICKERS_DIR,
    THEME_MAP_JSON,
    UPDATE_STATE_JSON,
    WATCHLIST_JSON,
)
from src.common.utils import filter_dates_to_recent_window, today_jst


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


def load_update_state() -> dict[str, object]:
    payload = load_json_dict(UPDATE_STATE_JSON)
    updated_dates = payload.get("updatedDates")
    updated_codes = payload.get("updatedCodes")
    adjusted_codes = payload.get("adjustedCodes")
    adjusted_date_from = str(payload.get("adjustedDateFrom") or "").strip()
    payload["updatedDates"] = [str(item).strip() for item in updated_dates] if isinstance(updated_dates, list) else []
    payload["updatedCodes"] = [str(item).strip() for item in updated_codes] if isinstance(updated_codes, list) else []
    payload["adjustedCodes"] = [str(item).strip() for item in adjusted_codes] if isinstance(adjusted_codes, list) else []
    payload["adjustedDateFrom"] = adjusted_date_from or None
    return payload


def load_ohlcv_rows(code: str) -> list[dict[str, float | int | str]]:
    path = OHLCV_DIR / f"{code}.csv"
    return load_ohlcv_rows_from_path(path)


def load_ohlcv_rows_prefer_adjusted(code: str) -> list[dict[str, float | int | str]]:
    adjusted_path = OHLCV_ADJUSTED_DIR / f"{code}.csv"
    if adjusted_path.exists():
        return load_ohlcv_rows_from_path(adjusted_path)
    return load_ohlcv_rows(code)


def load_ohlcv_rows_from_path(path) -> list[dict[str, float | int | str]]:
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
        "ma50": row.get("ma50"),
        "ma75": row.get("ma75"),
        "ma140": row.get("ma140"),
        "ma150": row.get("ma150"),
        "ma160": row.get("ma160"),
        "ma200": row.get("ma200"),
        "ma140SlopePct": row.get("ma140SlopePct"),
        "ma150SlopePct": row.get("ma150SlopePct"),
        "ma160SlopePct": row.get("ma160SlopePct"),
        "ma200SlopePct": row.get("ma200SlopePct"),
        "volumeMa5": row.get("volumeMa5"),
        "volumeMa20": row.get("volumeMa20"),
        "volumeMa25": row.get("volumeMa25"),
        "turnoverMa5": row.get("turnoverMa5"),
        "distanceToMa25": row.get("distanceToMa25"),
        "distanceToMa50": row.get("distanceToMa50"),
        "distanceToMa75": row.get("distanceToMa75"),
        "distanceToMa140": row.get("distanceToMa140"),
        "distanceToMa150": row.get("distanceToMa150"),
        "distanceToMa160": row.get("distanceToMa160"),
        "distanceToMa200": row.get("distanceToMa200"),
        "volumeRatio25": row.get("volumeRatio25"),
        "rci12": row.get("rci12"),
        "rci24": row.get("rci24"),
        "rci48": row.get("rci48"),
        "rsi2": row.get("rsi2"),
        "consecutiveDownDays": row.get("consecutiveDownDays"),
        "rangePosition52w": row.get("rangePosition52w"),
        "high52w": row.get("high52w"),
        "low52w": row.get("low52w"),
        "distanceTo52wHighPct": row.get("distanceTo52wHighPct"),
        "near52wHighRatio": row.get("near52wHighRatio"),
        "recoveryFrom52wLowPct": row.get("recoveryFrom52wLowPct"),
        "newHigh52w": row.get("newHigh52w"),
        "newHigh20d": row.get("newHigh20d"),
        "bullishCloseBreakout20d": row.get("bullishCloseBreakout20d"),
        "donchian20High": row.get("donchian20High"),
        "donchian55High": row.get("donchian55High"),
        "distanceToDonchian20Pct": row.get("distanceToDonchian20Pct"),
        "distanceToDonchian55Pct": row.get("distanceToDonchian55Pct"),
        "base10to20": row.get("base10to20"),
        "base10to30": row.get("base10to30"),
        "base20to60": row.get("base20to60"),
        "distanceToBaseHighPct": row.get("distanceToBaseHighPct"),
        "distanceToMidBaseHighPct": row.get("distanceToMidBaseHighPct"),
        "distanceToPrevHighPct": row.get("distanceToPrevHighPct"),
        "volatility20Pct": row.get("volatility20Pct"),
        "unstableBelowMa200Days": row.get("unstableBelowMa200Days"),
        "upperWick3dAvg": row.get("upperWick3dAvg"),
        "newHigh20dCount10": row.get("newHigh20dCount10"),
        "signalCategory": row.get("signalCategory"),
        "lowerWickFlag": row.get("lowerWickFlag"),
        "strongHammerFlag": row.get("strongHammerFlag"),
        "prevBearFlag": row.get("prevBearFlag"),
        "belowMa5Flag": row.get("belowMa5Flag"),
        "trendTurnCandidate": row.get("trendTurnCandidate"),
        "trendTurnBreakoutDate": row.get("trendTurnBreakoutDate"),
        "trendTurnDaysAfterBreakout": row.get("trendTurnDaysAfterBreakout"),
        "trendTurnRangePct": row.get("trendTurnRangePct"),
        "trendTurnAboveMa75Ratio": row.get("trendTurnAboveMa75Ratio"),
        "trendTurnScore": row.get("trendTurnScore"),
        "trendTurnReason": row.get("trendTurnReason"),
        "highPullback30": row.get("highPullback30"),
        "highPullback30Candidate": row.get("highPullback30Candidate"),
        "highPullback30DropRate": row.get("highPullback30DropRate"),
        "highPullback30HighDate": row.get("highPullback30HighDate"),
        "highPullback30LowDate": row.get("highPullback30LowDate"),
        "highPullback30BarsToLow": row.get("highPullback30BarsToLow"),
        "strongTrendPullbackRebound": row.get("strongTrendPullbackRebound"),
        "strongTrendPullbackReboundCandidate": row.get("strongTrendPullbackReboundCandidate"),
        "strongTrendPullbackReboundScore": row.get("strongTrendPullbackReboundScore"),
        "strongTrendPullbackReboundType": row.get("strongTrendPullbackReboundType"),
        "strongTrendPullbackReboundLabel": row.get("strongTrendPullbackReboundLabel"),
        "strongTrendPullbackReboundRisePct": row.get("strongTrendPullbackReboundRisePct"),
        "strongTrendPullbackReboundDropPct": row.get("strongTrendPullbackReboundDropPct"),
        "strongTrendPullbackReboundVolumeRatio20": row.get("strongTrendPullbackReboundVolumeRatio20"),
        "strategyMatches": row.get("strategyMatches", []),
        "strategyScores": row.get("strategyScores", {}),
        "strategyReasons": row.get("strategyReasons", {}),
        "strategyExcludedReasons": row.get("strategyExcludedReasons", {}),
        "strategyMetrics": row.get("strategyMetrics", {}),
        "minerviniTrendTemplateCandidate": row.get("minervini_trend_templateCandidate"),
        "stanWeinsteinStage2Candidate": row.get("stan_weinstein_stage2Candidate"),
        "turtleDonchianBreakoutCandidate": row.get("turtle_donchian_breakoutCandidate"),
        "canSlimCandidate": row.get("can_slimCandidate"),
        "rsi2PullbackCandidate": row.get("rsi2_pullbackCandidate"),
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


def discover_available_dates(months: int = 3) -> list[str]:
    from src.data_source.snapshots import resolve_current_snapshot_context

    available_dates: list[str] = []
    for path in sorted(OHLCV_DIR.glob("*.csv")):
        rows = load_ohlcv_rows(path.stem)
        if not rows:
            continue
        available_dates = [str(row["date"]) for row in rows]
        break
    latest_date = available_dates[-1] if available_dates else None
    available_dates = filter_dates_to_recent_window(available_dates, latest_date=latest_date, months=months)

    snapshot_context = resolve_current_snapshot_context()
    snapshot_date = str(snapshot_context.get("date") or "").strip()
    if snapshot_context.get("useSnapshot") and snapshot_date and snapshot_date not in available_dates:
        available_dates.append(snapshot_date)
    return available_dates
