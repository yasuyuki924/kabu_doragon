#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"

cd "${ROOT}"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

if [ ! -x "${PYTHON_BIN}" ]; then
  echo "[$(timestamp)] ERROR: missing python at ${PYTHON_BIN}" >&2
  exit 127
fi

mkdir -p "${ROOT}/logs"

echo "[$(timestamp)] [START] incremental public_json update"
echo "[$(timestamp)] cwd=${ROOT}"
echo "[$(timestamp)] branch=$(git branch --show-current 2>/dev/null || echo '-')"

"${PYTHON_BIN}" "${ROOT}/scripts/incremental_jquants_update.py" "$@"
status=$?

if [ "${status}" -eq 0 ]; then
  echo "[$(timestamp)] [OK] incremental public_json update completed"
else
  echo "[$(timestamp)] [ERROR] incremental public_json update failed status=${status}" >&2
fi
exit "${status}"
