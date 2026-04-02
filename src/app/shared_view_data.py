from __future__ import annotations

from src.common.utils import select_dates
from src.data_source.local_data import (
    discover_available_dates,
    iter_ticker_payloads,
    load_daily_records,
    load_update_state,
)


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
    selected_date_set = set(selected_dates)
    per_date: dict[str, list[dict[str, object]]] = {date_value: [] for date_value in selected_dates}
    missing_dates: list[str] = []
    for date_value in selected_dates:
        cached = load_daily_records(date_value, codes)
        if cached is None:
            missing_dates.append(date_value)
            continue
        per_date[date_value] = cached

    if not missing_dates:
        return per_date

    payloads = iter_ticker_payloads(codes)
    missing_date_set = set(missing_dates)
    for payload in payloads:
        meta = {
            "code": payload["code"],
            "name": payload["name"],
            "market": payload["market"],
            "sector": payload.get("sector", ""),
            "industry": payload.get("industry", ""),
            "themes": payload.get("themes", []),
            "tags": payload.get("tags", []),
            "links": payload.get("links", {}),
        }
        for row in payload.get("ohlcv", []):
            date_value = str(row["date"])
            if date_value not in missing_date_set or date_value not in selected_date_set:
                continue
            per_date[date_value].append({**meta, **row})
    return per_date

