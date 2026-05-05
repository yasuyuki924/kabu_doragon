# KabuDragon overview / ticker detail 軽量化結果レポート

## 1. 基本情報

- 実行日: 2026-05-06
- ブランチ: `feature/lightweight-ticker-detail`
- 目的:
  - `data/overview/{date}/market_pulse.json` を `data/public_json/overview_recent/{date}/market_pulse.json` へ逃がす。
  - 銘柄詳細ページの通常表示で、`data/tickers/{code}.json` を読まずに `ticker_recent` / `ticker_meta` / `ticker_detail_recent` を優先する。
- 今回も `data/tickers` / `data/overview` の削除・移動・圧縮は未実行。
- main merge / Git履歴掃除 / `git gc` / `git filter-repo` は未実行。

## 2. 変更したファイル

| ファイル | 内容 |
|---|---|
| `scripts/build_lightweight_detail_public_json.py` | overview_recent、ticker_meta、ticker_detail_recentを生成する新規スクリプト |
| `scripts/run_update_and_build_public_json.sh` | J-Quants更新後のpublic_json再生成にdetail/overview生成と検証を追加 |
| `assets/app_data.js` | overviewをpublic_json優先に変更し、ticker_meta / ticker_detail_recent読み込み関数を追加 |
| `assets/app.js` | ticker_meta / ticker_detail_recent読み込み関数をページdepsへ公開 |
| `assets/page_ticker.js` | 通常詳細ページでchart/meta/detailの軽量JSONを合成し、失敗時だけdata/tickersへfallback |
| `index.html` / `picked.html` / `registered.html` / `ticker.html` | JSクエリバージョン更新 |

## 3. 生成したpublic_json

| パス | 内容 | 件数 | 容量 |
|---|---|---:|---:|
| `data/public_json/overview_recent/{date}/market_pulse*.json` | 既存overview内のmarket_pulse系JSONコピー | 270 | 約4.0GB |
| `data/public_json/ticker_meta/{code}.json` | 銘柄プロフィール / links / snapshot | 3,791 | 約1.3MB |
| `data/public_json/ticker_detail_recent/1y/{code}.json` | 直近1年のRCI/RSI/strategy/technical detail | 3,791 | 約803MB |
| `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` | 既存の直近1年OHLCV+MA | 3,797 | 約132MB |

生成メトリクス:

- overview_recent: 270 files / 4,257,086,722 bytes / 2.22 sec
- ticker_meta: 3,791 files / 1,358,772 bytes
- ticker_detail_recent: 3,791 files / 919,141 rows / 834,387,944 bytes / 194.30 sec
- 合計: 196.53 sec

代表銘柄:

| code | meta | detail | detail rows | range |
|---|---:|---:|---:|---|
| 6327 | 304 B | 210,521 B | 245 | 2025-05-01 - 2026-05-01 |
| 7162 | 364 B | 220,651 B | 245 | 2025-05-01 - 2026-05-01 |
| 4772 | 443 B | 220,564 B | 245 | 2025-05-01 - 2026-05-01 |

## 4. overview market_pulseのpublic_json化

- 通常URLでは `assets/app_data.js` の `loadOverviewData()` が先に以下を読む。

```text
data/public_json/overview_recent/{date}/market_pulse{suffix}.json
```

- `?dataMode=legacy` の場合は従来どおり以下を読む。

```text
data/overview/{date}/market_pulse{suffix}.json
```

- public_json側が404 / parse失敗等の場合は `data/overview` 側へfallbackする。

注意:

- `market_pulse.json` 自体が1日あたり約19MBあるため、既存日付分をpublic_jsonへコピーすると約4.0GBになる。
- これは「`data/overview` から読み込み先を逃がす」互換レイヤーとしては有効だが、真の軽量化には `records` の縮小、必要日数限定、または概要/一覧用JSONの再設計が必要。

## 5. ticker_metaの構造

`data/public_json/ticker_meta/{code}.json` は以下を持つ。

```text
code, name, market, sector, industry, tags, themes, links, snapshotDate, snapshotType, updatedAt
```

用途:

- 銘柄詳細タイトル
- 市場 / タグ / profile
- Yahoo / IR等の外部リンク
- snapshot表示

## 6. ticker_detail_recentの構造

`data/public_json/ticker_detail_recent/1y/{code}.json` は以下を持つ。

```text
code, range, updatedAt, startDate, endDate, rows
```

`rows` には直近1年分の以下を含める。

```text
date, change, changePercent,
distanceToMa25, distanceToMa75, distanceToMa200,
volumeRatio25,
rci12, rci24, rci48, rsi2,
rangePosition52w,
strategyMatches, strategyScores, strategyReasons, strategyExcludedReasons,
trendTurnReason, trendTurnScore, trendTurnAboveMa75Ratio
```

OHLCVとMAは既存の `ticker_recent/1y/ohlcv_ma` から読み、detail側には重複保存しない。

## 7. 画面確認結果

Playwright/Chromeで `127.0.0.1:8010` を確認。

### 一覧

URL:

```text
http://127.0.0.1:8010/index.html?date=2026-04-30&sort=gainers&limit=100&turnover=0&range=3&timeframe=daily
```

結果:

- `data/public_json/overview_recent/2026-04-30/market_pulse.json` を1回読み込み。
- `data/overview/...` は読まない。
- 一覧チャートは `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を読む。
- console/page errorなし。

### 銘柄詳細 通常URL

URL:

```text
http://127.0.0.1:8010/ticker.html?code=6327
```

結果:

- `data/public_json/ticker_recent/1y/ohlcv_ma/6327.json` を読む。
- `data/public_json/ticker_meta/6327.json` を読む。
- `data/public_json/ticker_detail_recent/1y/6327.json` を読む。
- `data/tickers/6327.json` は読まない。
- 銘柄名、理由文、チャート、テクニカル表示は表示。
- console/page errorなし。

### 銘柄詳細 legacy

URL:

```text
http://127.0.0.1:8010/ticker.html?code=6327&dataMode=legacy
```

結果:

- public_jsonのchart/meta/detailは読まない。
- `data/tickers/6327.json` を読む。
- 銘柄名、理由文、チャート、テクニカル表示は表示。
- console/page errorなし。

## 8. 通常URLでdata/tickers依存が減ったか

- 銘柄詳細通常URLでは、`data/tickers/6327.json` を読まない状態まで進んだ。
- `data/tickers` はfallback / legacy / 1年以上前の日付 / public_json欠損時の安全弁として残す。
- これにより、通常詳細ページの初期表示で数MBの巨大JSON取得を避けられる。

## 9. data/overviewを削除できるか

まだ削除不可。

理由:

- public_json側へmarket_pulse互換コピーはできたが、内容はほぼ同等で約4.0GBある。
- まだ `data/overview` fallbackを安全弁として残している。
- true lightweightにするには、一覧表示に必要なキーだけへ再生成する必要がある。

削除可能に近づく条件:

- `overview_recent` を全日付コピーではなく、最新/必要日だけに制限する。
- `records` のキーを画面表示・ソート・フィルタに必要なものだけへ削る。
- `?dataMode=legacy` またはアーカイブ復元手順を残す。
- 代表日付でNetwork確認を済ませる。

## 10. data/tickersを削除できるか

まだ削除不可。

理由:

- 通常詳細ページはdata/tickersを読まなくなったが、fallback / legacyとして必要。
- 1年以上前の日付やpublic_json欠損時は `data/tickers` が安全弁。
- 生成スクリプト自体も現時点では `data/tickers` からticker_meta/detailを作っている。

削除可能に近づく条件:

- `ticker_meta` / `ticker_detail_recent` をJ-Quants更新後に安定生成できる。
- 1年以上前の詳細表示方針を決める。
- `data/tickers` ではなくwarehouseからdetailを生成できるようにする。
- 一定期間、通常運用で `data/tickers` fallbackが発生しないことを確認する。
- 削除ではなく圧縮退避から始める。

## 11. 残課題

- `overview_recent` が約4.0GBで、軽量化としてはまだ不十分。
- `ticker_detail_recent` が約803MBで、理由文を1年分保持する設計としては許容範囲だが、さらなる圧縮余地はある。
- `scripts/build_lightweight_detail_public_json.py` は `data/tickers` を入力にしているため、真に `data/tickers` を退避するにはwarehouse由来のdetail生成が必要。
- `data/public_json` 全体は約4.9GBになった。Git管理外なのでpush対象ではないが、ローカル容量には注意が必要。

## 12. 次の候補

1. `overview_recent` を最新/直近日付だけに限定する。
2. overview recordsのキーを一覧画面で本当に使うものだけへ削る。
3. `ticker_detail_recent` をlatestのみ/1年分で切り替えられるようにする。
4. `ticker_meta` と `ticker_detail_recent` をwarehouse/overview生成処理から作れるようにする。
5. fallback発生ログを集計し、`data/tickers` 退避判断材料にする。

