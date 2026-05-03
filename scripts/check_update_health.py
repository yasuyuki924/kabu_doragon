#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from dataclasses import dataclass
from datetime import date, datetime, time as dt_time, timedelta, timezone
from pathlib import Path
from typing import Any

JST = timezone.utc
try:
    from zoneinfo import ZoneInfo

    JST = ZoneInfo("Asia/Tokyo")
except Exception:
    JST = timezone.utc

LAUNCH_AGENT_LABEL = "com.okamoto.kabu_doragon_close_retry"
DEFAULT_AGENT_PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LAUNCH_AGENT_LABEL}.plist"


try:
    import jpholiday  # type: ignore
except Exception:  # pragma: no cover
    jpholiday = None


@dataclass
class LaunchAgentStatus:
    registered: bool
    check_command_ok: bool
    check_error: str
    bootstrap_attempted: bool
    bootstrap_succeeded: bool
    bootstrap_exit_code: int | None
    bootstrap_message: str
    plist_path: str


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def load_list(path: Path) -> list[Any]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, list) else []
    except Exception:
        return []


def read_tail_text(path: Path, max_bytes: int = 8192) -> str:
    if not path.exists():
        return ""
    try:
        with path.open("rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            fh.seek(max(size - max_bytes, 0))
            return fh.read().decode("utf-8", errors="replace")
    except Exception:
        return ""


def detect_jquants_auth_error(log_text: str) -> str:
    text = str(log_text or "").strip().lower()
    if not text:
        return ""
    if "the incoming api key is invalid or expired" in text:
        return "INVALID_OR_EXPIRED_API_KEY"
    if "403" in text and "api key" in text:
        return "API_KEY_403"
    return ""


def auth_error_is_current(
    auth_error_code: str,
    err_log_mtime: datetime | None,
    update_last_run_at: str,
) -> bool:
    if not auth_error_code or err_log_mtime is None:
        return False
    last_run_dt = parse_datetime(update_last_run_at)
    if last_run_dt is None:
        return True
    return err_log_mtime >= last_run_dt


def parse_datetime(value: str) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    candidates = [text]
    if text.endswith("Z"):
        candidates.append(text[:-1] + "+00:00")
    for candidate in candidates:
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=JST)
            return dt.astimezone(JST)
        except ValueError:
            continue
    formats = ["%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=JST)
        except ValueError:
            continue
    return None


def as_iso(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.astimezone(JST).isoformat(timespec="seconds")


def to_date_iso(value: str) -> str:
    dt = parse_datetime(value)
    if dt:
        return dt.date().isoformat()
    text = str(value or "").strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return ""


def is_business_day(today: date) -> bool:
    if today.weekday() >= 5:
        return False
    if jpholiday is None:
        return True
    try:
        return not bool(jpholiday.is_holiday(today))
    except Exception:
        return True


def previous_business_day(base: date) -> date:
    cursor = base - timedelta(days=1)
    while not is_business_day(cursor):
        cursor -= timedelta(days=1)
    return cursor


def check_launch_agent_registered(label: str) -> tuple[bool, bool, str]:
    try:
        proc = subprocess.run(["launchctl", "list"], check=False, capture_output=True, text=True)
    except Exception as exc:
        return False, False, f"launchctl list failed: {exc}"
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        return False, False, f"launchctl list exit={proc.returncode}: {err}"
    registered = False
    for line in proc.stdout.splitlines():
        if line.rstrip().endswith(label):
            registered = True
            break
    return registered, True, ""


def try_bootstrap_launch_agent(plist: Path) -> tuple[bool, int | None, str]:
    if not plist.exists():
        return False, None, f"plist not found: {plist}"
    domain = f"gui/{os.getuid()}"
    try:
        proc = subprocess.run(
            ["launchctl", "bootstrap", domain, str(plist)],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception as exc:
        return False, None, f"bootstrap failed: {exc}"
    if proc.returncode == 0:
        return True, 0, ""
    err = (proc.stderr or proc.stdout or "").strip()
    return False, proc.returncode, err


def collect(args: argparse.Namespace) -> dict[str, Any]:
    root = Path(__file__).resolve().parent.parent
    data_dir = root / "data"
    logs_dir = root / "logs"

    now = datetime.now(JST)
    today = now.date()
    today_iso = today.isoformat()
    weekday = today.isoweekday()
    business_day = is_business_day(today)

    manifest = load_json(data_dir / "manifest.json")
    update_state = load_json(data_dir / "update_state.json")
    sync_state = load_json(data_dir / "jquants_sync_state.json")
    update_summary = load_json(data_dir / "update_summary.json")
    quality_gate = load_json(data_dir / "update_quality_gate.json")
    watchlist = load_list(data_dir / "watchlist.json")

    manifest_latest = str(manifest.get("latestDate") or "").strip()
    manifest_generated_at = str(manifest.get("generatedAt") or "").strip()
    update_last_run_at = str(update_state.get("lastRunAt") or "").strip()
    sync_last_successful_date = str(sync_state.get("lastSuccessfulDate") or "").strip()
    inactive_count = int(update_summary.get("inactiveCount") or 0) if isinstance(update_summary, dict) else 0
    active_count = len([item for item in watchlist if isinstance(item, dict)])

    jquants_log = logs_dir / "jquants_close_retry.out.log"
    jquants_err_log = logs_dir / "jquants_close_retry.err.log"
    log_exists = jquants_log.exists()
    log_mtime = datetime.fromtimestamp(jquants_log.stat().st_mtime, JST) if log_exists else None
    log_updated_date = log_mtime.date().isoformat() if log_mtime else ""
    err_log_exists = jquants_err_log.exists()
    err_log_mtime = datetime.fromtimestamp(jquants_err_log.stat().st_mtime, JST) if err_log_exists else None
    auth_error_code = detect_jquants_auth_error(read_tail_text(jquants_err_log))
    auth_error_active = auth_error_is_current(auth_error_code, err_log_mtime, update_last_run_at)

    close_cutoff = dt_time(hour=args.cutoff_hour, minute=args.cutoff_minute)
    after_close_cutoff = now.timetz().replace(tzinfo=None) >= close_cutoff
    expected_latest_date = today_iso if (business_day and after_close_cutoff) else (
        previous_business_day(today).isoformat() if business_day else ""
    )

    launch_registered, launch_check_ok, launch_check_error = check_launch_agent_registered(LAUNCH_AGENT_LABEL)

    bootstrap_attempted = False
    bootstrap_succeeded = False
    bootstrap_exit_code: int | None = None
    bootstrap_message = ""
    launch_plist = Path(args.launch_agent_plist).expanduser().resolve() if args.launch_agent_plist else DEFAULT_AGENT_PLIST

    if args.attempt_repair_launch_agent and not launch_registered:
        bootstrap_attempted = True
        bootstrap_succeeded, bootstrap_exit_code, bootstrap_message = try_bootstrap_launch_agent(launch_plist)
        if bootstrap_succeeded:
            launch_registered, launch_check_ok, launch_check_error = check_launch_agent_registered(LAUNCH_AGENT_LABEL)

    reason_codes: list[str] = []
    if business_day:
        if expected_latest_date and manifest_latest < expected_latest_date:
            reason_codes.append("STALE_MANIFEST")
        if expected_latest_date and to_date_iso(update_last_run_at) < expected_latest_date:
            reason_codes.append("STALE_UPDATE_STATE")
        if expected_latest_date and log_updated_date < expected_latest_date:
            reason_codes.append("LOG_NOT_UPDATED")
        if not launch_registered:
            reason_codes.append("LAUNCH_AGENT_MISSING")
        if auth_error_active:
            reason_codes.append("AUTH_FAILED")
        quality_passed = quality_gate.get("passed")
        quality_summary = quality_gate.get("summary") if isinstance(quality_gate, dict) else {}
        quality_date = str(quality_summary.get("date") or "").strip() if isinstance(quality_summary, dict) else ""
        quality_target = expected_latest_date or manifest_latest
        if quality_passed is False and quality_date and quality_target and quality_date == quality_target:
            reason_codes.append("RECOVERY_FAILED")

    recovery_status = str(args.recovery_status or "none").strip().lower()
    if recovery_status in {"attempted", "succeeded", "failed"}:
        reason_codes.append("RECOVERY_ATTEMPTED")
    if recovery_status == "succeeded":
        reason_codes.append("RECOVERY_SUCCEEDED")
    elif recovery_status == "failed":
        reason_codes.append("RECOVERY_FAILED")

    if not reason_codes:
        reason_codes = ["OK"]

    active_issue_codes = [
        code
        for code in reason_codes
        if code in {"STALE_MANIFEST", "STALE_UPDATE_STATE", "LOG_NOT_UPDATED", "LAUNCH_AGENT_MISSING", "RECOVERY_FAILED", "AUTH_FAILED"}
    ]
    is_healthy = len(active_issue_codes) == 0
    abnormal_for_watchdog = business_day and any(
        code in {"STALE_MANIFEST", "STALE_UPDATE_STATE", "LOG_NOT_UPDATED", "LAUNCH_AGENT_MISSING", "RECOVERY_FAILED", "AUTH_FAILED"}
        for code in reason_codes
    )

    summary = {
        "checkedAt": as_iso(now),
        "context": str(args.context or "manual").strip() or "manual",
        "today": today_iso,
        "weekday": weekday,
        "isBusinessDay": business_day,
        "manifest": {
            "latestDate": manifest_latest,
            "generatedAt": manifest_generated_at,
            "generatedAtDate": to_date_iso(manifest_generated_at),
        },
        "expectedLatestDate": expected_latest_date or None,
        "afterCloseCutoff": after_close_cutoff,
        "closeCutoffTime": f"{args.cutoff_hour:02d}:{args.cutoff_minute:02d}",
        "updateState": {
            "lastRunAt": update_last_run_at,
            "lastRunDate": to_date_iso(update_last_run_at),
        },
        "jquantsSyncState": {
            "lastSuccessfulDate": sync_last_successful_date,
        },
        "jquantsCloseRetryLog": {
            "path": str(jquants_log),
            "exists": log_exists,
            "lastUpdatedAt": as_iso(log_mtime),
            "lastUpdatedDate": log_updated_date,
        },
        "jquantsCloseRetryError": {
            "path": str(jquants_err_log),
            "exists": err_log_exists,
            "lastUpdatedAt": as_iso(err_log_mtime),
            "authErrorCode": auth_error_code or None,
            "active": auth_error_active,
        },
        "updateSummary": update_summary,
        "universe": {
            "activeCount": active_count,
            "inactiveCount": inactive_count,
        },
        "qualityGate": quality_gate,
        "launchAgent": {
            "label": LAUNCH_AGENT_LABEL,
            "registered": launch_registered,
            "checkCommandOk": launch_check_ok,
            "checkError": launch_check_error,
            "bootstrapAttempted": bootstrap_attempted,
            "bootstrapSucceeded": bootstrap_succeeded,
            "bootstrapExitCode": bootstrap_exit_code,
            "bootstrapMessage": bootstrap_message,
            "plistPath": str(launch_plist),
        },
        "launchAgentRegistered": launch_registered,
        "reasonCodes": reason_codes,
        "activeIssueCodes": active_issue_codes,
        "isHealthy": is_healthy,
        "watchdog": {
            "abnormal": abnormal_for_watchdog,
            "triggerCodes": [
                code
                for code in reason_codes
                if code in {"STALE_MANIFEST", "STALE_UPDATE_STATE", "LOG_NOT_UPDATED", "LAUNCH_AGENT_MISSING", "RECOVERY_FAILED", "AUTH_FAILED"}
            ],
        },
    }
    return summary


def human_summary(payload: dict[str, Any]) -> str:
    manifest = payload.get("manifest") or {}
    update_state = payload.get("updateState") or {}
    log_state = payload.get("jquantsCloseRetryLog") or {}
    launch_agent = payload.get("launchAgent") or {}
    reasons = ",".join(payload.get("reasonCodes") or ["OK"])
    return (
        "update-health "
        f"status={'OK' if payload.get('isHealthy') else 'NG'} "
        f"today={payload.get('today', '')} "
        f"latestDate={manifest.get('latestDate', '')} "
        f"generatedAt={manifest.get('generatedAt', '')} "
        f"lastRunAt={update_state.get('lastRunAt', '')} "
        f"logUpdatedAt={log_state.get('lastUpdatedAt', '')} "
        f"launchAgentRegistered={launch_agent.get('registered', False)} "
        f"reasonCodes={reasons}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check data update health for kabu_doragon")
    parser.add_argument("--context", default="manual", help="Context label written to update_health.json")
    parser.add_argument(
        "--attempt-repair-launch-agent",
        action="store_true",
        help="Attempt launchctl bootstrap when the close-retry launch agent is missing",
    )
    parser.add_argument(
        "--launch-agent-plist",
        default=str(DEFAULT_AGENT_PLIST),
        help="LaunchAgent plist path used for bootstrap repair",
    )
    parser.add_argument(
        "--recovery-status",
        choices=["none", "attempted", "succeeded", "failed"],
        default="none",
        help="Recovery status code appended to reason codes",
    )
    parser.add_argument(
        "--json-path",
        default="",
        help="Optional output path for JSON summary (default: data/update_health.json)",
    )
    parser.add_argument("--cutoff-hour", type=int, default=16, help="Close update cutoff hour (JST)")
    parser.add_argument("--cutoff-minute", type=int, default=45, help="Close update cutoff minute (JST)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = collect(args)

    root = Path(__file__).resolve().parent.parent
    default_json_path = root / "data" / "update_health.json"
    output_path = Path(args.json_path).expanduser() if args.json_path else default_json_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(human_summary(payload))
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
