#!/bin/zsh
set -euo pipefail

ROOT="/Users/okamoto/kabu_doragon"
PENDING_EXIT_CODE=10

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

echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: running J-Quants fetch"
./.venv/bin/python scripts/fetch_prices.py \
  --provider jquants \
  --universe tse \
  --segments prime,standard,growth

echo "[$(date '+%Y-%m-%d %H:%M:%S')] rebuilding derived JSON"
./.venv/bin/python scripts/run_daily.py --skip-fetch --days 60

if ./.venv/bin/python scripts/check_jquants_latest.py; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: latest trading date reflected"
  exit 0
else
  check_status=$?
  if [ "${check_status}" -eq "${PENDING_EXIT_CODE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PENDING: latest trading date not published yet"
    exit "${PENDING_EXIT_CODE}"
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: post-check failed with exit ${check_status}" >&2
  exit "${check_status}"
fi
