#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from common import MANIFEST_JSON, OVERVIEW_DIR, RETRY_PENDING_JSON, ROOT, WATCHLIST_JSON, load_json_dict, write_json
from src.data_source.inactive_codes import load_inactive_lookup


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Retry missing/stale symbols in batches and rebuild shared views.")
    parser.add_argument("--provider", choices=["jquants", "yfinance"], default="yfinance")
    parser.add_argument("--selected-date", help="Target date. Defaults to manifest.latestDate.")
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--backoff-seconds", default="30,90,180")
    parser.add_argument("--no-sleep", action="store_true", help="Skip sleeping between retries.")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def load_watchlist_codes() -> list[str]:
    path = Path(WATCHLIST_JSON)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    return [str(item.get("ticker") or "").strip() for item in payload if isinstance(item, dict) and str(item.get("ticker") or "").strip()]


def classify_retry_targets(selected_date: str) -> dict[str, str]:
    inactive_lookup = load_inactive_lookup()
    target_map: dict[str, str] = {}
    overview = load_json_dict(OVERVIEW_DIR / selected_date / "market_pulse.json")
    records = overview.get("records")
    records = [item for item in records if isinstance(item, dict)] if isinstance(records, list) else []
    record_by_code = {str(item.get("code") or "").strip(): item for item in records if str(item.get("code") or "").strip()}
    priority = {
        "FETCH_FAIL": 0,
        "PARSE_FAIL": 1,
        "NO_OHLCV": 2,
        "STALE_ND": 3,
    }

    def set_reason(code: str, reason: str) -> None:
        if not code:
            return
        current = target_map.get(code)
        if current is None or priority.get(reason, 99) < priority.get(current, 99):
            target_map[code] = reason

    for code, record in record_by_code.items():
        if code in inactive_lookup:
            continue
        quality = record.get("dataQuality")
        quality = quality if isinstance(quality, dict) else {}
        reasons = quality.get("reasonCodes")
        reason_codes = [str(item) for item in reasons] if isinstance(reasons, list) else []
        for reason in reason_codes:
            if reason in {"FETCH_FAIL", "PARSE_FAIL", "STALE_ND"}:
                set_reason(code, reason)
        record_date = str(record.get("date") or "").strip()
        if record_date and record_date < selected_date:
            set_reason(code, "STALE_ND")

    for code in load_watchlist_codes():
        if code in inactive_lookup:
            continue
        if code not in record_by_code:
            set_reason(code, "FETCH_FAIL")
    return target_map


def load_retry_pending() -> dict[str, dict[str, object]]:
    payload = load_json_dict(RETRY_PENDING_JSON)
    items = payload.get("items")
    if not isinstance(items, list):
        return {}
    result: dict[str, dict[str, object]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        code = str(item.get("code") or "").strip()
        if not code:
            continue
        result[code] = item
    return result


def save_retry_pending(items: dict[str, dict[str, object]], selected_date: str) -> None:
    write_json(
        RETRY_PENDING_JSON,
        {
            "generatedAt": now_iso(),
            "selectedDate": selected_date,
            "items": sorted(items.values(), key=lambda item: (int(item.get("priority") or 99), str(item.get("code") or ""))),
        },
    )


def run_command(cmd: list[str]) -> int:
    print("$", " ".join(cmd))
    return subprocess.run(cmd, cwd=ROOT, check=False).returncode


def refresh_shared_views() -> int:
    cmd = [sys.executable, "scripts/run_daily.py", "--skip-fetch"]
    return run_command(cmd)


def call_fetch(provider: str, codes: list[str]) -> int:
    cmd = [
        sys.executable,
        "scripts/fetch_prices.py",
        "--provider",
        provider,
        "--universe",
        "tse",
        "--segments",
        "prime,standard,growth",
        "--codes",
        ",".join(codes),
    ]
    return run_command(cmd)


def main() -> int:
    args = parse_args()
    manifest = load_json_dict(MANIFEST_JSON)
    selected_date = str(args.selected_date or manifest.get("latestDate") or "").strip()
    if not selected_date:
        print("skip: manifest.latestDate is empty")
        return 0

    pending = load_retry_pending()
    inactive_lookup = load_inactive_lookup()
    pending = {code: item for code, item in pending.items() if code not in inactive_lookup}
    pending_codes = sorted(pending.keys())
    initial_targets = classify_retry_targets(selected_date)
    for code in pending_codes:
        if code not in initial_targets:
            reason = str(pending[code].get("reason") or "FETCH_FAIL")
            initial_targets[code] = reason

    if not initial_targets:
        save_retry_pending({}, selected_date)
        subprocess.run([sys.executable, "scripts/generate_update_summary.py", "--date", selected_date], cwd=ROOT, check=False)
        print("retry: no targets")
        return 0

    backoff = [int(item.strip()) for item in args.backoff_seconds.split(",") if item.strip()]
    while len(backoff) < args.max_attempts:
        backoff.append(backoff[-1] if backoff else 180)

    attempt = 0
    improved_total = 0
    current_targets = dict(initial_targets)
    attempted_codes: set[str] = set()
    for attempt_index in range(args.max_attempts):
        if not current_targets:
            break
        attempt = attempt_index + 1
        codes = sorted(current_targets.keys())
        attempted_codes.update(codes)
        batches = chunked(codes, max(1, args.batch_size))
        for batch in batches:
            status = call_fetch(args.provider, batch)
            if status != 0:
                for code in batch:
                    current_targets[code] = "FETCH_FAIL"
        refresh_shared_views()
        refreshed_targets = classify_retry_targets(selected_date)
        before = len(current_targets)
        current_targets = refreshed_targets
        improved_total += max(0, before - len(current_targets))
        if current_targets and attempt_index < args.max_attempts - 1 and not args.no_sleep:
            wait_seconds = backoff[attempt_index]
            print(f"retry: sleeping {wait_seconds}s before next attempt")
            time.sleep(wait_seconds)

    priority_map = {"FETCH_FAIL": 0, "PARSE_FAIL": 1, "NO_OHLCV": 2, "STALE_ND": 3}
    new_pending: dict[str, dict[str, object]] = {}
    for code, reason in current_targets.items():
        previous_attempts = int((pending.get(code) or {}).get("attempts") or 0)
        new_pending[code] = {
            "code": code,
            "reason": reason,
            "lastAttemptAt": now_iso(),
            "attempts": previous_attempts + max(1, attempt),
            "priority": priority_map.get(reason, 99),
        }
    save_retry_pending(new_pending, selected_date)

    subprocess.run(
        [
            sys.executable,
            "scripts/generate_update_summary.py",
            "--date",
            selected_date,
            "--retry-attempts",
            str(attempt),
            "--retry-improved",
            str(improved_total),
            "--retry-remaining",
            str(len(new_pending)),
        ],
        cwd=ROOT,
        check=False,
    )
    print(
        json.dumps(
            {
                "selectedDate": selected_date,
                "attempts": attempt,
                "targetCount": len(initial_targets),
                "remainingCount": len(new_pending),
                "improvedCount": improved_total,
                "attemptedCodes": len(attempted_codes),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
