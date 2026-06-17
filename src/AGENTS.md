# src/AGENTS.md

Read `../AGENTS.md` before changing source code in `src/`.

This directory is application/source logic scope.

Rules:

- Keep strategy and screening logic Python-first.
- Preserve the contract consumed by JS/UI: `strategyMatches`, `strategyScores`, `strategyMetrics`, and display fields.
- Do not mix source logic changes with UI deploy or data refresh unless the user requested that combined scope.
- Verify with focused tests or checks matched to the changed module.
