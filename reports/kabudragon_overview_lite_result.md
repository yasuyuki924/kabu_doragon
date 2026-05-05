# KabuDragon overview_lite 軽量化結果レポート

## 1. 基本情報

- 実行日: 2026-05-06
- ブランチ: `feature/lightweight-ticker-detail`
- 目的: 一覧画面が実際に使うキーだけに絞った `market_pulse` lite を作り、`data/public_json/overview_recent` の互換コピー依存を減らす。
- 削除・移動・圧縮は未実行。

## 2. 調査結果

一覧画面では、主に以下の用途で `market_pulse.records` を使う。

- 一覧カード表示: `code`, `name`, `close`, `change`, `changePercent`, `volume`, `high`, `low`
- フィルタ: `industry`, `themes`, `strategyMatches`, `newHigh20d`, `trendTurnCandidate`, `signalCategory`, `distanceToMa25/75/200`, `turnoverMa5`
- ソート: `changePercent`, `volumeRatio25`, `newHigh52w`, `newHigh20d`, `trendTurnScore`, `trendTurnAboveMa75Ratio`, `strategyScores`, `distanceToMa25/75/200`
- 品質表示: `dataQuality`, `date`
- strategyバッジ/ポップオーバー: `strategyMatches`, `strategyScores`, `strategyReasons`
- リンク: `links`
- 下ヒゲ判定: `open`, `high`, `low`, `close`
- グループ/フィルタ候補: `market`, `sector`, `industry`, `tags`, `themes`

## 3. 実装内容

### 生成

`scripts/build_lightweight_detail_public_json.py` に `overview_lite` 生成を追加した。

出力:

```text
data/public_json/overview_lite/{date}/market_pulse*.json
```

top-level summaryは維持し、`records` の各rowだけを必要キーへ削減する。

保持するrecordキー:

```text
code, name, market, sector, industry, tags, themes, links,
date, open, high, low, close, volume, change, changePercent,
distanceToMa25, distanceToMa75, distanceToMa200,
volumeRatio25, turnoverMa5, dataQuality,
newHigh52w, newHigh20d,
trendTurnCandidate, trendTurnScore, trendTurnAboveMa75Ratio,
signalCategory,
strategyMatches, strategyScores, strategyReasons,
watchCandidateScore
```

### 読み込み

`assets/app_data.js` の `loadOverviewData()` を以下の順に変更した。

1. 通常URL: `data/public_json/overview_lite/{date}/market_pulse*.json`
2. lite失敗時: `data/public_json/overview_recent/{date}/market_pulse*.json`
3. recent失敗時: `data/overview/{date}/market_pulse*.json`
4. `?dataMode=legacy`: `data/overview/{date}/market_pulse*.json` 固定

`scripts/run_update_and_build_public_json.sh` の検証にも `overview_lite` 件数確認を追加した。

## 4. サイズ削減結果

| 対象 | 件数 | 容量 | コメント |
|---|---:|---:|---|
| `data/public_json/overview_recent` | 270 | 約4.0GB | 既存overview互換コピー |
| `data/public_json/overview_lite` | 270 | 約966MB | 必要キーだけに削減 |

削減率:

- 約4.0GB → 約966MB
- 約77%削減
- 約3.3GB削減

代表日付 `2026-04-30`:

| 対象 | サイズ | records |
|---|---:|---:|
| `data/overview/2026-04-30/market_pulse.json` | 19,811,593 B | 3,731 |
| `data/public_json/overview_recent/2026-04-30/market_pulse.json` | 19,811,593 B | 3,731 |
| `data/public_json/overview_lite/2026-04-30/market_pulse.json` | 4,084,757 B | 3,731 |

## 5. 画面確認結果

### 通常URL

URL:

```text
http://127.0.0.1:8010/index.html?date=2026-04-30&sort=gainers&limit=100&turnover=0&range=3&timeframe=daily
```

確認結果:

- `data/public_json/overview_lite/2026-04-30/market_pulse.json` を読む。
- `data/public_json/overview_recent/...` は読まない。
- `data/overview/...` は読まない。
- chartは `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を読む。
- データ取得に関するconsole/page errorなし。
- favicon 404のみ発生。アプリ動作とは無関係。

### legacy URL

URL:

```text
http://127.0.0.1:8010/index.html?date=2026-04-30&sort=gainers&limit=100&turnover=0&range=3&timeframe=daily&dataMode=legacy
```

確認結果:

- `data/public_json/overview_lite` は読まない。
- `data/public_json/overview_recent` は読まない。
- `data/overview/2026-04-30/market_pulse.json` を読む。
- データ取得に関するconsole/page errorなし。

## 6. data/overviewを削除できるか

まだ削除不可。

理由:

- `overview_lite` は通常一覧画面では動くが、fallbackとして `overview_recent` と `data/overview` を残している。
- weekly/monthlyや特殊sort/filterでの代表確認を追加した方が安全。
- `overview_lite` の保持キーは現行画面ベースで絞っているため、将来UIで未保持キーを使う場合はfallbackが必要。

削除可能に近づく条件:

- `overview_lite` で daily / weekly / monthly の主要URLを確認する。
- strategy系、下ヒゲ、S高、deviation、trend_turnなど主要sortを確認する。
- fallback発生ログがないことを一定期間確認する。
- `data/overview` は削除ではなく、まずアーカイブ退避にする。

## 7. 次の候補

1. `overview_recent` の互換コピーを保持する期間を決める。
2. `overview_lite` の `strategyReasons` をさらに短縮するか検討する。
3. weekly/monthlyの軽量overview確認を追加する。
4. `data/overview` 退避前チェックリストを作る。

