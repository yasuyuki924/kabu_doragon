# KabuDragon 差分更新フロー設計・実装レポート

## 1. 結論
- 既存の `scripts/run_update_and_build_public_json.sh` は `scripts/run_jquants_close_retry.sh` 経由で `scripts/fetch_prices.py` を呼び、内部で `src/jquants_provider.py --history-years 5 --chunk-days 180` が走るため、毎回5年分相当の同期判定に戻りやすい。
- 新規に `scripts/run_incremental_public_json_update.sh` と `scripts/incremental_jquants_update.py` を追加し、`manifest.latestDate` と J-Quants の `targetDate` を比較して、差分がある場合だけ日付範囲指定で `sync_prices()` を呼ぶ構成にした。
- 新フローは `history-years 5` を呼ばず、`manifest.latestDate` の翌営業日から `targetDate` までのJ-Quants営業日だけを対象にする。
- 既存の重い更新フローは削除・置換していない。既存フローと新フローは用途を分けて併用する。

## 2. 既存更新が重い理由
- `run_update_and_build_public_json.sh` は最初に `run_jquants_close_retry.sh` を実行する。
- `run_jquants_close_retry.sh` は未反映時に `scripts/fetch_prices.py --provider jquants --universe tse --segments prime,standard,growth` を呼ぶ。
- `fetch_prices.py` はJ-Quantsの場合、`src/jquants_provider.py --history-years 5 --chunk-days 180` を組み立てる。
- そのため、単に `2026-05-01` から `2026-05-07` へ進めたいだけでも、5年分履歴同期の入口に入り、ネットワーク待ちやAPI待ちで長時間止まって見えることがある。
- また、途中で `corporate_actions`, `inactive_codes`, `watchlist` などの小さいdataファイルだけが更新され、価格・public_json更新まで到達しないケースがある。

## 3. 新しい差分更新フロー
実行コマンド:

```sh
zsh scripts/run_incremental_public_json_update.sh
```

動作:
- `.venv/bin/python` を使って `scripts/incremental_jquants_update.py` を実行する。
- ログは `logs/incremental_update_YYYYMMDD.log` に残す。
- 既存の重い更新プロセスが残っている場合は、デフォルトでは実行を拒否する。
- `manifest.latestDate` と J-Quants `targetDate` を比較する。
- `targetDate <= manifest.latestDate` なら `[SKIP] already up to date` として終了する。
- `targetDate > manifest.latestDate` の場合だけ差分更新へ進む。

## 4. manifest.latestDate と targetDate の比較方法
- `manifest.latestDate` は `data/manifest.json` から読む。
- J-Quants `targetDate` は既存の `load_auth_config()`, `build_client()`, `resolve_latest_trading_date()` を使って取得する。
- 差分期間は `manifest.latestDate + 1日` から `targetDate` までをJ-Quantsカレンダーで営業日に絞る。
- 実際の取得開始日は、その営業日リストの先頭日とする。

## 5. 差分なし時の動き
例:

```text
manifest.latestDate=2026-05-07
jquants.targetDate=2026-05-07
[SKIP] already up to date
```

この場合、価格CSVやpublic_jsonは更新しない。

## 6. 差分あり時の動き
例:

```text
manifest.latestDate=2026-05-01
jquants.targetDate=2026-05-07
mode=incremental
dateRange=2026-05-07..2026-05-07
fetch=OK
build_public_json=OK
manifest.latestDate=2026-05-07
[OK] incremental update completed
```

主な処理:
- `sync_prices(client, api_version, paths, codes, start_date, end_date, chunk_days=1)` を直接呼ぶ。
- `history-years 5` は使わない。
- `data/ohlcv_raw` と `data/ohlcv` を差分追記・マージする。
- `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を `data/ohlcv` CSVから再生成する。
- `data/public_json/ticker_detail_recent/1y/{code}.json` を同じく `data/ohlcv` CSVから再生成する。
- `data/public_json/overview_lite/{targetDate}/market_pulse.json` を作成する。
- `data/manifest.json`, `data/update_state.json`, `data/jquants_sync_state.json`, `data/update_summary.json`, `data/update_health.json` を更新する。

## 7. 既存重い更新フローとの使い分け
- 通常の日次更新: `zsh scripts/run_incremental_public_json_update.sh`
- 大きな欠損復旧、過去データ再取得、マスタ再構築: 既存の `zsh scripts/run_update_and_build_public_json.sh`
- `data/tickers` / `data/overview` を復元して旧形式まで完全再生成したい場合: 既存重いフローまたは別復旧タスクで扱う。

## 8. 失敗時のログ確認方法
- まず `logs/incremental_update_YYYYMMDD.log` を確認する。
- `data/update_health.json` の `status` と `details.reason` を確認する。
- `data/update_summary.json` の `status`, `date`, `details` を確認する。
- 既存の重い更新が残っている場合は、新フローは `legacy update process is running` と出して止まる。

## 9. launchdに組み込む場合の案
- 既存のclose retry agentをすぐ置き換えず、まず手動で数回確認する。
- 問題なければ launchd の実行先を `scripts/run_incremental_public_json_update.sh` に差し替える。
- 失敗時に旧フローへ自動fallbackするかどうかは別途検討する。自動fallbackすると重い5年分取得に戻るため、最初は手動判断が安全。

## 10. まだ残る課題
- 実行中の旧 `fetch_prices.py` / `jquants_provider.py` が残っている場合、新フローは衝突回避のため実行しない。
- `ticker_meta` は既存public_jsonを前提にする。新規上場銘柄のmeta追加は、別途マスタ更新・軽量meta生成が必要。
- `overview_lite` はtargetDateの日次 `market_pulse.json` を生成するが、weekly/monthlyのoverview_lite生成は今回対象外。
- `build_public_json_candidate.py` はまだ `warehouse_test` Parquet入力のままなので、差分更新フローでは直接使わない。
- Git管理対象の小さい `corporate_actions` が旧更新途中で変更されることがあるため、旧プロセス残存時の扱いは別途整理が必要。

## 11. 確認コマンド
```sh
zsh -n scripts/run_incremental_public_json_update.sh
python3 -m py_compile scripts/incremental_jquants_update.py
git diff --check
```

## 12. commit候補
候補メッセージ:

```text
feat: add incremental J-Quants public_json update flow
```
