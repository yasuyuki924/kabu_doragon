#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
QUALITY_SUMMARY_JSON="${ROOT}/data/ohlcv_quality_summary.json"
QUALITY_LOG="${ROOT}/logs/ohlcv_quality_summary.log"

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

# --- Safety guard: check ohlcv AND ohlcv_raw before any update ---
# sync_prices uses ohlcv_raw as source of truth. If ohlcv_raw has a gap,
# the update will regenerate ohlcv with the same gap and break public_json.
echo "[$(timestamp)] [CHECK] OHLCV integrity (ohlcv + ohlcv_raw)"
"${PYTHON_BIN}" "${ROOT}/scripts/check_ohlcv_integrity.py" --check-raw
integrity_status=$?
if [ "${integrity_status}" -ne 0 ]; then
  echo "[$(timestamp)] [ERROR] OHLCV integrity check failed (exit=${integrity_status}) — aborting" >&2
  echo "[$(timestamp)]   BLOCKED: incremental update, public_json rebuild, manifest update will NOT proceed" >&2
  echo "[$(timestamp)]   ACTION: run 'python3 scripts/check_ohlcv_integrity.py --check-raw' to diagnose" >&2
  echo "[$(timestamp)]   ACTION: if ohlcv_raw has a gap, repair with '--apply --fix-raw' before retrying" >&2
  exit 2
fi
echo "[$(timestamp)] [OK] OHLCV integrity passed"

echo "[$(timestamp)] [CHECK] corporate action dry-run"
"${PYTHON_BIN}" "${ROOT}/scripts/check_corporate_actions.py"
corp_action_status=$?
if [ "${corp_action_status}" -ne 0 ]; then
  echo "[$(timestamp)] [ERROR] corporate action dry-run failed (exit=${corp_action_status}) — aborting" >&2
  exit 2
fi
echo "[$(timestamp)] [OK] corporate action dry-run completed"

"${PYTHON_BIN}" "${ROOT}/scripts/incremental_jquants_update.py" "$@"
cmd_status=$?

if [ "${cmd_status}" -eq 0 ]; then
  echo "[$(timestamp)] [OK] incremental public_json update completed"

  echo "[$(timestamp)] [CHECK] post-update result check (ohlcv + ohlcv_raw + public_json)"
  "${PYTHON_BIN}" "${ROOT}/scripts/check_daily_update_result.py"
  postcheck_status=$?
  if [ "${postcheck_status}" -ne 0 ]; then
    echo "[$(timestamp)] [ERROR] post-update check FAILED (exit=${postcheck_status}) — data may be corrupted" >&2
    echo "[$(timestamp)]   ACTION: review logs/daily_update_postcheck_*.log for details" >&2
    echo "[$(timestamp)]   ACTION: python3 scripts/check_ohlcv_integrity.py --check-raw --summary" >&2
    exit "${postcheck_status}"
  fi
  echo "[$(timestamp)] [OK] post-update check passed"

  echo "[$(timestamp)] [CHECK] OHLCV quality summary (warning-only)"
  set +e
  "${PYTHON_BIN}" "${ROOT}/scripts/check_all_ohlcv_quality.py" --no-report --fail-on-critical --summary-json "${QUALITY_SUMMARY_JSON}" > "${QUALITY_LOG}" 2>&1
  quality_status=$?
  set -e
  if [ "${quality_status}" -ne 0 ]; then
    echo "[$(timestamp)] [ERROR] OHLCV quality summary failed (exit=${quality_status}) — critical OHLCV issue detected; log=${QUALITY_LOG}" >&2
    echo "[$(timestamp)]   ACTION: review ${QUALITY_SUMMARY_JSON} and ${QUALITY_LOG}" >&2
    exit "${quality_status}"
  else
    quality_line=$("${PYTHON_BIN}" -c 'import json,sys; d=json.load(open(sys.argv[1], encoding="utf-8")); print("status={} actionable={} critical={} warning={}".format(d.get("status","-"), d.get("actionableCount",0), d.get("criticalCount",0), d.get("warningCount",0)))' "${QUALITY_SUMMARY_JSON}" 2>/dev/null || echo "status=- actionable=- critical=- warning=-")
    echo "[$(timestamp)] [OK] OHLCV quality summary written ${quality_line}; log=${QUALITY_LOG}"
  fi
else
  echo "[$(timestamp)] [ERROR] incremental public_json update failed status=${cmd_status}" >&2
fi
exit "${cmd_status}"
