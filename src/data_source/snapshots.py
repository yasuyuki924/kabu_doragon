from __future__ import annotations

from src.common.io import load_json_dict
from src.common.paths import (
    AM_SNAPSHOT_JSON,
    CURRENT_SNAPSHOT_STATE_JSON,
    JQUANTS_SYNC_STATE_JSON,
    YF_SNAPSHOT_JSON,
)


def load_am_snapshot() -> dict[str, object]:
    payload = load_json_dict(AM_SNAPSHOT_JSON)
    records = payload.get("records")
    if not isinstance(records, list):
        payload["records"] = []
    return payload


def load_yf_snapshot() -> dict[str, object]:
    payload = load_json_dict(YF_SNAPSHOT_JSON)
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
            "status": None,
            "staleAfterClose": False,
            "finalRetryAt": None,
            "generatedAt": None,
        }
    return payload


def current_sync_latest_date() -> str | None:
    latest = load_json_dict(JQUANTS_SYNC_STATE_JSON).get("lastSuccessfulDate")
    text = str(latest or "").strip()
    return text or None


def _load_snapshot_lookup(payload: dict[str, object], snapshot_date: str) -> dict[str, dict[str, float | int | str]]:
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


def load_am_snapshot_lookup(snapshot_date: str) -> dict[str, dict[str, float | int | str]]:
    return _load_snapshot_lookup(load_am_snapshot(), snapshot_date)


def load_yf_snapshot_lookup(snapshot_date: str) -> dict[str, dict[str, float | int | str]]:
    return _load_snapshot_lookup(load_yf_snapshot(), snapshot_date)


def load_snapshot_lookup(snapshot_type: str, snapshot_date: str) -> dict[str, dict[str, float | int | str]]:
    if snapshot_type == "am":
        return load_am_snapshot_lookup(snapshot_date)
    if snapshot_type == "yf_intraday":
        return load_yf_snapshot_lookup(snapshot_date)
    return {}


def resolve_current_snapshot_context() -> dict[str, object]:
    state = load_current_snapshot_state()
    snapshot_date = str(state.get("date") or "").strip()
    snapshot_type = str(state.get("snapshotType") or "").strip().lower() or "daily"
    snapshot_status = str(state.get("status") or "").strip().lower()
    generated_at = state.get("generatedAt")
    active = bool(state.get("active"))

    empty_context = {
        "date": None,
        "type": None,
        "status": snapshot_status or None,
        "generatedAt": generated_at,
        "staleAfterClose": bool(state.get("staleAfterClose")),
        "finalRetryAt": state.get("finalRetryAt"),
        "useSnapshot": False,
        "useAmSnapshot": False,
    }

    if not snapshot_date:
        return empty_context

    if snapshot_type == "daily":
        return {
            **empty_context,
            "date": snapshot_date,
            "type": "daily",
            "status": snapshot_status or "finalized",
        }

    if snapshot_type == "am" and active:
        if load_am_snapshot_lookup(snapshot_date):
            return {
                **empty_context,
                "date": snapshot_date,
                "type": "am",
                "status": snapshot_status or "intraday",
                "useSnapshot": True,
                "useAmSnapshot": True,
            }
        return empty_context

    if snapshot_type == "yf_intraday" and active:
        if load_yf_snapshot_lookup(snapshot_date):
            return {
                **empty_context,
                "date": snapshot_date,
                "type": "stale_after_close" if snapshot_status == "stale" else "yf_intraday",
                "status": snapshot_status or "intraday",
                "useSnapshot": True,
                "useAmSnapshot": False,
            }
        return empty_context

    return empty_context


def apply_snapshot_row(
    rows: list[dict[str, float | int | str]],
    code: str,
    snapshot_context: dict[str, object] | None = None,
) -> list[dict[str, float | int | str]]:
    context = snapshot_context or resolve_current_snapshot_context()
    if not context.get("useSnapshot"):
        return rows
    snapshot_date = str(context.get("date") or "").strip()
    if not snapshot_date:
        return rows
    snapshot_lookup = context.get("lookup")
    if not isinstance(snapshot_lookup, dict):
        snapshot_lookup = load_snapshot_lookup(str(context.get("type") or "").strip(), snapshot_date)
    snapshot_row = snapshot_lookup.get(str(code).strip())
    if not snapshot_row:
        return rows
    merged = {str(row["date"]): dict(row) for row in rows}
    merged[snapshot_date] = snapshot_row
    return [merged[key] for key in sorted(merged)]

