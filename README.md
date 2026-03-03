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
- `data/jquants_sync_state.json`
  - J-Quants の最終成功同期日を保持する

## 起動方法

最も簡単な方法:

- Finder で [`/Users/okamoto/kabu_doragon/open_kabu_doragon.command`](/Users/okamoto/kabu_doragon/open_kabu_doragon.command) をダブルクリック
- 自動でローカルサーバーを起動し、[http://127.0.0.1:8010/index.html](http://127.0.0.1:8010/index.html) を既定ブラウザで開きます

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

### J-Quants の初期設定

J-Quants Light を標準経路として使います。まず `.env.example` をコピーして `.env` を作成してください。

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

- 推奨は `JQUANTS_API_KEY` を入れる方法です
- `JQUANTS_API_KEY` があればそれを優先します
- API キーがない場合だけ、`JQUANTS_API_REFRESH_TOKEN` または `MAIL_ADDRESS + PASSWORD` を使います
- `.env` は git に入れません

J-Quants のプラン差:

- `Light`: 過去 5 年分の日次 OHLCV を最新まで取得可能
- `Free`: 過去 2 年分、かつ 12 週間遅延

このプロジェクトは最新日次更新が目的なので、`Light` を前提にしています。

### 価格データの取得

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

### JSON の再生成

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py --provider jquants
```

通常実行は増分 build です。`fetch_prices.py` が書く `data/update_state.json` を使って、更新された銘柄だけ `tickers/*.json` を再生成し、同時に更新日だけの軽量キャッシュ `data/daily_records/YYYY-MM-DD.json` を更新し、その日付だけ `rankings / overview / manifest` を再生成します。

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

`--days 60` は full rebuild 時に直近 60 営業日ぶんの `rankings / overview / manifest` を再生成する指定です。

### 少数銘柄でのテスト

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py \
  --skip-fetch \
  --days 10 \
  --codes 1301,3133,7203
```

### 旧 yfinance 経路を使う場合

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/fetch_prices.py \
  --provider yfinance \
  --universe tse \
  --segments prime,standard,growth \
  --period 5y \
  --batch-size 50
```

J-Quants の取得に失敗した場合、自動で `yfinance` には切り替わりません。エラーで停止します。

### 当日分が返ってきたかの確認

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

### 引け後の30分おき再試行

日中のトップ画面チャートは自動では動きません。  
ただし、自動更新は次の時刻帯で「当日分が出たか」を確認し、出ていれば自動で反映できます。

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

### 前場四本値の確認

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

有効化の確認:

```bash
launchctl list | rg 'com\\.okamoto\\.kabu_doragon_(am_update|close_retry)'
```
