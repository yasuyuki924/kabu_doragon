# launchd/AGENTS.md

Read `../AGENTS.md` before changing launchd automation.

This directory is automation/workflow scope.

Rules:

- Do not modify scheduled jobs as part of UI-only work.
- Treat daily data update automation separately from Pages UI deployment.
- When asked whether automation is healthy, inspect configuration and last-run evidence; do not assume success.
