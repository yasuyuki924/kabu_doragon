# AGENTS.md
# Codex rules for kabu_doragon

## Project role
This repository is a production-grade Japanese stock screening dashboard.

## Primary goals
- preserve stable ranking flow
- keep scanner rendering fast
- maintain TradingView lazy loading
- avoid regressions in filter apply behavior
- keep ticker detail pages isolated

## Critical protected files
- index.html
- ticker.html
- scripts/
- src/
- assets/

## Do not break
- existing ranking sort order
- filter apply event binding
- date popup visibility
- off-screen chart cleanup
- Yahoo/J-Quants parser compatibility

## Safe workflow
1. implement in feature branch only
2. verify in codex-test worktree
3. merge to main after browser validation

## If uncertain
prefer minimal diff changes
