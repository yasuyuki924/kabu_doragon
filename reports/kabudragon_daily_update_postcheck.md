# KabuDragon 日次更新後チェック 運用ガイド

作成日: 2026-05-08

---

## 1. なぜ自動更新後チェックが必要か

KabuDragonの日次更新は、J-Quantsから取得したデータを
`ohlcv_raw` → `ohlcv` → `public_json` の順に変換するパイプラインです。
パイプラインのいずれかの段階で欠損や破損があっても、
スクリプト自体はエラーを出さずに成功（exit 0）することがあります。

特に以下の状態は「更新が成功したように見えて壊れている」ため、
更新後に必ず確認する必要があります。

| 破損パターン | 症状 | 従来の検出方法 |
|---|---|---|
| ohlcv_raw に1000日超のギャップ | ローソク足が2本しか表示されない | なし（手動確認のみ） |
| ohlcv が ohlcv_raw から再生成で破壊 | チャートの途中から欠損 | なし |
| public_json の最終日が manifest と不一致 | 表示日付がずれる | なし |
| 直近1年のデータ本数が不足 | 移動平均が短くなる | なし |

---

## 2. 今日（2026-05-08）起きた不具合の原因

1. **前日（2026-05-07）** に `repair_ohlcv_from_tickers_backup.py --apply` で `ohlcv/` を修復
   - しかし `--fix-raw` オプションがなかったため `ohlcv_raw/` は未修復のまま
2. **本日（2026-05-08）** の自動更新で `sync_prices` が `ohlcv_raw/` を読み込み
   - `ohlcv_raw/7203.csv` には1052日ギャップ（2023-06-20〜2026-05-07）が残存
   - `sync_prices` は `ohlcv_raw/` に当日分を追記 → 523行の `ohlcv_raw/` が残存
   - これをもとに `ohlcv/` を再生成 → `ohlcv/7203.csv` も523行に劣化
   - `public_json` 再生成 → 2本のローソク足しかない JSON が生成

**核心:** `sync_prices` は `ohlcv_raw/` を正として `ohlcv/` を上書きする。
`ohlcv/` を修復しても `ohlcv_raw/` が壊れていれば翌日に再破壊される。

---

## 3. チェック項目

`scripts/check_daily_update_result.py` は以下を確認します。

### 3.1 状態ファイル確認

| ファイル | 確認項目 |
|---|---|
| `data/manifest.json` | `latestDate` の存在と値 |
| `data/update_summary.json` | `status` |
| `data/update_health.json` | `status` / `isHealthy` |
| `data/jquants_sync_state.json` | `lastSuccessfulDate` |

### 3.2 代表銘柄 ohlcv / ohlcv_raw チェック

対象: `6327`, `7162`, `7203`, `9983`

| チェック | 閾値 | NGの意味 |
|---|---|---|
| ファイル存在 | 必須 | データが消えた |
| 総行数 | ≥ 1,200行 | 5年分のうち大量のデータが消えた |
| 最終日からのラグ | ≤ 10日（対 manifest.latestDate） | 最新データが入っていない |
| 直近1年の行数 | ≥ 200行 | 直近1年にギャップがある |
| 最大連続ギャップ | ≤ 10日 | データに大穴がある（2本化の前兆） |

### 3.3 public_json チェック

| チェック | 閾値 | NGの意味 |
|---|---|---|
| 行数 | ≥ 100行 | 2本化バグ発生中（正常は約230行） |
| 最終日 | == manifest.latestDate | 最新データが公開されていない |

---

## 4. 正常時の出力例

```
[2026-05-08T18:32:01] [START] check_daily_update_result
[2026-05-08T18:32:01] manifest.latestDate=2026-05-08
[2026-05-08T18:32:01] update_summary.status=success
[2026-05-08T18:32:01] update_health.status=True
[2026-05-08T18:32:01] jquants.lastSuccessfulDate=2026-05-08
[2026-05-08T18:32:01]   --- 7203 ---
[2026-05-08T18:32:01]   ohlcv      [OK] rows=1264 last=2026-05-08 lag=0d 1y=244 maxgap=7d
[2026-05-08T18:32:01]   ohlcv_raw  [OK] rows=1264 last=2026-05-08 lag=0d 1y=244 maxgap=7d
[2026-05-08T18:32:01]   public_json[OK] rows=232 last=2026-05-08
...
[2026-05-08T18:32:02] [OK] all checks passed — manifest.latestDate=2026-05-08
```

---

## 5. 異常時の出力例

### ケース1: ohlcv_raw に大穴がある（2本化バグ）

```
[2026-05-08T16:42:03]   --- 7203 ---
[2026-05-08T16:42:03]   ohlcv      [NG] rows=523 last=2026-05-08 lag=0d 1y=2 maxgap=1052d
[2026-05-08T16:42:03]             ISSUE: too few rows: 523 < 1200
[2026-05-08T16:42:03]             ISSUE: too few recent rows (1y): 2 < 200
[2026-05-08T16:42:03]             ISSUE: large date gap: 1052d between 2023-06-20 and 2026-05-07
[2026-05-08T16:42:03]   ohlcv_raw  [NG] rows=523 last=2026-05-08 lag=0d 1y=2 maxgap=1052d
...
[2026-05-08T16:42:03]   public_json[NG] rows=2 last=2026-05-08
[2026-05-08T16:42:03]             ISSUE: CRITICAL: 2-candle bug? only 2 rows (expect 100+)
[2026-05-08T16:42:04] [FAIL] 9 issue(s) found — data may be corrupted:
[2026-05-08T16:42:04]   - ohlcv/7203: too few rows: 523 < 1200
...
[2026-05-08T16:42:04]   ACTION: python3 scripts/check_ohlcv_integrity.py --check-raw --summary
[2026-05-08T16:42:04]   ACTION: if ohlcv_raw has a gap → repair_ohlcv_from_tickers_backup.py --apply --fix-raw
```

---

## 6. ログの場所

| ログファイル | 内容 |
|---|---|
| `logs/daily_update_postcheck_YYYYMMDD.log` | post-check の実行結果（本スクリプトが出力） |
| `logs/daily_update_YYYYMMDD.log` | kabu_daily_update.py の全体ログ（postcheck も含む） |
| `logs/incremental_update_early.out.log` | launchd early ジョブのログ |
| `logs/incremental_update_main.out.log` | launchd main ジョブのログ |
| `logs/incremental_update_catchup.out.log` | launchd catchup ジョブのログ |

---

## 7. post-checkが呼ばれる場所

```
launchd → kabu_daily_update.py
  Step 4: run_incremental_public_json_update.sh
              └→ check_ohlcv_integrity.py --check-raw  (pre-flight ガード)
              └→ incremental_jquants_update.py
              └→ check_daily_update_result.py  ← ★ここで呼ばれる (exit 1 でブロック)
  Step 5: manifest/update_summary/update_health 確認
  Step 5b: check_ohlcv_integrity.py --check-raw (post)
  Step 5c: check_daily_update_result.py  ← ★ここでも呼ばれる (exit 1 で返す)
```

二重に呼ばれる設計になっています。これは意図的で、
`run_incremental_public_json_update.sh` が直接 launchd から呼ばれる移行期間中も
確実にチェックが実行されるようにするためです。

---

## 8. 来週以降の確認方法

### 通常の確認（毎日18:30以降）

```bash
# post-check ログを確認
cat logs/daily_update_postcheck_$(date +%Y%m%d).log | grep '\[OK\]\|\[FAIL\]\|\[START\]'

# または kabu_daily_update ログで確認
cat logs/daily_update_$(date +%Y%m%d).log | grep 'postcheck:\|DONE\|ERROR'
```

### 異常が検出された場合

```bash
# 1. 詳細なOHLCV整合性確認
python3 scripts/check_ohlcv_integrity.py --check-raw --summary

# 2. ohlcv_raw に問題がある場合は修復
python3 scripts/repair_ohlcv_from_tickers_backup.py --dry-run --fix-raw
python3 scripts/repair_ohlcv_from_tickers_backup.py --apply --fix-raw

# 3. 修復後に再確認
python3 scripts/check_daily_update_result.py

# 4. 問題なければ手動でpublic_json更新
python3 scripts/kabu_daily_update.py
```

### launchd の実行結果確認

```bash
# ジョブの最終終了コードを確認（0 = 成功、非0 = 失敗）
launchctl list | grep kabu_doragon_incremental

# post-check でNGが出ると exit 1 になるため、ここで検出できる
```

---

## 9. 閾値の根拠

| 閾値 | 値 | 根拠 |
|---|---|---|
| `MIN_OHLCV_ROWS` | 1,200行 | ~5年×250日=1,250日。200行余裕を見て1,200 |
| `MIN_RECENT_1Y_ROWS` | 200行 | 1年≈250取引日。連休や停止分を引いて200 |
| `MIN_PUBLIC_JSON_ROWS` | 100行 | 1y表示は通常230行前後。100未満は明らかな2本化バグ |
| `MAX_GAP_DAYS` | 10日 | GW（最大5連休）や年末年始を考慮して10日 |
| `MAX_STALE_DAYS` | 10日 | 同上。10日超は更新が失敗している |

---

## 10. 関連ファイル

| ファイル | 役割 |
|---|---|
| `scripts/check_daily_update_result.py` | 本post-checkスクリプト |
| `scripts/check_ohlcv_integrity.py` | 既存のOHLCV整合性チェック（--check-rawで両方確認） |
| `scripts/kabu_daily_update.py` | 日次更新統一入口（Step 5cでpost-checkを呼ぶ） |
| `scripts/run_incremental_public_json_update.sh` | 差分更新スクリプト（末尾でpost-checkを呼ぶ） |
| `scripts/repair_ohlcv_from_tickers_backup.py` | OHLCV修復（--fix-rawでohlcv_rawも修復） |
| `PROTECTED_FILES.md` | データ更新の絶対ルール |
| `reports/kabudragon_ohlcv_raw_repair_plan.md` | ohlcv_raw修復手順 |
