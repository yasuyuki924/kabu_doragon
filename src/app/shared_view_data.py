from __future__ import annotations

import json

from src.common.utils import select_dates
from src.data_source.inactive_codes import summarize_inactive_codes
from src.data_source.local_data import (
    build_daily_record,
    discover_available_dates,
    load_daily_records,
    load_update_state,
    load_watchlist,
)
from src.common.paths import TICKERS_DIR


STALE_TOLERANCE_BUSINESS_DAYS = 1


def _build_trading_date_index(selected_dates: list[str]) -> tuple[list[str], dict[str, int]]:
    known_dates = set(discover_available_dates(36))
    known_dates.update(str(item).strip() for item in selected_dates if str(item).strip())
    ordered = sorted(known_dates)
    return ordered, {date_value: index for index, date_value in enumerate(ordered)}


def _safe_load_ticker_payload(code: str) -> tuple[dict[str, object] | None, list[str]]:
    path = TICKERS_DIR / f"{code}.json"
    if not path.exists():
        return None, ["FETCH_FAIL"]
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None, ["PARSE_FAIL"]
    if not isinstance(payload, dict):
        return None, ["PARSE_FAIL"]
    return payload, []


def _select_row_for_date(rows: list[dict[str, object]], selected_date: str) -> dict[str, object] | None:
    if not rows:
        return None
    fallback: dict[str, object] | None = None
    for row in rows:
        date_value = str(row.get("date") or "")
        if date_value <= selected_date:
            fallback = row
        else:
            break
    return fallback or rows[-1]


def _compute_stale_business_days(
    selected_date: str,
    last_data_date: str,
    index_by_date: dict[str, int],
) -> int | None:
    if not selected_date or not last_data_date:
        return None
    if last_data_date >= selected_date:
        return 0
    selected_index = index_by_date.get(selected_date)
    last_index = index_by_date.get(last_data_date)
    if selected_index is not None and last_index is not None and last_index <= selected_index:
        return selected_index - last_index
    return None


def _build_data_quality(
    *,
    selected_date: str,
    last_data_date: str,
    base_reasons: list[str],
    index_by_date: dict[str, int],
) -> dict[str, object]:
    reason_codes = list(base_reasons)
    stale_days = _compute_stale_business_days(selected_date, last_data_date, index_by_date)
    if last_data_date and selected_date and last_data_date < selected_date:
        if "STALE_ND" not in reason_codes:
            reason_codes.append("STALE_ND")
    return {
        "lastDataDate": last_data_date or None,
        "reasonCodes": reason_codes,
        "staleBusinessDays": stale_days,
    }


def _filter_cached_records(records: list[dict[str, object]], target_codes: set[str]) -> list[dict[str, object]]:
    return [
        item
        for item in records
        if isinstance(item, dict) and str(item.get("code") or "").strip() in target_codes
    ]


def resolve_selected_dates(
    days: int,
    end_date: str | None = None,
    from_date: str | None = None,
    explicit_dates: list[str] | None = None,
) -> tuple[list[str], list[str]]:
    all_dates = discover_available_dates()
    selected_dates = [date_value for date_value in (explicit_dates or []) if date_value in set(all_dates)]
    if not selected_dates:
        if from_date:
            selected_dates = [date_value for date_value in all_dates if date_value >= from_date]
            if end_date:
                selected_dates = [date_value for date_value in selected_dates if date_value <= end_date]
        else:
            selected_dates = select_dates(all_dates, days, end_date)
    return all_dates, selected_dates


def resolve_explicit_dates(raw_dates: str | None) -> list[str] | None:
    if raw_dates == "__UPDATE_STATE__":
        return [str(item) for item in load_update_state().get("updatedDates") or []]
    if not raw_dates:
        return None
    return [item.strip() for item in raw_dates.split(",") if item.strip()]


def load_records_by_date(selected_dates: list[str], codes: list[str] | None = None) -> dict[str, list[dict[str, object]]]:
    per_date: dict[str, list[dict[str, object]]] = {}
    watchlist = load_watchlist()
    if codes:
        code_filter = {str(code).strip() for code in codes if str(code).strip()}
        watchlist = [item for item in watchlist if str(item.get("ticker") or "").strip() in code_filter]
    target_codes = [str(item.get("ticker") or "").strip() for item in watchlist if str(item.get("ticker") or "").strip()]
    target_code_set = set(target_codes)
    watchlist_meta = {
        str(item.get("ticker") or "").strip(): {
            "code": str(item.get("ticker") or "").strip(),
            "name": str(item.get("name") or ""),
            "market": str(item.get("market") or ""),
            "sector": str(item.get("sector") or ""),
            "industry": str(item.get("industry") or ""),
            "themes": item.get("themes", []),
            "tags": item.get("tags", []),
            "links": item.get("links", {}),
        }
        for item in watchlist
    }
    _, index_by_date = _build_trading_date_index(selected_dates)

    payload_cache: dict[str, tuple[dict[str, object] | None, list[str]]] = {}

    def get_payload_info(code: str) -> tuple[dict[str, object] | None, list[str]]:
        if code not in payload_cache:
            payload_cache[code] = _safe_load_ticker_payload(code)
        return payload_cache[code]

    for date_value in selected_dates:
        cached = load_daily_records(date_value, codes) or []
        cached = _filter_cached_records(cached, target_code_set)
        merged: dict[str, dict[str, object]] = {}

        for record in cached:
            code = str(record.get("code") or "").strip()
            if not code:
                continue
            last_data_date = str(record.get("date") or "").strip()
            quality = _build_data_quality(
                selected_date=date_value,
                last_data_date=last_data_date,
                base_reasons=[],
                index_by_date=index_by_date,
            )
            merged[code] = {**record, "dataQuality": quality}

        missing_codes = [code for code in target_codes if code and code not in merged]
        for code in missing_codes:
            payload, payload_reasons = get_payload_info(code)
            meta = watchlist_meta.get(
                code,
                {
                    "code": code,
                    "name": "",
                    "market": "",
                    "sector": "",
                    "industry": "",
                    "themes": [],
                    "tags": [],
                    "links": {},
                },
            )
            rows = payload.get("ohlcv", []) if isinstance(payload, dict) else []
            rows = rows if isinstance(rows, list) else []
            normalized_rows = [item for item in rows if isinstance(item, dict)]
            if not normalized_rows:
                quality = _build_data_quality(
                    selected_date=date_value,
                    last_data_date="",
                    base_reasons=payload_reasons or ["NO_OHLCV"],
                    index_by_date=index_by_date,
                )
                merged[code] = {
                    **meta,
                    "date": date_value,
                    "open": None,
                    "high": None,
                    "low": None,
                    "close": None,
                    "volume": None,
                    "dataQuality": quality,
                }
                continue

            chosen_row = _select_row_for_date(normalized_rows, date_value)
            last_data_date = str(normalized_rows[-1].get("date") or "").strip()
            if chosen_row is None:
                quality = _build_data_quality(
                    selected_date=date_value,
                    last_data_date=last_data_date,
                    base_reasons=["NO_OHLCV"],
                    index_by_date=index_by_date,
                )
                merged[code] = {
                    **meta,
                    "date": date_value,
                    "open": None,
                    "high": None,
                    "low": None,
                    "close": None,
                    "volume": None,
                    "dataQuality": quality,
                }
                continue

            built = build_daily_record(meta, chosen_row)
            quality = _build_data_quality(
                selected_date=date_value,
                last_data_date=last_data_date or str(chosen_row.get("date") or "").strip(),
                base_reasons=[],
                index_by_date=index_by_date,
            )
            merged[code] = {**built, "dataQuality": quality}

        per_date[date_value] = sorted(merged.values(), key=lambda item: str(item.get("code") or ""))

    return per_date


def load_inactive_summary(selected_date: str) -> dict[str, object]:
    return summarize_inactive_codes(selected_date)
