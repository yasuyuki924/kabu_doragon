# KabuDragon OHLCV Backup Repair

- generatedAt: 2026-05-08T18:52:17+09:00
- backup: `/Users/okamoto/Library/CloudStorage/GoogleDrive-yasuyuki924@gmail.com/マイドライブ/KabuDragon_Backup/2026-05-06_lightweight_archive/tickers_20260506.tar.gz`
- currentOhlcvDir: `/Users/okamoto/My Project/kabu_doragon/data/ohlcv`
- ohlcvRawDir: `/Users/okamoto/My Project/kabu_doragon/data/ohlcv_raw`
- dryRunOnly: `false`
- apply: `true`
- fixRaw: `true`
- backupMaxDate: `2026-05-01`
- targetDate: `2026-05-08` (derived from manifest.json)

## Summary

- targetDate: `2026-05-08`
- targetCodes: `3797`
- backupCodes: `3791`
- currentCodes: `3787`
- mergeableCodes: `3781`
- backupHasBackupMaxDate: `3718`
- currentHasTargetDate: `3730`
- mergedHasBackupMaxDate: `3718`
- mergedHasTargetDate: `3730`
- mergedDuplicateDateCodes: `0`
- mergedRowsIncreasedCodes: `10`
- missingBackupCodes: `6`
- missingCurrentCodes: `10`
- backupParseErrors: `0`
- backupEmptyCodes: `0`
- currentEmptyCodes: `0`
- totalCurrentRows: `4458243`
- totalMergedRows: `4469442`
- maxRowIncrease: `1261`
- maxRowIncreaseCode: `6565`
- wouldWriteOhlcvCodes: `3781`
- appliedOhlcvCodes: `3781`
- appliedRawCodes: `3781`
- touchedOhlcvRaw: `True`
- rebuiltPublicJson: `True`
- publicJsonBuildSeconds: `827.998`

## Problem Samples

- merged_missing_2026-05-01: 8045, 3961, 2389, 7467, 6734, 3541, 7105, 7739, 8209, 8225, 4705, 6406, 5945, 7450, 5969, 7368, 5990, 8025, 7718, 7923
- merged_missing_2026-05-08: 5533, 9087, 3961, 2389, 7467, 6734, 3541, 7105, 9818, 7739, 8209, 137A, 6943, 6406, 1992, 7450, 7718, 7923, 2961, 7857
- missing_backup: 3526, 5596, 7445, 7817, 9600, 9776
- missing_current: 202A, 3541, 3902, 4690, 5259, 6565, 7092, 7105, 7739, 8209
- no_row_increase: 6523, 6489, 3371, 6173, 2999, 2130, 7762, 6870, 7277, 2425, 9793, 8881, 6466, 3664, 6036, 9639, 5533, 8301, 9843, 4772

## Decision Notes

- Apply is limited to codes present in both backup and current `data/ohlcv`.
- Duplicate dates are resolved by keeping the current `data/ohlcv` row.
- `merge_rows` preserves ALL current dates (no date is dropped).
- This run did not restore `data/tickers` or `data/overview`.
- `--fix-raw` was used: backup-sourced (already adjusted) rows were written to `data/ohlcv_raw`.
  Codes with corporate-action events may be double-adjusted on the next incremental update.
  This is an acceptable trade-off to fix the 1052-day gap in `data/ohlcv_raw`.
