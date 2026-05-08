# KabuDragon ohlcv_raw ギャップ修復計画

作成日: 2026-05-08

---

## 1. 事故の経緯

### 発生日時

- 2026-05-07 17:20 — incremental update 正常完了（manifest: 2026-05-01 → 2026-05-07）
- 2026-05-07 17:53 — `repair_ohlcv_from_tickers_backup.py --apply` 実行
  - `data/ohlcv/` を修復（3781件）
  - **`data/ohlcv_raw/` は `touchedOhlcvRaw: False` で未修復のまま**
- 2026-05-08 16:40 — incremental update 自動実行
  - `sync_prices` が `ohlcv_raw/` を正として `ohlcv/` を再生成
  - → `ohlcv/` が再び穴あき状態に戻る
  - チャートのローソク足が2本になる事故が再発

### ギャップの規模

| 項目 | 値 |
|---|---|
| 影響ファイル | `ohlcv_raw/` 3780件中 3505件（92%） |
| ギャップ期間 | 2023-06-20 〜 2026-05-07（1052日） |
| 代表銘柄の直近1年行数 | 2行（本来244行以上必要） |

---

## 2. 根本原因

`sync_prices`（`src/jquants_provider.py`）の設計：

```
existing_raw_rows = read_ohlcv_rows(ohlcv_raw/<code>.csv)   ← ここが穴あき
merged_raw_rows = merge_ohlcv_rows(existing_raw_rows, new_rows)
write_ohlcv_rows(ohlcv_raw/<code>.csv, merged_raw_rows)     ← 穴あきのまま保存
adjusted_rows = apply_corporate_actions(merged_raw_rows, events)
write_ohlcv_rows(ohlcv/<code>.csv, adjusted_rows)           ← ohlcv も穴あきに上書き
```

`ohlcv_raw/` が穴あきの場合、`ohlcv/` を手動修復しても翌日の自動更新で再破壊される。

---

## 3. 修復手順

### 前提

- Google Drive バックアップ (`tickers_20260506.tar.gz`) が参照可能であること
- ユーザーが Terminal から直接実行すること（Claude Code からは Google Drive 権限外）

### Step 1: dry-run で確認

```bash
cd "/Users/okamoto/My Project/kabu_doragon"
python3 scripts/repair_ohlcv_from_tickers_backup.py
# → reports/kabudragon_ohlcv_backup_repair_dry_run.md を確認
```

### Step 2: --apply --fix-raw で修復実行

```bash
cd "/Users/okamoto/My Project/kabu_doragon"
python3 scripts/repair_ohlcv_from_tickers_backup.py --apply --fix-raw
```

このコマンドが行うこと:
- バックアップから 2026-05-01 以前のデータを読み込む
- 現在の `ohlcv/` の全日付と merge（既存データは保持）
- 修復済み rows を `data/ohlcv/` に書き出し
- **同じ rows を `data/ohlcv_raw/` にも書き出し** ← 今回の新機能
- `public_json` を再生成

所要時間: 約15〜20分（3797銘柄の public_json rebuild を含む）

### Step 3: 整合性確認

```bash
# ohlcv と ohlcv_raw の両方を確認
python3 scripts/check_ohlcv_integrity.py --check-raw

# 詳細を JSON で確認
python3 scripts/check_ohlcv_integrity.py --check-raw --summary
```

期待する結果:
- 代表5銘柄で `[OK]` が返る
- `ohlcv` と `ohlcv_raw` の両方で `1y=244+` rows、`maxgap<=10d`

### Step 4: 翌日の自動更新後に再確認

```bash
# 翌日 18:30 以降に実行
python3 scripts/check_ohlcv_integrity.py --check-raw
```

`ohlcv_raw/` が修復済みであれば、自動更新後も `ohlcv/` は正常に維持される。

---

## 4. --fix-raw の注意点

`ohlcv_raw/` には本来「未調整の生データ」が入るべきだが、バックアップ
（`data/tickers/`形式）は既に株式分割等の調整済みデータである。

- **影響なし**: 修復期間（2023-06-21〜2026-05-01）に株式分割がなかった銘柄 → 大多数
- **二重調整のリスク**: 修復期間中に株式分割があった銘柄
  - `data/corporate_actions/` に対応イベントが記録されている場合
  - 次回 `sync_prices` 実行時に再調整が起きる可能性あり
  - 2026-05-08 の update_state では `adjustedCodes` は1件のみ

受け入れ可能なトレードオフとして、`--fix-raw` を採用する。

---

## 5. 今後の対策

### 即時対策（今回追加済み）

- `repair_ohlcv_from_tickers_backup.py` に `--fix-raw` オプション追加
- `check_ohlcv_integrity.py` に `--check-raw` オプション追加
  - `ohlcv` だけでなく `ohlcv_raw` の健全性も確認できる

### 中期対策（要検討）

- `kabu_daily_update.py` のプリフライトに `--check-raw` を追加し、
  `ohlcv_raw/` にギャップが検出された場合は更新前に警告を出す
- `sync_prices` で `ohlcv_raw/` の最終日が `ohlcv/` より古い場合、
  `ohlcv/` から補完して raw を修復するロジックの追加検討

---

## 6. 関連ドキュメント

- `reports/kabudragon_daily_update_stability_plan.md` — 日次更新安定化計画（2026-05-07）
- `PROTECTED_FILES.md` — 操作禁止ファイル一覧
- `DATA_SOURCE_LOCK.md` — データソースロック
