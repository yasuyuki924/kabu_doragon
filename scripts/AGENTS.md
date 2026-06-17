# scripts/AGENTS.md

Read `../AGENTS.md` before changing or running scripts.

This directory includes data update, build, integrity, and deployment support scripts.

Rules:

- Classify the script action before running it: UI check, data update, data integrity, public build, or workflow support.
- For UI-only work, prefer no script execution or a focused static check.
- Do not run legacy full-history update commands listed in the root `AGENTS.md`.
- Use `python3 scripts/kabu_daily_update.py` as the correct daily data update entrypoint when a data update is explicitly in scope.
- If a script can alter `data/`, `public_json`, manifests, caches, or public artifacts, treat it as data/workflow scope and confirm it matches the user's request.
