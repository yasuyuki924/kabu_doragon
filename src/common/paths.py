from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "data"
WATCHLIST_JSON = DATA_DIR / "watchlist.json"
THEME_MAP_JSON = DATA_DIR / "theme_map.json"
OHLCV_DIR = DATA_DIR / "ohlcv"
OHLCV_ADJUSTED_DIR = DATA_DIR / "ohlcv_adjusted"
INTRADAY_DIR = DATA_DIR / "intraday"
AM_SNAPSHOT_JSON = INTRADAY_DIR / "am_snapshot.json"
YF_SNAPSHOT_JSON = INTRADAY_DIR / "yf_snapshot.json"
CURRENT_SNAPSHOT_STATE_JSON = DATA_DIR / "current_snapshot_state.json"
TICKERS_DIR = DATA_DIR / "tickers"
DAILY_RECORDS_DIR = DATA_DIR / "daily_records"
RANKINGS_DIR = DATA_DIR / "rankings"
OVERVIEW_DIR = DATA_DIR / "overview"
MANIFEST_JSON = DATA_DIR / "manifest.json"
JQUANTS_SYNC_STATE_JSON = DATA_DIR / "jquants_sync_state.json"
UPDATE_STATE_JSON = DATA_DIR / "update_state.json"
UPDATE_SUMMARY_JSON = DATA_DIR / "update_summary.json"
RETRY_PENDING_JSON = DATA_DIR / "retry_pending.json"
INACTIVE_CODES_JSON = DATA_DIR / "inactive_codes.json"
LOGS_DIR = ROOT / "logs"
OUTPUT_DIR = ROOT / "output"
