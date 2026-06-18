#!/bin/zsh
set -euo pipefail

ROOT="/Users/okamoto/kabu_doragon"
PYTHON_BIN="${ROOT}/.venv/bin/python"
PENDING_EXIT_CODE=10
UPDATE_STATE_JSON="${ROOT}/data/update_state.json"
LOCK_DIR="${ROOT}/logs/run_yfinance_intraday_update.lock"

mkdir -p "${ROOT}/logs"
cd "${ROOT}"

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] SKIP: yfinance intraday update already running"
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT

weekday=$(date '+%u')
current_hhmm=$(date '+%H%M')
in_session=0
if [ "${weekday}" -ge 1 ] && [ "${weekday}" -le 5 ]; then
  if { [ "${current_hhmm}" -ge 0900 ] && [ "${current_hhmm}" -le 1130 ]; } || { [ "${current_hhmm}" -ge 1230 ] && [ "${current_hhmm}" -le 1530 ]; }; then
    in_session=1
  fi
fi

if [ "${in_session}" -ne 1 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] SKIP: outside JP market hours"
  exit 0
fi

if [ ! -x "${PYTHON_BIN}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: missing python at ${PYTHON_BIN}" >&2
  exit 127
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] yfinance intraday snapshot fetch start"

total_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)

fetch_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
set +e
"${PYTHON_BIN}" scripts/fetch_prices.py \
  --provider yfinance \
  --universe tse \
  --segments prime,standard,growth \
  --intraday-snapshot
fetch_status=$?
set -e
fetch_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${fetch_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

if [ "${fetch_status}" -eq "${PENDING_EXIT_CODE}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: yfinance intraday snapshot unavailable fetch=${fetch_elapsed}s"
  exit "${PENDING_EXIT_CODE}"
fi

if [ "${fetch_status}" -ne 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: yfinance intraday fetch failed with exit ${fetch_status}" >&2
  exit "${fetch_status}"
fi

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

total_elapsed=$("${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: yfinance intraday reflected ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
exit 0
