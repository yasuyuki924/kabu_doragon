# KabuDragon recent dataMode 実装レポート

## 1. 結論

- `127.0.0.1:8010` が配信している本番側ディレクトリ `/Users/okamoto/My Project/kabu_doragon` に `?dataMode=recent` 検証モードを実装しました。
- 前回の問題は、recent実装が別worktree側にあり、配信中の本番側 `assets/app.js` / `assets/page_index_scanner.js` へ反映されていなかったことです。
- 今回の修正では、`?dataMode=recent` のときだけ一覧 / picked / registered のチャート描画で `data/public_json_test/ticker_recent/1y/ohlcv_ma/{code}.json` を先に読みます。
- recent JSON が正常に読めた場合は `data/tickers/{code}.json` を読みません。recent JSON が失敗した場合のみ、既存 `data/tickers/{code}.json` にfallbackします。

## 2. 変更ファイル

| ファイル | 変更内容 | 理由 |
|---|---|---|
| `assets/app.js` | `isRecentDataMode`, `getRecentTickerDataUrl`, `loadRecentTickerForChart`, `loadTickerForChartWithFallback` を追加 | 通常モードを変えず、recentモードだけ軽量JSONを優先するため |
| `assets/app.js` | 通常モードは従来の `loadTickerPayloadWithDiagnostics`、recent成功時は recent payload のみ返す形に整理 | recent成功時に巨大 `data/tickers` を読まないようにするため |
| `assets/app.js` | recent OHLCVに `change` / `changePercent` を直前終値から補完 | チャート初期選択やクリック時に前日比表示を崩さないため |
| `assets/page_index_scanner.js` | 一覧カードチャートを `loadTickerForChartWithFallback` へ接続 | `?dataMode=recent` が実画面のチャート経路に届くようにするため |
| `assets/page_picked.js` | pickedチャートを `loadTickerForChartWithFallback` へ接続 | pickedでも同じ検証モードを使うため |
| `assets/page_registered_chart.js` | registeredチャートを `loadTickerForChartWithFallback` へ接続 | registeredでも同じ検証モードを使うため |
| `index.html`, `picked.html`, `registered.html`, `ticker.html` | JSクエリバージョンを `1.4.95` に更新 | ブラウザが古いJSを掴まないようにするため |

## 3. recent JSON 利用箇所

| 画面 | 通常モード | recentモード | fallback |
|---|---|---|---|
| 一覧カードチャート | `data/tickers/{code}.json` | `data/public_json_test/ticker_recent/1y/ohlcv_ma/{code}.json` | recent失敗時のみ `data/tickers/{code}.json` |
| picked チャート | `data/tickers/{code}.json` | `data/public_json_test/ticker_recent/1y/ohlcv_ma/{code}.json` | recent失敗時のみ `data/tickers/{code}.json` |
| registered チャート | `data/tickers/{code}.json` | `data/public_json_test/ticker_recent/1y/ohlcv_ma/{code}.json` | recent失敗時のみ `data/tickers/{code}.json` |
| ticker詳細ページ | `data/tickers/{code}.json` | 切り替え対象外 | 従来どおり |

## 4. フォールバック条件

| 条件 | 挙動 |
|---|---|
| 通常URL | recent JSONは読まず、既存 `data/tickers` を読む |
| `?dataMode=recent` かつ recent JSON成功 | recent JSONだけでチャート描画し、`data/tickers` は読まない |
| 404 / HTTP error | `console.info("[ticker-chart:recent:fallback]", ...)` を出し、既存 `data/tickers` へfallback |
| JSON parse失敗 | `console.info` に理由を出し、既存 `data/tickers` へfallback |
| `ohlcv` 配列なし / 空 | 既存 `data/tickers` へfallback |
| `date/open/high/low/close/volume` の必須キー不足 | 既存 `data/tickers` へfallback |
| 選択日が recent JSON に存在しない | 既存 `data/tickers` へfallback |

## 5. 動作確認

- `index.html` は `assets/page_index_scanner.js?v=1.4.95` と `assets/app.js?v=1.4.95` を参照するよう更新しました。
- `picked.html` は `assets/page_picked.js?v=1.4.95` と `assets/app.js?v=1.4.95` を参照するよう更新しました。
- `registered.html` は `assets/page_registered_chart.js?v=1.4.95` と `assets/app.js?v=1.4.95` を参照するよう更新しました。
- `ticker.html` は共通 `assets/app.js?v=1.4.95` を参照しますが、詳細ページのデータ読み込み経路は従来どおり `loadTickerPayload` のままです。
- `data/public_json_test/ticker_recent/1y/ohlcv_ma/7162.json` が本番側に存在することを確認しました。
- ユーザー確認で従来JSONが出ていた `7162`, `4772`, `7236`, `5250` は、recent JSONがそれぞれ `200 OK` で配信されることを確認しました。
- `node --check assets/app.js assets/page_index_scanner.js assets/page_picked.js assets/page_registered_chart.js` は成功しました。
- 今回変更した対象ファイルに絞った `git diff --check` は成功しました。既存の `data/ohlcv` 差分には以前からの末尾空白があるため、全体 `git diff --check` は別途扱いが必要です。

## 6. 既存機能への影響

- 銘柄詳細ページは recent 切り替え対象外です。
- RCI/RSI、戦略理由、詳細metadataは recent JSON に含めず、従来の `data/tickers` 利用を維持します。
- `?dataMode=recent` のチャートカードでは、recent成功時に軽量JSONのみを使うため、外部リンクなど `payload.links` 由来の補助情報は出ない場合があります。これは検証モード限定の挙動です。
- protected data ディレクトリ、J-Quants本番処理、既存ビルド処理、Git履歴、`.gitignore`, `requirements.txt`, `pyproject.toml` は変更していません。

## 7. 次に実装すべき最小タスク3つ

1. Chrome DevTools Networkで `?dataMode=recent` 時に `data/public_json_test/ticker_recent/1y/ohlcv_ma/{code}.json` が出ること、成功銘柄で `data/tickers/{code}.json` が出ないことを確認する。
2. recent成功時にリンクやmetadataを巨大ticker JSONなしで補完する軽量metadata JSONを設計する。
3. `ticker_recent` の大量小ファイル書き出しを、`updatedCodes` 差分生成または100銘柄bundleで改善する。
