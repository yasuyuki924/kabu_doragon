# KabuDragon recentモード public_json参照切替レポート

## 1. 結論

- `?dataMode=recent` は `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を読むようになりました。
- 通常モードへの影響はありません。通常URLでは従来どおり `data/tickers/{code}.json` を読みます。
- recent成功時は `data/tickers/{code}.json` を読みません。recent取得に失敗した場合のみ `data/tickers/{code}.json` にfallbackします。
- 本番切替前の残課題は、通常モードの完全切替判断、`updatedCodes` 差分生成、Git管理除外、軽量metadata/links補完です。

## 2. 変更ファイル

| ファイル | 変更内容 | 理由 |
|---|---|---|
| `assets/app.js` | recent JSON URLを `data/public_json_test` から `data/public_json` に変更 | 第5段階で生成した本番候補JSONを検証モードで読むため |
| `index.html` | `page_index_scanner.js` / `app.js` のバージョンを `1.4.96` に更新 | ブラウザが新しいJSを読むようにするため |
| `picked.html` | `page_picked.js` / `app.js` のバージョンを `1.4.96` に更新 | pickedのrecent検証で新しい参照先を使うため |
| `registered.html` | `page_registered_chart.js` / `app.js` のバージョンを `1.4.96` に更新 | registeredのrecent検証で新しい参照先を使うため |
| `ticker.html` | `app.js` のバージョンを `1.4.96` に更新 | 共通JSのキャッシュを揃えるため。詳細ページのデータ経路は変更なし |

## 3. Network確認

| URL種別 | 期待される読み込み先 | 確認結果 |
|---|---|---|
| 通常URL | `data/tickers/{code}.json` | `isRecentDataMode()` が false の場合は既存 `loadTickerPayloadWithDiagnostics` が呼ばれる |
| `?dataMode=recent` 一覧 | `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` | `index.html` が `app.js?v=1.4.96` を返し、配信JS内のrecent URLが `data/public_json` になっていることを確認 |
| `?dataMode=recent` recent成功 | `data/tickers/{code}.json` は読まない | `loadTickerForChartWithFallback` は recent成功時に recent payload を返し、legacy fetchへ進まない実装 |
| `?dataMode=recent` recent失敗 | `data/tickers/{code}.json` にfallback | `catch` で `console.info("[ticker-chart:recent:fallback]", ...)` を出して既存ローダーへfallback |
| ticker詳細ページ | `data/tickers/{code}.json` | `page_ticker.js` は従来どおり `loadTickerPayload` を使用 |

代表銘柄HTTP確認:

| code | public_json HTTP | サイズ |
|---|---:|---:|
| `7162` | 200 | 33,578 bytes |
| `4772` | 200 | 33,384 bytes |
| `7236` | 200 | 34,956 bytes |
| `5250` | 200 | 34,917 bytes |

## 4. fallback条件

| 条件 | 挙動 |
|---|---|
| 404 / HTTP error | `console.info` に理由を出し、`data/tickers` にfallback |
| JSON parse失敗 | `console.info` に理由を出し、`data/tickers` にfallback |
| `ohlcv` 配列なし / 空 | `data/tickers` にfallback |
| `date/open/high/low/close/volume` の必須キー不足 | `data/tickers` にfallback |
| 選択日不足 | `data/tickers` にfallback |
| 通常URL | recent JSONは読まず、従来どおり `data/tickers` を読む |

## 5. 既存機能への影響

- 通常一覧: 変更なし。`dataMode=recent` がない場合は従来どおりです。
- recent一覧: `data/public_json` の軽量JSONを優先します。
- picked: `?dataMode=recent` の場合のみ `data/public_json` を優先します。
- registered: `?dataMode=recent` の場合のみ `data/public_json` を優先します。
- 銘柄詳細ページ: 従来どおり `data/tickers` を使います。
- RCI/RSI: 変更なし。recent JSONには含めません。
- 戦略理由: 変更なし。recent JSONには含めません。
- metadata/links: 変更なし。recent成功時のチャート表示は軽量JSONのみを使い、必要時の詳細情報は既存経路に残します。

## 6. 次に実装すべき最小タスク3つ

1. `?dataMode=recent` で `public_json` を使った一覧 / picked / registered の実画面確認を行い、通常URLとのNetwork差分を記録する。
2. `scripts/build_public_json_candidate.py` に `--updated-codes` を追加し、差分生成PoCを行う。
3. `data/public_json`, `data/warehouse`, `*.parquet`, `*.duckdb`, 巨大JSONを `.gitignore` へ追加する変更案を作る。
