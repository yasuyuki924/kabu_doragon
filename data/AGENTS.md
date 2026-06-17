# data/AGENTS.md

Read `../AGENTS.md` before changing anything in `data/`.

This directory is `Data` scope and contains generated or acquired market data. Treat it as high risk.

Rules:

- Do not edit, regenerate, delete, or publish data files for UI-only work.
- Do not run J-Quants unless the user explicitly asks for fresh market data or the requested data has not been acquired/generated.
- Do not regenerate `data/public_json` unless `data/ohlcv` and `data/ohlcv_raw` integrity checks are clean.
- Do not update `manifest.latestDate` unless the underlying generated public data actually matches it.
- If data appears stale on the public site, first determine whether the public artifact is stale before fetching new data.
- Never use `git reset --hard`, `git clean`, or destructive deletion to "fix" data state.
