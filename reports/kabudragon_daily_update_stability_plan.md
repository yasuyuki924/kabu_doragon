# KabuDragon 日次更新安定化計画

作成日: 2026-05-07

---

## 1. 事故の概要と原因

### 発生事象

- `data/ohlcv` が一部の銘柄で欠損したまま `public_json` が再生成された
- フロントエンドで複数銘柄のチャートが「1本のローソク足」しか表示されなくなった
- 原因追跡・修復で大量のトークン/レートを消費した

### 根本原因

1. **差分更新スクリプトの実行前に `data/ohlcv` の健全性を確認していなかった**
   - 穴あきOHLCVのまま `public_json` 再生成が走り、不完全なJSONが生成された

2. **日次更新の入口が統一されていなかった**
   - AI判断によって異なるスクリプトが呼ばれることがあった
   - `run_update_and_build_public_json.sh`（旧5年更新）が誤って呼ばれるリスクがあった

3. **更新後の後確認（post-check）がなかった**
   - 更新後に `manifest.latestDate` や代表銘柄の `public_json` が正常かを確認していなかった

---

## 2. 新しい日次更新フロー

```
python3 scripts/kabu_daily_update.py
         │
         ├─ [1] レガシープロセス残存チェック
         │       └─ 旧更新が走っていたら即停止 (exit 3)
         │
         ├─ [2] OHLCV 整合性プリフライト
         │       └─ check_ohlcv_integrity.py 実行
         │       └─ 問題あれば即停止 (exit 2)
         │
         ├─ [3] manifest.latestDate 確認
         │       └─ 空なら即停止 (exit 1)
         │
         ├─ [4] run_incremental_public_json_update.sh 実行
         │       ├─ 最新なら [SKIP] で exit 0
         │       └─ 差分あれば J-Quants targetDate まで追いつき更新
         │
         └─ [5] 更新後ポストチェック
                 ├─ manifest.latestDate (更新後)
                 ├─ update_summary.json / update_health.json
                 ├─ 代表銘柄 public_json (last_date 確認)
                 ├─ [5b] check_ohlcv_integrity.py --check-raw
                 └─ [5c] check_daily_update_result.py  ← ohlcv+ohlcv_raw+public_json 行数・ギャップ確認
```

### 自動実行スケジュール（launchd）

| ジョブ | トリガー | 用途 |
|---|---|---|
| `incremental_update_catchup` | Mac起動/ログイン時 | 数日空き後の追いつき |
| `incremental_update_early` | 平日 16:40（月〜金） | 引け後速報 |
| `incremental_update_main` | 平日 18:30（月〜金） | 確定値更新 |

---

## 3. 使うコマンド一覧

### 日常運用

```bash
# 通常の日次更新（手動実行）
python3 scripts/kabu_daily_update.py

# OHLCV 健全性だけ確認したい（ohlcv + ohlcv_raw 両方）
python3 scripts/check_ohlcv_integrity.py --check-raw

# JSON サマリ出力
python3 scripts/check_ohlcv_integrity.py --check-raw --summary

# 更新後データ品質チェック（ohlcv + ohlcv_raw + public_json 行数・ギャップ確認）
python3 scripts/check_daily_update_result.py

# コミット前の staging area チェック
python3 scripts/preflight_guard.py
```

### ログ確認

```bash
# 当日の日次更新ログ
cat logs/daily_update_$(date +%Y%m%d).log

# 差分更新詳細ログ
cat logs/incremental_update_$(date +%Y%m%d).log

# catchup ジョブのログ
cat logs/incremental_update_catchup.out.log
tail -f logs/incremental_update_catchup.err.log

# early/main ジョブのログ
cat logs/incremental_update_early.out.log
cat logs/incremental_update_main.out.log
```

### launchd 状態確認

```bash
# 3本のジョブが登録されているか確認
launchctl list | grep kabu

# 正常状態:
# -   0   com.okamoto.kabu_doragon_incremental_update_catchup
# -   0   com.okamoto.kabu_doragon_incremental_update_main
# -   0   com.okamoto.kabu_doragon_incremental_update_early
# (第2列が 0 = 最後の実行が成功)
```

---

## 4. 失敗時に見るログ・対処フロー

### チャートが2本（または数本）になった

```bash
# 1. post-check で状況確認
python3 scripts/check_daily_update_result.py

# 2. OHLCV 健全性確認（ohlcv + ohlcv_raw 両方）
python3 scripts/check_ohlcv_integrity.py --check-raw --summary

# 3. ohlcv_raw に大穴が見つかった場合 → 修復
python3 scripts/repair_ohlcv_from_tickers_backup.py --dry-run --fix-raw
python3 scripts/repair_ohlcv_from_tickers_backup.py --apply --fix-raw

# 4. 修復後に再確認してから更新
python3 scripts/check_daily_update_result.py
python3 scripts/kabu_daily_update.py
```

### `launchctl list` で exit code が 1 になっている

```bash
# ジョブ名に応じてログを確認
cat logs/incremental_update_catchup.err.log
cat logs/incremental_update_early.err.log
cat logs/incremental_update_main.err.log
```

### `manifest.latestDate` が古い

```bash
# 差分更新を手動実行
python3 scripts/kabu_daily_update.py
# または
bash scripts/run_incremental_public_json_update.sh
```

### J-Quants 認証エラー

```bash
# .env の資格情報を確認
cat .env | grep JQUANTS
# または src/jquants_provider.py の load_auth_config 参照
```

---

## 5. 触ってはいけないもの（要約）

- `data/ohlcv/` — 削除・直接編集禁止
- `data/public_json/` — 削除禁止（スクリプト経由でのみ再生成）
- `scripts/run_update_and_build_public_json.sh` — 旧5年更新、実行禁止
- `git reset --hard` / `git clean -fd` — 禁止
- Google Drive バックアップ — 削除禁止

詳細は `PROTECTED_FILES.md` を参照。

---

## 6. 明日以降の確認方法

毎日18:30以降に以下を確認：

```bash
# 更新が成功しているか
cat logs/daily_update_$(date +%Y%m%d).log | grep '\[DONE\]\|\[ERROR\]\|\[SKIP\]'

# manifest が今日の日付になっているか
python3 -c "import json; d=json.load(open('data/manifest.json')); print(d['latestDate'])"

# ブラウザで銘柄詳細を確認
open http://127.0.0.1:8010/ticker.html?code=7203
```

launchd が正常動作していれば手動実行は不要です。

---

## 7. 関連スクリプト一覧

| スクリプト | 用途 |
|---|---|
| `scripts/kabu_daily_update.py` | 日次更新統一入口（これを使う） |
| `scripts/run_incremental_public_json_update.sh` | 差分更新実行（launchd / kabu_daily_update.py が呼ぶ） |
| `scripts/incremental_jquants_update.py` | J-Quants差分更新本体 |
| `scripts/check_ohlcv_integrity.py` | OHLCV整合性チェック（--check-raw で ohlcv_raw も確認） |
| `scripts/check_daily_update_result.py` | 更新後データ品質チェック（ohlcv+ohlcv_raw+public_json、2本化検出） |
| `scripts/preflight_guard.py` | コミット前staging確認 |
| `scripts/repair_ohlcv_from_tickers_backup.py` | OHLCV修復（障害時のみ、--fix-raw でohlcv_rawも修復） |
