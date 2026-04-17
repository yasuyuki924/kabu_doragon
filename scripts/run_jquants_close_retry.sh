#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
PENDING_EXIT_CODE=10
UPDATE_STATE_JSON="${ROOT}/data/update_state.json"
export KABU_DORAGON_ROOT="${ROOT}"

mkdir -p "${ROOT}/logs"
cd "${ROOT}"

if [ ! -x "${PYTHON_BIN}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: missing python at ${PYTHON_BIN}" >&2
  exit 127
fi

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
if ! "${PYTHON_BIN}" scripts/retry_missing_symbols.py --provider jquants --selected-date "$(date '+%Y-%m-%d')"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: retry phase failed" >&2
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
