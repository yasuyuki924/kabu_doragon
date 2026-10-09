# Split-cache repair preparation

As of 2026-10-09 JST. Branch: `codex/fix-split-cache`.

## Status

Implementation and bounded rehearsal only. This branch has not been pushed,
merged, or deployed. The original local data and live public site are unchanged.
Do not describe the production repair as complete.

The public workflow previously cached raw/adjusted prices and public JSON but
not the corporate-action metadata needed to rebuild adjusted prices. A fresh
runner could therefore restore prices without their split history.

## Changes

- Cache corporate actions and a validation certificate alongside price data.
- Use a separate cache namespace with same-branch restoration only.
- Reject legacy/unverified caches before acquisition or generated-data writes.
- Require valid adjustment factors in J-Quants v2 price responses.
- Compare adjusted prices with raw prices plus verified actions; independently
  validate chart OHLC, volume, coverage, and moving averages.
- Preserve previously verified actions across subsequent updates.
- Repair affected records in retained daily/weekly/monthly overviews, keeping
  unrelated records unchanged and staging replacements before writing.
- Compare hosted split-affected charts with the validated build candidate after
  publication.
- Provide explicit, isolated official-action inventory and migration helpers.
  Migration copies a snapshot, never modifies its raw files, and certifies only
  after all split/public checks and source hashes pass.

No UI or strategy algorithm changes, provider replacement, historical full-price
fetch, production data edits, or automatic migration are included.

## Verification

- 26 focused tests covering metadata loss, duplicate updates, multiple splits,
  incorrect adjustment dates, official coverage, nonfinite factors, workflow
  gates, overview preservation, isolated migration, read-only cache export,
  and interrupted official-inventory receipt reuse.
- Real-data candidate: 53 September split names plus 6327/7162/7203/9983.
- 57 adjusted/chart histories, including volume and MA5/25/75/200, passed.
- 27 overview files for nine retained dates passed; unrelated records remained
  equal. 196 observed source files retained their original hashes.
- Existing integrity and daily-result checks passed in the isolated candidate.
  Representative raw and adjusted histories: 1,368 rows, 243 recent-year rows,
  maximum seven-day gap; public charts: 245 rows, last date 2026-10-08.
- Fresh-environment next-day rehearsal covered all 57 names. Repeating the same
  simulated update did not alter adjusted files; missing action metadata was
  rejected. The simulated 2026-10-09 row is not acquired market data.
- Unmodified ticker UI rendered for 4667 and 278A at 1440x1000 and 390x844,
  with nonblank chart canvases and no JavaScript page errors.

Rehearsal evidence is under `.tmp/split-september-candidate/`. This uses existing
local action metadata and is not an official, whole-universe migration certificate.
The existing integrity helper emits a ResourceWarning for its unclosed CSV
reader in tests; no unrelated change to that helper is included.

## Release blockers and rollout

1. Obtain an immutable snapshot of the currently used PUBLIC cache, not the
   running local dataset. Local March adjustment anomalies need separate review;
   do not publish the whole local dataset to solve the September issue.
2. With specific user approval for the long-running work, acquire official
   J-Quants adjustment metadata for every retained raw-history date/code. Missing
   official coverage stops migration. Do not acquire five-year price history.
3. Build a separate whole-universe candidate. Run both required existing checks
   and review any differences between public-cache retention and the daily
   checker's 1,200-row local-history threshold. Do not weaken thresholds silently.
4. Validate representative and split-affected charts and overview records.
5. Arrange an explicit, reviewed way to seed the new MAIN cache with that
   candidate. The current branch does NOT implement a production cache-import
   operation. A local migration certificate alone does not seed Actions cache.
6. Only then merge and publish, and verify hosted manifest, update_health,
   representative charts, and split-affected charts against the candidate.

IMPORTANT: merging first would make the new fail-closed gate reject the existing
legacy cache and stop scheduled publication. This branch is not release-ready
until the migration and cache-seeding path above are completed. Interrupted
candidate work must never be promoted; the currently published site stays intact.

Live official acquisition, full-cache copying/processing, Actions execution,
push, and deployment require individual confirmation under the project rules.

## Read-only source acquisition preparation

The latest successful public run is 37816788603 at commit
`36d7ad3d3c97403a6efd7f5f05787934eaface84`. Its cache key is
`kabu-pages-data-Linux-main-37816788603` (1,098,664,078 compressed bytes).
The `github-pages` artifact contains generated delivery data but no raw price
history, so it cannot substitute for this cache during whole-universe migration.

The feature-branch workflow has an explicit `export_legacy_cache` mode. In that
mode the normal build job is skipped, the export job has contents-read permission
only, no J-Quants credentials, no cache-save step, and no deployment. Its separate
concurrency group cannot cancel a normal Pages run. The exact cache key must match;
there is no fallback to a different run. The export packages allowed cache paths
and checks every source-file hash before/after, with no source modifications.

This mode is prepared and tested locally only. Pushing the feature branch and
executing that read-only Actions job still require specific approval. It exports
the old source, not a repaired cache, and does not resolve the MAIN cache-seeding
release blocker above.

Live official queries independently confirmed September 29 adjustment factors:
4667 = 1/3 and 278A = 1/2. A second query matched all 53 active September 29
split names to the downloaded fixed public artifact. All 53 have public boundary
ratios consistent with a missing price adjustment. This is strong evidence of
the shared split issue, not full retained-history raw-data verification.

The successful run's 378,523,461-byte Pages artifact was downloaded and extracted
under `.tmp/split-public-artifact-37816788603/`, without changing source data.
Hosted manifest and update_health matched that artifact exactly during this
check. Its manifest latest date is 2026-10-08, with 3,700 active watchlist names
and 3,752 delivered charts. All active names have charts; no empty/duplicate/
unsorted-date or OHLCV-shape defects were found. Moving averages matched where
the full rolling window was available inside the delivered chart. This does
not prove that the underlying prices are split-adjusted: consistent moving
averages can be computed from an unadjusted history.

23 delivered charts have fewer than 100 rows and 97 are not at the manifest
date. These include inactive/stale delivery files and young listings; no claim
of missing acquisition is made without checking the official trading record.
The full audit evidence is `public_audit.json` beside the downloaded artifact.
Whole-universe official raw-history verification and migration have NOT run:
the raw cache requires the separately approved export Actions job.
