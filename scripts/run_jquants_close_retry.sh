#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
PENDING_EXIT_CODE=10
QUALITY_FAIL_EXIT_CODE=20
UPDATE_STATE_JSON="${ROOT}/data/update_state.json"
QUALITY_JSON="${ROOT}/data/update_quality_gate.json"
LOCK_DIR="${ROOT}/logs/run_jquants_close_retry.lock"
LOCK_TTL_SECONDS=$((45 * 60))
export KABU_DORAGON_ROOT="${ROOT}"

mkdir -p "${ROOT}/logs"
cd "${ROOT}"

if [ ! -x "${PYTHON_BIN}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: missing python at ${PYTHON_BIN}" >&2
  exit 127
fi

lock_age_seconds() {
  /bin/zsh -lc "stat -f %m \"$1\"" 2>/dev/null | awk -v now="$(date +%s)" '{print now - $1}'
}

if [ -d "${LOCK_DIR}" ]; then
  lock_age="$(lock_age_seconds "${LOCK_DIR}" || echo 0)"
  if [ "${lock_age}" -ge "${LOCK_TTL_SECONDS}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ABANDON: removing stale lock age=${lock_age}s"
    rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}"
  fi
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] SKIP: jquants close retry already running"
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || rm -rf "${LOCK_DIR}" 2>/dev/null || true' EXIT

echo "[$(date '+%Y-%m-%d %H:%M:%S')] check start"

if "${PYTHON_BIN}" scripts/check_jquants_latest.py; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] retry phase: pending symbols preflight"
  if ! "${PYTHON_BIN}" scripts/retry_missing_symbols.py --provider jquants; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: retry preflight failed" >&2
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: already reflected, skipping fetch"
  exit 0
else
  check_status=$?
  if [ "${check_status}" -ne "${PENDING_EXIT_CODE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: pre-check failed with exit ${check_status}" >&2
    exit "${check_status}"
  fi
fi

total_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: running J-Quants fetch"
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

echo "[$(date '+%Y-%m-%d %H:%M:%S')] rebuilding derived JSON"
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

echo "[$(date '+%Y-%m-%d %H:%M:%S')] retry phase: missing/stale symbols"
quality_target_date=$("${PYTHON_BIN}" - <<'PY'
import json
from pathlib import Path

def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

sync_state = load(Path("data/jquants_sync_state.json"))
manifest = load(Path("data/manifest.json"))
target = str(sync_state.get("lastSuccessfulDate") or "").strip()
if not target:
    target = str(manifest.get("latestDate") or "").strip()
print(target)
PY
)
if [ -n "${quality_target_date}" ]; then
  if ! "${PYTHON_BIN}" scripts/retry_missing_symbols.py --provider jquants --selected-date "${quality_target_date}"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: retry phase failed date=${quality_target_date}" >&2
  fi
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: latest trading date is unknown; refusing to use calendar date for retry" >&2
  exit 1
fi

if ! "${PYTHON_BIN}" scripts/check_data_completeness.py --date "${quality_target_date}" --json-path "${QUALITY_JSON}"; then
  quality_status=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: quality gate failed date=${quality_target_date}" >&2
  if [ "${quality_status}" -eq "${QUALITY_FAIL_EXIT_CODE}" ]; then
    exit "${QUALITY_FAIL_EXIT_CODE}"
  fi
  exit "${quality_status}"
fi

if "${PYTHON_BIN}" scripts/check_jquants_latest.py; then
  "${PYTHON_BIN}" - <<'PY'
from datetime import datetime
from pathlib import Path
import json
import os

root = Path(os.environ["KABU_DORAGON_ROOT"]) / "data"
sync_state = json.loads((root / "jquants_sync_state.json").read_text(encoding="utf-8"))
snapshot_date = str(sync_state.get("lastSuccessfulDate") or "").strip() or datetime.now().astimezone().date().isoformat()
payload = {
    "date": snapshot_date,
    "snapshotType": "daily",
    "active": True,
    "status": "finalized",
    "staleAfterClose": False,
    "finalRetryAt": None,
    "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
}
(root / "current_snapshot_state.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY
  total_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: latest trading date reflected ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
  exit 0
else
  check_status=$?
  if [ "${check_status}" -eq "${PENDING_EXIT_CODE}" ]; then
    total_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: latest trading date not published yet ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
    exit "${PENDING_EXIT_CODE}"
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: post-check failed with exit ${check_status}" >&2
  exit "${check_status}"
fi
