# KabuDragon final data slimdown result

## 1. Summary
- Date: 2026-05-06
- Branch: `feature/lightweight-ticker-detail`
- Base commit before this cleanup: `c6ef4a8b docs: record overview_recent archive cleanup`
- Goal: archive and remove local legacy `data/tickers` and `data/overview`, then run the app from `data/public_json` for normal operation.

This phase completes the local runtime slimdown for normal browsing. The app now keeps `data/public_json` as the primary runtime data source, while legacy data is archived outside the repository.

## 2. Size Change
| Target | Before | After | Notes |
|---|---:|---:|---|
| `data/` | 27G | 2.5G | Legacy ticker and overview data removed after archive verification |
| `data/tickers` | 21G | removed | Archived first |
| `data/overview` | 4.0G | removed | Archived first |
| `data/public_json` | 1.8G | 1.8G | Kept as runtime data |
| `data/warehouse_test` | 210M | 210M | Kept as PoC/input candidate |
| `data/ohlcv` | 198M | 198M | Kept as local source data |
| `data/ohlcv_raw` | 197M | 197M | Kept as local source data |

## 3. Archives
| Archive | Size | Source | Verification |
|---|---:|---|---|
| `~/Desktop/kabu_doragon_data_archive/tickers_20260506.tar.gz` | 1.6G | `data/tickers` | `tar -tzf` confirmed `data/tickers/` contents |
| `~/Desktop/kabu_doragon_data_archive/overview_20260506.tar.gz` | 420M | `data/overview` | `tar -tzf` confirmed `data/overview/` contents |

Restore commands:

```sh
tar -xzf ~/Desktop/kabu_doragon_data_archive/tickers_20260506.tar.gz
tar -xzf ~/Desktop/kabu_doragon_data_archive/overview_20260506.tar.gz
```

## 4. Deleted From Runtime Tree
- Removed: `data/tickers`
- Removed: `data/overview`
- Not removed: `data/public_json`
- Not removed: `data/warehouse_test`
- Not removed: `data/ohlcv`
- Not removed: `data/ohlcv_raw`
- Not removed: small tracked master/state files under `data/`

## 5. Normal URL Verification
| URL | Result |
|---|---|
| `http://127.0.0.1:8010/index.html?date=2026-04-30&sort=gainers&limit=100&turnover=0&range=3&timeframe=daily` | OK. Loaded `data/public_json/overview_lite/...` and `data/public_json/ticker_recent/...`; did not load `data/overview` or `data/tickers`. |
| `http://127.0.0.1:8010/ticker.html?code=6327` | OK. Loaded `ticker_recent`, `ticker_meta`, and `ticker_detail_recent`; did not load `data/tickers`. |
| `http://127.0.0.1:8010/ticker.html?code=7162` | OK. Loaded `ticker_recent`, `ticker_meta`, and `ticker_detail_recent`; did not load `data/tickers`. |
| `http://127.0.0.1:8010/ticker.html?code=4772` | OK. Loaded `ticker_recent`, `ticker_meta`, and `ticker_detail_recent`; did not load `data/tickers`. |

Visible app error boxes were not shown on the verified normal URLs.

## 6. Legacy URL Behavior
After removing `data/tickers` and `data/overview`, legacy URLs no longer have local legacy data available. To avoid a broken screen, the app now treats missing legacy data as archived and falls back to the public JSON runtime data with console warnings.

| URL | Result |
|---|---|
| `http://127.0.0.1:8010/index.html?date=2026-04-30&dataMode=legacy&sort=gainers&limit=100&turnover=0&range=3&timeframe=daily` | Legacy `data/overview` and `data/tickers` requests 404, then fallback to `overview_lite` and `ticker_recent`. No visible error box. |
| `http://127.0.0.1:8010/ticker.html?code=6327&dataMode=legacy` | Legacy `data/tickers/6327.json` request 404, then fallback to `ticker_recent`, `ticker_meta`, and `ticker_detail_recent`. No visible error box. |

Legacy mode remains useful only when archived legacy data is restored locally. Without restored legacy data, it now degrades to public JSON rather than failing the page.

## 7. Code Changes
- `assets/app_data.js`: `dataMode=legacy` overview loading now falls back to `overview_lite` if archived `data/overview` is unavailable.
- `assets/app.js`: `dataMode=legacy` ticker chart loading now falls back to `ticker_recent` if archived `data/tickers` is unavailable.
- `assets/page_ticker.js`: detail-page legacy payload loading now falls back to the public JSON detail/runtime payload if archived `data/tickers` is unavailable.
- `index.html`, `picked.html`, `registered.html`, `ticker.html`: bumped JS query versions to avoid stale browser cache.

## 8. Validation
- `zsh -n scripts/run_update_and_build_public_json.sh`: OK
- `python3 -m py_compile scripts/build_public_json_candidate.py scripts/build_lightweight_detail_public_json.py`: OK
- `node --check assets/app.js`: OK
- `node --check assets/app_data.js`: OK
- `node --check assets/page_ticker.js`: OK
- `git diff --check`: OK

## 9. Regeneration Notes
- `scripts/build_public_json_candidate.py` can still build chart JSON from `data/warehouse_test`.
- `scripts/build_lightweight_detail_public_json.py` currently depends on legacy source data such as `data/tickers` and `data/overview`.
- If ticker meta/detail JSON or overview lite must be regenerated from scratch, restore the archives first or update the generator to use warehouse/official source data instead.

## 10. Git State
- `data/tickers`, `data/overview`, and `data/public_json` are Git-ignored/generated local data.
- Removing `data/tickers` and `data/overview` does not create Git deletion diffs because they are no longer tracked.
- This phase does not run `git gc`, `git filter-repo`, or history cleanup.
- This phase does not merge to `main`.

## 11. Remaining Work
- Decide whether to keep legacy mode as an archived-data-only debug mode or rename it to avoid implying always-available local data.
- Move detail/meta regeneration away from `data/tickers` toward warehouse/source data.
- Add a lightweight runtime health check that verifies `overview_lite`, `ticker_recent`, `ticker_meta`, and `ticker_detail_recent` coverage before deleting or archiving source data.
