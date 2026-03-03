#!/bin/zsh
set -euo pipefail

ROOT="/Users/okamoto/kabu_doragon"
PENDING_EXIT_CODE=10
UPDATE_STATE_JSON="${ROOT}/data/update_state.json"

mkdir -p "${ROOT}/logs"
cd "${ROOT}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] AM snapshot check start"

if ./.venv/bin/python scripts/check_jquants_am_snapshot.py; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: AM or daily snapshot already active"
  exit 0
else
  check_status=$?
  if [ "${check_status}" -ne "${PENDING_EXIT_CODE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: AM pre-check failed with exit ${check_status}" >&2
    exit "${check_status}"
  fi
fi

total_start=$(python - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: fetching J-Quants AM snapshot"
fetch_start=$(python - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
./.venv/bin/python scripts/fetch_prices.py \
  --provider jquants \
  --universe tse \
  --segments prime,standard,growth \
  --am-snapshot
fetch_elapsed=$(python - <<PY
from time import perf_counter
start = float("${fetch_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] rebuilding derived JSON from AM snapshot"
build_start=$(python - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
./.venv/bin/python scripts/run_daily.py --skip-fetch
build_elapsed=$(python - <<PY
from time import perf_counter
start = float("${build_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

update_summary=$(python - <<PY
import json
from pathlib import Path
path = Path("${UPDATE_STATE_JSON}")
payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
print(f"updatedCodes={len(payload.get('updatedCodes') or [])} updatedDates={len(payload.get('updatedDates') or [])}")
PY
)

if ./.venv/bin/python scripts/check_jquants_am_snapshot.py; then
  total_elapsed=$(python - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: AM snapshot reflected ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
  exit 0
fi

check_status=$?
if [ "${check_status}" -eq "${PENDING_EXIT_CODE}" ]; then
  total_elapsed=$(python - <<PY
from time import perf_counter
start = float("${total_start}")
print(f"{perf_counter() - start:.1f}")
PY
)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: AM snapshot not available yet ${update_summary} fetch=${fetch_elapsed}s build=${build_elapsed}s total=${total_elapsed}s"
  exit "${PENDING_EXIT_CODE}"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: AM post-check failed with exit ${check_status}" >&2
exit "${check_status}"
