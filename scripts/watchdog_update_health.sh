#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
if [ ! -x "${PYTHON_BIN}" ]; then
  PYTHON_BIN="$(command -v python3)"
fi

LOGS_DIR="${ROOT}/logs"
HEALTH_JSON="${ROOT}/data/update_health.json"
LOCK_DIR="${LOGS_DIR}/update_watchdog.lock"
LOCK_TTL_SECONDS=$((20 * 60))
LAUNCH_AGENT_LABEL="com.okamoto.kabu_doragon_close_retry"
LAUNCH_AGENT_PLIST="${HOME}/Library/LaunchAgents/com.okamoto.kabu_doragon_close_retry.plist"

mkdir -p "${LOGS_DIR}"
cd "${ROOT}"

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

if [ "$(date '+%u')" -gt 5 ]; then
  log "SKIP: weekend"
  "${SCRIPT_DIR}/check_update_health.sh" --context watchdog-weekend >/dev/null || true
  exit 0
fi

log "START: pre-health check"
"${SCRIPT_DIR}/check_update_health.sh" --context watchdog-pre >/dev/null || true

is_abnormal="$(HEALTH_JSON="${HEALTH_JSON}" "${PYTHON_BIN}" - <<'PY'
import json
import os
from pathlib import Path
path = Path(os.environ["HEALTH_JSON"])
if not path.exists():
    print('true')
else:
    payload = json.loads(path.read_text(encoding='utf-8'))
    print('true' if payload.get('watchdog', {}).get('abnormal') else 'false')
PY
)"

launch_missing="$(HEALTH_JSON="${HEALTH_JSON}" "${PYTHON_BIN}" - <<'PY'
import json
import os
from pathlib import Path
path = Path(os.environ["HEALTH_JSON"])
if not path.exists():
    print('true')
else:
    payload = json.loads(path.read_text(encoding='utf-8'))
    codes = set(payload.get('reasonCodes') or [])
    print('true' if 'LAUNCH_AGENT_MISSING' in codes else 'false')
PY
)"

launch_agent_note=""
if [ "${launch_missing}" = "true" ]; then
  if [ -f "${LAUNCH_AGENT_PLIST}" ]; then
    log "RECOVERY: launch agent missing, trying bootstrap"
    set +e
    bootstrap_output="$(launchctl bootstrap "gui/$(id -u)" "${LAUNCH_AGENT_PLIST}" 2>&1)"
    bootstrap_rc=$?
    set -e
    if [ ${bootstrap_rc} -eq 0 ]; then
      log "RECOVERY: launchctl bootstrap succeeded"
    else
      launch_agent_note="bootstrap failed rc=${bootstrap_rc}: ${bootstrap_output}"
      log "WARN: ${launch_agent_note}"
    fi
  else
    launch_agent_note="plist not found: ${LAUNCH_AGENT_PLIST}"
    log "WARN: ${launch_agent_note}"
  fi
fi

recovery_status=""
recovery_note=""
if [ "${is_abnormal}" = "true" ]; then
  log "ABNORMAL: health indicates stale/missing state, trying one recovery run"
  set +e
  retry_output="$("${SCRIPT_DIR}/run_jquants_close_retry.sh" 2>&1)"
  retry_rc=$?
  set -e

  if [ ${retry_rc} -eq 0 ]; then
    recovery_status="succeeded"
    recovery_note="run_jquants_close_retry.sh completed"
    log "RECOVERY_SUCCEEDED: retry completed"
  elif printf '%s' "${retry_output}" | rg -q "SKIP: jquants close retry already running"; then
    recovery_status="attempted"
    recovery_note="retry skipped because close retry already running"
    log "RECOVERY_ATTEMPTED: close retry already running"
  else
    recovery_status="failed"
    recovery_note="run_jquants_close_retry.sh rc=${retry_rc}"
    log "RECOVERY_FAILED: ${recovery_note}"
    log "RECOVERY_FAILED_OUTPUT: ${retry_output}"
  fi
else
  log "OK: no abnormal signal"
fi

log "END: post-health check"
"${SCRIPT_DIR}/check_update_health.sh" \
  --context watchdog-post \
  --launch-agent-label "${LAUNCH_AGENT_LABEL}" \
  --recovery-status "${recovery_status}" \
  --recovery-note "${recovery_note}" \
  --launch-agent-note "${launch_agent_note}" >/dev/null || true

log "DONE"
