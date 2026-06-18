#!/usr/bin/env python3
"""Pre-flight guard: block dangerous staged files before any git commit or deploy.

Checks git staging area (index) for files that must never be committed:
  - data/ subtree (runtime-generated, large, not tracked by design)
  - known heavy-update scripts that should not be triggered

Exit codes:
  0 - staging area is safe
  1 - dangerous files detected; commit should be aborted
  2 - usage/environment error
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files/prefixes that must NOT appear in the git staging area.
BLOCKED_PREFIXES = [
    "data/ohlcv/",
    "data/ohlcv_raw/",
    "data/tickers/",
    "data/overview/",
    "data/public_json/",
    "data/cache/",
]

# data/ top-level JSON files are allowed in special "data-update-only" commits,
# but we warn about them so the operator consciously acknowledges.
WARN_PREFIXES = [
    "data/manifest.json",
    "data/jquants_sync_state.json",
    "data/update_state.json",
    "data/update_health.json",
    "data/update_summary.json",
]

# Scripts that are associated with the legacy heavy update flow.
# Staging them is not blocked, but flagged.
LEGACY_SCRIPT_PATTERNS = [
    "scripts/run_update_and_build_public_json.sh",
    "fetch_prices.py",
    "jquants_provider.py",
]


def get_staged_files() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    except subprocess.CalledProcessError as e:
        print(f"[preflight_guard] ERROR: git diff --cached failed: {e.stderr}", file=sys.stderr)
        return []


def main() -> int:
    staged = get_staged_files()

    if not staged:
        print("[preflight_guard] OK: nothing staged")
        return 0

    blocked: list[str] = []
    warned: list[str] = []
    legacy: list[str] = []

    for f in staged:
        if any(f.startswith(p) for p in BLOCKED_PREFIXES):
            blocked.append(f)
        elif any(f.startswith(p) for p in WARN_PREFIXES):
            warned.append(f)
        if any(pat in f for pat in LEGACY_SCRIPT_PATTERNS):
            legacy.append(f)

    safe = [f for f in staged if f not in blocked and f not in warned]

    print(f"[preflight_guard] staged={len(staged)}  blocked={len(blocked)}  warned={len(warned)}  legacy={len(legacy)}")

    if safe:
        print("  Safe to commit:")
        for f in safe:
            if f not in warned:
                print(f"    OK  {f}")

    if warned:
        print("  WARNING — data JSON files staged (commit only if intentional):")
        for f in warned:
            print(f"    WARN {f}")

    if legacy:
        print("  WARNING — legacy update script staged:")
        for f in legacy:
            print(f"    LEGACY {f}")

    if blocked:
        print("  BLOCKED — these files must NOT be committed:")
        for f in blocked:
            print(f"    BLOCK {f}")
        print("[preflight_guard] FAIL: dangerous files in staging area — aborting")
        return 1

    if warned:
        print("[preflight_guard] WARN: data JSON files staged — proceed only if this is a deliberate data commit")
        return 0

    print("[preflight_guard] OK: staging area is safe")
    return 0


if __name__ == "__main__":
    sys.exit(main())
