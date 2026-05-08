#!/usr/bin/env python3
"""Post-update data quality check for KabuDragon daily update.

Verifies ohlcv, ohlcv_raw, and public_json consistency after an incremental
update. Designed to detect the 2-candle bug (public_json with only 2-3 rows),
ohlcv_raw gaps that will corrupt ohlcv on the next update, manifest staleness,
and row-count anomalies.

Exit codes:
  0 - all checks passed
  1 - one or more NG issues detected
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS_DIR = ROOT / "logs"
MANIFEST_JSON = ROOT / "data" / "manifest.json"
UPDATE_SUMMARY_JSON = ROOT / "data" / "update_summary.json"
UPDATE_HEALTH_JSON = ROOT / "data" / "update_health.json"
SYNC_STATE_JSON = ROOT / "data" / "jquants_sync_state.json"
OHLCV_DIR = ROOT / "data" / "ohlcv"
OHLCV_RAW_DIR = ROOT / "data" / "ohlcv_raw"
PUBLIC_JSON_DIR = ROOT / "data" / "public_json" / "ticker_recent" / "1y" / "ohlcv_ma"

REPRESENTATIVE_CODES = ["6327", "7162", "7203", "9983"]

# Thresholds
MIN_OHLCV_ROWS = 1200       # ~5y of trading days; fewer = suspicious gap
MIN_RECENT_1Y_ROWS = 200    # ~250 trading days/year; fewer = gap in recent year
MIN_PUBLIC_JSON_ROWS = 100  # 1y view should have ~230 rows; <100 = likely 2-candle bug
MAX_GAP_DAYS = 10           # max tolerated consecutive calendar gap in ohlcv/ohlcv_raw
MAX_STALE_DAYS = 10         # allowed lag between ohlcv last_date and manifest.latestDate


class _Log:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = path.open("a", encoding="utf-8")

    def log(self, msg: str) -> None:
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line)
        self._fh.write(line + "\n")
        self._fh.flush()

    def close(self) -> None:
        self._fh.close()


def _load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _check_csv(path: Path, manifest_latest: str) -> dict:
    result: dict = {"ok": True, "issues": []}
    if not path.exists():
        result["ok"] = False
        result["issues"].append("file not found")
        return result

    try:
        rows = list(csv.DictReader(path.open(encoding="utf-8")))
    except Exception as e:
        result["ok"] = False
        result["issues"].append(f"read error: {e}")
        return result

    result["row_count"] = len(rows)
    if not rows:
        result["ok"] = False
        result["issues"].append("file is empty")
        return result

    dates = sorted(r.get("date", "") for r in rows if r.get("date"))
    result["first_date"] = dates[0] if dates else ""
    result["last_date"] = dates[-1] if dates else ""

    if len(rows) < MIN_OHLCV_ROWS:
        result["ok"] = False
        result["issues"].append(f"too few rows: {len(rows)} < {MIN_OHLCV_ROWS}")

    if manifest_latest and result.get("last_date"):
        try:
            last_dt = datetime.strptime(result["last_date"], "%Y-%m-%d").date()
            mf_dt = datetime.strptime(manifest_latest, "%Y-%m-%d").date()
            lag = (mf_dt - last_dt).days
            result["lag_days"] = lag
            if lag > MAX_STALE_DAYS:
                result["ok"] = False
                result["issues"].append(
                    f"stale: last={result['last_date']} manifest={manifest_latest} lag={lag}d"
                )
        except ValueError:
            pass

    if result.get("last_date"):
        try:
            cutoff = datetime.strptime(result["last_date"], "%Y-%m-%d").date() - timedelta(days=365)
            recent = sum(
                1 for d in dates
                if d and datetime.strptime(d, "%Y-%m-%d").date() >= cutoff
            )
            result["recent_1y_rows"] = recent
            if recent < MIN_RECENT_1Y_ROWS:
                result["ok"] = False
                result["issues"].append(
                    f"too few recent rows (1y): {recent} < {MIN_RECENT_1Y_ROWS}"
                )
        except ValueError:
            pass

    if len(dates) >= 2:
        max_gap = 0
        max_gap_pair: tuple[str, str] = ("", "")
        for i in range(1, len(dates)):
            try:
                a = datetime.strptime(dates[i - 1], "%Y-%m-%d").date()
                b = datetime.strptime(dates[i], "%Y-%m-%d").date()
                g = (b - a).days
                if g > max_gap:
                    max_gap = g
                    max_gap_pair = (dates[i - 1], dates[i])
            except ValueError:
                continue
        result["max_gap_days"] = max_gap
        result["max_gap_pair"] = max_gap_pair
        if max_gap > MAX_GAP_DAYS:
            result["ok"] = False
            result["issues"].append(
                f"large date gap: {max_gap}d between {max_gap_pair[0]} and {max_gap_pair[1]}"
            )

    return result


def _check_public_json(code: str, manifest_latest: str) -> dict:
    path = PUBLIC_JSON_DIR / f"{code}.json"
    result: dict = {"ok": True, "issues": []}

    if not path.exists():
        result["ok"] = False
        result["issues"].append("file not found")
        return result

    try:
        d = json.loads(path.read_text(encoding="utf-8"))
        ohlcv = d if isinstance(d, list) else d.get("ohlcv", [])
    except Exception as e:
        result["ok"] = False
        result["issues"].append(f"read error: {e}")
        return result

    result["row_count"] = len(ohlcv)
    result["last_date"] = ohlcv[-1].get("date", "") if ohlcv else ""

    if len(ohlcv) < MIN_PUBLIC_JSON_ROWS:
        result["ok"] = False
        result["issues"].append(
            f"CRITICAL: 2-candle bug? only {len(ohlcv)} rows (expect {MIN_PUBLIC_JSON_ROWS}+)"
        )

    if manifest_latest and result["last_date"] and result["last_date"] != manifest_latest:
        result["ok"] = False
        result["issues"].append(
            f"stale: last={result['last_date']} != manifest={manifest_latest}"
        )

    return result


def main() -> int:
    today = datetime.now().strftime("%Y%m%d")
    log = _Log(LOGS_DIR / f"daily_update_postcheck_{today}.log")

    log.log("[START] check_daily_update_result")

    manifest = _load_json(MANIFEST_JSON)
    update_summary = _load_json(UPDATE_SUMMARY_JSON)
    update_health = _load_json(UPDATE_HEALTH_JSON)
    sync_state = _load_json(SYNC_STATE_JSON)

    manifest_latest = str(manifest.get("latestDate") or "").strip()
    summary_status = str(update_summary.get("status") or "-").strip()
    health_status = (
        str(update_health.get("status") or update_health.get("isHealthy") or "-").strip()
    )
    sync_last = str(sync_state.get("lastSuccessfulDate") or "-").strip()

    log.log(f"manifest.latestDate={manifest_latest or '-'}")
    log.log(f"update_summary.status={summary_status}")
    log.log(f"update_health.status={health_status}")
    log.log(f"jquants.lastSuccessfulDate={sync_last}")

    if not manifest_latest:
        log.log("[WARN] manifest.latestDate is empty — recency checks will be skipped")

    ng_items: list[str] = []

    for code in REPRESENTATIVE_CODES:
        log.log(f"  --- {code} ---")

        ohlcv_r = _check_csv(OHLCV_DIR / f"{code}.csv", manifest_latest)
        tag = "OK" if ohlcv_r["ok"] else "NG"
        log.log(
            f"  ohlcv      [{tag}] rows={ohlcv_r.get('row_count','?')} "
            f"last={ohlcv_r.get('last_date','?')} "
            f"lag={ohlcv_r.get('lag_days','?')}d "
            f"1y={ohlcv_r.get('recent_1y_rows','?')} "
            f"maxgap={ohlcv_r.get('max_gap_days','?')}d"
        )
        for issue in ohlcv_r.get("issues", []):
            log.log(f"             ISSUE: {issue}")
            ng_items.append(f"ohlcv/{code}: {issue}")

        raw_r = _check_csv(OHLCV_RAW_DIR / f"{code}.csv", manifest_latest)
        tag = "OK" if raw_r["ok"] else "NG"
        log.log(
            f"  ohlcv_raw  [{tag}] rows={raw_r.get('row_count','?')} "
            f"last={raw_r.get('last_date','?')} "
            f"lag={raw_r.get('lag_days','?')}d "
            f"1y={raw_r.get('recent_1y_rows','?')} "
            f"maxgap={raw_r.get('max_gap_days','?')}d"
        )
        for issue in raw_r.get("issues", []):
            log.log(f"             ISSUE: {issue}")
            ng_items.append(f"ohlcv_raw/{code}: {issue}")

        pj_r = _check_public_json(code, manifest_latest)
        tag = "OK" if pj_r["ok"] else "NG"
        log.log(
            f"  public_json[{tag}] rows={pj_r.get('row_count','?')} "
            f"last={pj_r.get('last_date','?')}"
        )
        for issue in pj_r.get("issues", []):
            log.log(f"             ISSUE: {issue}")
            ng_items.append(f"public_json/{code}: {issue}")

    if ng_items:
        log.log(f"[FAIL] {len(ng_items)} issue(s) found — data may be corrupted:")
        for item in ng_items:
            log.log(f"  - {item}")
        log.log("  ACTION: python3 scripts/check_ohlcv_integrity.py --check-raw --summary")
        log.log("  ACTION: if ohlcv_raw has a gap → repair_ohlcv_from_tickers_backup.py --apply --fix-raw")
        log.close()
        return 1

    log.log(f"[OK] all checks passed — manifest.latestDate={manifest_latest}")
    log.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
