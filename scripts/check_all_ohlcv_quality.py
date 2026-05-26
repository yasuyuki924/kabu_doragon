#!/usr/bin/env python3
"""Check OHLCV quality across all tickers and optional public_json output.

This script is intentionally read-only for market data. By default it runs in
warning mode and exits 0 even when issues are found. Use --fail-on-critical when
the checks are ready to become an update gate.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OHLCV_DIR = ROOT / "data" / "ohlcv"
DEFAULT_PUBLIC_JSON_DIR = ROOT / "data" / "public_json" / "ticker_recent" / "1y" / "ohlcv_ma"
DEFAULT_REPORTS_DIR = ROOT / "reports"
DEFAULT_REPAIR_SOURCE_DIR = ROOT / "data" / "recheck_ohlcv_adjusted"
DEFAULT_ACTIVE_CODES_PATH = ROOT / "data" / "watchlist.json"

PRICE_FIELDS = ("open", "high", "low", "close")
GATE_CANDIDATE_KINDS = {
    "close_mismatch",
    "date_order",
    "duplicate_date",
    "empty",
    "missing_ohlc",
    "missing_public_rows",
    "non_positive_price",
    "ohlc_inconsistent",
    "paired_split_like_jump",
    "read_error",
}
REPAIR_FIRST_KINDS = {
    "close_mismatch",
    "ohlc_inconsistent",
    "paired_split_like_jump",
}


@dataclass(frozen=True)
class Issue:
    code: str
    source: str
    severity: str
    kind: str
    message: str
    date: str | None = None
    extra: dict[str, Any] | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ohlcv-dir", type=Path, default=DEFAULT_OHLCV_DIR)
    parser.add_argument("--public-json-dir", type=Path, default=DEFAULT_PUBLIC_JSON_DIR)
    parser.add_argument("--reports-dir", type=Path, default=DEFAULT_REPORTS_DIR)
    parser.add_argument(
        "--repair-source-dir",
        type=Path,
        default=DEFAULT_REPAIR_SOURCE_DIR,
        help="Directory used only to report whether adjusted repair candidates exist.",
    )
    parser.add_argument(
        "--active-codes-path",
        type=Path,
        default=DEFAULT_ACTIVE_CODES_PATH,
        help="Universe file used to skip obsolete/unlisted ticker files. Defaults to data/watchlist.json.",
    )
    parser.add_argument(
        "--include-unlisted",
        action="store_true",
        help="Check all files even if their code is absent from --active-codes-path.",
    )
    parser.add_argument(
        "--no-repair-plan",
        action="store_true",
        help="Skip read-only repair planning against --repair-source-dir.",
    )
    parser.add_argument("--no-public-json", action="store_true", help="Skip public_json checks.")
    parser.add_argument("--no-report", action="store_true", help="Do not write reports.")
    parser.add_argument(
        "--always-report",
        action="store_true",
        help="Write a report even when no issues are found.",
    )
    parser.add_argument(
        "--fail-on-critical",
        action="store_true",
        help="Exit 1 when critical issues are found. Default is warning mode.",
    )
    parser.add_argument(
        "--max-gap-days",
        type=int,
        default=10,
        help="Warn when consecutive rows have a calendar gap above this value.",
    )
    parser.add_argument(
        "--min-rows",
        type=int,
        default=200,
        help="Warn when a ticker has fewer rows than this value.",
    )
    parser.add_argument(
        "--paired-window",
        type=int,
        default=15,
        help="Lookahead rows used to detect split-like down/up or up/down pairs.",
    )
    parser.add_argument(
        "--split-low-ratio",
        type=float,
        default=0.35,
        help="Close ratio below this is treated as a suspicious drop candidate.",
    )
    parser.add_argument(
        "--single-day-extreme-ratio",
        type=float,
        default=0.55,
        help="Warn when close ratio moves beyond this one-day threshold.",
    )
    parser.add_argument(
        "--close-tolerance-pct",
        type=float,
        default=0.05,
        help="Allowed public_json vs ohlcv close difference in percent.",
    )
    return parser.parse_args()


def issue(
    code: str,
    source: str,
    severity: str,
    kind: str,
    message: str,
    date: str | None = None,
    extra: dict[str, Any] | None = None,
) -> Issue:
    return Issue(code=code, source=source, severity=severity, kind=kind, message=message, date=date, extra=extra)


def read_csv_rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as fh:
        for raw in csv.DictReader(fh):
            if not raw.get("date"):
                continue
            row: dict[str, Any] = {"date": str(raw["date"]).strip()}
            for field in PRICE_FIELDS:
                row[field] = float(raw[field])
            row["volume"] = int(float(raw.get("volume") or 0))
            rows.append(row)
    return rows


def load_active_codes(path: Path) -> set[str]:
    if not path.exists():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8"))
    codes: set[str] = set()
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                code = str(item.get("ticker") or item.get("code") or "").strip()
                if code:
                    codes.add(code)
            elif item:
                codes.add(str(item).strip())
    elif isinstance(payload, dict):
        items = payload.get("items") if isinstance(payload.get("items"), list) else []
        for item in items:
            if isinstance(item, dict):
                code = str(item.get("ticker") or item.get("code") or "").strip()
                if code:
                    codes.add(code)
            elif item:
                codes.add(str(item).strip())
    return codes


def compact_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def read_public_json_rows(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    raw_rows = payload if isinstance(payload, list) else payload.get("ohlcv", [])
    rows: list[dict[str, Any]] = []
    for raw in raw_rows if isinstance(raw_rows, list) else []:
        if not isinstance(raw, dict) or not raw.get("date"):
            continue
        row = {"date": str(raw["date"]).strip()}
        for field in PRICE_FIELDS:
            value = raw.get(field)
            row[field] = float(value) if value is not None else None
        volume = raw.get("volume")
        row["volume"] = int(float(volume)) if volume is not None else None
        rows.append(row)
    return rows


def safe_date(value: str) -> datetime | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def check_rows(
    code: str,
    source: str,
    rows: list[dict[str, Any]],
    *,
    min_rows: int,
    max_gap_days: int,
    paired_window: int,
    split_low_ratio: float,
    single_day_extreme_ratio: float,
) -> list[Issue]:
    issues: list[Issue] = []
    if not rows:
        return [issue(code, source, "critical", "empty", "no rows found")]

    if len(rows) < min_rows:
        issues.append(
            issue(
                code,
                source,
                "warning",
                "too_few_rows",
                f"row count is low: {len(rows)} < {min_rows}",
                extra={"rowCount": len(rows), "minRows": min_rows},
            )
        )

    dates = [str(row.get("date") or "") for row in rows]
    sorted_dates = sorted(dates)
    if dates != sorted_dates:
        issues.append(issue(code, source, "critical", "date_order", "dates are not sorted"))
    duplicated_dates = sorted(date for date, count in Counter(dates).items() if count > 1)
    for date_value in duplicated_dates[:10]:
        issues.append(issue(code, source, "critical", "duplicate_date", "duplicate date", date_value))

    for index, row in enumerate(rows):
        row_date = str(row.get("date") or "")
        values = {field: row.get(field) for field in PRICE_FIELDS}
        if any(value is None for value in values.values()):
            issues.append(issue(code, source, "critical", "missing_ohlc", "missing OHLC value", row_date))
            continue
        open_value = float(values["open"])
        high_value = float(values["high"])
        low_value = float(values["low"])
        close_value = float(values["close"])
        if min(open_value, high_value, low_value, close_value) <= 0:
            issues.append(issue(code, source, "critical", "non_positive_price", "price is not positive", row_date))
        if high_value < max(open_value, close_value) or low_value > min(open_value, close_value):
            issues.append(
                issue(
                    code,
                    source,
                    "critical",
                    "ohlc_inconsistent",
                    "OHLC is inconsistent: high/low does not contain open/close",
                    row_date,
                    {"open": open_value, "high": high_value, "low": low_value, "close": close_value},
                )
            )

        if index == 0:
            continue
        prev = rows[index - 1]
        prev_close = float(prev.get("close") or 0)
        if prev_close <= 0 or close_value <= 0:
            continue
        ratio = close_value / prev_close
        if ratio <= single_day_extreme_ratio or ratio >= 1 / single_day_extreme_ratio:
            issues.append(
                issue(
                    code,
                    source,
                    "warning",
                    "single_day_extreme_move",
                    f"large close-to-close ratio: {ratio:.4f}",
                    row_date,
                    {"previousDate": prev.get("date"), "previousClose": prev_close, "close": close_value, "ratio": round(ratio, 6)},
                )
            )

    for index in range(1, len(rows)):
        prev_date = safe_date(str(rows[index - 1].get("date") or ""))
        curr_date = safe_date(str(rows[index].get("date") or ""))
        if not prev_date or not curr_date:
            continue
        gap = (curr_date - prev_date).days
        if gap > max_gap_days:
            issues.append(
                issue(
                    code,
                    source,
                    "warning",
                    "large_date_gap",
                    f"large calendar gap: {gap} days",
                    str(rows[index].get("date") or ""),
                    {"previousDate": rows[index - 1].get("date"), "gapDays": gap},
                )
            )

    paired_high_ratio = 1 / split_low_ratio
    for index in range(1, len(rows)):
        prev_close = float(rows[index - 1].get("close") or 0)
        curr_close = float(rows[index].get("close") or 0)
        if prev_close <= 0 or curr_close <= 0:
            continue
        ratio = curr_close / prev_close
        if split_low_ratio < ratio < paired_high_ratio:
            continue
        for next_index in range(index + 1, min(len(rows), index + paired_window + 1)):
            next_prev_close = float(rows[next_index - 1].get("close") or 0)
            next_close = float(rows[next_index].get("close") or 0)
            if next_prev_close <= 0 or next_close <= 0:
                continue
            next_ratio = next_close / next_prev_close
            down_then_up = ratio <= split_low_ratio and next_ratio >= paired_high_ratio
            up_then_down = ratio >= paired_high_ratio and next_ratio <= split_low_ratio
            if down_then_up or up_then_down:
                issues.append(
                    issue(
                        code,
                        source,
                        "critical",
                        "paired_split_like_jump",
                        f"suspicious paired close jumps: {ratio:.4f} then {next_ratio:.4f}",
                        str(rows[index].get("date") or ""),
                        {
                            "firstPreviousDate": rows[index - 1].get("date"),
                            "firstDate": rows[index].get("date"),
                            "firstRatio": round(ratio, 6),
                            "secondPreviousDate": rows[next_index - 1].get("date"),
                            "secondDate": rows[next_index].get("date"),
                            "secondRatio": round(next_ratio, 6),
                        },
                    )
                )
                break

    return issues


def check_public_json_alignment(
    code: str,
    ohlcv_rows: list[dict[str, Any]],
    public_rows: list[dict[str, Any]],
    *,
    tolerance_pct: float,
) -> list[Issue]:
    issues: list[Issue] = []
    if not public_rows:
        return [issue(code, "public_json", "critical", "missing_public_rows", "public_json has no rows")]
    ohlcv_by_date = {str(row["date"]): row for row in ohlcv_rows if row.get("date")}
    missing_dates = []
    mismatches = []
    for public_row in public_rows:
        date_value = str(public_row.get("date") or "")
        if date_value not in ohlcv_by_date:
            missing_dates.append(date_value)
            continue
        public_close = public_row.get("close")
        ohlcv_close = ohlcv_by_date[date_value].get("close")
        if public_close is None or ohlcv_close is None:
            continue
        public_close = float(public_close)
        ohlcv_close = float(ohlcv_close)
        tolerance = max(0.05, abs(ohlcv_close) * tolerance_pct / 100)
        if abs(public_close - ohlcv_close) > tolerance:
            mismatches.append(
                {
                    "date": date_value,
                    "ohlcvClose": ohlcv_close,
                    "publicJsonClose": public_close,
                    "diff": round(public_close - ohlcv_close, 6),
                }
            )

    if missing_dates:
        issues.append(
            issue(
                code,
                "public_json",
                "warning",
                "public_date_not_in_ohlcv",
                f"{len(missing_dates)} public_json dates are not present in ohlcv",
                extra={"sampleDates": missing_dates[:10]},
            )
        )
    if mismatches:
        issues.append(
            issue(
                code,
                "public_json",
                "critical",
                "close_mismatch",
                f"{len(mismatches)} public_json close values differ from ohlcv",
                extra={"sampleMismatches": mismatches[:10], "tolerancePct": tolerance_pct},
            )
        )

    ohlcv_last = str(ohlcv_rows[-1].get("date") or "") if ohlcv_rows else ""
    public_last = str(public_rows[-1].get("date") or "") if public_rows else ""
    if ohlcv_last and public_last and public_last > ohlcv_last:
        issues.append(
            issue(
                code,
                "public_json",
                "warning",
                "public_newer_than_ohlcv",
                f"public_json latest date is newer than ohlcv: {public_last} > {ohlcv_last}",
                extra={"ohlcvLastDate": ohlcv_last, "publicJsonLastDate": public_last},
            )
        )
    return issues


def classify_action(item: Issue) -> str:
    if item.kind in REPAIR_FIRST_KINDS:
        return "repair_first"
    if item.kind in GATE_CANDIDATE_KINDS:
        return "gate_candidate"
    if item.severity == "critical":
        return "manual_review"
    return "observe"


def build_repair_source_summary(issues: list[Issue], repair_source_dir: Path) -> dict[str, Any]:
    repair_codes = sorted({item.code for item in issues if classify_action(item) == "repair_first"})
    available = []
    missing = []
    for code in repair_codes:
        target = repair_source_dir / f"{code}.csv"
        (available if target.exists() else missing).append(code)
    return {
        "repairSourceDir": compact_path(repair_source_dir),
        "repairFirstCodeCount": len(repair_codes),
        "availableCodeCount": len(available),
        "missingCodeCount": len(missing),
        "availableCodes": available,
        "missingCodes": missing,
    }


def build_triage(issues: list[Issue], repair_source_dir: Path) -> dict[str, Any]:
    buckets: dict[str, list[dict[str, Any]]] = {
        "repair_first": [],
        "gate_candidate": [],
        "manual_review": [],
        "observe": [],
    }
    for item in issues:
        action = classify_action(item)
        buckets[action].append(asdict(item))
    return {
        "policy": {
            "repair_first": "Fix or inspect before turning this check into an update blocker.",
            "gate_candidate": "Safe candidate for a future update gate after a few clean dry-runs.",
            "manual_review": "Needs human review before blocking updates.",
            "observe": "Keep as report-only signal; do not block updates yet.",
        },
        "counts": {key: len(value) for key, value in buckets.items()},
        "byKind": {
            key: dict(Counter(item["kind"] for item in value))
            for key, value in buckets.items()
        },
        "repairSource": build_repair_source_summary(issues, repair_source_dir),
        "samples": {key: value[:30] for key, value in buckets.items()},
    }


def row_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(row.get("date") or ""): row for row in rows if row.get("date")}


def changed_dates(
    base_rows: list[dict[str, Any]],
    candidate_rows: list[dict[str, Any]],
    *,
    fields: tuple[str, ...] = ("open", "high", "low", "close", "volume"),
) -> list[dict[str, Any]]:
    base_by_date = row_map(base_rows)
    changes = []
    for candidate in candidate_rows:
        date_value = str(candidate.get("date") or "")
        base = base_by_date.get(date_value)
        if not base:
            continue
        changed_fields = []
        for field in fields:
            base_value = base.get(field)
            candidate_value = candidate.get(field)
            if base_value is None or candidate_value is None:
                continue
            if float(base_value) != float(candidate_value):
                changed_fields.append(
                    {
                        "field": field,
                        "current": base_value,
                        "candidate": candidate_value,
                    }
                )
        if changed_fields:
            changes.append({"date": date_value, "fields": changed_fields})
    return changes


def build_repair_plan(
    issues: list[Issue],
    repair_source_dir: Path,
    ohlcv_rows_by_code: dict[str, list[dict[str, Any]]],
    public_rows_by_code: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    repair_issues = [item for item in issues if classify_action(item) == "repair_first"]
    codes = sorted({item.code for item in repair_issues})
    issue_kinds_by_code = {
        code: sorted({item.kind for item in repair_issues if item.code == code})
        for code in codes
    }
    issue_dates_by_code = {
        code: sorted({str(item.date) for item in repair_issues if item.code == code and item.date})
        for code in codes
    }

    items = []
    for code in codes:
        source_path = repair_source_dir / f"{code}.csv"
        current_rows = ohlcv_rows_by_code.get(code, [])
        public_rows = public_rows_by_code.get(code, [])
        if not source_path.exists():
            items.append(
                {
                    "code": code,
                    "status": "missing_repair_source",
                    "issueKinds": issue_kinds_by_code.get(code, []),
                    "issueDates": issue_dates_by_code.get(code, []),
                    "repairSource": compact_path(source_path),
                }
            )
            continue

        try:
            candidate_rows = read_csv_rows(source_path)
        except Exception as exc:
            items.append(
                {
                    "code": code,
                    "status": "repair_source_read_error",
                    "issueKinds": issue_kinds_by_code.get(code, []),
                    "issueDates": issue_dates_by_code.get(code, []),
                    "repairSource": compact_path(source_path),
                    "error": str(exc),
                }
            )
            continue

        current_dates = set(row_map(current_rows))
        public_dates = set(row_map(public_rows))
        candidate_dates = set(row_map(candidate_rows))
        current_changes = changed_dates(current_rows, candidate_rows)
        public_changes = changed_dates(public_rows, candidate_rows)
        issue_dates = issue_dates_by_code.get(code, [])
        covered_issue_dates = [date for date in issue_dates if date in candidate_dates]
        source_last = str(candidate_rows[-1].get("date") or "") if candidate_rows else ""
        current_tail_rows = [
            row for row in current_rows
            if source_last and str(row.get("date") or "") > source_last
        ]
        public_tail_rows = [
            row for row in public_rows
            if source_last and str(row.get("date") or "") > source_last
        ]
        status = "ready_for_dry_run_review"
        if not candidate_rows:
            status = "empty_repair_source"
        elif not current_rows:
            status = "missing_current_ohlcv"
        elif not current_changes and not public_changes:
            status = "no_candidate_diff"

        items.append(
            {
                "code": code,
                "status": status,
                "issueKinds": issue_kinds_by_code.get(code, []),
                "issueDates": issue_dates,
                "coveredIssueDates": covered_issue_dates,
                "repairSource": compact_path(source_path),
                "candidateRows": len(candidate_rows),
                "candidateStartDate": candidate_rows[0].get("date") if candidate_rows else None,
                "candidateEndDate": candidate_rows[-1].get("date") if candidate_rows else None,
                "currentRows": len(current_rows),
                "currentOverlapRows": len(current_dates & candidate_dates),
                "currentChangedRows": len(current_changes),
                "currentFirstChangedDate": current_changes[0]["date"] if current_changes else None,
                "currentLastChangedDate": current_changes[-1]["date"] if current_changes else None,
                "currentTailRowsAfterCandidate": len(current_tail_rows),
                "publicRows": len(public_rows),
                "publicOverlapRows": len(public_dates & candidate_dates),
                "publicChangedRows": len(public_changes),
                "publicFirstChangedDate": public_changes[0]["date"] if public_changes else None,
                "publicLastChangedDate": public_changes[-1]["date"] if public_changes else None,
                "publicTailRowsAfterCandidate": len(public_tail_rows),
                "sampleCurrentChanges": current_changes[:5],
                "samplePublicChanges": public_changes[:5],
            }
        )

    by_status = Counter(str(item.get("status") or "") for item in items)
    return {
        "mode": "dry-run",
        "description": "Read-only comparison between repair candidates and current ohlcv/public_json rows.",
        "codeCount": len(items),
        "readyCodeCount": by_status.get("ready_for_dry_run_review", 0),
        "byStatus": dict(sorted(by_status.items())),
        "items": items,
    }


def report_payload(
    args: argparse.Namespace,
    issues: list[Issue],
    checked: dict[str, int],
    ohlcv_rows_by_code: dict[str, list[dict[str, Any]]],
    public_rows_by_code: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    by_severity: dict[str, int] = {}
    by_kind: dict[str, int] = {}
    for item in issues:
        by_severity[item.severity] = by_severity.get(item.severity, 0) + 1
        by_kind[item.kind] = by_kind.get(item.kind, 0) + 1
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "mode": "fail-on-critical" if args.fail_on_critical else "warning",
        "checked": checked,
        "activeCodes": {
            "path": compact_path(args.active_codes_path),
            "includeUnlisted": bool(args.include_unlisted),
            "count": checked.get("activeCodes", 0),
            "skippedOhlcvFiles": checked.get("skippedOhlcvFiles", 0),
            "skippedPublicJsonFiles": checked.get("skippedPublicJsonFiles", 0),
        },
        "summary": {
            "issueCount": len(issues),
            "criticalCount": by_severity.get("critical", 0),
            "warningCount": by_severity.get("warning", 0),
            "bySeverity": by_severity,
            "byKind": by_kind,
        },
        "triage": build_triage(issues, args.repair_source_dir),
        "issues": [asdict(item) for item in issues],
    }
    if not args.no_repair_plan:
        payload["repairPlan"] = build_repair_plan(
            issues,
            args.repair_source_dir,
            ohlcv_rows_by_code,
            public_rows_by_code,
        )
    return payload


def write_reports(reports_dir: Path, payload: dict[str, Any]) -> tuple[Path, Path]:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = reports_dir / f"kabudragon_ohlcv_quality_{stamp}.json"
    md_path = reports_dir / f"kabudragon_ohlcv_quality_{stamp}.md"
    reports_dir.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# KabuDragon OHLCV Quality Report",
        "",
        f"- generatedAt: {payload['generatedAt']}",
        f"- mode: {payload['mode']}",
        f"- checked ohlcv files: {payload['checked'].get('ohlcvFiles', 0)}",
        f"- checked public_json files: {payload['checked'].get('publicJsonFiles', 0)}",
        f"- active codes: {payload['activeCodes'].get('count', 0)}",
        f"- skipped unlisted ohlcv files: {payload['activeCodes'].get('skippedOhlcvFiles', 0)}",
        f"- skipped unlisted public_json files: {payload['activeCodes'].get('skippedPublicJsonFiles', 0)}",
        f"- issues: {payload['summary']['issueCount']}",
        f"- critical: {payload['summary']['criticalCount']}",
        f"- warning: {payload['summary']['warningCount']}",
        "",
        "## Issue Counts",
        "",
    ]
    for kind, count in sorted(payload["summary"]["byKind"].items()):
        lines.append(f"- {kind}: {count}")
    lines.extend(["", "## Triage", ""])
    for bucket, description in payload["triage"]["policy"].items():
        count = payload["triage"]["counts"].get(bucket, 0)
        lines.append(f"- {bucket}: {count} - {description}")
    source = payload["triage"]["repairSource"]
    lines.extend(
        [
            "",
            "## Repair Source Coverage",
            "",
            f"- repair source: `{source['repairSourceDir']}`",
            f"- repair-first unique codes: {source['repairFirstCodeCount']}",
            f"- available: {source['availableCodeCount']}",
            f"- missing: {source['missingCodeCount']}",
        ]
    )
    if source["missingCodes"]:
        lines.append(f"- missing codes: {', '.join(source['missingCodes'])}")
    repair_plan = payload.get("repairPlan") or {}
    if repair_plan:
        lines.extend(
            [
                "",
                "## Dry-Run Repair Plan",
                "",
                f"- mode: {repair_plan.get('mode')}",
                f"- candidate codes: {repair_plan.get('codeCount')}",
                f"- ready for review: {repair_plan.get('readyCodeCount')}",
            ]
        )
        for status, count in sorted((repair_plan.get("byStatus") or {}).items()):
            lines.append(f"- {status}: {count}")
        lines.extend(["", "### Repair Plan Samples", ""])
        for item in (repair_plan.get("items") or [])[:80]:
            lines.append(
                f"- {item.get('code')} {item.get('status')}: "
                f"currentChangedRows={item.get('currentChangedRows', '-')} "
                f"publicChangedRows={item.get('publicChangedRows', '-')} "
                f"candidate={item.get('candidateStartDate', '-')}..{item.get('candidateEndDate', '-')}"
            )
    lines.extend(["", "## Repair First Samples", ""])
    for item in payload["triage"]["samples"].get("repair_first", [])[:80]:
        date_text = f" {item.get('date')}" if item.get("date") else ""
        lines.append(
            f"- [{item['severity']}] {item['code']} {item['source']}{date_text} "
            f"{item['kind']}: {item['message']}"
        )
    lines.extend(["", "## Issues", ""])
    for item in payload["issues"][:300]:
        date_text = f" {item.get('date')}" if item.get("date") else ""
        lines.append(
            f"- [{item['severity']}] {item['code']} {item['source']}{date_text} "
            f"{item['kind']}: {item['message']}"
        )
    if len(payload["issues"]) > 300:
        lines.append(f"- ... {len(payload['issues']) - 300} more issues in JSON report")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path, md_path


def main() -> int:
    args = parse_args()
    issues: list[Issue] = []
    active_codes = set() if args.include_unlisted else load_active_codes(args.active_codes_path)
    checked = {
        "ohlcvFiles": 0,
        "publicJsonFiles": 0,
        "skippedOhlcvFiles": 0,
        "skippedPublicJsonFiles": 0,
        "activeCodes": len(active_codes),
    }
    ohlcv_rows_by_code: dict[str, list[dict[str, Any]]] = {}
    public_rows_by_code: dict[str, list[dict[str, Any]]] = {}

    for path in sorted(args.ohlcv_dir.glob("*.csv")):
        code = path.stem
        if active_codes and code not in active_codes:
            checked["skippedOhlcvFiles"] += 1
            continue
        checked["ohlcvFiles"] += 1
        try:
            rows = read_csv_rows(path)
            ohlcv_rows_by_code[code] = rows
            issues.extend(
                check_rows(
                    code,
                    "ohlcv",
                    rows,
                    min_rows=args.min_rows,
                    max_gap_days=args.max_gap_days,
                    paired_window=args.paired_window,
                    split_low_ratio=args.split_low_ratio,
                    single_day_extreme_ratio=args.single_day_extreme_ratio,
                )
            )
        except Exception as exc:
            issues.append(issue(code, "ohlcv", "critical", "read_error", str(exc)))

    if not args.no_public_json and args.public_json_dir.exists():
        for path in sorted(args.public_json_dir.glob("*.json")):
            code = path.stem
            if active_codes and code not in active_codes:
                checked["skippedPublicJsonFiles"] += 1
                continue
            checked["publicJsonFiles"] += 1
            try:
                rows = read_public_json_rows(path)
                public_rows_by_code[code] = rows
                issues.extend(
                    check_rows(
                        code,
                        "public_json",
                        rows,
                        min_rows=100,
                        max_gap_days=args.max_gap_days,
                        paired_window=args.paired_window,
                        split_low_ratio=args.split_low_ratio,
                        single_day_extreme_ratio=args.single_day_extreme_ratio,
                    )
                )
                if code in ohlcv_rows_by_code:
                    issues.extend(
                        check_public_json_alignment(
                            code,
                            ohlcv_rows_by_code[code],
                            rows,
                            tolerance_pct=args.close_tolerance_pct,
                        )
                    )
            except Exception as exc:
                issues.append(issue(code, "public_json", "critical", "read_error", str(exc)))

    payload = report_payload(args, issues, checked, ohlcv_rows_by_code, public_rows_by_code)
    summary = payload["summary"]
    print(
        "[check_all_ohlcv_quality] "
        f"ohlcv={checked['ohlcvFiles']} public_json={checked['publicJsonFiles']} "
        f"skipped_ohlcv={checked['skippedOhlcvFiles']} skipped_public_json={checked['skippedPublicJsonFiles']} "
        f"issues={summary['issueCount']} critical={summary['criticalCount']} warning={summary['warningCount']}"
    )
    if summary["byKind"]:
        by_kind = ", ".join(f"{kind}={count}" for kind, count in sorted(summary["byKind"].items()))
        print(f"  by_kind: {by_kind}")
    triage_counts = payload["triage"]["counts"]
    print(
        "  triage: "
        f"repair_first={triage_counts.get('repair_first', 0)} "
        f"gate_candidate={triage_counts.get('gate_candidate', 0)} "
        f"manual_review={triage_counts.get('manual_review', 0)} "
        f"observe={triage_counts.get('observe', 0)}"
    )
    repair_source = payload["triage"]["repairSource"]
    print(
        "  repair_source: "
        f"available={repair_source['availableCodeCount']} "
        f"missing={repair_source['missingCodeCount']} "
        f"dir={repair_source['repairSourceDir']}"
    )
    repair_plan = payload.get("repairPlan") or {}
    if repair_plan:
        print(
            "  repair_plan: "
            f"codes={repair_plan.get('codeCount', 0)} "
            f"ready={repair_plan.get('readyCodeCount', 0)} "
            f"statuses={repair_plan.get('byStatus', {})}"
        )

    if not args.no_report and (issues or args.always_report):
        json_path, md_path = write_reports(args.reports_dir, payload)
        print(f"  report_json={json_path.relative_to(ROOT)}")
        print(f"  report_md={md_path.relative_to(ROOT)}")

    if args.fail_on_critical and summary["criticalCount"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
