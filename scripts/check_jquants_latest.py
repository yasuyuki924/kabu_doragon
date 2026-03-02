#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.jquants_provider import (  # noqa: E402
    build_client,
    current_repo_latest_date,
    current_sync_latest_date,
    default_paths,
    is_target_date_reflected,
    load_auth_config,
    resolve_latest_trading_date,
)


PENDING_EXIT_CODE = 10


def main() -> int:
    paths = default_paths()
    config = load_auth_config(paths.root)
    client, api_version = build_client(config)
    target_date = resolve_latest_trading_date(client, api_version)
    manifest_latest = current_repo_latest_date(paths)
    sync_latest = current_sync_latest_date(paths)

    if is_target_date_reflected(paths, target_date):
        print(f"OK: latest trading date {target_date} is already reflected")
        return 0

    print(
        f"PENDING: targetDate={target_date} manifest.latestDate={manifest_latest or '-'} "
        f"sync.lastSuccessfulDate={sync_latest or '-'}"
    )
    return PENDING_EXIT_CODE


if __name__ == "__main__":
    raise SystemExit(main())
