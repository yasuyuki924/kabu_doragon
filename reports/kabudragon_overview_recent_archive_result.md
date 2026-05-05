# KabuDragon overview_recent 圧縮退避結果レポート

## 1. 基本情報

- 実行日: 2026-05-06
- ブランチ: `feature/lightweight-ticker-detail`
- 目的: `data/public_json/overview_recent` 約4.0GBを常時展開しない構成にする。
- 削除対象: `data/public_json/overview_recent`
- 削除しない対象:
  - `data/overview`
  - `data/tickers`
  - `data/public_json/overview_lite`
  - `data/public_json/ticker_recent`
  - `data/public_json/ticker_meta`
  - `data/public_json/ticker_detail_recent`
  - `data/warehouse_test`
  - `data/ohlcv`
  - `data/ohlcv_raw`
- main merge / GitHub push / `git gc` / `git filter-repo` は未実行。

## 2. 作業前サイズ

| 対象 | サイズ |
|---|---:|
| `data/public_json` | 約5.8GB |
| `data/public_json/overview_recent` | 約4.0GB |
| `data/public_json/overview_lite` | 約921MB |
| `data/overview` | 約4.0GB |

## 3. 事前確認

- `data/public_json/overview_lite` が存在することを確認。
- `data/public_json/overview_recent` が存在することを確認。
- `data/overview` がfallbackとして存在することを確認。
- `overview_lite` / `overview_recent` はどちらも `market_pulse*.json` 270件。

削除前の画面確認:

| URL種別 | 読み込み先 | 結果 |
|---|---|---|
| 通常URL | `data/public_json/overview_lite/2026-04-30/market_pulse.json` | OK |
| legacy URL | `data/overview/2026-04-30/market_pulse.json` | OK |

## 4. 圧縮退避

退避先:

```text
~/Desktop/kabu_doragon_data_archive/public_json_overview_recent_20260506.tar.gz
```

アーカイブサイズ:

```text
420MB
```

アーカイブ内容確認:

- `data/public_json/overview_recent/` が含まれることを確認。
- 日付ディレクトリが含まれることを確認。

## 5. 削除結果

削除した対象:

```text
data/public_json/overview_recent
```

削除後確認:

- `data/public_json/overview_recent` が存在しないことを確認。
- `data/public_json/overview_lite` は残存。
- `data/overview` は残存。
- `data/tickers` は未変更。

## 6. 作業後サイズ

| 対象 | サイズ |
|---|---:|
| `data/public_json` | 約1.8GB |
| `data/public_json/overview_lite` | 約921MB |
| `data/overview` | 約4.0GB |
| `data` | 約27GB |

`data/public_json` は約5.8GBから約1.8GBへ削減。

## 7. 削除後の画面確認

### 通常URL

```text
http://127.0.0.1:8010/index.html?date=2026-04-30&sort=gainers&limit=100&turnover=0&range=3&timeframe=daily
```

確認結果:

- `data/public_json/overview_lite/2026-04-30/market_pulse.json` を読む。
- `data/public_json/overview_recent` は読まない。
- `data/overview` は読まない。
- データ取得エラーなし。
- console/page errorなし。

### legacy URL

```text
http://127.0.0.1:8010/index.html?date=2026-04-30&sort=gainers&limit=100&turnover=0&range=3&timeframe=daily&dataMode=legacy
```

確認結果:

- `data/public_json/overview_lite` は読まない。
- `data/public_json/overview_recent` は読まない。
- `data/overview/2026-04-30/market_pulse.json` を読む。
- データ取得エラーなし。
- console/page errorなし。

## 8. 残課題

- `data/overview` はまだ削除不可。legacy/fallbackとして残す。
- `overview_lite` は現行一覧画面の使用キーに基づくため、今後UIで新しいキーを使う場合は生成キーを追加する必要がある。
- weekly/monthlyや主要sort/filterの継続確認を増やすと、`data/overview` 退避判断がより安全になる。

## 9. data/overviewを削除できる条件

- daily / weekly / monthly の主要一覧URLで `overview_lite` が安定動作する。
- strategy系、下ヒゲ、S高、deviation、trend_turnなど主要sort/filterで欠落キーがない。
- 一定期間、通常運用で `overview_lite` から `data/overview` fallbackが発生しない。
- `data/overview` は削除ではなく、圧縮退避から始める。

## 10. data/tickersを削除できる条件

- 詳細ページ通常表示で `ticker_recent` / `ticker_meta` / `ticker_detail_recent` が安定動作する。
- `data/tickers` fallbackが一定期間発生しない。
- `ticker_meta` / `ticker_detail_recent` を `data/tickers` ではなくwarehouse等から再生成できる。
- `?dataMode=legacy` の扱いを再設計する。
- `data/tickers` も削除ではなく、圧縮退避から始める。

