# KabuDragon Strategy Migration Audit

作成日: 2026-05-27

## 目的

ストラテジー整理の前段として、現在UIに出ている手法、内部だけにある手法、ランキング系、JS側で後判定しているロジックを棚卸しし、Python側へ寄せる優先順位を整理する。

この監査では挙動を変えない。実装変更は次段階で、比較テストを作ってから行う。

## 現在の実装場所

| 種別 | 主なファイル | 役割 |
| --- | --- | --- |
| UI表示定義 | `assets/app_config.js` | ランキング、スキャナーのストラテジー選択肢、ラベル |
| スキャナー制御 | `assets/page_index_scanner.js` | URL状態、UI、フィルター、並び替え、日足専用戦略の追加判定 |
| 指標生成 | `src/indicators/core.py` | OHLCVから指標、反発、トレンド転換、ストラテジー結果を生成 |
| ストラテジー定義 | `src/screening/strategy_presets.py` | Minervini、Stage 2、Turtle、CAN SLIM、RSI(2)、High Pullback 30% |
| ランキング生成 | `src/screening/ranking.py`, `scripts/build_rankings.py` | 各ランキングJSONの抽出・並び替え |
| 仕様メモ | `STRATEGY_README.md` | 手法条件の説明 |

## UIに出ているスキャナー手法

| UI key | 表示名 | 現在の判定場所 | 状態 |
| --- | --- | --- | --- |
| `strategy_minervini` | 成長ブレイク（Minervini） | Python `strategy_presets.py` -> `strategyMatches` | JSはフィルターのみ |
| `strategy_stage2` | 中期上昇入り（Stage 2） | Python `strategy_presets.py` -> `strategyMatches` | JSはフィルターのみ |
| `strategy_turtle` | 高値ブレイク（Turtle） | Python `strategy_presets.py` -> `strategyMatches` | JSはフィルターのみ |
| `strategy_rsi2` | 上昇中の押し目（RSI(2)） | Python `strategy_presets.py` -> `strategyMatches` | JSはフィルターのみ |
| `trend_turn` | 200日線回復（ベース・リカバリー） | Python `core.py` / `ranking.py` | JSは `trendTurnCandidate` を見るだけ |
| `strategy_high_pullback_30` | 高値調整（30% Pullback） | Pythonにも実装済み、JSにも後判定あり | 段階移行候補 |
| `strategy_strong_trend_pullback_rebound` | 強トレンド押し目リバウンド | JS後判定のみ | 最優先のPython移行候補 |

## 内部にあるがスキャナー主選択肢ではないもの

| key | 表示/用途 | 現在の判定場所 | 備考 |
| --- | --- | --- | --- |
| `strategy_canslim` / `can_slim` | ランキング設定には存在 | Python `strategy_presets.py`, `build_rankings.py` | スキャナー主UIには出していない |
| `rebound_signal` | 反発シグナル | Python `core.py`, `ranking.py` | スキャナーでは内部フラグをフィルター |
| `lower_shadow` | 下ひげ | Python `ranking.py` と JS補助判定 | スキャナーUIの扱いは限定的 |
| `watch_candidates` | 監視候補 | Python `ranking.py` | スキャナー主UI外 |
| `new_high`, `deviation25/75/200`, `gainers`, `losers`, `volume_spike` | ランキング | Pythonランキング生成 / JS overviewソート | ストラテジーというよりランキング |
| `new_high_20d`, `bullish_close_breakout_20d`, `stop_high` | UI内部フィルター | Python生成フラグ + JSフィルター | 現UIで主選択肢ではない |

## JS側に残っている判定ロジック

| ロジック | JSでやっていること | Python移行可否 | リスク |
| --- | --- | --- | --- |
| `strategy_high_pullback_30` | 保存済み `highPullback30` があれば使い、なければ銘柄別チャートJSONを追加ロードして再判定 | 可能。すでにPython結果がある | 既存の古いJSONや日付別不足をどう扱うか確認が必要 |
| `strategy_strong_trend_pullback_rebound` | 銘柄ごとに recent/full chart rows をロードし、上昇幅、押し目、MA接触、反発、出来高を計算 | 可能。Python新規実装が必要 | 件数差、速度、過去日付対応の比較が必要 |
| ランキング系ソート | overviewレコードを直接ソート | 残してよい | UI操作として軽い |
| 表示用バッジ/ポップオーバー | strategyReasons / metrics の表示 | 残すべき | 表示責務なのでJSでよい |
| URL・日足専用制御 | timeframe制限、query同期 | 残すべき | UI責務なのでJSでよい |

## Python側へ寄せる優先順位

### 1. `strategy_strong_trend_pullback_rebound`

最優先。現在もっとも重く、銘柄ごとの追加JSONロードが必要。Python側で日次生成時に判定して `strategyMatches` に入れば、スキャナーは通常戦略と同じフィルターだけで済む。

安全な移行手順:

1. PythonにJSロジック相当の関数を追加する
2. 固定日付でJS結果とPython結果の件数・銘柄コード・スコアを比較するダミー/実データテストを作る
3. `strategyMatches` に追加するが、JS後判定はフォールバックとして残す
4. 差分が許容できることを確認してからJS後判定を無効化する

### 2. `strategy_high_pullback_30`

すでにPython側に `high_pullback_30` があるため、完全移行しやすい。ただしJSは古い/不足データ時の再判定フォールバックも担っている。まずは「Python結果がある場合はJS再計算しない」状態を確認し、次にフォールバック削除を検討する。

### 3. 設定一元化

UI key と strategy id の対応が複数箇所に分散している。

- UI key: `strategy_minervini`
- strategy id: `minervini_trend_template`
- ranking file: `strategy_minervini.json`

この対応表を `assets/app_config.js` に寄せるか、Pythonから生成した小さなmanifestにする。最初は手動の対応表で十分。

## JSに残すべきもの

- URLパラメータ同期
- dropdown / segmented control などのUI制御
- 表示件数、売買代金、テーマ、タグの画面上フィルター
- `strategyReasons` / `strategyMetrics` の表示
- lazy chart rendering
- ランキング系の軽いソート

## 次にやる安全な実装単位

次の1手は `strategy_strong_trend_pullback_rebound` のPython実装を「追加だけ」すること。

- 既存JS挙動は消さない
- Python結果とJS結果の比較レポートを出す
- まず固定日付 `2026-05-15` と `2026-05-22` で比較する
- 一致または差分理由が説明できるまで、UIの参照先は切り替えない

これなら壊れる面積が小さく、速度改善の見込みがもっとも大きい。
