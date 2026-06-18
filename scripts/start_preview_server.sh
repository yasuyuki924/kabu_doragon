#!/bin/zsh
# Dev preview server — port controlled by $PORT env var (default: 8010)
exec python3 -m http.server "${PORT:-8010}" --bind 127.0.0.1
