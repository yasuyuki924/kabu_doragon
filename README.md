# Local Stock Dashboard MVP

既存の `index.html` を活かしながら、日付指定で過去ランキングを遡れるローカル専用の株分析サイトです。  
フロントは `JSON -> 描画` に寄せ、計算とランキング生成は Python 側で行います。

## 現在の構成

```text
.
├── assets/
│   ├── app.js
│   └── style.css
├── scripts/
│   ├── build_market_overview.py
│   ├── build_rankings.py
│   ├── build_ticker_data.py
│   ├── common.py
│   ├── fetch_prices.py
│   └── run_daily.py
├── data/
│   ├── daily_records/
│   │   └── YYYY-MM-DD.json
│   ├── manifest.json
│   ├── overview/
│   │   └── YYYY-MM-DD/market_pulse.json
│   ├── rankings/
│   │   └── YYYY-MM-DD/*.json
│   ├── tickers/
│   │   └── 3133.json
│   ├── ohlcv/
│   │   └── 3133.csv
│   ├── ohlcv_raw/
│   │   └── 3133.csv
│   ├── corporate_actions/
│   │   └── 3133.json
│   ├── tse_listed_components.csv
│   └── watchlist.json
├── index.html
├── ticker.html
└── picked.html
```

## ファイルの役割

- `index.html`
  - 日付選択、条件絞り込み、連続チャート一覧のトップページ
- `ticker.html`
  - `code` と `date` を受けて、その日基準のチャートを表示
- `picked.html`
  - scanner ベースのトップで選別した銘柄一覧とエクスポート
- `assets/app.js`
  - `manifest / rankings / overview / tickers` を読んで描画するフロント
- `data/theme_map.json`
  - PDFベースのテーマ定義。テーマ名と関連銘柄コード一覧を保持
- `scripts/fetch_prices.py`
  - 既定では `src/jquants_provider.py` を呼び出して OHLCV と watchlist を更新
  - `--provider yfinance` 指定時のみ旧 `src/fetch_nikkei225.py` を使う
- `scripts/build_ticker_data.py`
  - `data/ohlcv/*.csv` から銘柄ごとの `data/tickers/*.json` を生成
- `scripts/build_rankings.py`
  - 日付ごとのランキング JSON を生成
- `scripts/build_market_overview.py`
  - 日付ごとの相場概況 JSON と `data/manifest.json` を生成
- `scripts/run_daily.py`
  - 一連の処理をまとめて実行する入口
- `src/jquants_provider.py`
  - J-Quants Light を使って上場銘柄一覧と日次 OHLCV を取得する
  - `data/ohlcv_raw` に未補正 OHLCV、`data/ohlcv` に分割・併合補正後 OHLCV、`data/corporate_actions` に補正イベントを保存する
- `data/jquants_sync_state.json`
  - J-Quants の最終成功同期日を保持する

## 起動方法

最も簡単な方法:

- Finder で [`/Users/okamoto/kabu_doragon/open_kabu_doragon.command`](/Users/okamoto/kabu_doragon/open_kabu_doragon.command) をダブルクリック
- 自動でローカルサーバーを起動し、[http://127.0.0.1:8010/index.html](http://127.0.0.1:8010/index.html) を既定ブラウザで開きます

毎回サクッと開きたい場合:

- `open_kabu_doragon.command` を Dock やデスクトップに置いておくと、1回のクリックで起動できます
- さらに常駐化したい場合は [`/Users/okamoto/kabu_doragon/launchd/com.okamoto.kabu_doragon_http_server.plist`](/Users/okamoto/kabu_doragon/launchd/com.okamoto.kabu_doragon_http_server.plist) を `~/Library/LaunchAgents/` に配置して読み込むと、ログイン中は `http://127.0.0.1:8010/index.html` をすぐ開けます

## 構成整理メモ

2026-04 の第一段階リファクタリングでは、既存の実行入口を維持したまま内部責務を `src/` に分離しています。

- `scripts/`
  - 既存の実行入口を維持する薄いラッパー層
- `src/app/`
  - 日次パイプライン制御、共有ビュー用のデータ解決、manifest 生成
- `src/data_source/`
  - watchlist / theme / OHLCV / snapshot / daily cache の読み書き
- `src/indicators/`
  - 移動平均、RCI、WTD/MTD、日足 enrichment
- `src/screening/`
  - ランキング用スコアリング、overview 集計
- `src/common/`
  - パス、JSON I/O、日付・コード共通処理
- `src/exports/`
  - JSON 出力の薄い exporter 層

互換性のため [`/Users/okamoto/kabu_doragon/scripts/common.py`](/Users/okamoto/kabu_doragon/scripts/common.py) は残してあり、既存の `from common import ...` は当面そのまま動く前提です。

### 今回の整理で意図的に据え置いたもの

- `assets/app.js`
  - 5,000 行超のため、UI 挙動を壊さないことを優先して今回は未分割
- `data/` 配下の既存生成物
  - 現行 UI の表示前提になっているため、第一段階では配置変更せず
- `scripts/build_*.py`
  - 入口は維持しつつ、重複ロジックだけ先に `src/` へ退避

### Git 管理の方針

第一段階では、まず以下を `.gitignore` に寄せています。

- `logs/`
- `.tmp/`
- `output/`
- `data/intraday/*.json`
- `data/update_state.json`
- `data/current_snapshot_state.json`

`data/tickers/` や `data/rankings/` などの大きい生成物は、既存運用との互換性を優先してまだ tracked のままです。完全に Git を軽くする次段階では、生成先を `output/` へ逃がすか、配布用データと再生成データを分離するのが安全です。

手動で起動する場合:

```bash
cd "/Users/okamoto/kabu_doragon"
python3 -m http.server 8010
```

ブラウザで開く:

```text
http://127.0.0.1:8010/index.html
```

`/Users/okamoto/kabu_doragon/index.html` を Finder から直接開く `file://` 方式は非対応です。`fetch()` が失敗して、カレンダーやチャートが表示されません。
必ず [http://127.0.0.1:8010/index.html](http://127.0.0.1:8010/index.html) を開いてください。

### テーマフィルターについて

- `index.html` のテーマプルダウン先頭は常に `すべて` です
- テーマ定義の正本は PDF ですが、アプリが読む実データは [`/Users/okamoto/kabu_doragon/data/theme_map.json`](/Users/okamoto/kabu_doragon/data/theme_map.json) です
- テーマデータには `すべて` を入れません。`すべて` は UI 固定項目です
- テーマの追加・修正は画面 UI ではなく `data/theme_map.json` を正本として管理します
- `theme_map.json` の正式形式は `themes[].name` と `themes[].codes[]` です
- `codes[]` に入れる証券コードは、既存の `watchlist.json` に存在する銘柄に限定します
- Codex へは自然文で依頼して構いません。例:
  - `テーマ「量子コンピュータ関連」を追加して`
  - `テーマ「蓄電池」に 6501 を追加して`
  - `テーマ「防衛」から 6208 を削除して`
  - `この PDF をもとにテーマを追加して`
- Codex は `theme_map.json` 更新後に検証と再生成まで行う前提です
- テーマを追加・修正したら、少なくとも以下を実行して `tickers / rankings / overview / manifest` を再生成してください

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/validate_theme_map.py
./.venv/bin/python scripts/run_daily.py --skip-fetch --days 60
```

## データ更新方法

### 標準経路: Yahoo Finance

標準の取得経路は `yfinance` です。通常運用では J-Quants の設定は不要です。

通常の更新:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/fetch_prices.py \
  --universe tse \
  --segments prime,standard,growth \
  --history-years 5 \
  --batch-size 50
```

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py
```

初回 5 年同期をやり直したい場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/fetch_prices.py \
  --universe tse \
  --segments prime,standard,growth \
  --history-years 5 \
  --batch-size 50 \
  --full-refresh
```

`run_daily.py` の既定 provider も `yfinance` です。何も指定しなければ Yahoo 経路で取得と再生成を行います。

### J-Quants を明示利用する場合

J-Quants は予備経路として残しています。明示的に使う場合だけ `.env.example` をコピーして `.env` を作成してください。

```bash
cd "/Users/okamoto/kabu_doragon"
cp .env.example .env
```

`.env` に設定する項目:

```env
JQUANTS_PLAN=light
JQUANTS_API_KEY=
JQUANTS_API_MAIL_ADDRESS=
JQUANTS_API_PASSWORD=
JQUANTS_API_REFRESH_TOKEN=
```

運用ルール:

- 標準運用は Yahoo Finance です
- J-Quants は旧運用の互換経路として残しています
- J-Quants を解約する場合は、旧 launchd ジョブを停止してからにしてください

- 推奨は `JQUANTS_API_KEY` を入れる方法です
- `JQUANTS_API_KEY` があればそれを優先します
- API キーがない場合だけ、`JQUANTS_API_REFRESH_TOKEN` または `MAIL_ADDRESS + PASSWORD` を使います
- `.env` は git に入れません

J-Quants のプラン差:

- `Light`: 過去 5 年分の日次 OHLCV を最新まで取得可能
- `Free`: 過去 2 年分、かつ 12 週間遅延

このプロジェクトは最新日次更新が目的なので、`Light` を前提にしています。

### J-Quants で価格データを取得する場合

この経路は旧運用です。通常は使いません。

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/fetch_prices.py \
  --provider jquants \
  --universe tse \
  --segments prime,standard,growth \
  --history-years 5
```

初回 5 年同期をやり直したい場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/fetch_prices.py \
  --provider jquants \
  --universe tse \
  --segments prime,standard,growth \
  --history-years 5 \
  --full-refresh
```

### J-Quants で JSON を再生成する場合

この経路も旧運用です。通常の build は Yahoo Finance 前提で `--provider yfinance` または既定値を使ってください。

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py --provider jquants
```

通常実行は増分 build です。`fetch_prices.py` が書く `data/update_state.json` を使って、更新された銘柄だけ `tickers/*.json` を再生成し、同時に更新日だけの軽量キャッシュ `data/daily_records/YYYY-MM-DD.json` を更新し、その日付だけ `rankings / overview / manifest` を再生成します。株式分割・併合が入った場合は `adjustedDateFrom` 以降をまとめて再生成します。

取得済み CSV から JSON だけ再生成したい場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py --skip-fetch
```

全件再生成が必要なときだけ:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py --skip-fetch --full-rebuild --days 60
```

full rebuild では `tickers` 全件を再生成した上で、カレンダー用の `daily_records / rankings / overview / manifest` は「最新日から暦 3 か月」の営業日範囲だけを再生成します。`--days 60` はこのモードでは実質使われません。

`data/ohlcv/*.csv` は描画と指標計算に使う補正済み系列です。未補正の正本は `data/ohlcv_raw/*.csv` に残ります。株式分割・併合の反映後は、過去日のチャート、移動平均、乖離率、ランキングが変わることがあります。

トップ画面とスキャナーのカレンダーは全履歴ではなく、`manifest.latestDate` から暦 3 か月前までの営業日だけを表示します。

### 少数銘柄でのテスト

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py \
  --skip-fetch \
  --days 10 \
  --codes 1301,3133,7203
```

### Yahoo Finance の日足取得

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/fetch_prices.py \
  --provider yfinance \
  --universe tse \
  --segments prime,standard,growth \
  --history-years 5 \
  --batch-size 50
```

`yfinance` は `auto_adjust=False` の raw 日足を `data/ohlcv_raw/*.csv` に差分マージし、既存の分割・併合補正ロジックを通して `data/ohlcv/*.csv` を再生成します。  
J-Quants の取得に失敗した場合、自動で `yfinance` には切り替わりません。標準経路そのものを Yahoo にしているため、通常は J-Quants を経由しません。

`run_daily.py` を使う場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py --provider yfinance
```

### 場中5分更新と引け後確定

通常運用の自動更新は次の 2 本です。

- 場中5分更新: `scripts/run_yfinance_intraday_update.sh`
- 引け後確定: `scripts/run_yfinance_close_retry.sh`

### yfinance の場中データ

`yfinance` 由来の場中データを `暫定データ` として表示できます。これは正式日足ではなく、当日中だけの参考値です。

手動で取得する場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/zsh scripts/run_yfinance_intraday_update.sh
```

補足:

- 暫定値は `data/intraday/yf_snapshot.json` に保存されます
- 画面上のラベルは `暫定データ` です
- `更新` ボタンは取得開始ではなく、最新JSONの再読込と再描画だけを行います
- 取れなければ前営業日の正式データ表示を維持します
- 引け後に正式な日足が反映された場合は `daily` が優先されます

自宅Macで場中に自動更新したい場合:

```bash
cd "/Users/okamoto/kabu_doragon"
mkdir -p ~/Library/LaunchAgents
cp "launchd/com.okamoto.kabu_doragon_yfinance_intraday.plist" ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabu_doragon_yfinance_intraday.plist 2>/dev/null || true
launchctl load -w ~/Library/LaunchAgents/com.okamoto.kabu_doragon_yfinance_intraday.plist
```

補足:

- `launchd` 側は 5 分ごとに起動し、実際の更新は平日 9:20-11:30 / 12:30-15:30 の間だけ行います
- 多重起動は `logs/run_yfinance_intraday_update.lock` で防止します
- `logs/yfinance_intraday_launchd.log` と `logs/yfinance_intraday_launchd.err.log` で実行状況を確認できます
- `Refresh` ボタンは Yahoo 取得を起動せず、最新 JSON を再読込するだけです
- 朝一は Yahoo 側が当日足をまだ返さないことがあり、`PENDING` の回が出ます。これは失敗ではなく未公開タイミング扱いです
- 日足がまだ出ていない回でも、取得できる場合は intraday バーから当日 OHLCV を組み立てて反映します

### yfinance の引け後確定更新

設定ファイル:

- `launchd/com.okamoto.kabu_doragon_yfinance_close_retry.plist`

平日 `15:35` に当日分の日足を取得し、まだ未反映なら `15:40`、`16:00`、`16:15` に再試行します。  
成功した回で `current_snapshot_state.json` を `daily` に切り替え、画面上の当日表示も正式日足に移行します。  
`16:15` でも未反映なら、その日は `暫定データ（引け後未確定）` として固定し、翌営業日の通常更新へ戻します。

登録/解除コマンド:

```bash
mkdir -p ~/Library/LaunchAgents
cp "launchd/com.okamoto.kabu_doragon_yfinance_close_retry.plist" ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabu_doragon_yfinance_close_retry.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.okamoto.kabu_doragon_yfinance_close_retry.plist
```

```bash
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabu_doragon_yfinance_close_retry.plist
```

ログ:

- `logs/yfinance_close_retry.out.log`
- `logs/yfinance_close_retry.err.log`
- lock が 20 分以上古い場合は、次回実行で自動解放して再試行します

### J-Quants の当日反映チェック

`Light` は日中リアルタイム更新ではなく、J-Quants 側に当日の日足が出たあとで反映されます。  
J-Quants の公式ドキュメント上では、株価（四本値）の日次データは `16:30頃（JST）` に更新されます。  
前場四本値は `正午` 以降に取得できることがあり、本リポジトリでは `前場 -> 日通し` の 2 段階で当日表示を切り替えます。  
前場更新対象は全銘柄ではなく、最新ランキング上位と売買代金上位をもとに抽出した主要 `300銘柄` です。  
また、上場銘柄一覧など一部データは `17:30頃` に更新され、翌営業日 `08:00頃` に再更新されることがあります。  
当日分がすでに repo に入っているかは、次のコマンドで確認できます。

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/check_jquants_latest.py
```

出力例:

- 反映済み:
  - `OK: latest trading date 2026-03-02 is already reflected`
- まだ未反映:
  - `PENDING: targetDate=2026-03-02 manifest.latestDate=2026-02-27 sync.lastSuccessfulDate=2026-02-27`

### J-Quants の引け後再試行（旧運用 / 予備）

この経路は残していますが、通常運用は Yahoo 側の場中5分更新と引け後確定を使ってください。

- 平日 `16:30` から `20:00` まで 30 分おき
- 平日 `08:00` に 1 回

`08:00` の実行は、前営業日の上場銘柄一覧などの再更新を拾うためです。

手動で同じ処理を走らせる場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/zsh scripts/run_jquants_close_retry.sh
```

このスクリプトの挙動:

- すでに当日分が反映済みなら何もせず終了
- まだ未反映なら J-Quants 取得と JSON 再生成を実行
- それでも未反映なら `PENDING` として終了
- API エラーなどは `ERROR` として終了

補足:

- `PENDING` は失敗ではなく「J-Quants 側にまだ当日分が出ていない」状態です
- 最新反映後はブラウザを再読込すると [http://127.0.0.1:8010/index.html](http://127.0.0.1:8010/index.html) に当日分が出ます
- 当日分がまだない回は、次の 30 分枠で再試行されます

### J-Quants 前場更新（旧運用 / 非推奨）

当日分の前場スナップショットが有効かは、次のコマンドで確認できます。

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/check_jquants_am_snapshot.py
```

出力例:

- 前場表示中:
  - `OK: am snapshot 2026-03-03 is active`
- すでに日通しへ切替済み:
  - `OK: daily snapshot 2026-03-03 is already active`
- まだ未取得:
  - `PENDING: no am snapshot for 2026-03-03`

手動で前場更新を走らせる場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/zsh scripts/run_jquants_am_update.sh
```

補足:

- `data/intraday/am_snapshot.json` には `coverage.requested` と `coverage.succeeded` が入ります
- `requested` の `95%` 以上が成功した回だけ前場 snapshot を active にします
- それ未満の回は前場原本だけ残し、画面は前回状態を維持します

J-Quants を解約する場合:

```bash
launchctl disable gui/$(id -u)/com.okamoto.kabu_doragon_am_update
launchctl disable gui/$(id -u)/com.okamoto.kabu_doragon_close_retry
```

必要ならあわせて unload します。

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.okamoto.kabu_doragon_am_update.plist
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.okamoto.kabu_doragon_close_retry.plist
```

## データ構造

### `data/manifest.json`

```json
{
  "generatedAt": "2026-03-01T11:00:00",
  "latestDate": "2026-02-27",
  "availableDates": ["2026-02-20", "2026-02-21", "2026-02-27"],
  "currentSnapshot": {
    "date": "2026-03-03",
    "type": "am"
  },
  "rankingFiles": [
    "gainers",
    "losers",
    "volume_spike",
    "new_high",
    "deviation25",
    "watch_candidates"
  ]
}
```

### `data/rankings/YYYY-MM-DD/gainers.json`

```json
{
  "date": "2026-02-27",
  "ranking": "値上がり率",
  "count": 50,
  "items": [
    {
      "rank": 1,
      "code": "3133",
      "name": "海帆",
      "changePercent": 12.34
    }
  ]
}
```

### `data/overview/YYYY-MM-DD/market_pulse.json`

```json
{
  "date": "2026-02-27",
  "recordCount": 3765,
  "riseCount": 1820,
  "fallCount": 1640,
  "aboveMa25Count": 2011,
  "averageChangePercent": 0.42,
  "records": []
}
```

### `data/tickers/3133.json`

```json
{
  "code": "3133",
  "name": "海帆",
  "market": "グロース",
  "sector": "小売業",
  "ohlcv": [
    {
      "date": "2026-02-27",
      "open": 1000,
      "high": 1080,
      "low": 980,
      "close": 1050,
      "ma25": 912.4,
      "rci12": 88.2
    }
  ]
}
```

## 拡張しやすいポイント

- `data/rankings/YYYY-MM-DD/*.json`
  - 独自ランキングをファイル追加するだけで増やしやすい
- `data/overview/YYYY-MM-DD/market_pulse.json`
  - 市場別集計や騰落レシオなどを追加しやすい
- `data/tickers/<code>.json`
  - IR 要約、決算要約、ニュース要約、イベントフラグを銘柄単位で載せやすい
- `assets/app.js`
  - 画面ロジックは JSON を読むだけなので、計算追加の影響を受けにくい

# Monex Scouter Test Fetcher

マネックス証券「銘柄スカウター」から検証用データを取得するスクリプトです。  
2段階認証は**手動**で実施し、回避実装は行っていません。

## 出力先（変更済み）

デフォルト保存先は以下です。

- Google Drive が検出できる場合: `Google My Drive/MonexScouter`
- 検出できない場合: このプロジェクト配下 `output/`

この環境では通常、次の配下に保存されます。

- `/Users/okamoto/Library/CloudStorage/GoogleDrive-yasuyuki924@gmail.com/マイドライブ/MonexScouter`

必要なら `--output-dir` または `MONEX_OUTPUT_DIR` で変更できます。

## 生成物

- `requirements.txt`
- `src/login_and_fetch.py`
- `.gitignore`

## 事前準備

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

## 実行例

### 単一銘柄

```bash
python src/login_and_fetch.py \
  --code 6521 \
  --nav-wait-seconds 2.0 \
  --scouter-url 'https://monex.ifis.co.jp/index.php?hc=...&u_id=...'
```

### 複数銘柄（追加対応）

```bash
python src/login_and_fetch.py \
  --codes 6521,7203,6758 \
  --nav-wait-seconds 2.0 \
  --scouter-url 'https://monex.ifis.co.jp/index.php?hc=...&u_id=...'
```

### 銘柄固有タブを個別PDF化

```bash
python src/login_and_fetch.py \
  --codes 6521,7203 \
  --nav-wait-seconds 2.0 \
  --scouter-url 'https://monex.ifis.co.jp/index.php?hc=...&u_id=...'
  --export-tabs-pdf
```

## 主なオプション

- `--code 6521`: 単一銘柄
- `--codes 6521,7203,...`: 複数銘柄
- `--output-dir <path>`: 保存先ルート
- `--export-tabs-pdf`: `bcode=<code>` 付きタブURLのみPDF化
- `--force-login`: 保存済みセッションを使わず再ログイン
- `--close-on-finish`: 収集後にブラウザを閉じる（デフォルトは開いたまま）

## 収集後の挙動

- デフォルトではブラウザを開いたまま `next code>` 入力待ちになります。
- 空入力で終了できます。

## 出力ファイル構成

各銘柄ごとに:

- `scouter_<code>.json`
- `scouter_<code>.pdf`
- `scouter_<code>_tabs/*.pdf`（`--export-tabs-pdf` 時）
- `scouter_<code>_tabs/index.json`
- `_artifacts/fetch_error_*.png`（エラー時）

## セキュリティ注意

- ID/パスワード/認証コードはコードに保持しません。
- 機密情報はログ出力しません。
- `playwright/.auth/` や `.env` は `.gitignore` 済みです。

## 株探ニュース収集（今朝の注目ニュース / 明日の好悪材料）

`kabutan_news_collector.py` で、株探の市場ニュースから以下2種類を収集できます。

- 今朝の注目ニュース
- 明日の好悪材料

デフォルトは過去約3ヶ月（92日）です。

```bash
.venv/bin/python kabutan_news_collector.py
```

主なオプション:

- `--days 92`: 収集期間（日数）
- `--end-date YYYY-MM-DD`: 収集終了日（デフォルト: 実行日）
- `--category 9`: 株探ニュースカテゴリ（デフォルト: 注目）
- `--output-dir artifacts/kabutan_news`: 出力先

出力ファイル:

- `artifacts/kabutan_news/kabutan_news_3months.json`
- `artifacts/kabutan_news/kabutan_news_3months.csv`

差分更新（既存ファイルとのマージ）:

```bash
.venv/bin/python kabutan_news_collector.py \
  --update-existing \
  --write-dated-diff \
  --save-diff-to-gdrive \
  --gdrive-subdir KabutanNewsDiff \
  --write-chatgpt-prompt \
  --write-analysis-window \
  --analysis-days 14
```

差分ファイル（新規追加のみ）:

- `artifacts/kabutan_news/kabutan_news_diff_latest.json`
- `artifacts/kabutan_news/kabutan_news_diff_latest.csv`
- `artifacts/kabutan_news/kabutan_news_diff_YYYYMMDD.json`
- `artifacts/kabutan_news/kabutan_news_diff_YYYYMMDD.csv`
- `artifacts/kabutan_news/chatgpt_kabutan_news_prompt_YYYYMMDD.md`
- `artifacts/kabutan_news/chatgpt_kabutan_news_analysis_latest.json`
- `artifacts/kabutan_news/chatgpt_kabutan_news_analysis_latest.csv`
- `artifacts/kabutan_news/chatgpt_kabutan_news_analysis_YYYYMMDD.json`
- `artifacts/kabutan_news/chatgpt_kabutan_news_analysis_YYYYMMDD.csv`

Google Drive 保存先（自動検出）:

- `マイドライブ/KabutanNewsDiff/`

### 毎朝の自動巡回（launchd）

設定ファイル:

- `launchd/com.okamoto.kabutan_news_daily.plist`

平日 07:40（Asia/Tokyo）に日付付き差分を作成し、Google Driveへ保存します。  
登録/解除コマンド:

```bash
mkdir -p ~/Library/LaunchAgents
cp "launchd/com.okamoto.kabutan_news_daily.plist" ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabutan_news_daily.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.okamoto.kabutan_news_daily.plist
```

```bash
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabutan_news_daily.plist
```

### 引け後の自動更新（launchd）

設定ファイル:

- `launchd/com.okamoto.kabu_doragon_close_retry.plist`

平日 `16:30` から `20:00` まで 30 分おきに、当日分の日足が返ってきたかを確認します。  
加えて、平日 `08:00` に 1 回、前営業日分の上場銘柄一覧などの再更新を拾います。  
まだ返ってきていなければ `PENDING` として終了し、次の枠で再試行します。  
返ってきた回で `ohlcv / tickers / rankings / overview / manifest` を更新します。
日足同期時は分割・併合イベントも同時に取り込み、必要なら `adjustedDateFrom` 以降を追加で再生成します。

登録/解除コマンド:

```bash
mkdir -p ~/Library/LaunchAgents
cp "launchd/com.okamoto.kabu_doragon_close_retry.plist" ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabu_doragon_close_retry.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.okamoto.kabu_doragon_close_retry.plist
```

```bash
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabu_doragon_close_retry.plist
```

ログ:

- `logs/jquants_close_retry.out.log`
- `logs/jquants_close_retry.err.log`

`launchd` は対話シェルと PATH が異なるため、この更新スクリプトは `python` ではなく `./.venv/bin/python` を明示して動かす前提です。

### 正午の前場更新（launchd）

設定ファイル:

- `launchd/com.okamoto.kabu_doragon_am_update.plist`

平日 `12:05` と `12:30` に前場四本値の取得を試みます。  
取得できた回で `data/intraday/am_snapshot.json` を更新し、`tickers / rankings / overview / manifest` を前場値で再生成します。  
対象は全銘柄ではなく主要 `300銘柄` です。  
大引け後の日通し更新が通ると、当日表示は自動で `日通し` に切り替わります。

登録/解除コマンド:

```bash
mkdir -p ~/Library/LaunchAgents
cp "launchd/com.okamoto.kabu_doragon_am_update.plist" ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabu_doragon_am_update.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.okamoto.kabu_doragon_am_update.plist
```

```bash
launchctl unload ~/Library/LaunchAgents/com.okamoto.kabu_doragon_am_update.plist
```

ログ:

- `logs/jquants_am_update.out.log`
- `logs/jquants_am_update.err.log`

前場更新スクリプトも `launchd` の PATH に依存しないよう、`./.venv/bin/python` を明示して実行する前提です。

有効化の確認:

```bash
launchctl list | rg 'com\\.okamoto\\.kabu_doragon_(am_update|close_retry)'
```

## OHLCV 品質チェック

全銘柄の表示用データに異常がないかを確認する読み取り専用チェックです。
通常は警告モードで動き、異常があっても日次更新やデータファイルは変更しません。
デフォルトでは `data/watchlist.json` にある現役対象だけを検査し、上場廃止などでリストから外れた古いCSVは無視します。

```bash
cd "/Users/okamoto/My Project/kabu_doragon"
./.venv/bin/python scripts/check_all_ohlcv_quality.py
```

確認内容:

- `data/ohlcv/*.csv` の行数不足、日付順、重複日付、日付ギャップ
- OHLC の整合性
- 急落して数日内に急騰で戻る補正ズレ疑い
- `data/public_json/ticker_recent/1y/ohlcv_ma/*.json` の同様の異常
- `ohlcv` と `public_json` の終値不一致

異常が見つかった場合だけ `reports/kabudragon_ohlcv_quality_*.json` と `.md` を出力します。
レポートには `repair_first` / `gate_candidate` / `manual_review` / `observe` の分類も含めます。
最初は `repair_first` を確認し、誤検知が少ないことを見てから更新ゲート化します。
`data/recheck_ohlcv_adjusted` に修復候補がある場合は、実データを書き換えずに dry-run の修復計画も出します。
修復計画では、候補データで置き換えた場合に `ohlcv` と `public_json` の何行が変わるか、候補データの期間、候補データ後に残す末尾行数を確認できます。
更新ゲートとして使う段階になったら、危険な異常だけを対象に `--fail-on-critical` を付けて終了コードで止められます。
日次更新では、品質チェックは警告モードでのみ実行します。チェックに失敗しても更新処理は停止しません。
結果は `data/ohlcv_quality_summary.json` に書き出され、トップ画面の品質サマリーに重大件数と対象データを表示します。
詳細ログは `logs/ohlcv_quality_summary.log` に出し、launchd 側には1行サマリーだけを出します。

dry-run 修復計画を実際に適用する場合:

```bash
./.venv/bin/python scripts/apply_ohlcv_repair_plan.py \
  --quality-report reports/kabudragon_ohlcv_quality_YYYYMMDD_HHMMSS.json \
  --apply
```

適用時は、対象の `data/ohlcv` と `data/public_json/ticker_recent/1y/ohlcv_ma` を先に
`reports/ohlcv_repair_backup_YYYYMMDD_HHMMSS/` へ一時バックアップします。成功後は肥大化防止のため自動削除します。
バックアップを残したい場合だけ `--keep-backups` を付けます。`data/ohlcv_raw` は変更しません。
