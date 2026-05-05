# KabuDragon ローカルdata運用メモ

## 1. Git管理されないローカルdata一覧

以下はGit管理外/ignore対象としてローカルに保持する。

| パス | 用途 | 削除可否 |
|---|---|---|
| `data/tickers/` | 詳細ページ本体、legacyモード、理由文/RCI/RSI/metadata | まだ削除不可 |
| `data/public_json/` | 通常チャート表示用の軽量JSON | 削除不可 |
| `data/overview/` | 一覧画面の `market_pulse.json` など | 削除不可 |
| `data/warehouse_test/` | public_json生成元のPoC warehouse | まだ削除不可 |
| `data/ohlcv/` | 正式データ/再生成元候補 | 削除不可 |
| `data/ohlcv_raw/` | raw取得データ/検証用 | 削除不可 |
| `data/cache/` | 再生成可能キャッシュ | 内容次第で整理候補 |
| `data/archive/` | 将来の退避先候補 | 運用ルール策定後に使用 |

## 2. data/tickers が必要な理由

- 銘柄詳細ページのメタ情報・理由文・RCI/RSI・strategy系がまだ `data/tickers/{code}.json` に依存している。
- `?dataMode=legacy` の切り戻し用としても必要。
- 詳細ページの通常表示から `data/tickers` を外せるまでは削除しない。

## 3. data/public_json が必要な理由

- 通常URLの一覧 / picked / registered / 銘柄詳細チャートが優先的に読む。
- パス:

```text
data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json
```

- 約132MBで、従来の `data/tickers` 21GBより大幅に軽い。
- J-Quants更新後は `scripts/build_public_json_candidate.py` または `scripts/run_update_and_build_public_json.sh` で再生成する。

## 4. data/overview が必要な理由

- 現行画面が以下のようなファイルを直接読む。

```text
data/overview/{date}/market_pulse.json
```

- `data/overview` を削除すると、一覧/ランキング画面で404が発生する。
- 例:

```text
JSON 読み込み失敗: ./data/overview/2026-04-30/market_pulse.json (404)
```

- 2026-05-05の整理時に一度削除したが、画面404のためアーカイブから復元済み。

## 5. data/warehouse_test が残っている理由

- `scripts/build_public_json_candidate.py` の入力として使う。
- パス:

```text
data/warehouse_test/prices_by_year/year=*/prices.parquet
```

- 次フェーズで `data/warehouse` として正式化するか検討する。
- 正式化までは削除しない。

## 6. 別PCでpullしたときの注意

- Gitには巨大dataを入れていないため、pullだけでは画面は完全には動かない。
- 少なくとも以下を別途配置する必要がある。

```text
data/tickers/
data/public_json/
data/overview/
data/warehouse_test/
data/ohlcv/
data/ohlcv_raw/
```

- これらは外付けSSD、Google Drive、Desktop退避アーカイブなどから復元する。
- Git管理外dataがない場合は、通常画面で404が出る可能性がある。

## 7. 初期データ配置手順

1. リポジトリをpullする。
2. ローカルdataバックアップから以下を配置する。

```text
data/tickers/
data/public_json/
data/overview/
data/warehouse_test/
data/ohlcv/
data/ohlcv_raw/
```

3. 以下を確認する。

```bash
test -d data/tickers && echo "OK tickers exists"
test -d data/public_json && echo "OK public_json exists"
test -d data/overview && echo "OK overview exists"
test -d data/warehouse_test && echo "OK warehouse_test exists"
test -f data/overview/2026-04-30/market_pulse.json && echo "OK overview market_pulse exists"
```

4. 構文確認を行う。

```bash
zsh -n scripts/run_update_and_build_public_json.sh
python3 -m py_compile scripts/build_public_json_candidate.py
node --check assets/page_ticker.js
```

5. 実配信で画面確認する。

```text
http://127.0.0.1:8010/index.html
http://127.0.0.1:8010/ticker.html?code=6327
http://127.0.0.1:8010/ticker.html?code=6327&dataMode=legacy
```

## 8. 404が出たときの確認方法

### public_json系

```bash
test -f data/public_json/ticker_recent/1y/ohlcv_ma/6327.json && echo "OK public_json 6327"
```

ブラウザNetworkで以下が200か確認する。

```text
data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json
```

### tickers系

```bash
test -f data/tickers/6327.json && echo "OK ticker 6327"
```

legacy URLで以下が読めるか確認する。

```text
http://127.0.0.1:8010/ticker.html?code=6327&dataMode=legacy
```

### overview系

```bash
test -f data/overview/2026-04-30/market_pulse.json && echo "OK overview market_pulse"
```

配信URLで確認する。

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  http://127.0.0.1:8010/data/overview/2026-04-30/market_pulse.json
```

## 9. 使用ポートの注意

- `localhost:8000` は別rootを配信している可能性がある。
- KabuDragonの実配信確認は `127.0.0.1:8010` を優先する。
- 404確認時は、どのディレクトリを配信しているサーバーか必ず確認する。

## 10. 今後削除してはいけないもの

現時点では以下を削除しない。

```text
data/tickers/
data/public_json/
data/overview/
data/warehouse_test/
data/ohlcv/
data/ohlcv_raw/
```

特に `data/overview` は一度削除して画面404になったため、軽量代替ができるまで削除しない。

## 11. 今後軽量化できる候補

| 対象 | 方針 |
|---|---|
| `data/overview` | 最新日/必要日だけのpublic_json化、market_pulse軽量化 |
| `data/tickers` | `ticker_meta` と `ticker_detail_recent` へ分離 |
| `data/warehouse_test` | `data/warehouse` として正式化し、差分更新へ移行 |
| `data/ohlcv` / `data/ohlcv_raw` | Parquet/DuckDBへ正式移行後に退避候補 |
| Git履歴 | backup後、別タスクでfilter-repo等を検討 |

