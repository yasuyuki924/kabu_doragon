#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
PUBLIC_JSON_DIR="${ROOT}/data/public_json/ticker_recent/1y/ohlcv_ma"
REQUIRED_CODES=(6327 7162 4772)
REQUIRED_KEYS=(date open high low close volume ma5 ma25 ma75 ma200)

cd "${ROOT}"

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

elapsed_seconds() {
  "${PYTHON_BIN}" - <<PY
from time import perf_counter
start = float("${1}")
print(f"{perf_counter() - start:.1f}")
PY
}

if [ ! -x "${PYTHON_BIN}" ]; then
  echo "[$(timestamp)] ERROR: missing python at ${PYTHON_BIN}" >&2
  exit 127
fi

total_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)

echo "[$(timestamp)] step 1/3: running J-Quants close retry flow"
"${SCRIPT_DIR}/run_jquants_close_retry.sh"

echo "[$(timestamp)] step 2/3: rebuilding public_json ticker_recent"
public_start=$("${PYTHON_BIN}" - <<'PY'
from time import perf_counter
print(perf_counter())
PY
)
"${PYTHON_BIN}" scripts/build_public_json_candidate.py
public_elapsed="$(elapsed_seconds "${public_start}")"
echo "[$(timestamp)] public_json rebuild completed in ${public_elapsed}s"

echo "[$(timestamp)] step 3/3: validating public_json output"
"${PYTHON_BIN}" - <<'PY'
import json
from pathlib import Path
import sys

output_dir = Path("data/public_json/ticker_recent/1y/ohlcv_ma")
required_codes = ("6327", "7162", "4772")
required_keys = {"date", "open", "high", "low", "close", "volume", "ma5", "ma25", "ma75", "ma200"}

if not output_dir.exists():
    raise SystemExit(f"missing public_json dir: {output_dir}")

json_files = sorted(output_dir.glob("*.json"))
if len(json_files) < 3000:
    raise SystemExit(f"too few public_json files: {len(json_files)}")

for code in required_codes:
    path = output_dir / f"{code}.json"
    if not path.exists():
        raise SystemExit(f"missing representative public_json: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("ohlcv") if isinstance(payload, dict) else None
    if not rows:
        raise SystemExit(f"empty ohlcv: {path}")
    missing = sorted(required_keys - set(rows[-1].keys()))
    if missing:
        raise SystemExit(f"missing keys in {path}: {missing}")

total_bytes = sum(path.stat().st_size for path in json_files)
print(
    json.dumps(
        {
            "outputDir": str(output_dir),
            "fileCount": len(json_files),
            "totalBytes": total_bytes,
            "representativeCodes": list(required_codes),
        },
        ensure_ascii=False,
    )
)
PY

total_elapsed="$(elapsed_seconds "${total_start}")"
echo "[$(timestamp)] OK: update and public_json rebuild completed total=${total_elapsed}s public_json=${public_elapsed}s"
