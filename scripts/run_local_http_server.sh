#!/bin/zsh

set -euo pipefail

PROJECT_DIR="/Users/okamoto/My Project/kabu_doragon"
PORT="8010"
HOST="127.0.0.1"

cd "${PROJECT_DIR}"
exec python3 -m http.server "${PORT}" --bind "${HOST}"
