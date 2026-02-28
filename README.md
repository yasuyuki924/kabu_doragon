# Local Stock Dashboard MVP

静的ファイルだけで動く、ローカル専用の株分析ダッシュボードです。  
データは `/data/watchlist.json` と `/data/market_summary.json` と `/data/ohlcv/{ticker}.csv` を読み込みます。

## 追加した構成

```text
.
├── assets/
│   ├── app.js
│   └── style.css
├── data/
│   ├── market_summary.json
│   ├── ohlcv/
│   │   └── 3133.csv
│   ├── tse_listed_components.csv
│   └── watchlist.json
├── index.html
└── ticker.html
```

## 起動方法

`fetch()` で JSON / CSV を読むため、`file://` 直開きではなく簡易HTTPサーバー経由を推奨します。

```bash
cd "/Users/okamoto/kabu_doragon"
python3 -m http.server 8000
open http://localhost:8000/index.html
```

## データ取得

### 日経225

日経225の構成銘柄CSVは `data/nikkei225_components.csv` を使います。  
日足データを `data/ohlcv/*.csv` と `data/watchlist.json` と `data/market_summary.json` に再生成するには:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python src/fetch_nikkei225.py --period 5y --batch-size 25
```

### 東証プライム / スタンダード / グロース全銘柄

JPX公式の「東証上場銘柄一覧」から、3市場の内国株式を抽出して watchlist 化できます。

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python src/fetch_nikkei225.py \
  --universe tse \
  --segments prime,standard,growth \
  --period 5y \
  --batch-size 50
```

既存の OHLCV を使って watchlist / summary だけ作り直す場合:

```bash
cd "/Users/okamoto/kabu_doragon"
./.venv/bin/python src/fetch_nikkei225.py \
  --universe tse \
  --segments prime,standard,growth \
  --skip-price-download
```

主な生成物:

- `data/tse_listed_components.csv`
- `data/watchlist.json`
- `data/market_summary.json`
- `data/ohlcv/*.csv`

## 連続チャート

フィルタ済み銘柄を最大50件まで下スクロールで見るページ:

```text
http://localhost:8000/scanner.html?sort=gainers&limit=50&months=3
```

主なパラメータ:

- `sort=gainers|losers|volume|code`
- `limit=20|30|50`
- `months=3|6`
- `tag=<tag名>`

`open index.html` だけでもファイル自体は開けますが、ブラウザの制約でローカルデータ読込に失敗する場合があります。  
その場合は上記の `python3 -m http.server` を使ってください。

## 画面

- `index.html`
  - watchlist 一覧
  - ticker / name の部分一致検索
  - `ticker`, `name`, `market` のソート
  - タグ絞り込み
  - タグ表示
  - `market_summary.json` 優先読込
  - ローカル保存の watchlist 追加 / 編集 / 削除
- `ticker.html?t=3133`
  - ローソク足
  - 出来高
  - 出来高移動平均 `5 / 25`
  - 移動平均線 `5 / 25 / 75 / 200`
  - RCI `12 / 24 / 48`
  - 期間切替 `1〜6ヶ月`
  - ローカルメモ保存
  - ファイル欠損時のエラー表示

## ローカル保存仕様

- watchlist 編集内容は `localStorage` に保存されます
- 元の `data/watchlist.json` は初期データとして残ります
- 「ローカル編集を破棄」で `localStorage` を消して初期状態へ戻せます
- 銘柄メモも `localStorage` に保存されます
- `market_summary.json` がある場合、一覧画面は銘柄ごとの CSV fetch を省略します

## データ形式

### `data/watchlist.json`

```json
[
  {
    "ticker": "3133",
    "name": "海帆",
    "market": "TSE",
    "tags": ["vortex", "watch"],
    "links": {
      "ir": "https://example.com/3133/ir",
      "news": "https://example.com/3133/news"
    }
  }
]
```

### `data/ohlcv/{ticker}.csv`

```csv
date,open,high,low,close,volume
2025-08-01,842,861,831,854,421300
```

### `data/market_summary.json`

```json
{
  "generatedAt": "2026-02-28T18:00:00",
  "universe": "tse",
  "recordCount": 1800,
  "records": [
    {
      "ticker": "1301",
      "latestDate": "2026-02-27",
      "latestClose": 4120,
      "changePercent": 1.42
    }
  ]
}
```

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
