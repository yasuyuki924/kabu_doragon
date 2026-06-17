# .github/AGENTS.md

Read `../AGENTS.md` before changing GitHub Actions, Pages, or deployment files.

This directory is `Workflow` scope. Workflow changes can affect public deployment and data freshness.

Rules:

- Do not change deployment behavior as part of a UI-only request unless the deploy path itself is the proven blocker.
- A `git push` is not public release. Public release requires the configured Pages workflow to run and deploy successfully.
- UI-only deploys must not run J-Quants or rebuild market data.
- UI-only deploys must not publish an artifact with an older `data/manifest.json` than the currently public site.
- If artifact data would regress, stop and report instead of deploying.
- Keep workflow validation proportional: inspect config and run the smallest safe check that proves the requested path.
