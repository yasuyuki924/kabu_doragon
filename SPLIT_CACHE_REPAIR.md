# Split-cache repair preparation

As of 2026-10-09 JST. Branch: `codex/fix-split-cache`.

## Status

UPDATED SCOPE: the user selected ONLY the 53 September 29 split names in
`scripts/september_split_targets.json`. 6327/7162/7203/9983 are validation only,
not repair targets. The earlier whole-universe migration proposal below is
superseded wherever it conflicts with this explicit scope.

Implementation, bounded rehearsal, and approved scoped public-source verification
have run. The feature branch was pushed, but has NOT been merged or deployed.
The original local data and live public site are unchanged. The required daily
postcheck FAILS on the public cache's 363-row retention versus its 1,200-row
threshold. Do not describe the production repair as complete or release-ready.

The public workflow previously cached raw/adjusted prices and public JSON but
not the corporate-action metadata needed to rebuild adjusted prices. A fresh
runner could therefore restore prices without their split history.

## Changes

- Cache corporate actions and a validation certificate alongside price data.
- Use a separate cache namespace with same-branch restoration only.
- Reject legacy/unverified caches before acquisition or generated-data writes.
- Require valid adjustment factors in J-Quants v2 price responses.
- Export only the 53 target histories plus four validation-only histories and
  the existing shared overview files needed to preserve unrelated records.
- Fetch official metadata by the 53 target codes, not by full-universe dates.
- Seal and enforce an explicit 53-code scope; never claim unrelated codes were
  officially validated. The regular rebuild guard honors that explicit scope.
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

- The following local rehearsal results precede the official public-source
  verification documented below; they do not override its release blockers.
- 31 focused tests covering metadata loss, duplicate updates, multiple splits,
  incorrect adjustment dates, official coverage, nonfinite factors, workflow
  gates, overview preservation, isolated migration, read-only cache export,
  interrupted official-inventory receipt reuse, scoped export/acquisition/
  certification/migration, and preservation of original overview record order.
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

## Scoped Release Blockers And Rollout

1. DONE: obtain an immutable, bounded snapshot from the fixed PUBLIC cache:
   53 repair names, four validation-only names, and shared overview data. Do not
   substitute the running local dataset, which has separate March anomalies.
2. DONE with specific user approval: acquire official
   J-Quants adjustment metadata ONLY for the 53 target codes across their retained
   raw-history dates. Missing official coverage stops migration. Do not acquire
   five-year price history or investigate unrelated names.
3. Candidate built; RELEASE BLOCKED: the existing integrity check passes, but
   the unmodified daily postcheck fails eight CSV checks (four representatives,
   raw and adjusted) because each has 363 rows, below 1,200. These same failures
   exist in the immutable source before repair. Do not weaken thresholds.
4. The 53-code public adjustment check and desktop/mobile chart checks pass.
   Independent preservation/simulation evidence is beside the candidate.
   Review the 285A historical threshold-rounding case below before any import.
5. Arrange an explicit, reviewed import of ONLY the 53-name correction into the
   current public cache, preserving all unrelated ticker files and records.
   The current branch does NOT implement that production cache-import operation.
   The 53-name certificate does not certify the rest of the market.
6. Only then merge and publish, and verify hosted manifest, update_health,
   representative charts, and split-affected charts against the candidate.

IMPORTANT: merging first would make the new fail-closed gate reject the existing
legacy cache and stop scheduled publication. This branch is not release-ready
until the scoped candidate and import path above are completed. Interrupted
candidate work must never be promoted; the currently published site stays intact.

Live official acquisition, full-cache copying/processing, Actions execution,
push, and deployment require individual confirmation under the project rules.

## Read-only source acquisition preparation

The latest successful public run is 37816788603 at commit
`36d7ad3d3c97403a6efd7f5f05787934eaface84`. Its cache key is
`kabu-pages-data-Linux-main-37816788603` (1,098,664,078 compressed bytes).
The `github-pages` artifact contains generated delivery data but no raw price
history, so it cannot substitute for this cache during whole-universe migration.

The feature-branch workflow has an explicit, now 53-code-bounded
`export_legacy_cache` mode. In that
mode the normal build job is skipped, the export job has contents-read permission
only, no J-Quants credentials, no cache-save step, and no deployment. Its separate
concurrency group cannot cancel a normal Pages run. The exact cache key must match;
there is no fallback to a different run. The export packages allowed cache paths
and checks every source-file hash before/after, with no source modifications.

With specific user approval, the branch was pushed and read-only export run
37899846878 succeeded. The normal build job was skipped; no cache was saved and
no public deployment occurred. It exported the scoped old source, not a repaired
cache, and does not resolve the scoped MAIN import release blocker above.

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
Whole-universe official verification/migration are no longer planned or needed
for this repair. Scoped official verification and isolated migration HAVE run,
as documented below. Neither the original local dataset nor the public dataset
has been repaired in place.

## Approved Scoped Execution On October 9

- Read-only export run: https://github.com/yasuyuki924/kabu_doragon/actions/runs/37899846878
- Source cache: `kabu-pages-data-Linux-main-37816788603`, latest date 2026-10-08.
- Export artifact: `split-cache-source-37899846878`, ID 11602235820.
- Archive SHA256: `9d168b2137d4561ffcc719efb585e42c5f45e0b240b75952e6d6f7f9b6931c42`.
- 884 source files verified unchanged. All 57 exported charts exactly matched
  the previously downloaded, fixed successful Pages artifact.
- Every exported raw history spans 2025-04-14 through 2026-10-08 (354-363 rows).
  All 53 target raw-history date/gap checks passed. Representative raw and
  adjusted histories have 243 recent-year rows and maximum six-day gaps.
- Official inventory: 53 by-code requests, full retained-date factor coverage.
  All 53 have the 2026-09-29 event. 4062 additionally has a 2025-12-29 split;
  this is the same approved target code, not an expansion of repair scope.
- Isolated candidate: `.tmp/split-53-official-candidate/`.
- Exactly 53 adjusted histories/charts changed. Raw files remained byte-identical.
  590 retained overview files contain 31,233 repaired target records.
- `check_split_adjustment.py --require-state --public` passed for exactly 53
  codes against the completed official inventory. Certification does not cover
  other stocks or claim the daily postcheck passed.
- 4667 and 278A rendered at 1440x1000 and 390x844 without JavaScript page errors;
  screenshots and canvas checks are in the candidate directory.
- Existing `check_ohlcv_integrity.py --check-raw`: PASS before and after.
  8301 is intentionally absent from this bounded export and remains warn-only.
- Existing `check_daily_update_result.py`: FAIL before and after, exclusively
  the eight representative raw/adjusted 363-versus-1,200 row-count checks.
  Representative public charts have 245 rows ending 2026-10-08; overview index
  coverage passed. No threshold was changed and no extra history was fetched.
- The 31 focused tests passed again during this execution.
- Independent comparison checked all 590 overview files: 2,138,745 unrelated
  records and the complete original record order were unchanged. All 884 source
  hashes were unchanged, and 135 non-target files were byte-identical in the
  candidate. Raw files for all 57 exported codes were byte-identical.
- 19,224 adjusted OHLCV rows were independently checked using the official
  factors. 391 conditional numeric fields cleared with an inactive detector:
  390 false crash/pullback fields and the one 285A historical base field below.
  No other previously numeric indicator became null.
- An isolated restored-cache simulation passed for all 53 codes, including
  byte-identical repeated updates and rejection of missing metadata. Its
  simulated 2026-10-09 rows were deleted with the temporary directory; they are
  not actual market data and never entered the source or candidate dataset.
- `release_gate.json` beside the candidate explicitly records
  `blocked_for_publication`. This branch remains unmerged and main remains
  `36d7ad3d3c97403a6efd7f5f05787934eaface84` at the final remote check.

### Conditional Signals And Rounding Review

Correcting splits removes false crash/pullback signals, so conditional fields
may legitimately become null when their detector becomes false. For example,
3106 on 2026-09-30 previously reported an approximately 81-percent drop between
September 28 and 29; the adjusted data removes that split-induced false signal.
This is not missing price history. The strategy algorithms were not changed.

A separate sensitivity was reproduced for 285A on 2025-05-07: its original
13-day base range is exactly 12 percent. Dividing prices by three and rounding
to the existing four-decimal OHLCV precision changes the computed range to
12.000000685714324 percent, crossing the unchanged `<= 12` test. Exact scaling
without that rounding retains the base. The historical score therefore differs
in the candidate. This is a release review item, not an approved strategy change.

One lower-impact option for review is preserving pre-split historical overview
snapshots and repairing only snapshots from September 29 onward, while keeping
the adjusted chart history correct. This option has NOT been implemented.
Do not change strategy thresholds globally or silently preserve obsolete
post-split false signals. The retention-check policy and scoped cache import
also need explicit resolution before merging or publishing this branch.
