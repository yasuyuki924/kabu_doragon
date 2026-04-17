#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
PENDING_EXIT_CODE=10
UPDATE_STATE_JSON="${ROOT}/data/update_state.json"
CURRENT_SNAPSHOT_JSON="${ROOT}/data/current_snapshot_state.json"
MANIFEST_JSON="${ROOT}/data/manifest.json"
SYNC_STATE_JSON="${ROOT}/data/jquants_sync_state.json"
LOCK_DIR="${ROOT}/logs/run_yfinance_close_retry.lock"
LOCK_TTL_SECONDS=$((20 * 60))
FINAL_STALE_HOUR=16
FINAL_STALE_MINUTE=15
export KABU_DORAGON_ROOT="${ROOT}"

mkdir -p "${ROOT}/logs"
cd "${ROOT}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

lock_age_seconds() {
  /bin/zsh -lc "stat -f %m \"$1\"" 2>/dev/null | awk -v now="$(date +%s)" '{print now - $1}'
}

write_snapshot_state() {
  local snapshot_type="$1"
  local snapshot_status="$2"
  local stale_after_close="$3"
  local final_retry_at="$4"
  local final_retry_at_json="None"
  if [ -n "${final_retry_at}" ]; then
    final_retry_at_json=$("${PYTHON_BIN}" - <<PY
import json
print(json.dumps("${final_retry_at}"))
PY
)
  fi
  "${PYTHON_BIN}" - <<PY
from datetime import datetime
from pathlib import Path
import json

path = Path("${CURRENT_SNAPSHOT_JSON}")
payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
snapshot_date = str(payload.get("date") or datetime.now().astimezone().date().isoformat()).strip()
updated = {
    "date": snapshot_date,
    "snapshotType": "${snapshot_type}",
    "active": True,
    "status": "${snapshot_status}",
    "staleAfterClose": ${stale_after_close},
    "finalRetryAt": ${final_retry_at_json},
    "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
}
path.write_text(json.dumps(updated, ensure_ascii=False, indent=2), encoding="utf-8")
PY
}

current_minutes() {
  echo $((10#$(date '+%H') * 60 + 10#$(date '+%M')))
}

final_stale_minutes=$((FINAL_STALE_HOUR * 60 + FINAL_STALE_MINUTE))

if [ -d "${LOCK_DIR}" ]; then
  lock_age="$(lock_age_seconds "${LOCK_DIR}" || echo 0)"
  if [ "${lock_age}" -ge "${LOCK_TTL_SECONDS}" ]; then
    log "ABANDON: removing stale lock age=${lock_age}s"
    rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}"
  fi
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  log "SKIP: yfinance close retry already running"
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}" 2>/dev/null || true' EXIT

if [ ! -x "${PYTHON_BIN}" ]; then
  log "ERROR: missing python at ${PYTHON_BIN}" >&2
  exit 127
fi

weekday=$(date '+%u')
if [ "${weekday}" -lt 1 ] || [ "${weekday}" -gt 5 ]; then
  log "SKIP: not a weekday"
  exit 0
fi

target_date=$(date '+%Y-%m-%d')
now_iso=$(date '+%Y-%m-%dT%H:%M:%S%z' | sed 's/\\([0-9][0-9]\\)$/:\\1/')
now_minutes="$(current_minutes)"

read_state=$("${PYTHON_BIN}" - <<'PY'
import json
from pathlib import Path
import os

root = Path(os.environ["KABU_DORAGON_ROOT"]) / "data"

def load(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))

manifest = load(root / "manifest.json")
sync_state = load(root / "jquants_sync_state.json")
snapshot_state = load(root / "current_snapshot_state.json")
print(json.dumps({
    "manifestLatest": str(manifest.get("latestDate") or "").strip(),
    "syncLatest": str(sync_state.get("lastSuccessfulDate") or "").strip(),
    "snapshotType": str(snapshot_state.get("snapshotType") or "").strip(),
    "snapshotStatus": str(snapshot_state.get("status") or "").strip(),
}))
PY
)

manifest_latest=$(printf '%s' "${read_state}" | jq -r '.manifestLatest')
sync_latest=$(printf '%s' "${read_state}" | jq -r '.syncLatest')
snapshot_type=$(printf '%s' "${read_state}" | jq -r '.snapshotType')
snapshot_status=$(printf '%s' "${read_state}" | jq -r '.snapshotStatus')

if [ "${manifest_latest}" = "${target_date}" ] && [ "${sync_latest}" = "${target_date}" ]; then
  log "RETRY_PHASE: pending symbols preflight"
  if ! "${PYTHON_BIN}" scripts/retry_missing_symbols.py --provider yfinance; then
    log "WARN: retry preflight failed"
  fi
  if [ "${snapshot_type}" != "daily" ] || [ "${snapshot_status}" != "finalized" ]; then
    write_snapshot_state "daily" "finalized" "False" ""
    "${PYTHON_BIN}" scripts/build_market_overview.py --dates "${target_date}" >/dev/null
    log "SUCCESS: latest trading date already reflected; finalized current snapshot"
  else
    log "SUCCESS: latest trading date ${target_date} is already reflected"
  fi
  exit 0
fi

total_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)

log "START: running yfinance close fetch for ${target_date}"
fetch_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
"${PYTHON_BIN}" scripts/fetch_prices.py \
  --provider yfinance \
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

update_summary=$("${PYTHON_BIN}" - <<PY
import json
from pathlib import Path
path = Path("${UPDATE_STATE_JSON}")
payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
print(f"updatedCodes={len(payload.get('updatedCodes') or [])} updatedDates={len(payload.get('updatedDates') or [])}")
PY
)

log "RETRY_PHASE: missing/stale symbols"
if ! "${PYTHON_BIN}" scripts/retry_missing_symbols.py --provider yfinance --selected-date "${target_date}"; then
  log "WARN: retry phase failed"
fi

post_state=$("${PYTHON_BIN}" - <<'PY'
import json
from pathlib import Path
import os

root = Path(os.environ["KABU_DORAGON_ROOT"]) / "data"

def load(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))

manifest = load(root / "manifest.json")
sync_state = load(root / "jquants_sync_state.json")
print(json.dumps({
    "manifestLatest": str(manifest.get("latestDate") or "").strip(),
    "syncLatest": str(sync_state.get("lastSuccessfulDate") or "").strip(),
}))
PY
)

post_manifest_latest=$(printf '%s' "${post_state}" | jq -r '.manifestLatest')
post_sync_latest=$(printf '%s' "${post_state}" | jq -r '.syncLatest')

total_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

if [ "${post_manifest_latest}" = "${target_date}" ] && [ "${post_sync_latest}" = "${target_date}" ]; then
  write_snapshot_state "daily" "finalized" "False" ""
  log "REBUILD_FINALIZED: rebuilding derived JSON under daily/finalized snapshot"
  finalized_build_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
  "${PYTHON_BIN}" scripts/run_daily.py --skip-fetch
  finalized_build_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${finalized_build_start}")
print(f"{perf_counter() - start:.1f}")
PY
)
  log "SUCCESS: latest trading date reflected ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
  log "SUCCESS_FINALIZED_REBUILD: finalized_build=${finalized_build_elapsed}s"
  exit 0
fi

if [ "${now_minutes}" -ge "${final_stale_minutes}" ]; then
  write_snapshot_state "yf_intraday" "stale" "True" "${now_iso}"
  log "STALE: latest trading date not published by final retry ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
  exit "${PENDING_EXIT_CODE}"
fi

log "PENDING: latest trading date not published yet ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
exit "${PENDING_EXIT_CODE}"
