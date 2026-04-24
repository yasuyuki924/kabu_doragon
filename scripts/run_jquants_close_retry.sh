#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
if [ ! -x "${PYTHON_BIN}" ]; then
  PYTHON_BIN="$(command -v python3)"
fi

PENDING_EXIT_CODE=10
QUALITY_GATE_EXIT_CODE=20
UPDATE_STATE_JSON="${ROOT}/data/update_state.json"
SYNC_STATE_JSON="${ROOT}/data/jquants_sync_state.json"
CURRENT_SNAPSHOT_JSON="${ROOT}/data/current_snapshot_state.json"
LOCK_DIR="${ROOT}/logs/run_jquants_close_retry.lock"
LOCK_TTL_SECONDS=$((45 * 60))

mkdir -p "${ROOT}/logs"
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
    log "ABANDON: removing stale lock age=${lock_age}s"
    rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}"
  fi
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "SKIP: jquants close retry already running"
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}" 2>/dev/null || true' EXIT

if [ ! -x "${PYTHON_BIN}" ]; then
  log "ERROR: missing python runtime" >&2
  exit 127
fi

resolve_sync_target_date() {
  SYNC_STATE_JSON="${SYNC_STATE_JSON}" "${PYTHON_BIN}" - <<'PY'
import json
import os
from pathlib import Path
path = Path(os.environ["SYNC_STATE_JSON"])
payload = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
print(str(payload.get('lastSuccessfulDate') or '').strip())
PY
}

write_snapshot_state() {
  local snapshot_date="$1"
  CURRENT_SNAPSHOT_JSON="${CURRENT_SNAPSHOT_JSON}" SNAPSHOT_DATE="${snapshot_date}" "${PYTHON_BIN}" - <<'PY'
from datetime import datetime
import os
from pathlib import Path
import json

path = Path(os.environ["CURRENT_SNAPSHOT_JSON"])
payload = {
    "date": os.environ["SNAPSHOT_DATE"],
    "snapshotType": "daily",
    "active": True,
    "status": "finalized",
    "staleAfterClose": False,
    "finalRetryAt": None,
    "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
}
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY
}

run_quality_gate() {
  local gate_date="$1"
  if [ -z "${gate_date}" ]; then
    log "WARN: skip quality gate because target date is empty"
    return 0
  fi
  "${PYTHON_BIN}" scripts/check_data_completeness.py \
    --date "${gate_date}" \
    --json-path data/update_quality_gate.json
}

log "check start"
if "${PYTHON_BIN}" scripts/check_jquants_latest.py; then
  sync_target_date="$(resolve_sync_target_date)"
  if [ -n "${sync_target_date}" ]; then
    run_quality_gate "${sync_target_date}"
  fi
  if [ -n "${sync_target_date}" ]; then
    write_snapshot_state "${sync_target_date}"
  fi
  log "OK: latest trading date already reflected"
  exit 0
fi

check_status=$?
if [ "${check_status}" -ne "${PENDING_EXIT_CODE}" ]; then
  log "ERROR: pre-check failed with exit ${check_status}" >&2
  exit "${check_status}"
fi

total_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)

log "PENDING: running J-Quants fetch"
fetch_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
"${PYTHON_BIN}" scripts/fetch_prices.py \
  --provider jquants \
  --universe tse \
  --segments prime,standard,growth
fetch_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${fetch_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

log "REBUILD: rebuilding derived JSON"
build_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
"${PYTHON_BIN}" scripts/run_daily.py --skip-fetch
build_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${build_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

sync_target_date="$(resolve_sync_target_date)"
if ! run_quality_gate "${sync_target_date}"; then
  log "ERROR: quality gate failed target=${sync_target_date:-'-'}"
  exit "${QUALITY_GATE_EXIT_CODE}"
fi

update_summary=$(UPDATE_STATE_JSON="${UPDATE_STATE_JSON}" "${PYTHON_BIN}" - <<'PY'
import json
import os
from pathlib import Path
path = Path(os.environ["UPDATE_STATE_JSON"])
payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
print(f"updatedCodes={len(payload.get('updatedCodes') or [])} updatedDates={len(payload.get('updatedDates') or [])}")
PY
)

if "${PYTHON_BIN}" scripts/check_jquants_latest.py; then
  if [ -n "${sync_target_date}" ]; then
    write_snapshot_state "${sync_target_date}"
  fi
  total_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)
  log "OK: latest trading date reflected ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
  exit 0
fi

check_status=$?
if [ "${check_status}" -eq "${PENDING_EXIT_CODE}" ]; then
  total_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)
  log "PENDING: latest trading date not published yet ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
  exit "${PENDING_EXIT_CODE}"
fi

log "ERROR: post-check failed with exit ${check_status}" >&2
exit "${check_status}"
