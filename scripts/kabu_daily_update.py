#!/usr/bin/env python3
"""Unified safe entry point for KabuDragon daily data updates.

This script replaces ad-hoc manual runs. It:
  1. Checks for leftover legacy processes
  2. Runs OHLCV integrity check (pre-flight)
  3. Confirms J-Quants targetDate vs manifest.latestDate
  4. Skips if already up to date
  5. Delegates actual update to run_incremental_public_json_update.sh
  6. Verifies manifest / update_summary / representative public_json after update
  7. Writes a dated log to logs/daily_update_YYYYMMDD.log

NEVER falls back to the legacy 5-year full rebuild.

Exit codes:
  0 - update succeeded or was skipped (already up to date)
  1 - update failed or post-check failed
  2 - pre-flight blocked (integrity issue or dangerous state)
  3 - legacy process conflict
"""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS_DIR = ROOT / "logs"
MANIFEST_JSON = ROOT / "data" / "manifest.json"
UPDATE_SUMMARY_JSON = ROOT / "data" / "update_summary.json"
UPDATE_HEALTH_JSON = ROOT / "data" / "update_health.json"
SYNC_STATE_JSON = ROOT / "data" / "jquants_sync_state.json"

INCREMENTAL_SHELL = ROOT / "scripts" / "run_incremental_public_json_update.sh"
INTEGRITY_SCRIPT = ROOT / "scripts" / "check_ohlcv_integrity.py"
POSTCHECK_SCRIPT = ROOT / "scripts" / "check_daily_update_result.py"
CORPORATE_ACTION_SCRIPT = ROOT / "scripts" / "check_corporate_actions.py"

# 8301 has known structural gaps; use the same 4-code set as check_ohlcv_integrity.py.
REPRESENTATIVE_CODES = ["6327", "7162", "7203", "9983"]

LEGACY_PROCESS_PATTERNS = (
    "run_update_and_build_public_json",
    "fetch_prices.py",
    "jquants_provider.py",
)


class DailyLog:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = path.open("a", encoding="utf-8")

    def log(self, msg: str) -> None:
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line)
        self._fh.write(line + "\n")
        self._fh.flush()

    def close(self) -> None:
        self._fh.close()


def _run(cmd: list[str], cwd: Path = ROOT) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def detect_legacy_processes() -> list[str]:
    try:
        r = _run(["ps", "aux"])
        return [
            line for line in r.stdout.splitlines()
            if any(p in line for p in LEGACY_PROCESS_PATTERNS) and "grep" not in line
        ]
    except Exception:
        return []


def load_manifest_latest() -> str:
    try:
        return str(json.loads(MANIFEST_JSON.read_text()).get("latestDate") or "").strip()
    except Exception:
        return ""


def load_sync_state_date() -> str:
    try:
        return str(json.loads(SYNC_STATE_JSON.read_text()).get("lastSuccessfulDate") or "").strip()
    except Exception:
        return ""


def load_update_summary() -> dict:
    try:
        return json.loads(UPDATE_SUMMARY_JSON.read_text())
    except Exception:
        return {}


def load_update_health() -> dict:
    try:
        return json.loads(UPDATE_HEALTH_JSON.read_text())
    except Exception:
        return {}


def check_public_json_representative(log: DailyLog) -> bool:
    """Verify that representative tickers have recent data in public_json."""
    ticker_dir = ROOT / "data" / "public_json" / "ticker_recent" / "1y" / "ohlcv_ma"
    manifest_latest = load_manifest_latest()
    ok = True
    for code in REPRESENTATIVE_CODES:
        f = ticker_dir / f"{code}.json"
        if not f.exists():
            log.log(f"  [WARN] public_json missing: {f.name}")
            continue
        try:
            d = json.loads(f.read_text())
            ohlcv = d if isinstance(d, list) else d.get("ohlcv", [])
            last_date = ohlcv[-1]["date"] if ohlcv else ""
            row_count = len(ohlcv)
            status = "OK" if last_date == manifest_latest else "STALE"
            log.log(f"  public_json {code}: {status} rows={row_count} last={last_date}")
            if status == "STALE" and manifest_latest:
                ok = False
        except Exception as e:
            log.log(f"  [WARN] public_json read error {code}: {e}")
    return ok


def main() -> int:
    today = datetime.now().strftime("%Y%m%d")
    log_path = LOGS_DIR / f"daily_update_{today}.log"
    log = DailyLog(log_path)

    log.log("[START] kabu_daily_update")
    log.log(f"log={log_path}")

    # --- Step 1: Legacy process guard ---
    legacy = detect_legacy_processes()
    if legacy:
        log.log("[ERROR] Legacy update process detected — refusing to proceed")
        for line in legacy:
            log.log(f"  legacy_proc={line[:120]}")
        log.log("  ACTION: kill the legacy process and retry")
        log.close()
        return 3

    # --- Step 2: OHLCV integrity pre-flight (ohlcv + ohlcv_raw) ---
    # ohlcv_raw is the source sync_prices reads from. A gap there will propagate
    # to ohlcv on the next update even if ohlcv was repaired manually.
    log.log("[CHECK] OHLCV integrity pre-flight (ohlcv + ohlcv_raw)")
    r = subprocess.run(
        [sys.executable, str(INTEGRITY_SCRIPT), "--check-raw"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    for line in r.stdout.splitlines():
        log.log(f"  integrity: {line}")
    if r.returncode != 0:
        for line in r.stderr.splitlines():
            log.log(f"  integrity_err: {line}")
        log.log("[ERROR] OHLCV integrity check failed — update blocked")
        log.log("  ACTION: run `python3 scripts/check_ohlcv_integrity.py --check-raw --summary`")
        log.log("  ACTION: if ohlcv_raw has a gap, repair with repair_ohlcv_from_tickers_backup.py --apply --fix-raw")
        log.close()
        return 2

    # --- Step 3: Manifest latestDate and sync state ---
    manifest_latest = load_manifest_latest()
    sync_last = load_sync_state_date()
    log.log(f"manifest.latestDate={manifest_latest or '-'}")
    log.log(f"jquants.lastSuccessfulDate={sync_last or '-'}")
    if not manifest_latest:
        log.log("[ERROR] manifest.latestDate is empty — cannot proceed with incremental update")
        log.log("  ACTION: check data/manifest.json and run_incremental_public_json_update.sh manually")
        log.close()
        return 1

    # --- Step 3b: Corporate action dry-run before publication rebuild ---
    # This is intentionally dry-run only; detected actions must be reviewed
    # before any adjusted OHLCV promotion.
    log.log("[CHECK] corporate action pre-flight dry-run")
    r_ca = subprocess.run(
        [sys.executable, str(CORPORATE_ACTION_SCRIPT)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    for line in r_ca.stdout.splitlines():
        log.log(f"  corp_action: {line}")
    if r_ca.returncode != 0:
        for line in r_ca.stderr.splitlines():
            log.log(f"  corp_action_err: {line}")
        log.log("[ERROR] corporate action dry-run failed — update blocked")
        log.close()
        return 2

    # --- Step 4: Call incremental update ---
    log.log("[RUN] run_incremental_public_json_update.sh")
    r = subprocess.run(
        ["/bin/zsh", str(INCREMENTAL_SHELL)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    for line in r.stdout.splitlines():
        log.log(f"  sh: {line}")
    if r.returncode != 0:
        for line in r.stderr.splitlines():
            log.log(f"  sh_err: {line}")
        log.log(f"[ERROR] incremental update failed (exit={r.returncode})")
        log.log("  ACTION: check logs/incremental_update_*.log for details")
        log.close()
        return 1

    # --- Step 5: Post-update checks ---
    log.log("[CHECK] post-update verification")
    new_manifest = load_manifest_latest()
    log.log(f"  manifest.latestDate (after)={new_manifest or '-'}")

    summary = load_update_summary()
    health = load_update_health()
    log.log(f"  update_summary.status={summary.get('status','-')} date={summary.get('date','-')}")
    log.log(f"  update_health.status={health.get('status','-')}")

    # 5b: post-update OHLCV integrity (ohlcv + ohlcv_raw)
    log.log("[CHECK] post-update OHLCV integrity (ohlcv + ohlcv_raw)")
    r2 = subprocess.run(
        [sys.executable, str(INTEGRITY_SCRIPT), "--check-raw"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    for line in r2.stdout.splitlines():
        log.log(f"  post_integrity: {line}")
    if r2.returncode != 0:
        for line in r2.stderr.splitlines():
            log.log(f"  post_integrity_err: {line}")
        log.log("[WARN] post-update OHLCV integrity check failed — public_json may be inconsistent")
        log.log("  ACTION: run check_ohlcv_integrity.py --check-raw to diagnose")

    pj_ok = check_public_json_representative(log)

    if not pj_ok:
        log.log("[WARN] some public_json tickers are stale after update")
        log.log("  ACTION: check individual ticker files in data/public_json/ticker_recent/")

    # --- Step 5c: Comprehensive post-update result check ---
    log.log("[CHECK] comprehensive post-update result check (ohlcv + ohlcv_raw + public_json)")
    r3 = subprocess.run(
        [sys.executable, str(POSTCHECK_SCRIPT)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    for line in r3.stdout.splitlines():
        log.log(f"  postcheck: {line}")
    if r3.returncode != 0:
        for line in r3.stderr.splitlines():
            log.log(f"  postcheck_err: {line}")
        log.log("[ERROR] post-update check FAILED — data may be corrupted or 2-candle bug active")
        log.log("  ACTION: review logs/daily_update_postcheck_*.log for details")
        log.log("  ACTION: python3 scripts/check_ohlcv_integrity.py --check-raw --summary")
        log.close()
        return 1

    log.log(f"[DONE] kabu_daily_update finished manifest.latestDate={new_manifest}")
    log.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
