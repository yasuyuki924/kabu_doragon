from __future__ import annotations

import html
import json
import re
from datetime import date, datetime
from pathlib import Path
from urllib.request import Request, urlopen

from src.common.io import load_json_dict, write_json
from src.common.paths import INACTIVE_CODES_JSON, RETRY_PENDING_JSON, WATCHLIST_JSON


JPX_DELISTED_URL = "https://www.jpx.co.jp/listing/stocks/delisted/index.html"
TABLE_ROW_PATTERN = re.compile(r"<tr[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
TABLE_CELL_PATTERN = re.compile(r"<td[^>]*>(.*?)</td>", re.IGNORECASE | re.DOTALL)
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")

INACTIVE_REASON_DELISTED = "INACTIVE_DELISTED"
INACTIVE_REASON_JPX_CONFIRMED = "INACTIVE_JPX_CONFIRMED"
INACTIVE_REASON_MASTER_MISSING = "INACTIVE_MASTER_MISSING"
INACTIVE_REASON_CODES = {
    INACTIVE_REASON_DELISTED,
    INACTIVE_REASON_JPX_CONFIRMED,
    INACTIVE_REASON_MASTER_MISSING,
}


def normalize_code(value: object) -> str:
    text = str(value or "").strip().upper()
    if text.endswith(".0"):
        text = text[:-2]
    if len(text) == 5 and text.endswith("0"):
        return text[:-1]
    return text


def strip_html(value: str) -> str:
    return html.unescape(HTML_TAG_PATTERN.sub("", value)).replace("\xa0", " ").strip()


def parse_jpx_date(value: object) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y/%m/%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def fetch_jpx_delisted_lookup() -> dict[str, dict[str, str]]:
    today = datetime.now().date()
    request = Request(JPX_DELISTED_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=30) as response:
            page_html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return {}

    lookup: dict[str, dict[str, str]] = {}
    for row_html in TABLE_ROW_PATTERN.findall(page_html):
        cells = [strip_html(cell) for cell in TABLE_CELL_PATTERN.findall(row_html)]
        if len(cells) < 3:
            continue
        delisted_on = parse_jpx_date(cells[0])
        code = normalize_code(cells[2])
        if not code or delisted_on is None or delisted_on > today:
            continue
        lookup[code] = {
            "code": code,
            "name": str(cells[1] if len(cells) >= 2 else "").strip(),
            "market": str(cells[3] if len(cells) >= 4 else "").strip(),
            "effectiveDate": delisted_on.isoformat(),
            "source": "jpx_delisted",
        }
    return lookup


def load_existing_watchlist_candidates(path: Path = WATCHLIST_JSON) -> list[dict[str, str]]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    items: list[dict[str, str]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        code = normalize_code(item.get("ticker"))
        if not code:
            continue
        items.append(
            {
                "code": code,
                "name": str(item.get("name") or "").strip(),
                "market": str(item.get("market") or "").strip(),
            }
        )
    return items


def load_retry_pending_candidates(path: Path = RETRY_PENDING_JSON) -> list[dict[str, str]]:
    payload = load_json_dict(path)
    items = payload.get("items")
    if not isinstance(items, list):
        return []
    out: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        code = normalize_code(item.get("code"))
        if not code:
            continue
        out.append({"code": code, "name": "", "market": ""})
    return out


def load_inactive_codes(path: Path = INACTIVE_CODES_JSON) -> dict[str, object]:
    payload = load_json_dict(path)
    items = payload.get("items")
    normalized_items: list[dict[str, object]] = []
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            code = normalize_code(item.get("code"))
            if not code:
                continue
            normalized_items.append(
                {
                    "code": code,
                    "name": str(item.get("name") or "").strip(),
                    "market": str(item.get("market") or "").strip(),
                    "reason": str(item.get("reason") or "").strip(),
                    "reasonCodes": [
                        str(reason).strip()
                        for reason in item.get("reasonCodes", [])
                        if str(reason).strip() in INACTIVE_REASON_CODES
                    ],
                    "source": str(item.get("source") or "").strip(),
                    "effectiveDate": str(item.get("effectiveDate") or "").strip() or None,
                    "detectedAt": str(item.get("detectedAt") or "").strip() or None,
                    "lastCheckedAt": str(item.get("lastCheckedAt") or "").strip() or None,
                }
            )
    return {
        "generatedAt": str(payload.get("generatedAt") or "").strip() or None,
        "asOfDate": str(payload.get("asOfDate") or "").strip() or None,
        "jpxFetchOk": bool(payload.get("jpxFetchOk")),
        "items": normalized_items,
    }


def load_inactive_lookup(path: Path = INACTIVE_CODES_JSON) -> dict[str, dict[str, object]]:
    payload = load_inactive_codes(path)
    return {str(item["code"]): item for item in payload.get("items", []) if isinstance(item, dict)}


def _effective_on_or_before(item: dict[str, object], as_of_date: str | None) -> bool:
    if not as_of_date:
        return True
    effective_date = str(item.get("effectiveDate") or "").strip()
    if not effective_date:
        return True
    return effective_date <= as_of_date


def summarize_inactive_codes(as_of_date: str | None, path: Path = INACTIVE_CODES_JSON, sample_size: int = 10) -> dict[str, object]:
    payload = load_inactive_codes(path)
    items = [
        item
        for item in payload.get("items", [])
        if isinstance(item, dict) and _effective_on_or_before(item, as_of_date)
    ]
    items.sort(
        key=lambda item: (
            str(item.get("effectiveDate") or "9999-99-99"),
            str(item.get("code") or ""),
        )
    )
    sample = [
        {
            "code": str(item.get("code") or "").strip(),
            "reason": str(item.get("reason") or "").strip(),
            "effectiveDate": str(item.get("effectiveDate") or "").strip() or None,
        }
        for item in items[: max(0, sample_size)]
    ]
    return {
        "count": len(items),
        "confirmedCount": sum(
            1 for item in items if INACTIVE_REASON_JPX_CONFIRMED in set(item.get("reasonCodes") or [])
        ),
        "candidateCount": sum(
            1 for item in items if item.get("reason") == INACTIVE_REASON_MASTER_MISSING
        ),
        "codes": [str(item.get("code") or "").strip() for item in items],
        "sample": sample,
        "jpxFetchOk": bool(payload.get("jpxFetchOk")),
        "asOfDate": as_of_date,
    }


def build_inactive_registry(
    *,
    candidate_entries: list[dict[str, str]],
    active_codes: set[str],
    as_of_date: str,
    existing_lookup: dict[str, dict[str, object]] | None = None,
    jpx_lookup: dict[str, dict[str, str]] | None = None,
    checked_at: str | None = None,
) -> list[dict[str, object]]:
    existing_lookup = existing_lookup or {}
    jpx_lookup = jpx_lookup or {}
    checked_at = checked_at or datetime.now().astimezone().isoformat(timespec="seconds")

    candidate_map: dict[str, dict[str, str]] = {}
    for entry in candidate_entries:
        code = normalize_code(entry.get("code"))
        if not code:
            continue
        current = candidate_map.setdefault(code, {"code": code, "name": "", "market": ""})
        name = str(entry.get("name") or "").strip()
        market = str(entry.get("market") or "").strip()
        if name and not current["name"]:
            current["name"] = name
        if market and not current["market"]:
            current["market"] = market
    for code, item in existing_lookup.items():
        candidate_map.setdefault(
            code,
            {
                "code": code,
                "name": str(item.get("name") or "").strip(),
                "market": str(item.get("market") or "").strip(),
            },
        )

    items: list[dict[str, object]] = []
    for code, candidate in sorted(candidate_map.items()):
        previous = existing_lookup.get(code, {})
        jpx_item = jpx_lookup.get(code)
        reason_codes: list[str] = []
        primary_reason = ""
        source = ""
        effective_date: str | None = None

        confirmed_by_jpx = jpx_item is not None or INACTIVE_REASON_JPX_CONFIRMED in set(previous.get("reasonCodes") or [])
        if confirmed_by_jpx:
            reason_codes.extend([INACTIVE_REASON_DELISTED, INACTIVE_REASON_JPX_CONFIRMED])
            primary_reason = INACTIVE_REASON_JPX_CONFIRMED
            source = "jpx_delisted"
            effective_date = str(
                (jpx_item or previous).get("effectiveDate") or ""
            ).strip() or None

        if code not in active_codes:
            reason_codes.append(INACTIVE_REASON_MASTER_MISSING)
            if not primary_reason:
                primary_reason = INACTIVE_REASON_MASTER_MISSING
                source = "jquants_master"
                effective_date = as_of_date

        if not reason_codes:
            continue

        name = candidate["name"] or str((jpx_item or previous).get("name") or "").strip()
        market = candidate["market"] or str((jpx_item or previous).get("market") or "").strip()
        item = {
            "code": code,
            "name": name,
            "market": market,
            "reason": primary_reason,
            "reasonCodes": sorted(set(reason_codes)),
            "source": source,
            "effectiveDate": effective_date,
            "detectedAt": str(previous.get("detectedAt") or "").strip() or checked_at,
            "lastCheckedAt": checked_at,
        }
        items.append(item)
    return items


def write_inactive_codes(
    items: list[dict[str, object]],
    *,
    as_of_date: str,
    jpx_fetch_ok: bool,
    path: Path = INACTIVE_CODES_JSON,
) -> None:
    write_json(
        path,
        {
            "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "asOfDate": as_of_date,
            "jpxFetchOk": jpx_fetch_ok,
            "items": items,
        },
    )
