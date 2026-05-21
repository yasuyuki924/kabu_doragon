# KabuDragon corporate action pipeline plan

Generated: 2026-05-22

## Scope of this pass

This pass adds only an isolated design and prototype path for stock split / reverse split adjustment.

Created:

- `scripts/build_adjusted_ohlcv.py`
- `scripts/build_ticker_recent_from_adjusted.py`
- this report

Not changed:

- `data/ohlcv_raw/`
- `data/ohlcv/`
- `data/public_json/overview_lite/`
- `data/daily_records/`
- current `data/public_json/ticker_recent/`
- `strategyMatches`
- the existing update pipeline

The prototype scripts default to dry-run. They require `--write` before creating derived files.

## Current generation path

### Raw and current adjusted OHLCV

The current repository code names the local fetch path as J-Quants. A source identifier named `CheckONS` was not found in the inspected repository paths, so this report treats CheckONS as the user-approved upstream price source boundary and keeps the same safety rule: the raw OHLCV layer is not adjusted in place.

The local update entry points are:

```text
scripts/kabu_daily_update.py
  -> scripts/run_incremental_public_json_update.sh
  -> scripts/incremental_jquants_update.py
```

The code path that currently writes price rows is in `src/jquants_provider.py`:

```text
fetched OHLCV rows
  -> data/ohlcv_raw/{code}.csv
corporate action events
  -> data/corporate_actions/{code}.json
apply_corporate_actions(...)
  -> data/ohlcv/{code}.csv
```

`src/jquants_provider.py` already contains corporate action helpers:

- `frame_to_corporate_action_events`
- `read_corporate_action_events`
- `write_corporate_action_events`
- `build_cumulative_adjustment_map`
- `apply_corporate_actions`

The present repository keeps `data/ohlcv_raw` as the fetch-source layer and `data/ohlcv` as the layer consumed by local ticker builds.

The user-facing policy for the next design is stricter:

- do not rewrite CheckONS-origin raw OHLCV
- hold split / reverse split events separately
- create a separately named adjusted layer before switching any production consumer

That policy is compatible with the data boundary above, but the new switch should use a separate `data/ohlcv_adjusted` layer until validation is complete.

### Chart card data

The scanner and ticker detail chart primary JSON path is:

```text
data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json
```

Browser references:

- `assets/app.js`
  - `getRecentTickerDataUrl(code)`
  - `loadRecentTickerForChart(code)`
- `assets/page_index_scanner.js`
  - scanner cards request the recent chart payload and only use longer CSV fallback for extended views

Current production `ticker_recent` generation:

```text
scripts/build_public_json_candidate.py
  input:  data/warehouse_test/prices_by_year/year=*/prices.parquet
  output: data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json
```

That script calculates MA5 / MA25 / MA75 / MA200 during the public JSON build. This is the reason a mixed price basis can show coherent candles but broken MA lines.

### Strategy and ranking data

The current strategy and ranking path is:

```text
data/ohlcv/{code}.csv
  -> scripts/build_ticker_data.py
  -> src.indicators.core.build_enriched_rows(...)
  -> data/tickers/{code}.json
  -> data/daily_records/YYYY-MM-DD.json
  -> scripts/build_rankings.py and scripts/build_market_overview.py
  -> browser-facing overview / ranking JSON
```

Important consumers:

- `scripts/build_ticker_data.py` calls `load_ohlcv_rows(code)` and builds enriched rows.
- `src/indicators/core.py` calculates moving averages, screening metrics, high pullback metrics, and strategy candidates from those rows.
- `scripts/build_rankings.py` ranks daily records.
- the browser strategy filter reads `strategyMatches` from overview records.

Therefore the stable production switch for ranking and strategy is **not** a chart JSON rewrite. It is a controlled input switch for ticker/enrichment builds from:

```text
data/ohlcv/{code}.csv
```

to a validated adjusted source:

```text
data/ohlcv_adjusted/{code}.csv
```

for selected builds first, then for the daily pipeline only after parity checks.

## Corporate actions storage proposal

Keep one event JSON per ticker:

```text
data/corporate_actions/{code}.json
```

Suggested schema:

```json
{
  "code": "8392",
  "generatedAt": "2026-05-22T00:00:00+09:00",
  "events": [
    {
      "code": "8392",
      "effectiveDate": "2026-03-23",
      "type": "split",
      "preShares": 1,
      "postShares": 5,
      "factor": 5,
      "adjFactor": 0.2,
      "source": "corporate_action_source",
      "verified": true
    }
  ]
}
```

The existing J-Quants helper schema already understands the core fields:

- `effectiveDate`
- `type`
- `preShares`
- `postShares`
- `factor`
- `adjFactor`

Recommended extra audit fields:

- `source`
- `sourceId` or source URL when available
- `fetchedAt`
- `verified`
- `note` for manual exception handling

Events should be the only data fetched from the secondary source. Price rows should not be replaced by that source.

## Adjusted OHLCV specification

Derived path:

```text
data/ohlcv_adjusted/{code}.csv
```

Inputs:

```text
data/ohlcv_raw/{code}.csv
data/corporate_actions/{code}.json
```

CSV columns stay identical to OHLCV:

```text
date,open,high,low,close,volume
```

Adjustment rules:

1. Keep rows on and after the effective action boundary on the latest price basis.
2. For rows before a split boundary, divide OHLC by cumulative split factor and multiply volume by that factor.
3. For reverse splits, use the event factor in the same cumulative direction.
4. Apply multiple events cumulatively when a code has multiple actions.
5. Do not store MA values in this CSV layer.
6. Recalculate every downstream MA from adjusted close, never mix raw close and adjusted MA.

## Prototype scripts added

### `scripts/build_adjusted_ohlcv.py`

Purpose:

```text
raw OHLCV + corporate actions -> adjusted OHLCV CSV
```

Default scope:

```text
8392,8050
```

Safety behavior:

- dry-run by default
- writes only with `--write`
- skips a code when it has no corporate action event
- output defaults to `data/ohlcv_adjusted/`
- does not read or write overview, daily records, or current ticker_recent JSON

The prototype can read event files under `data/corporate_actions/`.
For a small trial before event ingestion is ready, it also accepts explicit inline trial events:

```bash
python3 scripts/build_adjusted_ohlcv.py \
  --event 8392:2026-03-23:5 \
  --event 8050:2026-03-23:2
```

Add `--write` only when the trial output should be created.

### `scripts/build_ticker_recent_from_adjusted.py`

Purpose:

```text
adjusted OHLCV CSV -> trial ticker_recent JSON with MA5/25/75/200
```

Safety behavior:

- dry-run by default
- writes only with `--write`
- reads only `data/ohlcv_adjusted/{code}.csv` by default
- writes only `data/public_json/ticker_recent_adjusted/1y/ohlcv_ma/{code}.json` by default
- does not overwrite current production `ticker_recent`

The generated JSON shape matches the compact chart payload:

```json
{
  "ohlcv": [
    {
      "date": "YYYY-MM-DD",
      "open": 0,
      "high": 0,
      "low": 0,
      "close": 0,
      "volume": 0,
      "ma5": 0,
      "ma25": 0,
      "ma75": 0,
      "ma200": 0
    }
  ]
}
```

## Chart reflection path

Safe trial order:

1. Generate adjusted CSV only for 8392 / 8050.
2. Generate adjusted ticker_recent only for 8392 / 8050 under `ticker_recent_adjusted`.
3. Compare old and trial chart JSON:
   - row count
   - date range
   - split boundary close continuity
   - MA values on the same scale as close
4. Render trial JSON through a test-only path or manual comparison before changing `assets/app.js`.

Production chart cutover options after validation:

- Option A: change the generator feeding current `ticker_recent` so it consumes adjusted OHLCV consistently.
- Option B: add a manifest/config switch to adjusted ticker_recent and roll it out by code cohort.

Option A is simpler once adjusted data is trusted. Option B is safer during migration.

## Strategy and ranking reflection path

Do not route strategy/ranking through chart JSON.

Recommended staged switch:

1. Add an OHLCV source selector around the local OHLCV loader used by `scripts/build_ticker_data.py`.
2. For an isolated trial, build tickers and daily records for only 8392 / 8050 into non-production output or a test worktree.
3. Compare metrics computed from current and adjusted input:
   - MA distances
   - 52-week high / base metrics
   - Minervini / Stage 2 / Turtle / RSI(2)
   - ranking fields such as gainers and deviation rankings
4. Only then allow production `build_ticker_data.py` / daily update flow to read `ohlcv_adjusted`.
5. Rebuild overview/ranking layers only after adjusted OHLCV integrity gates pass.

This preserves the separation:

- chart quick repair: compact public chart JSON
- screening repair: enrichment input rows

## 8392 / 8050 trial steps

Dry-run adjusted OHLCV:

```bash
python3 scripts/build_adjusted_ohlcv.py \
  --event 8392:2026-03-23:5 \
  --event 8050:2026-03-23:2
```

Write only the trial adjusted CSVs:

```bash
python3 scripts/build_adjusted_ohlcv.py \
  --event 8392:2026-03-23:5 \
  --event 8050:2026-03-23:2 \
  --write
```

Dry-run compact chart JSON:

```bash
python3 scripts/build_ticker_recent_from_adjusted.py
```

Write only trial compact chart JSON:

```bash
python3 scripts/build_ticker_recent_from_adjusted.py --write
```

Before any browser switch, verify:

- raw files did not change
- adjusted CSVs parse and have the expected row count
- trial ticker JSON parses
- MA5 / MA25 / MA75 / MA200 are calculated from the same adjusted close series
- boundary charts for 8392 / 8050 no longer show split-scale jumps

## Safe production rollout

1. Freeze the corporate action schema and pick the secondary event source.
2. Add event fetch/import with audit metadata and event-only writes.
3. Build `data/ohlcv_adjusted` from raw + events in a dedicated step.
4. Add integrity checks for:
   - CSV parse and OHLC consistency
   - nonnegative volume
   - extreme close jumps around event boundaries
   - event coverage for known split / reverse split dates
5. Validate 8392 / 8050, then the current split-like chart-break cohort.
6. Switch chart generation to adjusted input first.
7. Compare strategy/ranking outputs in a test worktree before switching enrichment input.
8. Change production ranking/overview generation only after the adjusted layer is reproducible and checks pass.

## Immediate non-goals

- no `public_json` full rebuild
- no overview regeneration
- no daily_records regeneration
- no raw price mutation
- no direct production chart path switch
- no ranking/strategy source switch in this pass
