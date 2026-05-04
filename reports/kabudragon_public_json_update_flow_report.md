# KabuDragon public_json更新運用レポート

## 1. 結論

- J-Quants更新後の `public_json` 再生成は、新規の薄い運用スクリプト `scripts/run_update_and_build_public_json.sh` で行う方針にした。
- 既存のJ-Quants本番処理は大きく置き換えず、既存の `scripts/run_jquants_close_retry.sh` を先に実行し、成功後に `scripts/build_public_json_candidate.py` を呼ぶ。
- 手動実行コマンドは `bash scripts/run_update_and_build_public_json.sh` または `zsh scripts/run_update_and_build_public_json.sh`。
- 自動化候補は、現在のclose retry launchdの後段、または別launchdでこのラッパーを呼ぶ方式。
- 注意点として、現行の `build_public_json_candidate.py` は `data/warehouse_test/prices_by_year/` のParquetを入力にしている。J-Quants更新直後の完全同期には、次段階で `data/warehouse` を本番化し、J-Quants更新後にwarehouseも更新する必要がある。

## 2. 現在の更新フロー

- J-Quants取得:
  - `scripts/fetch_prices.py --provider jquants --universe tse --segments prime,standard,growth`
  - 内部では `src/jquants_provider.py` を呼び、`data/ohlcv` / `data/ohlcv_raw` 等の価格データを更新する。
- 既存JSON生成:
  - `scripts/run_daily.py --skip-fetch`
  - `src.app.daily_runner.build_daily_pipeline()` 経由で、overview、rankings、ticker JSON、manifest、summary系の派生JSONを生成する。
- close retry / quality gate:
  - `scripts/run_jquants_close_retry.sh`
  - precheck、fetch、derived JSON rebuild、missing/stale retry、`check_data_completeness.py` を順に実行する。
  - retry対象日は `jquants_sync_state.lastSuccessfulDate` 優先、fallbackで `manifest.latestDate` を使う。
- public_json生成の位置づけ:
  - 通常画面のチャート表示は `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を優先して読む。
  - `?dataMode=legacy` では従来の `data/tickers/{code}.json` を読む。
  - そのため、J-Quants更新後は通常画面用に `public_json` を再生成する運用が必要。

## 3. 追加したスクリプト

| ファイル | 役割 |
|---|---|
| `scripts/run_update_and_build_public_json.sh` | 既存J-Quants close retryフローを実行し、成功後に `build_public_json_candidate.py` を呼び、`public_json` の件数・代表銘柄・必須キーを検証する薄い運用ラッパー |

## 4. 実行方法

```bash
zsh scripts/run_update_and_build_public_json.sh
```

実行内容:

1. `scripts/run_jquants_close_retry.sh` を実行する。
2. 成功した場合のみ `scripts/build_public_json_candidate.py` を実行する。
3. `data/public_json/ticker_recent/1y/ohlcv_ma/` を検証する。
4. 総処理時間と `public_json` 生成時間をログに出す。

## 5. 検証内容

スクリプト内で以下を検証する。

- `data/public_json/ticker_recent/1y/ohlcv_ma/` が存在する。
- JSONファイル数が3,000件以上ある。
- 代表銘柄 `6327`, `7162`, `4772` のJSONが存在する。
- 代表銘柄の最新行に `date`, `open`, `high`, `low`, `close`, `volume`, `ma5`, `ma25`, `ma75`, `ma200` がある。
- `public_json` 生成時間をログに出す。

現在の既存 `public_json` 確認値:

- 出力先: `data/public_json/ticker_recent/1y/ohlcv_ma/`
- ファイル数: 3,797件以上
- 代表銘柄: `6327`, `7162`, `4772` は存在確認対象
- 容量目安: 約132MB
- 生成時間目安: 約11.49秒

## 6. 失敗時の対応

- J-Quants取得失敗:
  - `run_jquants_close_retry.sh` が非0で終了するため、`public_json` 生成へ進まない。
  - ログで precheck、fetch、retry、quality gate のどこで落ちたか確認する。
- public_json生成失敗:
  - `build_public_json_candidate.py` の例外で停止する。
  - 入力Parquet `data/warehouse_test/prices_by_year/year=*/prices.parquet` の存在と依存パッケージを確認する。
- 代表銘柄欠損:
  - 検証ステップが非0で停止する。
  - `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` の存在、入力warehouse側の銘柄有無を確認する。
- legacyモードへの戻し方:
  - 画面URLに `?dataMode=legacy` を付ける。
  - 一覧 / picked / registered のチャート描画は `data/tickers/{code}.json` 固定になる。

## 7. 次に実装すべき最小タスク3つ

1. `data/warehouse_test` ではなく本番用 `data/warehouse` を作り、J-Quants更新後にwarehouseへ差分追記する。
2. `build_public_json_candidate.py` に `--updated-codes` を追加し、全件生成ではなく更新銘柄だけ再生成できるようにする。
3. launchdまたは既存close retry後段で `scripts/run_update_and_build_public_json.sh` を呼ぶ運用に切り替え、ログ監視項目を追加する。

## 8. ローカル完成判定

- ブランチ名: `codex/kabudragon-warehouse-poc`
- 完成判定日: 2026-05-05
- 判定: ローカル完成扱いとしてよい。
- 作業ツリー: clean確認済み。
- `public_json` 件数: `data/public_json/ticker_recent/1y/ohlcv_ma/` に3,797件。
- 通常URLの挙動: 一覧 / picked / registered のチャート描画は `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を優先し、失敗時のみ `data/tickers/{code}.json` にfallbackする。
- legacyモードの挙動: `?dataMode=legacy` を付けると、チャート描画は従来どおり `data/tickers/{code}.json` 固定になる。
- 銘柄詳細ページの挙動: `assets/page_ticker.js` は従来どおり `loadTickerPayload(code)` を使い、`data/tickers/{code}.json` を読む。今回の軽量チャートJSON切替の対象外。
- 構文確認: `zsh -n scripts/run_update_and_build_public_json.sh` と `python3 -m py_compile scripts/build_public_json_candidate.py` は確認済み。
- 実データ: `data/tickers`, `data/overview`, `data/daily_records`, `data/rankings`, `data/ohlcv`, `data/ohlcv_raw`, `data/public_json` はローカルに残し、削除・移動・圧縮はしていない。

main merge前の注意点:

- `bf03f331 chore: stop tracking generated market data` には、巨大データ追跡解除以外の既存変更も含まれている。PR作成前に差分説明へ明記する。
- `data/tickers` などの削除差分はGit追跡解除であり、ローカル実データ削除ではない。別環境でpullする場合はデータ復元/再生成手順が必要。
- `.git` 履歴サイズはまだ小さくなっていない。履歴掃除は別ブランチ/別タスクで、バックアップ後に検討する。
- `build_public_json_candidate.py` は現時点で `data/warehouse_test/prices_by_year/` を入力にする。J-Quants更新直後の完全同期には、本番用 `data/warehouse` への移行が次段階で必要。

今後の次ブランチ候補:

1. `data/warehouse` 本番化とJ-Quants更新後の差分追記。
2. `build_public_json_candidate.py --updated-codes` による差分生成。
3. `data/tickers` など巨大JSONのarchive/backup運用設計。
4. Git履歴掃除の事前計画。ただし `git filter-repo` や `git gc` はこの軽量化ブランチでは実行しない。
