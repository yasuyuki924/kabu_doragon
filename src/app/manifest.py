from __future__ import annotations

from datetime import datetime

from src.data_source.snapshots import resolve_current_snapshot_context


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
            "trend_turn",
            "rebound_signal",
            "strategy_minervini",
            "strategy_stage2",
            "strategy_turtle",
            "strategy_canslim",
            "strategy_rsi2",
        ],
    }
    snapshot_context = resolve_current_snapshot_context()
    if snapshot_context.get("date") and snapshot_context.get("type") and snapshot_context.get("date") == payload["latestDate"]:
        payload["currentSnapshot"] = {
            "date": snapshot_context["date"],
            "type": snapshot_context["type"],
            "status": snapshot_context.get("status"),
            "staleAfterClose": bool(snapshot_context.get("staleAfterClose")),
            "finalRetryAt": snapshot_context.get("finalRetryAt"),
            "generatedAt": snapshot_context.get("generatedAt"),
        }
    return payload
