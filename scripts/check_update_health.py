#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from datetime import date, datetime, time, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
LOGS_DIR = ROOT / "logs"

REASON_OK = "OK"
REASON_STALE_MANIFEST = "STALE_MANIFEST"
REASON_STALE_UPDATE_STATE = "STALE_UPDATE_STATE"
REASON_LOG_NOT_UPDATED = "LOG_NOT_UPDATED"
REASON_LAUNCH_AGENT_MISSING = "LAUNCH_AGENT_MISSING"
REASON_RECOVERY_ATTEMPTED = "RECOVERY_ATTEMPTED"
REASON_RECOVERY_FAILED = "RECOVERY_FAILED"
REASON_RECOVERY_SUCCEEDED = "RECOVERY_SUCCEEDED"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check update health and write JSON summary")
    parser.add_argument("--context", default="manual")
    parser.add_argument("--json-path", default=str(DATA_DIR / "update_health.json"))
    parser.add_argument("--close-cutoff", default="16:45", help="HH:MM")
    parser.add_argument("--launch-agent-label", default="com.okamoto.kabu_doragon_close_retry")
    parser.add_argument("--watch-log-path", default=str(LOGS_DIR / "jquants_close_retry.out.log"))
    parser.add_argument("--recovery-status", choices=["", "attempted", "failed", "succeeded"], default="")
    parser.add_argument("--recovery-note", default="")
    parser.add_argument("--launch-agent-note", default="")
    return parser.parse_args()


def _load_json(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _parse_iso_datetime(raw: object) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.astimezone()
    return parsed.astimezone()


def _extract_date(raw: object) -> str | None:
    text = str(raw or "").strip()
    if not text:
        return None
    if len(text) >= 10 and text[4:5] == "-" and text[7:8] == "-":
        return text[:10]
    parsed = _parse_iso_datetime(text)
    if parsed is None:
        return None
    return parsed.date().isoformat()


def _is_business_day(value: date) -> bool:
    return value.weekday() < 5


def _previous_business_day(value: date) -> date:
    cursor = value - timedelta(days=1)
    while not _is_business_day(cursor):
        cursor -= timedelta(days=1)
    return cursor


def _parse_cutoff(value: str) -> time:
    try:
        hour_text, minute_text = str(value).strip().split(":", 1)
        return time(hour=int(hour_text), minute=int(minute_text))
    except Exception:
        return time(hour=16, minute=45)


def _log_file_info(path: Path) -> dict[str, object]:
    exists = path.exists()
    mtime = None
    if exists:
        try:
            mtime = datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds")
        except Exception:
            mtime = None
    return {
        "path": str(path),
        "exists": exists,
        "updatedAt": mtime,
        "updatedDate": _extract_date(mtime),
    }


def _launch_agent_registered(label: str) -> tuple[bool, str]:
    try:
        proc = subprocess.run(["launchctl", "list", label], check=False, capture_output=True, text=True)
    except Exception as exc:
        return False, f"launchctl_error: {exc}"
    if proc.returncode == 0:
        return True, ""
    reason = (proc.stderr or proc.stdout or "").strip()
    return False, reason or f"launchctl_exit_{proc.returncode}"


def _append_reason(codes: list[str], code: str) -> None:
    if code and code not in codes:
        codes.append(code)


def main() -> int:
    args = parse_args()
    now = datetime.now().astimezone()

    manifest = _load_json(DATA_DIR / "manifest.json")
    update_state = _load_json(DATA_DIR / "update_state.json")
    sync_state = _load_json(DATA_DIR / "jquants_sync_state.json")
    update_summary = _load_json(DATA_DIR / "update_summary.json")
    quality_gate = _load_json(DATA_DIR / "update_quality_gate.json")

    manifest_latest = str(manifest.get("latestDate") or "").strip() or None
    manifest_generated_at = str(manifest.get("generatedAt") or "").strip() or None
    update_state_last_run_at = str(update_state.get("lastRunAt") or "").strip() or None
    sync_last_successful = str(sync_state.get("lastSuccessfulDate") or "").strip() or None

    launch_registered, launch_reason = _launch_agent_registered(args.launch_agent_label)
    log_info = _log_file_info(Path(args.watch_log_path))

    today = now.date()
    cutoff = _parse_cutoff(args.close_cutoff)
    after_close_cutoff = now.time() >= cutoff
    is_business = _is_business_day(today)

    expected_latest_date = None
    if is_business:
        expected_latest_date = today if after_close_cutoff else _previous_business_day(today)

    reason_codes: list[str] = []

    expected_text = expected_latest_date.isoformat() if expected_latest_date else None
    update_state_last_run_date = _extract_date(update_state_last_run_at)

    if expected_text and manifest_latest != expected_text:
        _append_reason(reason_codes, REASON_STALE_MANIFEST)
    if expected_text and update_state_last_run_date != expected_text:
        _append_reason(reason_codes, REASON_STALE_UPDATE_STATE)
    if expected_text and log_info.get("updatedDate") != expected_text:
        _append_reason(reason_codes, REASON_LOG_NOT_UPDATED)
    if not launch_registered:
        _append_reason(reason_codes, REASON_LAUNCH_AGENT_MISSING)

    if args.recovery_status == "attempted":
        _append_reason(reason_codes, REASON_RECOVERY_ATTEMPTED)
    elif args.recovery_status == "failed":
        _append_reason(reason_codes, REASON_RECOVERY_FAILED)
    elif args.recovery_status == "succeeded":
        _append_reason(reason_codes, REASON_RECOVERY_SUCCEEDED)

    if quality_gate and quality_gate.get("passed") is False:
        _append_reason(reason_codes, REASON_RECOVERY_FAILED)

    abnormal_reasons = {
        REASON_STALE_MANIFEST,
        REASON_STALE_UPDATE_STATE,
        REASON_LOG_NOT_UPDATED,
        REASON_LAUNCH_AGENT_MISSING,
        REASON_RECOVERY_FAILED,
    }
    abnormal = any(code in abnormal_reasons for code in reason_codes)

    if not reason_codes:
        reason_codes = [REASON_OK]

    payload = {
        "checkedAt": now.isoformat(timespec="seconds"),
        "context": args.context,
        "reasonCodes": reason_codes,
        "manifest": {
            "latestDate": manifest_latest,
            "generatedAt": manifest_generated_at,
        },
        "updateState": {
            "lastRunAt": update_state_last_run_at,
            "lastRunDate": update_state_last_run_date,
        },
        "jquantsSyncState": {
            "lastSuccessfulDate": sync_last_successful,
        },
        "log": log_info,
        "launchAgent": {
            "label": args.launch_agent_label,
            "registered": launch_registered,
            "reason": launch_reason or args.launch_agent_note,
            "note": args.launch_agent_note or None,
        },
        "watchdog": {
            "abnormal": abnormal,
            "expectedLatestDate": expected_text,
            "afterCloseCutoff": after_close_cutoff,
            "closeCutoffTime": args.close_cutoff,
            "businessDay": is_business,
            "recoveryStatus": args.recovery_status or None,
            "recoveryNote": args.recovery_note or None,
        },
        "updateSummary": update_summary,
        "qualityGate": quality_gate,
    }

    json_path = Path(args.json_path)
    if not json_path.is_absolute():
        json_path = ROOT / json_path
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = (
        f"HEALTH {','.join(reason_codes)} "
        f"latest={manifest_latest or '-'} expected={expected_text or '-'} "
        f"lastRun={update_state_last_run_date or '-'} "
        f"launch={'ok' if launch_registered else 'missing'} "
        f"log={log_info.get('updatedDate') or '-'}"
    )
    print(summary)
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
