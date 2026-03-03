#!/bin/zsh
set -euo pipefail

ROOT="/Users/okamoto/kabu_doragon"
PENDING_EXIT_CODE=10
UPDATE_STATE_JSON="${ROOT}/data/update_state.json"

mkdir -p "${ROOT}/logs"
cd "${ROOT}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] check start"

if ./.venv/bin/python scripts/check_jquants_latest.py; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: already reflected, skipping fetch"
  exit 0
else
  check_status=$?
  if [ "${check_status}" -ne "${PENDING_EXIT_CODE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: pre-check failed with exit ${check_status}" >&2
    exit "${check_status}"
  fi
fi

total_start=$(python - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: running J-Quants fetch"
fetch_start=$(python - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
./.venv/bin/python scripts/fetch_prices.py \
  --provider jquants \
  --universe tse \
  --segments prime,standard,growth
fetch_elapsed=$(python - <<PY
from time import perf_counter
start = float("${fetch_start}")
print(f"{perf_counter() - start:.1f}")
PY
)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] rebuilding derived JSON"
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

if ./.venv/bin/python scripts/check_jquants_latest.py; then
  ./.venv/bin/python - <<'PY'
from datetime import datetime
from pathlib import Path
import json

root = Path("/Users/okamoto/kabu_doragon/data")
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
  total_elapsed=$(python - <<PY
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
    total_elapsed=$(python - <<PY
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
