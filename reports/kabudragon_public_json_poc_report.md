# KabuDragon public_json化 PoC レポート

## 1. 結論

`ticker_recent` 方式は非常に有効。既存 `data/tickers` は `20.62 GB` あるが、全銘柄の軽量JSONは以下まで縮小できた。

| 方式 | 全銘柄容量 | `data/tickers` 比削減 |
|---|---:|---:|
| 6ヶ月 OHLCV | 39.52 MB | 99.8128% |
| 6ヶ月 OHLCV+MA | 64.89 MB | 99.6926% |
| 1年 OHLCV | 80.18 MB | 99.6202% |
| 1年 OHLCV+MA | 131.68 MB | 99.3763% |
| 2年 OHLCV | 158.23 MB | 99.2505% |
| 2年 OHLCV+MA | 259.90 MB | 98.7689% |

本番向きの初期案は **1年 OHLCV+MA**。容量は `131.68 MB` と十分小さく、チャート表示に必要なローソク足と主要移動平均を含められる。6ヶ月は軽いが中期トレンド確認には短く、2年はまだ軽いものの初期表示用途としてはやや大きい。

OHLCVのみでもローソク足チャートは成立するが、既存チャートは `ma5`, `ma25`, `ma75`, `ma200` を使うため、画面互換性を考えるとMA追加版が安全。RCI/RSI/理由文/strategy系は初期チャートJSONには含めず、詳細分析や戦略パネル用に別JSONまたはwarehouse由来の動的生成へ逃がすのがよい。

既存画面切替の難易度は中程度。チャート描画だけなら比較的容易だが、ticker詳細のテクニカル指標・戦略理由・RCI表示は別データソースが必要になる。

## 2. 生成した成果物

出力先は `data/public_json_test/` のみ。本番用 `data/public_json` は作成していない。

| 出力 | 内容 |
|---|---|
| `data/public_json_test/ticker_recent/6m/ohlcv/` | 6ヶ月 OHLCVのみ、3,797銘柄 |
| `data/public_json_test/ticker_recent/6m/ohlcv_ma/` | 6ヶ月 OHLCV+MA、3,797銘柄 |
| `data/public_json_test/ticker_recent/1y/ohlcv/` | 1年 OHLCVのみ、3,797銘柄 |
| `data/public_json_test/ticker_recent/1y/ohlcv_ma/` | 1年 OHLCV+MA、3,797銘柄 |
| `data/public_json_test/ticker_recent/2y/ohlcv/` | 2年 OHLCVのみ、3,797銘柄 |
| `data/public_json_test/ticker_recent/2y/ohlcv_ma/` | 2年 OHLCV+MA、3,797銘柄 |
| `data/public_json_test/public_json_poc_metrics.json` | 測定結果 |

生成ファイル数は `22,782`。JSONはcompact出力で、`indent=2` は使っていない。

## 3. 容量比較

| 対象 | 容量 | コメント |
|---|---:|---|
| 既存 `data/tickers` 全体 | 20.62 GB | 3,791銘柄、約5年、約87キー/行 |
| `public_json_test` 全体 | 782 MB | 6パターン全部を同時生成したPoC合計 |
| 6ヶ月 OHLCV | 39.52 MB | 最小。短期チャート向き |
| 6ヶ月 OHLCV+MA | 64.89 MB | 短期 + MA |
| 1年 OHLCV | 80.18 MB | 軽量だがMAなし |
| 1年 OHLCV+MA | 131.68 MB | 推奨候補 |
| 2年 OHLCV | 158.23 MB | 中長期も見やすい |
| 2年 OHLCV+MA | 259.90 MB | まだ十分小さいが初期表示にはやや大きい |

## 4. 速度比較

| 処理 | 時間 | コメント |
|---|---:|---|
| Parquet読み込み | 0.5820 sec | `data/warehouse_test/prices_by_year/` 全件 |
| MA計算 | 1.9439 sec | `ma5`, `ma25`, `ma75`, `ma200` |
| JSON書き出し合計 | 188.8126 sec | 22,782ファイル生成。I/O支配 |
| 6ヶ月 OHLCV 書き出し | 11.5840 sec | 3,797ファイル |
| 6ヶ月 OHLCV+MA 書き出し | 14.9850 sec | 3,797ファイル |
| 1年 OHLCV 書き出し | 21.9592 sec | 3,797ファイル |
| 1年 OHLCV+MA 書き出し | 29.6222 sec | 3,797ファイル |
| 2年 OHLCV 書き出し | 46.8608 sec | 3,797ファイル |
| 2年 OHLCV+MA 書き出し | 63.5376 sec | 3,797ファイル |

Parquet読み込みとMA計算は速い。時間がかかるのは大量小ファイルのJSON書き出し。Google Drive同期配下で実行するとさらに遅くなる可能性が高い。

## 5. 代表銘柄比較

以下は推奨候補の `1y/ohlcv_ma` との比較。

| code | 既存JSONサイズ | 新JSONサイズ | レコード数 | 日付範囲 |
|---|---:|---:|---:|---|
| 6327 | 5.93 MB | 35.29 KB | 245 | 2025-05-01 - 2026-05-01 |
| 8309 | 6.38 MB | 37.47 KB | 245 | 2025-05-01 - 2026-05-01 |
| 4883 | 6.03 MB | 33.29 KB | 245 | 2025-05-01 - 2026-05-01 |
| 3133 | 5.98 MB | 35.08 KB | 245 | 2025-05-01 - 2026-05-01 |
| 7203 | 6.14 MB | 37.66 KB | 245 | 2025-05-01 - 2026-05-01 |

代表銘柄の全期間比較:

| code | 6ヶ月 OHLCV | 6ヶ月 OHLCV+MA | 1年 OHLCV | 1年 OHLCV+MA | 2年 OHLCV | 2年 OHLCV+MA |
|---|---:|---:|---:|---:|---:|---:|
| 6327 | 10.76 KB | 17.55 KB | 21.60 KB | 35.29 KB | 42.80 KB | 69.95 KB |
| 8309 | 11.14 KB | 18.30 KB | 22.74 KB | 37.47 KB | 45.37 KB | 74.68 KB |
| 4883 | 10.13 KB | 16.26 KB | 20.72 KB | 33.29 KB | 41.86 KB | 67.39 KB |
| 3133 | 10.57 KB | 17.20 KB | 21.57 KB | 35.08 KB | 43.28 KB | 70.44 KB |
| 7203 | 11.26 KB | 18.44 KB | 22.98 KB | 37.66 KB | 45.85 KB | 75.13 KB |

## 6. 既存画面への影響

現在 `data/tickers` を直接読む主な箇所:

| ファイル | 依存内容 |
|---|---|
| `assets/app_data.js` | `loadTickerPayloadData` が `./data/tickers/{code}.json` をfetch |
| `assets/app.js` | scanner card chart、diagnostics、fallback処理 |
| `assets/page_index_scanner.js` | 一覧カード内チャートで `payload.ohlcv` を利用 |
| `assets/page_picked.js` | picked銘柄チャートで `payload.ohlcv` を利用 |
| `assets/page_registered_chart.js` | registered銘柄チャートで `payload.ohlcv` を利用 |
| `assets/page_ticker.js` | ticker詳細のチャート、テクニカル指標、戦略パネル |
| `assets/ticker_sample.js` | サンプル表示 |

チャート表示に本当に必要なキー:

- `date`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `ma5`
- `ma25`
- `ma75`
- `ma200`

OHLCVのみ版で不足する主なキー:

- `ma5`, `ma25`, `ma75`, `ma200`: チャート上の移動平均線に必要
- `distanceToMa25`, `distanceToMa75`, `distanceToMa200`: ticker詳細のテクニカル表示やランキング補助に必要
- `rci12`, `rci24`, `rci48`: ticker詳細のRCI表示に必要
- `strategyMatches`, `strategyScores`, `strategyReasons`: strategy badge / 理由表示に必要
- `trendTurnReason` など: トレンド転換理由表示に必要

RCI/RSI/理由文/strategy系を省いた場合の影響:

- 一覧カードのローソク足チャートは問題が少ない。
- 移動平均線はOHLCV+MA版なら維持可能。
- ticker詳細の「テクニカル」欄では乖離率やRCIが欠ける。
- ticker詳細の「戦略理由」欄は表示できない。
- strategy badgeや理由ポップアップは、overview/rankings側の既存データを使うか、別の軽量 `ticker_analysis` JSONが必要。
- deviation系の並び替え・表示は一覧のoverview/rankings依存が残るため、ticker_recentだけでは置換しない方がよい。

将来 `ticker_recent` に切り替える場合の修正範囲:

1. `loadTickerPayloadData` に読み込み先切替を追加する。
2. チャート用途は `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を優先する。
3. 詳細分析・strategy理由が必要なページでは、従来 `data/tickers` か別途 `ticker_analysis` を遅延ロードする。
4. diagnosticsは軽量payloadのスキーマに合わせて緩和する。
5. chart rangeが2年以上必要な場合だけwarehouse由来の拡張データを取得する。

## 7. 推奨方針

本番では **1年 OHLCV+MA** を標準の `ticker_recent` として持つのがよい。

理由:

- 全銘柄で `131.68 MB` と十分小さい。
- 1年あれば日足・週足・月足の直近比較に使いやすい。
- MAを含めることで既存チャート表現に近い。
- 6ヶ月は軽いが、200日線や中期トレンド確認にはやや短い。
- 2年はまだ軽いが、初期表示用としては1年よりI/Oが増える。

RCI/RSI/理由文/strategy系は `ticker_recent` には含めない方がよい。これらは容量増加の原因になりやすく、初期チャート表示の必須データではない。詳細分析時にwarehouseから動的生成するか、最新日中心の `ticker_analysis` / `signal_detail` JSONに分離するのが安全。

## 8. 次に実装すべき最小タスク3つ

1. `public_json_test` の生成処理を再実行可能な検証スクリプトにする。ただし本番ビルドにはまだ組み込まない。
2. 既存画面に手を入れず、ローカルのサンプルページだけで `ticker_recent/1y/ohlcv_ma` を読み込む比較表示を作る。
3. `ticker_recent` と別に、最新日だけの `ticker_analysis` JSON設計を作り、RCI/RSI/strategy理由をどこまで分離するか決める。

## 9. 既存本番ファイル保護の確認

作業前後で以下のprotected既存ディレクトリのファイル数・容量・mtime合計を比較し、未変更だった。

- `data/tickers`
- `data/overview`
- `data/daily_records`
- `data/rankings`
- `data/ohlcv`
- `data/ohlcv_raw`

今回作成・更新したのは `data/public_json_test/` と `reports/kabudragon_public_json_poc_report.md` のみ。本番用 `data/public_json` は作成していない。既存画面、J-Quants本番処理、既存ビルド処理、`.gitignore`、`requirements.txt`、`pyproject.toml`、Git履歴は変更していない。
