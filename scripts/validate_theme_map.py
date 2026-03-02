#!/usr/bin/env python3
from __future__ import annotations

import json

from common import THEME_MAP_JSON, WATCHLIST_JSON


def load_json(path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def main() -> int:
    errors: list[str] = []

    try:
        payload = load_json(THEME_MAP_JSON)
    except FileNotFoundError:
        print(f"ERROR: theme map not found: {THEME_MAP_JSON}")
        return 1
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON in {THEME_MAP_JSON}: {exc}")
        return 1

    try:
        watchlist = load_json(WATCHLIST_JSON)
    except FileNotFoundError:
        print(f"ERROR: watchlist not found: {WATCHLIST_JSON}")
        return 1
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON in {WATCHLIST_JSON}: {exc}")
        return 1

    if not isinstance(payload, dict):
        print("ERROR: theme_map.json root must be an object")
        return 1

    themes = payload.get("themes")
    if not isinstance(themes, list):
        print("ERROR: theme_map.json 'themes' must be a list")
        return 1

    valid_codes = {
        str(item.get("ticker") or "").strip()
        for item in watchlist
        if isinstance(item, dict) and str(item.get("ticker") or "").strip()
    }
    seen_names: set[str] = set()

    for index, item in enumerate(themes, start=1):
        prefix = f"themes[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix}: theme entry must be an object")
            continue

        name = item.get("name")
        if not isinstance(name, str):
            errors.append(f"{prefix}: 'name' must be a string")
            continue
        normalized_name = name.strip()
        if not normalized_name:
            errors.append(f"{prefix}: theme name must not be empty")
        elif normalized_name in seen_names:
            errors.append(f"{prefix}: duplicate theme name '{normalized_name}'")
        else:
            seen_names.add(normalized_name)

        codes = item.get("codes")
        if not isinstance(codes, list):
            errors.append(f"{prefix}: 'codes' must be a list")
            continue
        if not codes:
            errors.append(f"{prefix}: 'codes' must not be empty")
            continue

        seen_codes: set[str] = set()
        for code_index, code in enumerate(codes, start=1):
            code_prefix = f"{prefix}.codes[{code_index}]"
            if not isinstance(code, str):
                errors.append(f"{code_prefix}: code must be a string")
                continue
            normalized_code = code.strip()
            if not normalized_code:
                errors.append(f"{code_prefix}: code must not be empty")
                continue
            if normalized_code != code:
                errors.append(f"{code_prefix}: code must not include leading/trailing spaces")
            if normalized_code in seen_codes:
                errors.append(f"{code_prefix}: duplicate code '{normalized_code}' in theme '{normalized_name or name}'")
                continue
            seen_codes.add(normalized_code)
            if normalized_code not in valid_codes:
                errors.append(f"{code_prefix}: unknown code '{normalized_code}' (not found in watchlist.json)")

    if errors:
        print("ERROR: theme_map.json validation failed")
        for message in errors:
            print(f"- {message}")
        return 1

    print("OK: theme_map.json is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
