# KabuDragon OHLCV Backup Repair Dry Run

- generatedAt: 2026-05-07T18:08:54+09:00
- backup: `/Users/okamoto/Library/CloudStorage/GoogleDrive-yasuyuki924@gmail.com/マイドライブ/KabuDragon_Backup/2026-05-06_lightweight_archive/tickers_20260506.tar.gz`
- currentOhlcvDir: `/Users/okamoto/My Project/kabu_doragon/data/ohlcv`
- dryRunOnly: `false`
- apply: `true`
- backupMaxDate: `2026-05-01`
- targetDate: `2026-05-07`

## Summary

- targetCodes: `3797`
- backupCodes: `3791`
- currentCodes: `3787`
- mergeableCodes: `3781`
- backupHas20260501: `3718`
- currentHas20260507: `3748`
- mergedHas20260501: `3718`
- mergedHas20260507: `3748`
- mergedDuplicateDateCodes: `0`
- mergedRowsIncreasedCodes: `10`
- missingBackupCodes: `6`
- missingCurrentCodes: `10`
- backupParseErrors: `0`
- backupEmptyCodes: `0`
- currentEmptyCodes: `0`
- totalCurrentRows: `4454513`
- totalMergedRows: `4465712`
- maxRowIncrease: `1261`
- maxRowIncreaseCode: `6565`
- wouldWriteOhlcvCodes: `3781`
- appliedOhlcvCodes: `3781`
- touchedOhlcvRaw: `False`
- rebuiltPublicJson: `True`
- publicJsonBuildSeconds: `910.851`

## Problem Samples

- merged_missing_2026_05_01: 8045, 3961, 2389, 7467, 6734, 3541, 7105, 7739, 8209, 8225, 4705, 6406, 5945, 7450, 5969, 7368, 5990, 8025, 7718, 7923
- merged_missing_2026_05_07: 8301, 3961, 2389, 7467, 6734, 3541, 7105, 7739, 8209, 6406, 7450, 7718, 7923, 5352, 6293, 7420, 7565, 4333, 6565, 7250
- missing_backup: 3526, 5596, 7445, 7817, 9600, 9776
- missing_current: 202A, 3541, 3902, 4690, 5259, 6565, 7092, 7105, 7739, 8209
- no_row_increase: 6523, 6489, 3371, 6173, 2999, 2130, 7762, 6870, 7277, 2425, 9793, 8881, 6466, 3664, 6036, 9639, 5533, 8301, 9843, 4772

## Decision Notes

- Apply is limited to codes present in both backup and current `data/ohlcv`.
- Duplicate dates are resolved by keeping the current `data/ohlcv` row.
- This run did not restore `data/tickers` or `data/overview`.
- This run did not touch `data/ohlcv_raw`.
