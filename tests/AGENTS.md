# tests/AGENTS.md

Read `../AGENTS.md` before changing tests.

This directory is verification scope.

Rules:

- Keep tests focused on the requested change and its risk.
- Do not use tests as a reason to run data acquisition or deployment workflows for UI-only work.
- When adding regression coverage, prefer small fixtures or isolated temporary data over touching production `data/`.
