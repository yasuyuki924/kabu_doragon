from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.app.manifest import build_manifest_payload
from src.common.io import ensure_parent, load_json_dict, write_json
from src.common.paths import (
    AM_SNAPSHOT_JSON,
    CURRENT_SNAPSHOT_STATE_JSON,
    DAILY_RECORDS_DIR,
    DATA_DIR,
    INTRADAY_DIR,
    INACTIVE_CODES_JSON,
    JQUANTS_SYNC_STATE_JSON,
    MANIFEST_JSON,
    OHLCV_DIR,
    OVERVIEW_DIR,
    RANKINGS_DIR,
    ROOT,
    RETRY_PENDING_JSON,
    THEME_MAP_JSON,
    TICKERS_DIR,
    UPDATE_SUMMARY_JSON,
    UPDATE_STATE_JSON,
    WATCHLIST_JSON,
    YF_SNAPSHOT_JSON,
)
from src.common.utils import (
    filter_dates_to_recent_window,
    parse_codes,
    select_dates,
    shift_calendar_months,
    today_jst,
)
from src.data_source.local_data import (
    attach_themes,
    build_daily_record,
    build_theme_lookup,
    discover_available_dates,
    iter_ticker_payloads,
    load_daily_records,
    load_ohlcv_rows,
    load_ohlcv_rows_prefer_adjusted,
    load_theme_map,
    load_ticker_payload,
    load_update_state,
    load_watchlist,
    merge_daily_records,
)
from src.data_source.snapshots import (
    apply_snapshot_row,
    current_sync_latest_date,
    load_am_snapshot,
    load_am_snapshot_lookup,
    load_current_snapshot_state,
    load_snapshot_lookup,
    load_yf_snapshot,
    load_yf_snapshot_lookup,
    resolve_current_snapshot_context,
)
from src.indicators.core import (
    MA_WINDOWS,
    RCI_WINDOWS,
    VOLUME_MA_WINDOWS,
    apply_period_change_from_open,
    apply_period_overview_metrics,
    build_enriched_rows,
    build_wtd_mtd_bars,
    calculate_rci,
    calculate_rci_series,
    distance_from_baseline,
    latest_moving_average,
    moving_average,
    rank_values,
)
from src.screening.summary import summarize_sector_strength, summarize_tag_counts, summarize_theme_counts
