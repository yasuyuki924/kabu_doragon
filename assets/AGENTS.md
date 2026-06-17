# assets/AGENTS.md

Read `../AGENTS.md` before changing anything in `assets/`.

This directory is UI/client behavior scope. Changes here are usually `UI-only`.

Rules:

- Do not run J-Quants, data refresh, public JSON rebuild, or cached data rebuild for assets-only work.
- Keep UI-only changes limited to the requested visual or interaction behavior.
- Verify with a focused local browser/static check.
- Before saying a UI change is public, confirm the deployed public asset or page content.
- If the public mobile site differs from local, check branch, workflow trigger, artifact freshness, cache, and public asset content before changing code.
