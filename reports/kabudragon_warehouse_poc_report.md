# KabuDragon warehouse化 検証レポート

## 1. 結論

第1段階のPoCとして、既存の `data/ohlcv` を読み取り専用で使い、`data/warehouse_test/` に年別ParquetとDuckDBを作成した。既存画面、既存JSON、J-Quants本番処理、Git設定は変更していない。

結論として、KabuDragonの次段階の正式候補は **Parquetを正式データ保存の主形式、DuckDBを検証・分析・集計クエリ用の補助形式** とするのが最も安全。Parquetは容量が小さく、年別差分更新との相性が良い。DuckDBは検索が速く開発体験もよいが、今回のDBファイルはインデックス込みでParquetより大きい。

既存JSONをすぐ置き換えるべきではない。まずはwarehouseへ保存だけ追加し、既存JSON生成と併用する段階移行がよい。

## 2. 元データ確認

| 対象 | 銘柄数 | レコード数 | 日付範囲 | 容量 | コメント |
|---|---:|---:|---|---:|---|
| `data/ohlcv` | 3,797 | 4,468,596 | 2021-03-01 - 2026-05-01 | 190.93 MB | PoCの正式データ入力。空欄なし、`code + date` 重複なし |
| `data/ohlcv_raw` | 3,790 | 4,460,741 | 2021-03-05 - 2026-05-01 | 189.86 MB | raw系候補。今回のwarehouse出力には未使用 |

共通カラムは `date`, `open`, `high`, `low`, `close`, `volume`。`code` はCSVファイル名から文字列として付与した。

## 3. Parquet化結果

作成先:

- `data/warehouse_test/prices_by_year/year=2021/prices.parquet`
- `data/warehouse_test/prices_by_year/year=2022/prices.parquet`
- `data/warehouse_test/prices_by_year/year=2023/prices.parquet`
- `data/warehouse_test/prices_by_year/year=2024/prices.parquet`
- `data/warehouse_test/prices_by_year/year=2025/prices.parquet`
- `data/warehouse_test/prices_by_year/year=2026/prices.parquet`

| 形式 | 容量 | 元データ比 | 読み込み速度 | コメント |
|---|---:|---:|---:|---|
| CSV `data/ohlcv` | 190.93 MB | 100% | 7.3025 sec | 3,797ファイルを全件読み込み |
| 年別Parquet snappy | 43.87 MB | 23.0% | 0.0644 sec | 全件読み込み。非常に軽い |

Parquet schema:

| column | type |
|---|---|
| `code` | string |
| `date` | timestamp[ns] |
| `open` | double |
| `high` | double |
| `low` | double |
| `close` | double |
| `volume` | int64 |
| `source` | string |

`code` は文字列として保持されるため、先頭ゼロを持つコードにも対応できる。`date` は日付型として扱えるtimestampで保存された。

## 4. DuckDB化結果

作成先:

- `data/warehouse_test/kabudragon_test.duckdb`

| 形式 | 容量 | 検索速度 | コメント |
|---|---:|---:|---|
| DuckDB `prices` | 166.26 MB | `code='6327'`: 0.002530 sec / `date='2026-05-01'`: 0.012303 sec | index作成前 |
| DuckDB `prices` + indexes | 166.26 MB | `code='6327'`: 0.008982 sec / `date='2026-05-01'`: 0.019430 sec | `code`, `date` index作成後。今回規模ではindexなしの方が速い |

DuckDB schema:

| column | type |
|---|---|
| `code` | VARCHAR |
| `date` | DATE |
| `open` | DOUBLE |
| `high` | DOUBLE |
| `low` | DOUBLE |
| `close` | DOUBLE |
| `volume` | BIGINT |
| `source` | VARCHAR |

DuckDB table作成時間は 1.3702 sec。`idx_prices_code` と `idx_prices_date` の作成時間は 1.3997 sec。

## 5. 既存JSONとの比較

今回のPoCは `data/tickers` などの巨大JSONからではなく、正式データ候補の `data/ohlcv` からwarehouseを作成した。整合性確認は元CSV、Parquet、DuckDB間で実施した。

| 確認項目 | CSV | Parquet | DuckDB | 結果 |
|---|---:|---:|---:|---|
| 総レコード数 | 4,468,596 | 4,468,596 | 4,468,596 | 一致 |
| 銘柄数 | 3,797 | 3,797 | 3,797 | 一致 |
| 最小日付 | 2021-03-01 | 2021-03-01 | 2021-03-01 | 一致 |
| 最大日付 | 2026-05-01 | 2026-05-01 | 2026-05-01 | 一致 |
| `code + date` 重複 | 0 | 0 | 0 | 問題なし |
| `6327` 件数 | 1,262 | 1,262 | 1,262 | 一致 |
| `2026-05-01` 件数 | 3,718 | 3,718 | 3,718 | 一致 |

## 6. 既存機能への影響

既存画面への影響はない。既存画面の読み込み先は変更していないため、現在の `data/manifest.json`, `data/overview`, `data/rankings`, `data/tickers` は従来どおり使われる。

将来差し替えが必要になりそうな処理:

- `scripts/build_ticker_data.py`: 現在は銘柄ごとの巨大JSONを全期間・多数指標込みで生成する。
- `scripts/build_market_overview.py`: 日別に全銘柄・多数指標入りoverviewを生成する。
- `scripts/build_rankings.py`: ranking JSONの生成元をwarehouse由来にできる。
- `src/app/daily_runner.py`: J-Quants取得後にwarehouse保存を追加し、JSON生成と分離する余地がある。

残す必要があるJSON:

- 既存画面維持のため、当面は `data/tickers`, `data/overview`, `data/daily_records`, `data/rankings` を残す。
- 次段階では `public_json` 相当として、最新・直近期間だけの軽量JSONを別途作るのが安全。

## 7. public_json化の予備提案

今回は未実装。将来はブラウザ表示用JSONを以下に絞るとよい。

| JSON | 推奨内容 | 期間 |
|---|---|---|
| latest overview | 最新日の市場overview、dataQuality、inactive summary | 最新日中心 |
| latest rankings | 最新日の各ランキング | 最新日 + 直近3-6ヶ月 |
| ticker recent | チャート用OHLCV、最小限のMA、出来高 | 1年を推奨 |
| ticker detail extra | 詳細分析時だけ追加ロード | 必要時 |

期間はまず **1年** がよい。6ヶ月だと中期トレンド比較に短く、2年だとJSON削減効果が弱くなる。現行UIのチャート比較とランキング閲覧には1年が現実的な初期値。

`data/tickers` から削れそうなもの:

- 全期間の `strategyReasons`
- 全期間の `strategyExcludedReasons`
- 全期間の複数戦略スコア
- 過去全日の `trendTurnReason`
- 画面初期表示で使わない長期指標

## 8. J-Quants差分更新の予備提案

今回は未実装。現状ではJ-Quants取得後、`build_ticker_data.py --use-update-state` が `updatedCodes` に応じて銘柄JSONを丸ごと再生成する。`updatedCodes` が全銘柄級になると、`data/tickers/*.json` の大量読み書きが最大のボトルネックになる。

差分更新案:

1. J-Quants取得後、まず `warehouse/prices_by_year` へ対象日の行だけ upsert する。
2. `updatedCodes` が少数なら該当銘柄の軽量 `ticker_recent` だけ再生成する。
3. `updatedCodes` が全銘柄級でも、全期間ticker JSONは再生成せず、最新日overview/rankingsだけ更新する。
4. corporate actionsや分割補正が絡む場合のみ、対象銘柄・対象日以降の再計算に切り替える。

Parquetは年別ファイルの追記・置換単位を設計する必要がある。DuckDBはupsert運用が比較的簡単。したがって、正式保存はParquet、更新作業用または集計用にDuckDBを併用する案がよい。

## 9. Git管理から外すべきもの

今回は `.gitignore` を変更していない。次フェーズで以下をGit管理対象外にする提案を行う。

- `data/warehouse_test/`
- `data/warehouse/`
- `*.parquet`
- `*.duckdb`
- `data/cache/`
- `data/public_json/` のうち再生成可能なもの
- `data/tickers/`
- `data/overview/`
- `data/daily_records/`
- `data/rankings/`
- 圧縮アーカイブや巨大legacy JSON

Git履歴掃除は別タスク。`git filter-repo` 等はバックアップとリモート影響確認後に実施する。

## 10. 作成したファイル一覧

| ファイル | 容量 |
|---|---:|
| `data/warehouse_test/kabudragon_test.duckdb` | 166 MB |
| `data/warehouse_test/prices_by_year/year=2021/prices.parquet` | 6.6 MB |
| `data/warehouse_test/prices_by_year/year=2022/prices.parquet` | 8.1 MB |
| `data/warehouse_test/prices_by_year/year=2023/prices.parquet` | 8.6 MB |
| `data/warehouse_test/prices_by_year/year=2024/prices.parquet` | 8.8 MB |
| `data/warehouse_test/prices_by_year/year=2025/prices.parquet` | 8.8 MB |
| `data/warehouse_test/prices_by_year/year=2026/prices.parquet` | 3.0 MB |
| `data/warehouse_test/warehouse_poc_metrics.json` | 3.6 KB |
| `reports/kabudragon_warehouse_poc_report.md` | このレポート |

## 11. 追加した依存パッケージ

`.venv` に以下を追加した。`requirements.txt` / `pyproject.toml` は変更していない。

| package | version |
|---|---|
| `pyarrow` | 24.0.0 |
| `duckdb` | 1.5.2 |
| `pandas` | 2.3.3 |

## 12. 次に実装すべき最小タスク3つ

1. `scripts/build_warehouse.py` のような検証済み処理を追加し、J-Quants取得後にwarehouseへ保存だけ行う。ただし既存JSON生成は残す。
2. `public_json/ticker_recent` の試作を行い、1年分OHLCV + 最小限指標だけで既存ticker画面を再現できるか検証する。
3. `.gitignore` 更新案を作り、warehouse・cache・巨大JSONをGit管理から外す。ただし履歴掃除はさらに別タスクにする。

## 13. 既存ファイル保護の確認

今回のPoCで、既存の `data/ohlcv`, `data/ohlcv_raw`, `data/tickers`, `data/overview`, `data/daily_records`, `data/rankings` は読み取り専用として扱った。作成先は `data/warehouse_test/` と `reports/` のみ。

既存画面の読み込み先、J-Quants本番処理、`.gitignore`、`requirements.txt`、`pyproject.toml`、Git履歴は変更していない。
