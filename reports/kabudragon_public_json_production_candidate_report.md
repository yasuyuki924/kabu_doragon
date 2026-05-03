# KabuDragon public_json 本番候補生成レポート

## 1. 結論

- `data/public_json` は本番候補として利用可能です。`data/warehouse_test/prices_by_year/` のParquetから、全3,797銘柄の直近1年 OHLCV+MA JSONを生成できました。
- 生成容量は `130,542,776 bytes`、約 `124.5 MiB` です。`du -sh` では `132M` でした。
- 生成時間は合計 `11.49 sec` でした。内訳は Parquet読み込み `1.17 sec`、MA計算 `1.57 sec`、JSON書き出し `8.26 sec` です。
- 本番切替前の主な課題は、`?dataMode=recent` の参照先を `public_json_test` から `public_json` へ変える検証、更新後の差分生成、Git管理除外、リンク/metadataの軽量補完です。

## 2. 作成成果物

| パス | 内容 | 容量 | 件数 |
|---|---|---:|---:|
| `scripts/build_public_json_candidate.py` | 本番候補 public_json 生成スクリプト | 6.1 KB | 1 |
| `data/public_json/ticker_recent/1y/ohlcv_ma/` | 直近1年 OHLCV+MA JSON | 130,542,776 bytes | 3,797 files |
| `data/public_json/ticker_recent/1y/ohlcv_ma_metrics.json` | 生成メトリクス | 1.5 KB | 1 |
| `reports/kabudragon_public_json_production_candidate_report.md` | 本レポート | - | 1 |

## 3. 生成仕様

- 入力: `data/warehouse_test/prices_by_year/year=*/prices.parquet`
- 出力: `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json`
- JSON形式: compact出力、各ファイルは `{ "ohlcv": [...] }`
- 含めるキー: `date`, `open`, `high`, `low`, `close`, `volume`, `ma5`, `ma25`, `ma75`, `ma200`
- 除外するキー: RCI, RSI, strategy系, 理由文, metadata, links
- 期間: 最新日 `2026-05-01` から直近1年、出力範囲 `2025-05-01` から `2026-05-01`
- MA計算方法: 全期間データを `code`, `date` でソートし、銘柄ごとに終値の rolling mean を `5`, `25`, `75`, `200` 本で計算してから、出力だけ直近1年へ絞り込み
- `code` は文字列として扱い、先頭ゼロを落とさない前提の処理にしています。

## 4. 整合性確認

- 銘柄数: `3,797`
- 総レコード数: `914,802`
- 日付範囲: `2025-05-01` から `2026-05-01`
- 入力全体: `4,468,596` レコード、`3,797` 銘柄、`2021-03-01` から `2026-05-01`
- 出力キー一覧: `close`, `date`, `high`, `low`, `ma200`, `ma25`, `ma5`, `ma75`, `open`, `volume`

代表銘柄確認:

| code | サイズ | レコード数 | 日付範囲 | キー |
|---|---:|---:|---|---|
| `6327` | 34,052 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `8309` | 36,282 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `4883` | 31,992 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `3133` | 33,828 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `7203` | 36,844 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `7162` | 33,578 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `4772` | 33,384 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `7236` | 34,956 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |
| `5250` | 34,917 bytes | 245 | `2025-05-01` - `2026-05-01` | OHLCV+MAのみ |

## 5. recentモード変更案

- 現在: `?dataMode=recent` は `data/public_json_test/ticker_recent/1y/ohlcv_ma/{code}.json` を読みます。
- 次案: `?dataMode=recent` の参照先を `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` に変更します。
- fallback: recent JSONが404、parse失敗、必須OHLCVキー不足、選択日不足の場合のみ、既存 `data/tickers/{code}.json` に戻します。
- 通常モードとの切り分け: `dataMode=recent` がない通常URLでは、引き続き `data/tickers/{code}.json` を読む設計のままにします。
- 注意: 今回は参照先変更を実装していません。既存 `?dataMode=recent` はまだ `data/public_json_test` を読みます。

## 6. J-Quants更新後の運用案

- 当面の手動/日次全件生成: J-Quants更新とwarehouse更新後に `scripts/build_public_json_candidate.py` を実行し、全銘柄の `public_json` を再生成します。今回の実測では約12秒なので、当面の運用負荷は許容範囲です。
- `updatedCodes` 差分生成への移行案: J-Quants更新結果から更新銘柄コードを受け取り、該当コードだけParquet/warehouseから直近1年+MA200計算に必要な過去期間を読み直して該当JSONだけ再生成します。
- 日次更新: `run_jquants_close_retry.sh` などの既存本番処理はまだ置き換えず、次フェーズで「warehouse更新後にpublic_json生成を追加する」形で検討します。
- 失敗時のfallback: public_json生成に失敗しても通常画面は既存 `data/tickers` を読むため影響を抑えられます。`?dataMode=recent` では404等を検知して `data/tickers` にfallbackします。

## 7. JSON書き出し高速化案

推奨順位:

| 順位 | 案 | メリット | デメリット |
|---:|---|---|---|
| 1 | `updatedCodes` 差分 | 日次更新で変更銘柄だけ再生成できる。既存の1銘柄1ファイル構成を維持できる | updatedCodesの受け渡しとMA計算用の過去データ取得が必要 |
| 2 | 100銘柄bundle | ファイル数を約3,800から約38へ減らせる。ファイルシステム/同期負荷に強い | ブラウザ側にコードからbundleを引くマッピングが必要 |
| 3 | gzip併用 | 転送量と保存容量を大きく減らせる。JSON構造は変えずに済む | 静的サーバー側で `.gz` 配信またはHTTP圧縮の設定が必要 |
| 4 | API/DuckDB | 必要な銘柄・期間だけ動的返却でき、長期的には最も柔軟 | 静的JSON配信より運用構成が大きくなる |

今回の全件生成は `jsonWriteSeconds=8.26 sec` だったため、直近の優先度は `updatedCodes` 差分生成です。bundle/API化は本番切替後の第2最適化として扱うのが安全です。

## 8. Git管理方針

- `data/public_json`: 再生成可能な表示用キャッシュなので、次フェーズで `.gitignore` 対象にする案が妥当です。
- `data/warehouse`: 正式データ候補ですがサイズが大きくなりうるため、Gitではなくローカル/バックアップ/外部ストレージ管理に寄せる案が妥当です。
- `*.parquet`: Git管理対象外にする案が妥当です。
- `*.duckdb`: Git管理対象外にする案が妥当です。
- 巨大JSON: `data/tickers`, `data/overview`, `data/daily_records` などは次フェーズでGit管理から外す対象候補です。ただし履歴掃除は別タスクとしてバックアップ後に慎重に行うべきです。
- 今回は `.gitignore` を変更していません。

## 9. 次に実装すべき最小タスク3つ

1. `?dataMode=recent` の参照先を `data/public_json_test` から `data/public_json` へ切り替える検証モード変更を行う。
2. `scripts/build_public_json_candidate.py` に `--updated-codes` を追加し、差分生成のPoCを行う。
3. `data/public_json` と warehouse系生成物を `.gitignore` に追加する変更案を作り、Git管理対象から外す準備をする。

## 10. 未変更確認

- `data/tickers`, `data/public_json_test`, `data/overview`, `data/daily_records`, `data/rankings`, `data/ohlcv`, `data/ohlcv_raw` はファイル数・容量・mtime合計で未変更です。
- 通常画面の読み込み先、既存 `?dataMode=recent` の参照先、J-Quants本番処理、既存ビルド処理、Git履歴は変更していません。
- `.gitignore`, `requirements.txt`, `pyproject.toml` は変更していません。
