#!/usr/bin/env python3
"""Fail closed on missing split metadata or inconsistent adjusted/public prices."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import date
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.jquants_provider import apply_corporate_actions, read_ohlcv_rows

STATE_NAME = "split_adjustment_state.json"
PRICE_KEYS = ("open", "high", "low", "close")


def active_codes(data_dir: Path) -> list[str]:
    watchlist = data_dir / "watchlist.json"
    if watchlist.exists():
        payload = json.loads(watchlist.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise ValueError("invalid active watchlist")
        return sorted({str(item["ticker"]).strip().upper() for item in payload if item.get("ticker")})
    return sorted(path.stem for path in (data_dir / "public_json/ticker_meta").glob("*.json"))


def load_events(path: Path) -> list[dict]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("events"), list):
        raise ValueError(f"invalid corporate action file: {path}")
    events = payload["events"]
    dates = set()
    for event in events:
        day = event["effectiveDate"]
        date.fromisoformat(day)
        factor = float(event["factor"])
        if day in dates or not math.isfinite(factor) or factor <= 0:
            raise ValueError(f"invalid/duplicate action for {path.stem}: {day}")
        dates.add(day)
        if str(event.get("code", path.stem)) != path.stem:
            raise ValueError(f"action code mismatch: {path}")
        if event.get("adjFactor") is not None and not math.isclose(
            float(event["adjFactor"]) * factor, 1, rel_tol=1e-6
        ):
            raise ValueError(f"factor/adjFactor mismatch: {path}")
    return sorted(events, key=lambda item: item["effectiveDate"])


def event_digest(events: list[dict]) -> str:
    canonical = [(event["effectiveDate"], str(Fraction(str(event["factor"])).limit_denominator(1000)))
                 for event in events]
    return hashlib.sha256(json.dumps(canonical, separators=(",", ":")).encode()).hexdigest()


def validate_rows(code: str, rows: list[dict]) -> None:
    if not rows:
        raise ValueError(f"{code}: no price history")
    dates = [row["date"] for row in rows]
    if dates != sorted(set(dates)):
        raise ValueError(f"{code}: duplicate/unsorted dates")
    for row in rows:
        date.fromisoformat(row["date"])
        if any(not math.isfinite(float(row[key])) or float(row[key]) <= 0 for key in PRICE_KEYS):
            raise ValueError(f"{code}: invalid OHLC at {row['date']}")
        if not math.isfinite(float(row["volume"])) or float(row["volume"]) < 0:
            raise ValueError(f"{code}: invalid volume at {row['date']}")
        if row["high"] < max(row["open"], row["close"]) or row["low"] > min(row["open"], row["close"]):
            raise ValueError(f"{code}: inconsistent OHLC at {row['date']}")


def check_raw_events(code: str, raw: list[dict], events: list[dict], *, inspect_unknown: bool = True) -> None:
    event_dates = {event["effectiveDate"] for event in events}
    price_dates = {row["date"] for row in raw}
    for event in events:
        day = event["effectiveDate"]
        if raw[0]["date"] <= day <= raw[-1]["date"] and day not in price_dates:
            raise ValueError(f"{code}: action date {day} absent from raw history")
    if not inspect_unknown:
        return
    # Unverified inputs are stopped for review, never corrected from price ratios.
    for previous, current in zip(raw, raw[1:]):
        ratio = current["close"] / previous["close"]
        if current["date"] in event_dates or 0.65 <= ratio <= 1.6:
            continue
        scales = [1 / factor for factor in (2, 3, 4, 5, 6, 10, 15, 20)] + [2, 3, 4, 5, 6, 10]
        if any(abs(ratio / scale - 1) < 0.12 for scale in scales):
            raise ValueError(
                f"{code}: unexplained price scale change at {current['date']} ratio={ratio:.4f}; "
                "verify official action metadata before rebuilding"
            )


def assert_equal_rows(code: str, expected: list[dict], actual: list[dict], label: str) -> None:
    if [row["date"] for row in actual] != [row["date"] for row in expected]:
        raise ValueError(f"{code}: {label} date coverage differs from raw history")
    for want, got in zip(expected, actual):
        for key in (*PRICE_KEYS, "volume"):
            if not math.isclose(float(want[key]), float(got[key]), rel_tol=1e-9, abs_tol=0.00015):
                raise ValueError(f"{code}: {label} {want['date']} {key} differs from raw + actions")


def check_public(code: str, expected: list[dict], data_dir: Path) -> None:
    path = data_dir / "public_json/ticker_recent/1y/ohlcv_ma" / f"{code}.json"
    rows = json.loads(path.read_text(encoding="utf-8"))["ohlcv"]
    recent = expected[-245:]
    assert_equal_rows(code, recent, rows, "public JSON")
    positions = {row["date"]: index for index, row in enumerate(expected)}
    for row in rows:
        index = positions[row["date"]]
        for window in (5, 25, 75, 200):
            want = None if index + 1 < window else sum(
                value["close"] for value in expected[index + 1 - window:index + 1]
            ) / window
            got = row.get(f"ma{window}")
            if (want is None) != (got is None) or (
                want is not None and not math.isclose(float(got), want, rel_tol=1e-8, abs_tol=0.00015)
            ):
                raise ValueError(f"{code}: public MA{window} mismatch at {row['date']}")


def check_dataset(data_dir: Path, codes: list[str], *, require_state: bool = False,
                  public: bool = False, official_inventory: dict | None = None) -> dict:
    state_path = data_dir / STATE_NAME
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if require_state and state.get("schemaVersion") != 1:
        raise ValueError("Legacy/unverified split cache: explicit isolated migration is required")
    if require_state:
        digests = state.get("actionDigests")
        if not isinstance(digests, dict) or not digests or not set(codes).issubset(digests):
            raise ValueError("Split cache certificate has incomplete code coverage")
        for code, digest in digests.items():
            if event_digest(load_events(data_dir / "corporate_actions" / f"{code}.json")) != digest:
                raise ValueError(f"{code}: cached corporate action metadata is missing/changed")
    if state.get("schemaVersion") == 1:
        known = state.get("knownActions")
        if not isinstance(known, dict):
            raise ValueError("Split cache certificate has no preserved action inventory")
        for code, previous in known.items():
            current = {event["effectiveDate"]: event for event in load_events(data_dir / "corporate_actions" / f"{code}.json")}
            for event in previous:
                replacement = current.get(event["effectiveDate"])
                if replacement is None or event_digest([event]) != event_digest([replacement]):
                    raise ValueError(f"{code}: previously verified corporate action is missing/changed")
    digests = {}
    known_actions = {}
    for code in codes:
        raw = read_ohlcv_rows(data_dir / "ohlcv_raw" / f"{code}.csv")
        adjusted = read_ohlcv_rows(data_dir / "ohlcv" / f"{code}.csv")
        events = load_events(data_dir / "corporate_actions" / f"{code}.json")
        validate_rows(code, raw)
        validate_rows(code, adjusted)
        if official_inventory is not None:
            covered = official_inventory.get("coverage", {}).get(code, {})
            if (official_inventory.get("source") != "jquants-v2" or
                    covered.get("fromDate", "9999") > raw[0]["date"] or
                    covered.get("toDate", "") < raw[-1]["date"] or
                    official_inventory.get("actionDigests", {}).get(code) != event_digest(events)):
                raise ValueError(f"{code}: incomplete/conflicting official bootstrap inventory")
        trusted_code = state.get("schemaVersion") == 1 and code in state.get("actionDigests", {})
        check_raw_events(code, raw, events, inspect_unknown=not trusted_code and official_inventory is None)
        expected = apply_corporate_actions(raw, events)
        assert_equal_rows(code, expected, adjusted, "adjusted OHLCV")
        positions = {row["date"]: index for index, row in enumerate(expected)}
        for event in events:
            index = positions.get(event["effectiveDate"], 0)
            if index:
                ratio = expected[index]["close"] / expected[index - 1]["close"]
                if not 0.5 < ratio < 2:
                    raise ValueError(f"{code}: adjusted split boundary still discontinuous at {event['effectiveDate']}")
        if public:
            check_public(code, expected, data_dir)
        digests[code] = event_digest(events)
        known_actions[code] = [{"effectiveDate": event["effectiveDate"], "factor": event["factor"]} for event in events]
    return {"schemaVersion": 1, "checkedCodeCount": len(codes), "actionDigests": digests,
            "knownActions": known_actions}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--codes")
    parser.add_argument("--require-state", action="store_true")
    parser.add_argument("--public", action="store_true")
    parser.add_argument("--seal", action="store_true", help="Write a cache certificate only after all checks pass")
    parser.add_argument("--bootstrap-inventory", type=Path, help="Official retained-history action inventory required for first sealing")
    args = parser.parse_args()
    codes = sorted({value.strip().upper() for value in args.codes.split(",") if value.strip()}) if args.codes else active_codes(args.data_dir)
    if not codes:
        parser.error("no active codes; pass --codes or supply ticker_meta")
    try:
        inventory = json.loads(args.bootstrap_inventory.read_text()) if args.bootstrap_inventory else None
        state = check_dataset(args.data_dir, codes, require_state=args.require_state, public=args.public,
                              official_inventory=inventory)
        if args.seal:
            if not args.public or args.codes:
                raise ValueError("sealing requires --public and the complete active universe")
            target = args.data_dir / STATE_NAME
            existing = json.loads(target.read_text()) if target.exists() else {}
            if existing.get("schemaVersion") != 1:
                if not args.bootstrap_inventory:
                    raise ValueError("first sealing requires an official --bootstrap-inventory; legacy data cannot be trusted automatically")
                if inventory.get("source") != "jquants-v2":
                    raise ValueError("bootstrap inventory is not J-Quants v2")
                for code in codes:
                    raw = read_ohlcv_rows(args.data_dir / "ohlcv_raw" / f"{code}.csv")
                    covered = inventory.get("coverage", {}).get(code, {})
                    if (covered.get("fromDate", "9999") > raw[0]["date"] or
                            covered.get("toDate", "") < raw[-1]["date"] or
                            inventory.get("actionDigests", {}).get(code) != state["actionDigests"][code]):
                        raise ValueError(f"{code}: incomplete/conflicting official bootstrap inventory")
            temporary = target.with_suffix(".json.tmp")
            temporary.write_text(json.dumps(state, indent=2), encoding="utf-8")
            temporary.replace(target)
        print(json.dumps({"status": "OK", "checkedCodeCount": len(codes), "sealed": args.seal}))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"[BLOCKED] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
