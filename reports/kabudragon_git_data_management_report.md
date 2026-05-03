# KabuDragon Gitデータ管理方針レポート

## 1. 結論

- Git管理から外すべきものは、`data/tickers`, `data/overview`, `data/daily_records`, `data/rankings`, `data/cache`, `data/ohlcv`, `data/ohlcv_raw` などの生成・取得データです。現在、`data` 配下だけで追跡済みファイルが `17,964` 件、作業ツリー上の追跡済み容量が `31,198,700,962 bytes` あります。
- Git管理に残すべきものは、`src/`, `assets/`, `scripts/`, HTML, `reports/`, README、小さい設定ファイル、必要最小限の小さいサンプルデータです。
- すぐやるべきことは、次フェーズで `.gitignore` に生成データ除外ルールを追加し、`git rm --cached` で追跡解除する準備をすることです。
- まだやらないことは、データ削除、`git rm` 実行、Git履歴掃除、`git filter-repo`、既存データの移動・圧縮です。履歴掃除はバックアップと合意後の別タスクに分けるべきです。

## 2. 現在のGit管理状況

| 対象 | Git管理状態 | 容量 | ファイル数 | コメント |
|---|---|---:|---:|---|
| `data/tickers` | 追跡済み | 22,137,278,197 bytes | 3,791 | 最大の肥大化要因。詳細ページfallback用には残すがGit管理対象から外す候補 |
| `data/overview` | 一部追跡済み | 4,257,086,722 bytes | 270 | 267件、4,197,829,588 bytes が追跡済み。巨大overview JSONが多い |
| `data/daily_records` | 一部追跡済み | 4,219,580,445 bytes | 262 | 259件、4,161,762,091 bytes が追跡済み |
| `data/rankings` | 一部追跡済み | 269,897,395 bytes | 1,492 | 1,476件、266,279,925 bytes が追跡済み |
| `data/ohlcv` | 追跡済み | 200,203,207 bytes | 3,797 | 元データに近いCSVだが生成/取得データ扱い。Git管理から外す候補 |
| `data/ohlcv_raw` | 追跡済み | 199,086,937 bytes | 3,790 | raw取得データ。Git管理から外す候補 |
| `data/public_json` | 未追跡 | 130,544,815 bytes | 3,798 | 第5段階生成物。`.gitignore` 未設定のため誤追加リスクあり |
| `data/public_json_test` | 未追跡 | 771,537,652 bytes | 22,783 | PoC生成物。`.gitignore` 未設定のため誤追加リスクあり |
| `data/warehouse_test` | 未追跡 | 220,342,286 bytes | 8 | Parquet/DuckDB PoC生成物。`.gitignore` 未設定のため誤追加リスクあり |
| `data/cache` | 追跡済み | 32,472,864 bytes | 3,755 | cache名どおりGit管理から外す候補 |
| `*.parquet` | 未追跡 | 約46 MB | 6 | `data/warehouse_test/prices_by_year` 配下。Git管理対象外にすべき |
| `*.duckdb` | 未追跡 | 約166 MB | 1 | `data/warehouse_test/kabudragon_test.duckdb`。Git管理対象外にすべき |
| `data/market_summary.json` | 追跡済み | 1,719,453 bytes | 1 | 小さめだが生成物なら除外候補 |
| `data/watchlist.json` | 追跡済み | 1,388,768 bytes | 1 | アプリ初期データとして残すか要判断 |
| `.git` | Git内部 | 5.8 GB | - | `git count-objects` では pack が 5.83 GiB。過去の巨大データ混入可能性が高い |

補足:

- `git ls-files '*.parquet'` は `0` 件、`git ls-files '*.duckdb'` は `0` 件でした。
- `git ls-files -o --exclude-standard '*.parquet'` は `6` 件、`*.duckdb` は `1` 件でした。
- 追跡済み `data/**/*.json` は `10,362` 件、追跡済み `data/**/*.csv` は `7,587` 件です。
- 大きい追跡済みファイル上位は `data/overview/*/market_pulse*.json` が多く、1ファイル約20MB級です。

## 3. .gitignore 現状

現在除外されている主なもの:

```gitignore
__pycache__/
*.py[cod]
.env
.venv/
.tmp/
logs/
output/
*.log
.DS_Store
.pytest_cache/
.mypy_cache/
data/intraday/*.json
data/update_state.json
data/current_snapshot_state.json
```

不足している除外項目:

- `data/tickers/`
- `data/overview/`
- `data/daily_records/`
- `data/rankings/`
- `data/cache/`
- `data/public_json/`
- `data/public_json_test/`
- `data/warehouse/`
- `data/warehouse_test/`
- `data/ohlcv/`
- `data/ohlcv_raw/`
- `*.parquet`
- `*.duckdb`
- 巨大な生成JSON/CSV全般

## 4. 推奨 .gitignore 案

今回は変更せず、案だけ提示します。

```gitignore
# Generated / fetched market data
data/tickers/
data/overview/
data/daily_records/
data/rankings/
data/cache/
data/public_json/
data/public_json_test/
data/warehouse/
data/warehouse_test/
data/ohlcv/
data/ohlcv_raw/

# Warehouse / database artifacts
*.parquet
*.duckdb

# Runtime state and generated summaries
data/update_state.json
data/current_snapshot_state.json
data/update_health.json
data/update_summary.json
data/update_quality_gate*.json
data/retry_pending.json
```

残す候補:

- `data/watchlist.json` はアプリ初期銘柄リストとして必要なら残す候補です。
- `data/manifest.json`, `data/jquants_sync_state.json`, `data/theme_map.json` は小さいため、運用上共有したいかどうかで判断します。
- `data/tse_listed_components.csv`, `data/nikkei225_components.csv` は小さいマスタ/サンプルとして残す候補です。

## 5. 既にGit管理されている巨大データの外し方

Step 1: バックアップ

- 作業前にプロジェクト全体または少なくとも `data/` と `.git/` をバックアップします。
- Google Drive同期中なら、同期停止またはローカル退避を検討します。

Step 2: `.gitignore` 更新

- 上記の生成データ除外案を `.gitignore` に追加します。
- 先に `.gitignore` だけを小さくレビューできるPR/commitに分けるのが安全です。

Step 3: `git rm --cached` で追跡解除

- データファイル自体は削除せず、Git indexからだけ外します。
- 例: `git rm --cached -r data/tickers data/overview data/daily_records data/rankings data/cache data/ohlcv data/ohlcv_raw`
- `data/public_json`, `data/public_json_test`, `data/warehouse_test` は現時点で未追跡なので、`.gitignore` 追加だけで十分です。

Step 4: 動作確認

- 通常URL、`?dataMode=legacy`、銘柄詳細ページ、J-Quants更新処理の読み込み先を確認します。
- データ実体はローカルに残っていることを `test -f` や画面表示で確認します。

Step 5: commit

- `.gitignore` と `git rm --cached` の結果だけをcommitします。
- 生成データの削除や圧縮は同じcommitに混ぜない方が安全です。

Step 6: 履歴掃除は別タスク

- `.git` の5.8GBは、過去コミットに巨大データが残っている可能性があります。
- 履歴掃除は通常の追跡解除とは別に、バックアップ後・チーム合意後に実施します。

## 6. Git履歴掃除の注意点

- `git filter-repo` は履歴を書き換えるため、リモートとの整合性に大きな影響があります。
- 既存ブランチ、他のworktree、PR、タグ、fork、ローカルcloneがすべて影響を受けます。
- 実行前にbare mirror backupと通常バックアップを作るべきです。
- 履歴掃除後はforce pushが必要になる可能性があり、共同作業者は再cloneまたはリベース対応が必要です。
- Git LFSへ移す場合も、既存履歴から消えるわけではないため、LFS化と履歴掃除は別問題です。
- 今回は絶対に実行しない方針で正しいです。まずは `.gitignore` と `git rm --cached` による将来肥大化の停止を優先すべきです。

## 7. 次に実装すべき最小タスク3つ

1. `.gitignore` に `data/public_json/`, `data/public_json_test/`, `data/warehouse_test/`, `*.parquet`, `*.duckdb`, 巨大生成ディレクトリを追加する。
2. `git rm --cached -r` で `data/tickers`, `data/overview`, `data/daily_records`, `data/rankings`, `data/cache`, `data/ohlcv`, `data/ohlcv_raw` を段階的に追跡解除する。
3. 追跡解除後に通常URL、`?dataMode=legacy`、銘柄詳細、J-Quants更新、public_json生成を確認し、データ実体が消えていないことを検証する。

今回は `.gitignore` 変更、`git rm`、履歴掃除、データ削除は実行していません。
