#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
HEALTH_JSON="${ROOT}/data/update_health.json"
CHECK_SCRIPT="${SCRIPT_DIR}/check_update_health.sh"
RETRY_SCRIPT="${SCRIPT_DIR}/run_jquants_close_retry.sh"
LOCK_DIR="${ROOT}/logs/update_watchdog.lock"
LOCK_TTL_SECONDS=$((45 * 60))

mkdir -p "${ROOT}/logs"
cd "${ROOT}"

if [ ! -x "${PYTHON_BIN}" ]; then
  PYTHON_BIN="$(command -v python3)"
fi

if [ -z "${KABU_WATCHDOG_LOG_REDIRECTED:-}" ]; then
  export KABU_WATCHDOG_LOG_REDIRECTED=1
  exec >> "${ROOT}/logs/update_watchdog.out.log" 2>> "${ROOT}/logs/update_watchdog.err.log"
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

lock_age_seconds() {
  /bin/zsh -lc "stat -f %m \"$1\"" 2>/dev/null | awk -v now="$(date +%s)" '{print now - $1}'
}

if [ -d "${LOCK_DIR}" ]; then
  lock_age="$(lock_age_seconds "${LOCK_DIR}" || echo 0)"
  if [ "${lock_age}" -ge "${LOCK_TTL_SECONDS}" ]; then
    log "ABANDON: removing stale watchdog lock age=${lock_age}s"
    rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}"
  fi
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "SKIP: watchdog already running"
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}" 2>/dev/null || true' EXIT

log "START: watchdog health check"
"${CHECK_SCRIPT}" --context watchdog --attempt-repair-launch-agent || true

abnormal="$(HEALTH_JSON_PATH="${HEALTH_JSON}" "${PYTHON_BIN}" - <<'PY'
import json
import os
from pathlib import Path
path = Path(os.environ["HEALTH_JSON_PATH"])
payload = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
print('1' if payload.get('watchdog', {}).get('abnormal') else '0')
PY
)"

if [ "${abnormal}" = "1" ]; then
  log "ALERT: detected stale update state, attempting one-time recovery"
  set +e
  recovery_output="$(/bin/zsh "${RETRY_SCRIPT}" 2>&1)"
  recovery_status=$?
  set -e
  printf '%s\n' "${recovery_output}"
  if [ "${recovery_status}" -eq 0 ]; then
    if printf '%s' "${recovery_output}" | rg -q "SKIP: jquants close retry already running"; then
      log "RECOVERY: run_jquants_close_retry.sh skipped due to lock"
      "${CHECK_SCRIPT}" --context watchdog --attempt-repair-launch-agent --recovery-status attempted || true
    else
      log "RECOVERY: run_jquants_close_retry.sh completed"
      "${CHECK_SCRIPT}" --context watchdog --attempt-repair-launch-agent --recovery-status succeeded || true
    fi
  else
    log "RECOVERY: run_jquants_close_retry.sh failed"
    "${CHECK_SCRIPT}" --context watchdog --attempt-repair-launch-agent --recovery-status failed || true
  fi
else
  log "OK: watchdog health check passed"
fi

log "DONE: watchdog"
