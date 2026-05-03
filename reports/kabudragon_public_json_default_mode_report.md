# KabuDragon public_json デフォルト化レポート

## 1. 結論

- 通常画面の一覧 / picked / registered チャート描画は `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` 優先になりました。
- `?dataMode=legacy` を付けると、従来方式の `data/tickers/{code}.json` 固定に戻せます。この場合は `public_json` を読みません。
- 通常モードへの影響はチャート用OHLCV取得のみです。銘柄詳細ページ、RCI/RSI、戦略理由、metadata、links の既存経路は維持しています。
- 本番運用上の注意点は、`public_json` 生成失敗時のfallback監視、更新後の差分生成、Git管理除外、軽量metadata補完です。

## 2. 変更ファイル

| ファイル | 変更内容 | 理由 |
|---|---|---|
| `assets/app.js` | `isLegacyDataMode()` を追加し、`loadTickerForChartWithFallback()` をlegacy以外ではpublic_json優先に変更 | 通常URLでpublic_jsonを使い、`?dataMode=legacy` で従来方式へ戻せるようにするため |
| `assets/app.js` | `isRecentDataMode()` は互換性のため残し、legacy以外をpublic_jsonモードとして扱う | 既存 `?dataMode=recent` URLも引き続き有効にするため |
| `index.html` | `page_index_scanner.js` / `app.js` のバージョンを `1.4.97` に更新 | ブラウザが新しいJSを読むようにするため |
| `picked.html` | `page_picked.js` / `app.js` のバージョンを `1.4.97` に更新 | pickedチャートで新しいモード判定を使うため |
| `registered.html` | `page_registered_chart.js` / `app.js` のバージョンを `1.4.97` に更新 | registeredチャートで新しいモード判定を使うため |
| `ticker.html` | `app.js` のバージョンを `1.4.97` に更新 | 共通JSキャッシュを揃えるため。詳細ページのデータ経路は変更なし |

## 3. モード別の読み込み先

| URLモード | 一覧/picked/registeredチャート | 銘柄詳細 |
|---|---|---|
| 通常URL | `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` 優先、失敗時 `data/tickers/{code}.json` | 常に `data/tickers/{code}.json` |
| `?dataMode=recent` | 通常URLと同じくpublic_json優先、失敗時 `data/tickers/{code}.json` | 常に `data/tickers/{code}.json` |
| `?dataMode=legacy` | `data/tickers/{code}.json` 固定 | 常に `data/tickers/{code}.json` |

## 4. Network確認

| URL | 期待される読み込み先 | 確認結果 |
|---|---|---|
| `index.html?date=2026-05-01&sort=gainers&limit=200&turnover=0&range=3&timeframe=daily` | `data/public_json/ticker_recent/1y/ohlcv_ma/*.json` | 配信HTMLが `app.js?v=1.4.97` を返し、配信JSでlegacy以外public_json優先になっていることを確認 |
| `index.html?...&dataMode=recent` | `data/public_json/ticker_recent/1y/ohlcv_ma/*.json` | `dataMode=recent` は互換モードとしてpublic_json優先 |
| `index.html?...&dataMode=legacy` | `data/tickers/*.json` | `isLegacyDataMode()` が true の場合、public_jsonローダーを通らず既存 `loadTickerPayloadWithDiagnostics` を呼ぶ実装 |
| `ticker.html?code=6327...` | `data/tickers/6327.json` | `page_ticker.js` は従来どおり `loadTickerPayload` を使用 |

代表銘柄のpublic_json HTTP確認:

| code | HTTP | サイズ |
|---|---:|---:|
| `7162` | 200 | 33,578 bytes |
| `4772` | 200 | 33,384 bytes |
| `7236` | 200 | 34,956 bytes |
| `5250` | 200 | 34,917 bytes |

## 5. fallback条件

| 条件 | 挙動 |
|---|---|
| public_json 404 / HTTP error | `console.info("[ticker-chart:recent:fallback]", ...)` に理由を出し、`data/tickers` にfallback |
| JSON parse失敗 | `console.info` に理由を出し、`data/tickers` にfallback |
| `ohlcv` 配列なし / 空 | `data/tickers` にfallback |
| `date/open/high/low/close/volume` の必須キー不足 | `data/tickers` にfallback |
| 選択日不足 | `data/tickers` にfallback |
| `?dataMode=legacy` | public_jsonを読まず、最初から `data/tickers` 固定 |

## 6. 既存機能への影響

- 一覧: チャート描画だけpublic_json優先。ランキング、価格、前日比、バッジなどは既存overview/ranking由来のままです。
- picked: チャート描画だけpublic_json優先。pick管理や詳細リンクは従来どおりです。
- registered: チャート描画だけpublic_json優先。登録セット管理や詳細リンクは従来どおりです。
- 銘柄詳細: 常に `data/tickers` を使います。
- RCI/RSI: 変更なし。public_jsonには含めません。
- 戦略理由: 変更なし。public_jsonには含めません。
- metadata/links: 変更なし。詳細情報は既存経路を維持しています。

## 7. 次に実装すべき最小タスク3つ

1. 実画面Networkで通常URLが `data/public_json` を読み、`?dataMode=legacy` が `data/tickers` を読むことを確認する。
2. `scripts/build_public_json_candidate.py` に `--updated-codes` を追加し、日次差分生成を実装する。
3. `data/public_json`, `data/warehouse`, `*.parquet`, `*.duckdb`, 巨大JSONを `.gitignore` に追加する変更を行う。
