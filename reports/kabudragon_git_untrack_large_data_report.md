# KabuDragon 巨大データGit追跡解除レポート

## 1. 結論

- `.gitignore` に生成データ、warehouse成果物、DB/圧縮アーカイブ系の除外ルールを追加した。
- `git rm --cached --sparse -f -r` により、巨大な生成データをGitの追跡対象から外した。実ファイルは削除していない。
- 追跡解除した主対象は `data/tickers`, `data/overview`, `data/daily_records`, `data/rankings`, `data/ohlcv`, `data/ohlcv_raw`。
- `data/public_json`, `data/public_json_test`, `data/warehouse_test`, `*.parquet`, `*.duckdb` は今後誤追加されないよう `.gitignore` で保護した。
- 今回やっていないこと: 実データ削除、移動、圧縮、`git filter-repo`、`git gc`、Git履歴掃除、J-Quants処理変更、画面変更。
- 重要: commit後もローカルにはデータが残るが、別PCでpullしてもGit管理外データは取得されない。外付けSSD、Google Driveの圧縮バックアップ、または再生成手順を別途用意する必要がある。

## 2. .gitignore 追加内容

| パターン | 理由 |
|---|---|
| `data/tickers/` | 銘柄別の巨大JSON生成物。Git管理ではなくローカル/バックアップ管理にするため。 |
| `data/overview/` | 日次overview派生JSON。再生成可能な巨大データのため。 |
| `data/daily_records/` | 日次/週次/月次の派生JSON。再生成可能で容量が大きいため。 |
| `data/rankings/` | ランキング派生JSON。再生成可能で日次増加するため。 |
| `data/warehouse/` | 今後の正式warehouse候補。Parquet/DuckDB等の生成データをGitに入れないため。 |
| `data/warehouse_test/` | PoC成果物。再生成可能で容量が大きいため。 |
| `data/public_json/` | 本番候補の軽量表示用JSON。生成物として扱うため。 |
| `data/public_json_test/` | PoC表示用JSON。再生成可能な検証成果物のため。 |
| `data/cache/` | キャッシュ生成物。Gitで共有すべきでないため。 |
| `data/archive/` | 将来の圧縮/退避アーカイブ候補。巨大化しやすいため。 |
| `*.parquet` | warehouse列指向データ。巨大化しやすく再生成可能なため。 |
| `*.duckdb` | DuckDBファイル。巨大化しやすくローカル管理向きのため。 |
| `*.db` | DBファイル一般を誤追加しないため。 |
| `*.sqlite` | SQLiteファイルを誤追加しないため。 |
| `*.sqlite3` | SQLite3ファイルを誤追加しないため。 |
| `*.json.gz` | 圧縮JSONアーカイブを誤追加しないため。 |
| `*.tar.gz` | 圧縮アーカイブを誤追加しないため。 |

## 3. Git追跡解除対象

| 対象 | 追跡解除前のGit管理状態 | 容量 | ファイル数 | 実ファイル残存確認 |
|---|---|---:|---:|---|
| `data/tickers` | 追跡あり | 22.14GB | 3,791 | 残存確認済み |
| `data/overview` | 追跡あり | 4.26GB | 270 | 残存確認済み |
| `data/daily_records` | 追跡あり | 4.22GB | 262 | 残存確認済み |
| `data/rankings` | 追跡あり | 269.90MB | 1,492 | 残存確認済み |
| `data/ohlcv` | 追跡あり | 200.20MB | 3,797 | 残存確認済み |
| `data/ohlcv_raw` | 追跡あり | 199.09MB | 3,790 | 残存確認済み |
| `data/cache` | 追跡対象外化/ignore対象 | 32.47MB | 3,755 | 残存確認済み |

補足:

- `data/ohlcv` と `data/ohlcv_raw` は株価データ本体に近いが、ユーザー方針に合わせてGit管理ではなくローカル/バックアップ管理の候補として追跡解除した。
- `data/public_json`, `data/public_json_test`, `data/warehouse_test` は現時点でGit追跡数0件で、`.gitignore` により今後の誤追加を防ぐ状態にした。

## 4. git status 確認

- `git status` 上では、対象データが大量の staged deletion として表示される。これは `git rm --cached` による追跡解除であり、ローカル実ファイル削除ではない。
- staged deletion の確認結果は合計 12,730 件。
- 内訳:
  - `data/tickers`: 3,778 件
  - `data/overview`: 213 件
  - `data/daily_records`: 205 件
  - `data/rankings`: 973 件
  - `data/ohlcv`: 3,784 件
  - `data/ohlcv_raw`: 3,777 件
- `.gitignore` は未コミットの変更として表示される。
- 本レポート `reports/kabudragon_git_untrack_large_data_report.md` を新規作成した。

## 5. 実ファイル残存確認

| 対象 | ファイル数 | 容量 | コメント |
|---|---:|---:|---|
| `data/tickers` | 3,791 | 22.14GB | 実ファイル残存。Git追跡は0件。 |
| `data/overview` | 270 | 4.26GB | 実ファイル残存。Git追跡は0件。 |
| `data/daily_records` | 262 | 4.22GB | 実ファイル残存。Git追跡は0件。 |
| `data/rankings` | 1,492 | 269.90MB | 実ファイル残存。Git追跡は0件。 |
| `data/ohlcv` | 3,797 | 200.20MB | 実ファイル残存。Git追跡は0件。 |
| `data/ohlcv_raw` | 3,790 | 199.09MB | 実ファイル残存。Git追跡は0件。 |
| `data/cache` | 3,755 | 32.47MB | 実ファイル残存。Git追跡は0件。 |
| `data/public_json` | 3,798 | 130.54MB | Git追跡0件。ignore確認済み。 |
| `data/public_json_test` | 22,783 | 771.54MB | Git追跡0件。ignore確認済み。 |
| `data/warehouse_test` | 8 | 220.34MB | Git追跡0件。ignore確認済み。 |

## 6. 注意点

- `git rm --cached` はファイル削除ではなく、Gitインデックスからの追跡解除である。
- commit後も、この作業を行ったローカル環境には実ファイルが残る。
- ただし、別PCや新規clone環境ではGit管理外データは自動取得されない。
- 今後は `data/` の正式バックアップ方針が必要。候補は外付けSSD、NAS、Google Driveへの圧縮バックアップ、またはJ-Quants/warehouseからの再生成手順。
- `.git` サイズは今回の作業だけでは小さくならない。既に履歴へ入った巨大データはGit履歴内に残るため。
- 履歴掃除は `git filter-repo` 等が必要になるが、リモート履歴、他ブランチ、共同作業者への影響が大きい。必ず完全バックアップ後の別タスクとして扱う。
- 今回は `git filter-repo`、`git gc`、データ削除、圧縮、移動は実行していない。

バックアップ推奨:

- この変更をcommit/pushする前に、少なくとも `data/` 全体と `.git/` を別ディスクへ退避する。
- Google Driveへ置く場合は、大量小ファイルの同期負荷を避けるため、実行用ディレクトリではなく圧縮バックアップとして管理する。
- `data/public_json` や `data/warehouse_test` は再生成可能だが、生成時間短縮のため必要ならバックアップ対象に含める。

## 7. 次に実装すべき最小タスク3つ

1. `.gitignore` と `git rm --cached` 結果をcommitし、通常画面と `?dataMode=legacy` の最低限動作確認を行う。
2. `data/public_json` と `data/warehouse` のバックアップ/再生成手順をREADMEまたは運用メモに明文化する。
3. 履歴掃除を行うかどうかを別タスクで判断し、実施する場合はリモート/作業ブランチ/バックアップ方針を先に固める。
