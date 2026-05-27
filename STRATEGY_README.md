# KabuDragon Strategy README

このドキュメントは、KabuDragon に実装されているストラテジー、スクリーニング手法、ランキング条件をコードベースから整理したものです。

対象ファイル:

- `assets/app_config.js`
- `assets/app.js`
- `assets/page_index_scanner.js`
- `src/indicators/core.py`
- `src/screening/ranking.py`
- `src/screening/strategy_presets.py`
- `src/utils/indicators.py`
- `src/utils/screening.py`
- `scripts/build_rankings.py`
- `scripts/rebound_signal.py`

## 共通指標

| 指標 | 計算式・意味 |
| --- | --- |
| `MA(n)` | 終値の単純移動平均。主に 5, 25, 50, 75, 140, 150, 160, 200 日。 |
| `distanceToMaN` | `(close - MA(n)) / MA(n) * 100` |
| `maNSlopePct` | `(MA(n)[today] - MA(n)[20日前]) / MA(n)[20日前] * 100` |
| `turnover` | `close * volume` |
| `turnoverMa5` | 売買代金の5日平均 |
| `volumeRatio25` | `volume / volumeMa25` |
| `high52w` / `low52w` | 直近252本程度の高値・安値 |
| `distanceTo52wHighPct` | `(high52w - close) / high52w * 100` |
| `near52wHighRatio` | `close / high52w` |
| `recoveryFrom52wLowPct` | `(close / low52w - 1) * 100` |
| `base` | 指定期間の `rangePct = (windowHigh - windowLow) / windowLow * 100` が閾値以下なら検出 |
| `breakoutDistancePct` | `(breakoutLevel - close) / breakoutLevel * 100` |
| `RSI(2)` | Wilder型 RSI |
| `RCI(12/24/48)` | 時間順位と価格順位の相関 |

## UI登録ストラテジー

### 1. 成長ブレイク（Minervini）

- UI key: `strategy_minervini`
- 内部ID: `minervini_trend_template`
- 表示名: 成長ブレイク（Minervini）

高値圏で強い上昇トレンドにある銘柄を拾うためのストラテジーです。

#### 除外条件

- `close < 300`
- `turnoverMa5 < 100,000,000` かつ `volumeRatio25 < 1.0`
- `unstableBelowMa200Days > 3`
- `volatility20Pct > 18`

`unstableBelowMa200Days` は、直近20本で `close < ma200 * 0.95` だった日数です。

#### マッチ条件

- `close > ma50`
- `close > ma150`
- `close > ma200`
- `ma50 > ma150 > ma200`
- `ma200SlopePct > 0`
- `near52wHighRatio >= 0.85`
- `recoveryFrom52wLowPct >= 30`

#### 補助評価

- `base10to30.detected == true`
- `min(distanceToBaseHighPct, distanceToPrevHighPct) <= 3`

#### スコア

- 株価が50日・150日・200日線の上: `+3`
- 移動平均線が理想的な順列: `+3`
- 200日線が上向き: `+2`
- 52週高値圏: `+2`
- 52週安値から30%以上回復: `+1`
- 高値圏ベース形成: `+2`
- レンジ上限または前回高値まで3%以内: `+2`

### 2. 中期上昇入り（Stage 2）

- UI key: `strategy_stage2`
- 内部ID: `stan_weinstein_stage2`
- 表示名: 中期上昇入り（Stage 2）

Stan Weinstein の Stage 2 移行候補を意識した、長期線上抜けと中期ベースの組み合わせです。

#### 除外条件

- `close < 300`
- `turnoverMa5 < 100,000,000` かつ `volumeRatio25 < 0.9`
- `ma150SlopePct <= 0`
- `close <= ma150`
- `distanceToMa150 > 25`
- `volatility20Pct > 20`

#### マッチ条件

- `close > ma150`
- `ma150SlopePct > 0`
- `base20to60.detected == true`
- `close` が `base20to60.high` から3%以内

#### 計算式

```text
stage2 = close > ma150 && ma150SlopePct > 0
base20to60 = 20〜60日の値幅が18%以内
breakoutCandidate = (baseHigh - close) / baseHigh * 100 <= 3
```

#### スコア

- 150日線の上: `+2`
- 150日線上向き: `+2`
- 中期ベース形成: `+2`
- 中期ブレイク候補: `+2`
- `volumeRatio25 >= 1.3`: `+1`
- 何らかの理由があれば Stage 2 候補として `+1`

### 3. 高値ブレイク（Turtle）

- UI key: `strategy_turtle`
- 内部ID: `turtle_donchian_breakout`
- 表示名: 高値ブレイク（Turtle）

20日または55日高値更新を機械的に拾う Donchian breakout 型の手法です。

#### 除外条件

- `close < 200`
- `turnoverMa5 < 80,000,000` かつ `volumeRatio25 < 0.8`
- `upperWick3dAvg > 0.45`
- `volumeBoostRequired == true` の場合、`volumeRatio25 < 1.3`
- `newHigh20dCount10 > 4`

#### マッチ条件

20日または55日の Donchian 高値を、終値または高値で更新します。

```text
donchian20High = 前日までの20日高値
donchian55High = 前日までの55日高値
breakout = close >= donchianHigh || high >= donchianHigh
```

#### 補助加点

- 高値更新
- 高値更新幅
- `volumeRatio25 >= 1.3`
- `close > ma50`
- `close > ma150`
- `base10to20.detected == true`

### 4. 上昇中の押し目（RSI(2)）

- UI key: `strategy_rsi2`
- 内部ID: `rsi2_pullback`
- 表示名: 上昇中の押し目（RSI(2)）

上昇トレンド内で短期的に売られすぎた押し目候補を拾います。

#### 除外条件

- `close < 200`
- `turnoverMa5 < 80,000,000` かつ `volumeRatio25 < 0.8`
- `ma200SlopePct <= 0`
- `changePercent <= -8`

#### マッチ条件

- `ma200SlopePct > 0`
- `close > ma50`
- `RSI(2) <= 10`
- `consecutiveDownDays >= 2`

#### 計算式

```text
consecutiveDownDays = 終値が前日終値を下回り続けた本数
pullbackDepthPct = distanceToMa50
```

#### スコア

- 上昇トレンド内の短期売られすぎ: `+2`
- RSI(2) 閾値以下: `+2`
- 連続下落日数条件: `+1`
- MA50からの押し目深さ表示: `+1`
- 出来高倍率条件: `+0.5`

### 5. 200日線回復（ベース・リカバリー）

- UI key: `trend_turn`
- 表示名: 200日線回復（ベース・リカバリー）

長期間200日線下にいた銘柄が、今日200日線を回復する場面を拾います。

#### マッチ条件

- 今日 `close > ma200`
- 前日 `previousClose <= previousMa200`
- 過去120日分の `ma200` が有効
- 過去120日で `close > ma200` だった日数が10日以下

#### 計算式

```text
aboveCount = 過去120日中、終値がMA200より上の日数
trendTurnScore = 120 - aboveCount
trendTurnAboveMa75Ratio = aboveCount / 120
distanceToMa200 = (close - ma200) / ma200 * 100
```

#### ソート

1. `aboveCount` が少ない順
2. `abs(distanceToMa200)` が小さい順
3. `volumeRatio25` 降順
4. `changePercent` 降順

### 6. 高値調整（30% Pullback）

- UI key: `strategy_high_pullback_30`
- 内部ID: `high_pullback_30`
- 表示名: 高値調整（30% Pullback）
- 日足専用

直近200本高値から短期間に30%以上調整した銘柄を拾います。

#### マッチ条件

- 直近200本の最高値を探す
- その最高値の後、10本以内の最安値を探す
- 高値からその後安値までの下落率が30%以上
- その安値達成から5本以内

#### 計算式

```text
highest200 = 直近200本の最高値
afterLow = highest200 の後10本以内の最安値
dropRate = (highest200 - afterLow) / highest200 * 100
barsToLow = lowIndex - highIndex
barsSinceLow = currentIndex - lowIndex
currentDrawdownPct = (highest200 - currentClose) / highest200 * 100
```

#### ソート

1. `abs(dropRate - 30)` が小さい順
2. `dropRate` が大きい順
3. `changePercent` 昇順

### 7. 強トレンド押し目リバウンド

- UI key: `strategy_strong_trend_pullback_rebound`
- 内部ID: `strong_trend_pullback_rebound`
- 表示名: 強トレンド押し目リバウンド
- 日足専用

直近で強く上昇した後、MA25/MA75付近まで押して、反発し始めた銘柄を拾います。

#### 事前フィルタ

要約データがある場合のみ、以下を足データ読み込み前に使います。

- `close >= ma5`
- `distanceToMa75 >= -8`
- `high52w` がある場合、`(high52w - close) / high52w * 100 >= 15`

要約データがない過去日は、ここで落とさず足データで判定します。

#### マッチ条件

- 直近60本を見る
- 60本内の安値から、その後の高値までの上昇率が30%以上
- 現在値がその高値から15〜45%押している
- `currentClose >= ma5`
- `ma75SlopePct >= -3`
- `distanceToMa75 >= -8`
- 押し目期間中に、MA25へ3%以内またはMA75へ5%以内に接触

#### 計算式

```text
risePct = (high - low) / low * 100
dropPct = (high - currentClose) / high * 100
ma75SlopePct = (currentMa75 - ma75[20日前]) / ma75[20日前] * 100
distanceToMa25 = (currentClose - ma25) / ma25 * 100
distanceToMa75 = (currentClose - ma75) / ma75 * 100
volumeRatio20 = currentVolume / average(volume, 20本)
lowerWickRatio = (min(open, close) - low) / (high - low)
```

#### 反発補助

- `ma5` が前日以上
- 終値が直近5本高値を突破
- 終値が直近10本高値を突破
- `volumeRatio20 >= 1.0` または `>= 1.2`
- 押し目出来高が上昇局面出来高の90%以下
- 押し目中の最大下ヒゲ比率が0.35以上

#### 分類

- `dropPct >= 30`: 深押しリセット
- それ以外: 通常押し目
- MA25上で反発: `ma25_rebound`
- MA75付近反発: `ma75_rebound`

#### スコア

- 上昇率、押し幅、MA接触、MA回復、出来高、下ヒゲ、MA75傾きで加点
- 通常押し目: 55点以上で採用
- 深押しリセット: 48点以上で採用、ただしスコア上限82

## 内部実装あり・UIで主役ではない手法

### 8. CAN SLIM

- UI key: `strategy_canslim`
- 内部ID: `can_slim`

内部実装とランキング生成はありますが、現在のメインストラテジードロップダウンには表示されていません。

#### 除外条件

- `close < 300`
- `turnoverMa5 < 120,000,000` かつ `volumeRatio25 < 1.0`
- `volatility20Pct > 22`

#### マッチ条件

- `close / high52w >= 0.88`
- `base20to60.detected == true`
- `close` が `base20to60.high` から3%以内
- `ma50 > ma150 > ma200`
- `turnoverMa5 >= 120,000,000` または `volumeRatio25 >= 1.4`

### 9. 反発シグナル

- key: `rebound_signal`

下ヒゲやハンマー型のローソク足を分類する内部シグナルです。

#### 計算式

```text
range = high - low
body = abs(close - open)
lowerWick = min(open, close) - low
upperWick = high - max(open, close)
lowerRatio = lowerWick / range
upperRatio = upperWick / range
bodyRatio = body / range
closePos = (close - low) / range
```

#### 下ヒゲ条件

- `lowerRatio >= 0.40`
- `lowerWick >= body * 1.20`
- `closePos >= 0.50`
- `upperWick <= lowerWick`

#### 強ハンマー条件

- `lowerRatio >= 0.50`
- `lowerWick >= body * 1.50`
- `bodyRatio <= 0.35`
- `upperWick <= lowerWick * 0.50`
- `closePos >= 0.55`

#### 分類

- `strong_rebound`: 強ハンマー型 かつ 前日陰線 かつ 終値がMA5未満
- `rebound_candidate`: 下ヒゲ かつ 前日陰線または終値がMA5未満
- `lower_wick_only`: 下ヒゲのみ
- `none`: それ以外

### 10. 下ヒゲ

- key: `lower_shadow`

より明示的な下ヒゲランキングです。

#### 条件

```text
body = abs(close - open)
lowerShadow = min(open, close) - low
upperShadow = high - max(open, close)
range = high - low
lowerShadowRatio = lowerShadow / range
```

採用条件:

- `lowerShadow >= body * 2.0`
- `lowerShadowRatio >= 0.35`
- `upperShadow <= lowerShadow * 0.8`

強度:

- strong: `lowerShadow >= body * 3.0` かつ `lowerShadowRatio >= 0.45` かつ `upperShadow <= lowerShadow * 0.6`
- medium: `lowerShadow >= body * 2.0` かつ `lowerShadowRatio >= 0.35`
- weak: `lowerShadow >= body * 1.2` かつ `lowerShadowRatio >= 0.25`

### 11. 新高値

- key: `new_high`

#### 条件

```text
newHigh52w = close >= high52w
```

ソート:

1. `newHigh52w`
2. `changePercent`
3. `distanceToMa25`

### 12. 20日陽線終値ブレイク

- key: `bullish_close_breakout_20d`

#### 条件

- 当日陽線: `close >= open`
- 過去20日の陽線終値最高値を、今日の終値が上抜け

```text
highestPast20dBullishClose = max(close of past 20 days where close >= open)
bullishCloseBreakout20d = close >= open && close > highestPast20dBullishClose
```

関連内部フラグ:

- `newHigh20d`: 当日を含む20日内の陽線終値高値更新

### 13. ストップ高

- key: `stop_high`

JPXの制限値幅テーブルを使って、ストップ高到達を判定します。

#### 計算式

```text
prevClose = close - change
limitWidth = JPX制限値幅テーブルから取得
limitUpPrice = prevClose + limitWidth
reachedLimit = abs(high - limitUpPrice) <= 0.5
isLock = abs(close - limitUpPrice) <= 0.5
```

分類:

- `lock`: ストップ高張り付き
- `peeled`: 高値では到達したが終値は剥がれ
- `none`: 非該当

### 14. 監視候補

- key: `watch_candidates`

勢い、短期乖離、出来高、RCI、新高値を合成した監視候補スコアです。

#### スコア

```text
watchCandidateScore =
  max(changePercent, 0) * 1.6
  + max(distanceToMa25, 0) * 0.9
  + volumeRatio25 * 5.0
  + max(rci12, 0) / 20.0
  + (newHigh52w ? 4.0 : 0)
```

### 15. 移動平均乖離ランキング

- keys: `deviation25`, `deviation75`, `deviation200`

#### 計算式

```text
distanceToMa25 = (close - ma25) / ma25 * 100
distanceToMa75 = (close - ma75) / ma75 * 100
distanceToMa200 = (close - ma200) / ma200 * 100
```

UIでは範囲フィルタもあります。

- `gte`: 指定値以上
- `lte`: 指定値以下
- `between`: 最小値〜最大値

### 16. 値上がり率・値下がり率・出来高増加

- keys: `gainers`, `losers`, `volume`

#### 計算式

```text
change = close - previousClose
changePercent = change / previousClose * 100
volumeRatio25 = volume / volumeMa25
```

ランキング:

- `gainers`: `changePercent` 降順
- `losers`: `changePercent` 昇順
- `volume`: `volumeRatio25` 降順

## UI表示状況

### メインストラテジードロップダウンに表示

- 成長ブレイク（Minervini）
- 中期上昇入り（Stage 2）
- 高値ブレイク（Turtle）
- 上昇中の押し目（RSI(2)）
- 200日線回復（ベース・リカバリー）
- 高値調整（30% Pullback）
- 強トレンド押し目リバウンド

### 内部実装あり・UIで主役ではないもの

- CAN SLIM
- 反発シグナル
- 下ヒゲ
- 新高値
- 20日陽線終値ブレイク
- ストップ高
- 監視候補
- MA乖離ランキング
- 値上がり率/値下がり率/出来高増加ランキング
