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
└── scanner.html
```

## ファイルの役割

- `index.html`
  - 日付選択、ランキング、相場概況、監視リストのトップページ
- `ticker.html`
  - `code` と `date` を受けて、その日基準のチャートを表示
- `scanner.html`
  - 指定日基準の縦スクロール連続チャート
- `assets/app.js`
  - `manifest / rankings / overview / tickers` を読んで描画するフロント
- `scripts/fetch_prices.py`
  - 既存 `src/fetch_nikkei225.py` を呼び出して OHLCV と watchlist を更新
- `scripts/build_ticker_data.py`
  - `data/ohlcv/*.csv` から銘柄ごとの `data/tickers/*.json` を生成
- `scripts/build_rankings.py`
  - 日付ごとのランキング JSON を生成
- `scripts/build_market_overview.py`
  - 日付ごとの相場概況 JSON と `data/manifest.json` を生成
- `scripts/run_daily.py`
  - 一連の処理をまとめて実行する入口

## 起動方法

```bash
cd "/Users/okamoto/kabu_doragon"
python3 -m http.server 8010
```

ブラウザで開く:

```text
http://127.0.0.1:8010/index.html
```

`file://` 直開きでは `fetch()` が失敗するので、HTTP サーバー経由で開いてください。

## データ更新方法

### 価格データの取得

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/fetch_prices.py \
  --universe tse \
  --segments prime,standard,growth \
  --period 5y \
  --batch-size 50
```

### JSON の再生成

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py --skip-fetch --days 60
```

`--days 60` は、直近 60 営業日ぶんの `rankings / overview / manifest` を作る最小構成です。  
保持日数を増やしたい場合は `--days` を大きくしてください。

### 少数銘柄でのテスト

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python scripts/run_daily.py \
  --skip-fetch \
  --days 10 \
  --codes 1301,3133,7203
```

## データ構造

### `data/manifest.json`

```json
{
  "generatedAt": "2026-03-01T11:00:00",
  "latestDate": "2026-02-27",
  "availableDates": ["2026-02-20", "2026-02-21", "2026-02-27"],
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
