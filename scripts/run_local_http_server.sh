#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT="8010"
HOST="127.0.0.1"

cd "${PROJECT_DIR}"
exec python3 -m http.server "${PORT}" --bind "${HOST}"
