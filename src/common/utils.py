from __future__ import annotations

import calendar
from datetime import datetime


def parse_codes(value: str | None) -> list[str] | None:
    if not value:
        return None
    codes = [item.strip() for item in value.split(",") if item.strip()]
    return codes or None


def today_jst() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def shift_calendar_months(date_str: str, months: int) -> str:
    base_date = datetime.strptime(str(date_str), "%Y-%m-%d").date()
    month_index = (base_date.month - 1) + months
    year = base_date.year + (month_index // 12)
    month = (month_index % 12) + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(base_date.day, last_day)
    return base_date.replace(year=year, month=month, day=day).isoformat()


def filter_dates_to_recent_window(
    all_dates: list[str],
    latest_date: str | None = None,
    months: int = 3,
) -> list[str]:
    if not all_dates:
        return []
    resolved_latest_date = str(latest_date or all_dates[-1]).strip()
    if not resolved_latest_date:
        return []
    start_date = shift_calendar_months(resolved_latest_date, -max(0, months))
    return [date_value for date_value in all_dates if start_date <= date_value <= resolved_latest_date]


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

