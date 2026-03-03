#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from common import resolve_current_snapshot_context  # noqa: E402
from src.jquants_provider import build_client, default_paths, load_auth_config, resolve_latest_trading_date  # noqa: E402


PENDING_EXIT_CODE = 10


def main() -> int:
    paths = default_paths()
    config = load_auth_config(paths.root)
    client, api_version = build_client(config)
    target_date = resolve_latest_trading_date(client, api_version)
    context = resolve_current_snapshot_context()
    snapshot_date = str(context.get("date") or "").strip()
    snapshot_type = str(context.get("type") or "").strip()

    if snapshot_date == target_date and snapshot_type == "am":
        print(f"OK: am snapshot {target_date} is active")
        return 0

    if snapshot_date == target_date and snapshot_type == "daily":
        print(f"OK: daily snapshot {target_date} is already active")
        return 0

    print(f"PENDING: no am snapshot for {target_date}")
    return PENDING_EXIT_CODE


if __name__ == "__main__":
    raise SystemExit(main())
