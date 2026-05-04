# KabuDragon 銘柄詳細ページ軽量化設計レポート

## 1. 現状

- ブランチ: `feature/lightweight-ticker-detail`
- 調査日: 2026-05-05
- 最新実装では、一覧 / picked / registered / 銘柄詳細チャートのOHLCV描画は `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を優先している。
- 銘柄詳細ページ本体は、引き続き `loadTickerPayload(code)` 経由で `data/tickers/{code}.json` を読む。
- `?dataMode=legacy` では、詳細チャートも従来どおり `data/tickers/{code}.json` を使う。
- `data/tickers` は約21GB残っており、詳細ページのメタ情報・テクニカル・strategy理由文・linksのために必要な状態。

## 2. data/tickers依存キー一覧

### 読み込み経路

| ファイル | 関数/処理 | 内容 |
|---|---|---|
| `assets/page_ticker.js` | `initTickerPage` 初期ロード / refresh | `loadTickerPayload(code)` で詳細ページ本体データを取得 |
| `assets/app.js` | `loadTickerPayload(code)` | `loadTickerPayloadData(fetchJson, code)` へ委譲 |
| `assets/app_data.js` | `loadTickerPayloadData(fetchJson, code)` | `./data/tickers/{code}.json` をfetch |

### top-levelキー

代表銘柄 `6327`, `7162`, `4772` では、top-levelは以下の11キー。

| キー | 用途 | 軽量化方針 |
|---|---|---|
| `code` | 銘柄コード | detail軽量JSONに残す |
| `name` | 銘柄名 / タイトル / カード | detail軽量JSONに残す |
| `market` | 市場 / ヘッダーメタ / profile | detail軽量JSONに残す |
| `sector` | profile | detail軽量JSONに残す |
| `industry` | profile | detail軽量JSONに残す |
| `tags` | ヘッダーメタ / profile | detail軽量JSONに残す |
| `themes` | 現詳細ページでは直接表示なし、将来候補 | 任意。まずは残してよい |
| `links` | 外部リンク / Yahoo / IR等 | detail軽量JSONに残す |
| `snapshotDate` | snapshot表示 | detail軽量JSONに残す |
| `snapshotType` | snapshot表示 | detail軽量JSONに残す |
| `ohlcv` | チャート、サマリー、テクニカル、strategy | chart用とdetail用に分離 |

### rowキー

代表銘柄の `ohlcv` rowは87キー。詳細ページが直接使っている主なキーは以下。

| 分類 | キー | 用途 |
|---|---|---|
| 基本価格 | `date`, `open`, `high`, `low`, `close`, `volume`, `change`, `changePercent` | サマリー / カード / 日付選択 / チャート連動 |
| MA/距離 | `ma5`, `ma25`, `ma75`, `ma200`, `distanceToMa25`, `distanceToMa75`, `distanceToMa200` | チャート / テクニカル表示 |
| 出来高指標 | `volumeRatio25` | テクニカル表示 |
| RCI/RSI | `rci12`, `rci24`, `rci48`, `rsi2` | RCI/RSI表示、strategy評価 |
| 52週位置 | `rangePosition52w` | テクニカル表示 |
| strategy | `strategyMatches`, `strategyScores`, `strategyReasons`, `strategyExcludedReasons` | バッジ / 理由文 |
| trend turn | `trendTurnReason`, `trendTurnScore`, `trendTurnAboveMa75Ratio` | trendTurn系表示・将来拡張 |

## 3. public_jsonで代替済みの範囲

`data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` は以下を保持している。

```text
date, open, high, low, close, volume, ma5, ma25, ma75, ma200
```

代替済みまたは代替可能な範囲:

- 日足 / 週足 / 月足チャート描画
- MA線表示
- 直近1年のOHLCV表示
- `change` / `changePercent` は既存の `normalizeRecentTickerPayload()` で前日終値から補完可能

代替できない範囲:

- 銘柄名 / 市場 / セクター / 業種 / タグ / links
- `distanceToMa25`, `distanceToMa75`, `distanceToMa200`
- `volumeRatio25`
- `rci12`, `rci24`, `rci48`, `rsi2`
- `strategyMatches`, `strategyScores`, `strategyReasons`, `strategyExcludedReasons`
- `trendTurnReason`, `trendTurnScore`, `trendTurnAboveMa75Ratio`
- snapshot情報

## 4. detail用軽量JSONに必要な項目

詳細ページを `data/tickers` なしで表示するには、chart用JSONとは別に「メタ情報 + 詳細指標」の軽量JSONが必要。

### 推奨構造: 2ファイル分離

#### A. `data/public_json/ticker_meta/{code}.json`

メタ情報だけを持つ。

```json
{
  "code": "6327",
  "name": "北川精機",
  "market": "スタンダード",
  "sector": "...",
  "industry": "...",
  "tags": ["..."],
  "themes": ["..."],
  "links": {
    "quote": "...",
    "ir": "...",
    "news": "..."
  },
  "snapshotDate": "2026-05-01",
  "snapshotType": "..."
}
```

用途:

- タイトル
- ヘッダーの市場 / タグ
- profile
- 外部リンク
- snapshot表示

#### B. `data/public_json/ticker_detail_recent/1y/{code}.json`

直近1年の詳細指標だけを持つ。OHLCV本体は既存 `ticker_recent/1y/ohlcv_ma` に任せる。

```json
{
  "code": "6327",
  "range": "1y",
  "rows": [
    {
      "date": "2026-05-01",
      "distanceToMa25": 46.6331,
      "distanceToMa75": 85.8401,
      "distanceToMa200": 167.9839,
      "volumeRatio25": 1.3542,
      "rci12": 84.62,
      "rci24": 95.93,
      "rci48": 56.88,
      "rsi2": 98.9382,
      "rangePosition52w": 92.2428,
      "strategyMatches": [],
      "strategyScores": {
        "minervini_trend_template": 0.0,
        "stan_weinstein_stage2": 0.0,
        "turtle_donchian_breakout": 0.0,
        "can_slim": 0.0,
        "rsi2_pullback": 1.5
      },
      "strategyReasons": {
        "rsi2_pullback": ["MA50から +59.3% の押し目", "押し目候補"]
      },
      "trendTurnReason": "",
      "trendTurnScore": 0
    }
  ]
}
```

用途:

- テクニカルカード
- RCI/RSI
- strategyバッジ
- strategy理由文
- trendTurn系

### 代替案

| 案 | パス | 評価 |
|---|---|---|
| メタ・詳細分離 | `ticker_meta/{code}.json` + `ticker_detail_recent/1y/{code}.json` | 推奨。メタだけ欲しい場合に最小ロードできる |
| 1ファイル統合 | `ticker_detail_recent/1y/{code}.json` にmetaとrowsを同梱 | 実装は簡単だが、linksだけ欲しい場合も詳細行を読む |
| chart JSONへ詳細キー追加 | `ticker_recent/1y/ohlcv_ma/{code}.json` にRCI/strategyも入れる | 非推奨。軽量チャートJSONが再肥大化する |

## 5. 想定容量

代表銘柄実測:

| code | 現行 `data/tickers` | chart public_json | metaのみ推定 | latest detail推定 | 1年detail rows推定 |
|---|---:|---:|---:|---:|---:|
| 6327 | 6,217,300 B | 34,052 B | 264 B | 1,155 B | 210,675 B |
| 7162 | 6,270,262 B | 33,578 B | 324 B | 1,443 B | 220,865 B |
| 4772 | 6,374,280 B | 33,384 B | 403 B | 1,382 B | 220,857 B |

全3,797銘柄換算の概算:

| 構成 | 推定容量 | コメント |
|---|---:|---|
| `ticker_meta` のみ | 約1.2MB | ほぼ無視できるサイズ |
| `ticker_meta` + 最新日detailのみ | 約4.8MB | 最新サマリー中心なら十分 |
| `ticker_detail_recent/1y` 詳細行込み | 約788MB | strategy理由文を1年分持つと大きいが、21GBより大幅に小さい |
| 既存 chart public_json | 約132MB | すでに生成済み |
| chart + meta + 1年detail rows | 約920MB前後 | data/tickers 21GB比で約95%削減 |

結論として、全機能維持を優先するなら `ticker_detail_recent/1y` は1GB弱を見込む。容量最優先なら「meta + latest detail」から始め、選択日を変えた場合だけlegacy fallbackまたはAPI生成にするのが安全。

## 6. 実装ステップ

### Step 1: meta軽量JSON PoC

- `data/public_json/ticker_meta/{code}.json` を生成する。
- 詳細ページのタイトル / profile / links / snapshotだけをmeta JSONへ切り替える。
- `data/tickers` はfallbackとして残す。
- 期待効果: 初期表示で巨大JSONを読まずにヘッダー・チャートを出せる。

### Step 2: latest detail軽量JSON PoC

- `data/public_json/ticker_detail_latest/{code}.json` または `ticker_detail_recent/1y/{code}.json` の最新行だけを生成する。
- テクニカルカード、RCI、strategyバッジ、理由文を最新日だけ軽量JSONから表示する。
- 日付変更時は未対応ならlegacy fallback。

### Step 3: 直近1年 detail rows

- `data/public_json/ticker_detail_recent/1y/{code}.json` を生成する。
- 日付ピッカーで直近1年内の選択ならlegacy不要にする。
- 1年以上前はlegacy fallbackまたは「詳細指標は直近1年のみ」と明示する。

### Step 4: fallback整理

- 通常: chart public_json + ticker_meta + ticker_detail_recent
- `?dataMode=legacy`: `data/tickers`
- 軽量JSONが404 / parse失敗 / selectedDate不足の場合のみ `data/tickers` へfallback

### Step 5: data/tickers退避判断

- 銘柄詳細ページの通常利用で `data/tickers` を読まないことをNetwork確認。
- legacyモードとバックアップを残したうえで、`data/tickers` を圧縮退避候補にする。

## 7. data/tickers退避可能になる条件

`data/tickers` を通常運用から外すには、最低限以下が必要。

- 一覧 / picked / registered / 詳細チャートが `data/public_json/ticker_recent/1y/ohlcv_ma` で安定表示される。
- 銘柄詳細ページのtitle / meta / profile / linksが `ticker_meta` で表示できる。
- 銘柄詳細ページのテクニカル / RCI / strategy / 理由文が `ticker_detail_recent` またはAPI経由で表示できる。
- `?dataMode=legacy` または退避アーカイブから復旧できる手順がある。
- J-Quants更新後に chart / meta / detail のpublic_jsonを再生成する運用フローがある。
- 代表銘柄だけでなく、ランキング上位・低位株・上場廃止候補・出来高ゼロ系でfallbackが確認済み。
- `data/tickers` を削除ではなく、まず外部/デスクトップ/Google Drive等に圧縮退避してから一定期間運用する。

## 8. リスク

- strategy理由文は銘柄・日付によって文字列量が大きく、1年分を全銘柄で持つと約800MB級になる可能性がある。
- 1年より古い選択日に対して、detail指標をどう扱うか決める必要がある。
- `distanceToMa*` や `volumeRatio25` はpublic_jsonから再計算可能だが、既存生成値と丸め差が出る可能性がある。
- RCI/RSI/strategyはブラウザ再計算より生成時保存のほうが安全。
- `links` や `tags` はwatchlistやoverview側にも重複している可能性があり、canonical sourceを決める必要がある。

## 9. 次のcommit候補

今回のレポートだけをcommitする場合:

```text
docs: design lightweight ticker detail data
```

次に実装する最小タスク候補:

1. `ticker_meta` 生成PoCスクリプトを追加する。
2. 詳細ページで `ticker_meta` を優先し、`data/tickers` をfallbackにする。
3. `ticker_detail_latest` または `ticker_detail_recent/1y` の生成仕様を小さく実装して、代表銘柄でNetwork削減を確認する。
