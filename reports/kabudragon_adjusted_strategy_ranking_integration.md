# KabuDragon adjusted strategy/ranking integration

Generated: 2026-05-22T04:40:00+09:00

## Scope
- Mode: `write`
- Date range: `2026-03-19` to `2026-05-21`
- Target codes: 99
- Target dates: 41
- Backup: `reports/backup_20260522_043812_adjusted_strategy_ranking`

## Data changes
- daily_records patched: 11922
- overview_lite target-code records patched: 10831
- overview_lite post-sync files: 112
- overview_lite post-sync records touched: 416831
- ranking files patched: 0 (data/rankings is absent, and scanner ranking is served from overview_lite records.)

## Strategy counts before/after
### 2026-03-19
- before: `{'can_slim': 48, 'high_pullback_30': 19, 'minervini_trend_template': 244, 'rsi2_pullback': 13, 'stan_weinstein_stage2': 71, 'strategy_high_pullback_30': 19, 'trend_turn': 61, 'turtle_donchian_breakout': 87}`
- after: `{'can_slim': 48, 'high_pullback_30': 19, 'minervini_trend_template': 244, 'rsi2_pullback': 12, 'stan_weinstein_stage2': 72, 'strategy_high_pullback_30': 19, 'trend_turn': 61, 'turtle_donchian_breakout': 87}`
### 2026-05-21
- before: `{'can_slim': 59, 'high_pullback_30': 31, 'minervini_trend_template': 135, 'rsi2_pullback': 19, 'stan_weinstein_stage2': 79, 'strategy_high_pullback_30': 31, 'trend_turn': 238, 'turtle_donchian_breakout': 158}`
- after: `{'can_slim': 62, 'high_pullback_30': 33, 'minervini_trend_template': 144, 'rsi2_pullback': 20, 'stan_weinstein_stage2': 80, 'strategy_high_pullback_30': 33, 'trend_turn': 239, 'turtle_donchian_breakout': 158}`

## Verification
- JSON parse: OK
- Python syntax check: OK
- shell syntax check: OK
- git diff --check: OK
- HTTP 200: strategy_stage2 / strategy_minervini / strategy_turtle / strategy_high_pullback_30 / trend_turn
- HTTP 200: ticker_recent representatives 8392 / 8050 / 1723 / 5803 / 7012 / 8393

## Daily update integration
- `check_corporate_actions.py` now falls back to `data/ohlcv/*.csv` when `data/watchlist.json` is absent.
- `kabu_daily_update.py` runs the corporate action check in dry-run mode before the incremental update.
- `run_incremental_public_json_update.sh` also runs the corporate action dry-run before public JSON update work.

## Safety
- `data/ohlcv_raw` was not touched.
- `data/ohlcv` was not touched.
- public_json full regeneration was not run.
- Existing target daily_records and overview_lite files were backed up before writes.
- Commit and push were not run.
