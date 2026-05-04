# KabuDragon data圧縮退避・整理レポート

## 1. 実行概要

- 実行日: 2026-05-05
- ブランチ名: `codex/kabudragon-warehouse-poc`
- 目的: `public_json` 軽量運用後に不要度が高い大容量生成データを圧縮退避し、安全な範囲だけローカルから削除する。
- 実行しなかったこと: `data/tickers` 削除、`data/public_json` 削除、`data/warehouse_test` 削除、`data/ohlcv` / `data/ohlcv_raw` 削除、GitHub push、main merge、`git gc`、`git filter-repo`、Git履歴掃除。

## 2. サイズ変化

| 対象 | 作業前 | 作業後 | コメント |
|---|---:|---:|---|
| `data/` 全体 | 30G | 21G | 約9G削減 |
| `data/tickers` | 21G | 21G | 削除せず保持 |
| `data/public_json` | 132M | 132M | 通常画面用に保持 |
| `data/warehouse_test` | 210M | 210M | `build_public_json_candidate.py` の入力候補として保持 |
| `data/ohlcv` | 198M | 198M | 正式データ/再生成元候補として保持 |
| `data/ohlcv_raw` | 197M | 197M | raw取得データとして保持 |

削除した対象の作業前サイズ:

| 対象 | 作業前サイズ |
|---|---:|
| `data/public_json_test` | 782M |
| `data/overview` | 4.0G |
| `data/daily_records` | 3.9G |
| `data/rankings` | 260M |

## 3. 圧縮退避した対象

退避先: `~/Desktop/kabu_doragon_data_archive/`

| アーカイブ | 元ディレクトリ | サイズ | 確認 |
|---|---|---:|---|
| `public_json_test_20260505.tar.gz` | `data/public_json_test` | 139M | `tar -tzf` で中身確認済み |
| `overview_daily_records_rankings_20260505.tar.gz` | `data/overview`, `data/daily_records`, `data/rankings` | 867M | `tar -tzf` で中身確認済み |
| `warehouse_test_20260505.tar.gz` | `data/warehouse_test` | 105M | `tar -tzf` で中身確認済み |

## 4. 削除した対象

以下は圧縮退避とアーカイブ確認が成功した後に削除した。

- `data/public_json_test`
- `data/overview`
- `data/daily_records`
- `data/rankings`

いずれもGit追跡0件で、`.gitignore` 対象。

## 5. 削除しなかった対象

- `data/tickers`: 銘柄詳細ページと `?dataMode=legacy` がまだ依存しているため保持。
- `data/public_json`: 通常URLの一覧 / picked / registered チャートが優先利用するため保持。
- `data/warehouse_test`: 現行 `scripts/build_public_json_candidate.py` が `data/warehouse_test/prices_by_year/` を入力にするため保持。
- `data/ohlcv`, `data/ohlcv_raw`: 正式データ/再生成元候補のため保持。
- `data/cache`: 今回の削除対象外。
- `data/corporate_actions`, `tse_listed_components.csv`, `nikkei225_components.csv`, `theme_map.json` などの小さいマスタ類: Git管理対象または小容量のため保持。

## 6. Git管理状態

- `data/tickers`, `data/overview`, `data/daily_records`, `data/rankings`, `data/ohlcv`, `data/ohlcv_raw`, `data/public_json`, `data/public_json_test`, `data/warehouse_test` はGit追跡0件。
- 上記大容量ディレクトリは `.gitignore` 対象。
- 削除した4ディレクトリはGit追跡対象外だったため、削除後の `git status --short` には出ていない。
- 今回新規にGit差分として残るのは、このレポートのみ。

## 7. 動作確認結果

存在確認:

- `data/public_json`: OK
- `data/tickers`: OK
- `data/warehouse_test`: OK
- `scripts/build_public_json_candidate.py`: OK
- `scripts/run_update_and_build_public_json.sh`: OK

構文確認:

- `zsh -n scripts/run_update_and_build_public_json.sh`: OK
- `python3 -m py_compile scripts/build_public_json_candidate.py`: OK

削除確認:

- `data/public_json_test`: 削除済み
- `data/overview`: 削除済み
- `data/daily_records`: 削除済み
- `data/rankings`: 削除済み

## 8. 次フェーズ候補

1. `data/warehouse_test` を本番用 `data/warehouse` へ昇格し、J-Quants更新後に差分追記する。
2. `scripts/build_public_json_candidate.py` に `--updated-codes` を追加し、全件生成ではなく更新銘柄だけ再生成する。
3. 銘柄詳細ページを軽量化し、`data/tickers` 依存を減らす。
4. `data/tickers` の圧縮退避と削除可否を、詳細ページ/legacy依存解消後に再判断する。
5. Git履歴掃除は別タスクとして、完全バックアップ後に検討する。
