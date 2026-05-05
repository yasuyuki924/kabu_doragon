# KabuDragon 軽量化フェーズ最終レポート

## 1. 基本情報

- 実行日: 2026-05-06
- ブランチ: `feature/lightweight-ticker-detail`
- 作成時点の最新commit: `ef0016fa docs: design lightweight ticker detail data`
- GitHub push: 本レポート作成時点では未実行
- main merge: 未実行
- `git gc` / `git filter-repo`: 未実行
- 実データ削除・移動・圧縮: 最終仕上げでは未実行

## 2. 軽量化で実施した内容

- `data/ohlcv` からParquet / DuckDB warehouse化PoCを実施し、正式データ候補として年別ParquetとDuckDBの有効性を確認した。
- `data/public_json/ticker_recent/1y/ohlcv_ma/{code}.json` を生成し、直近1年のチャート表示用JSONを約132MBに圧縮した。
- 一覧 / picked / registered のチャート描画を、通常URLで `data/public_json` 優先に切り替えた。
- `?dataMode=legacy` を追加し、必要時は従来の `data/tickers/{code}.json` を強制利用できるようにした。
- 銘柄詳細ページのチャート部分も `data/public_json` 優先にした。
- 銘柄詳細ページのメタ情報・理由文・RCI/RSI・strategy系は、現時点では従来どおり `data/tickers` を使う。
- J-Quants更新後に `data/public_json` を再生成する運用スクリプト `scripts/run_update_and_build_public_json.sh` を追加した。
- 巨大生成データをGit管理から外し、`.gitignore` に生成データ・warehouse・DB・圧縮ファイルの除外方針を追加した。
- 古いworktree `5c3c` / `69a0` はpatch退避後に削除済み。

## 3. public_json優先化の範囲

| 画面 / 機能 | 通常URL | `?dataMode=legacy` | 備考 |
|---|---|---|---|
| 一覧カードチャート | `data/public_json/ticker_recent/1y/ohlcv_ma` 優先 | `data/tickers` 固定 | public_json失敗時はfallback |
| pickedチャート | `data/public_json/ticker_recent/1y/ohlcv_ma` 優先 | `data/tickers` 固定 | public_json失敗時はfallback |
| registeredチャート | `data/public_json/ticker_recent/1y/ohlcv_ma` 優先 | `data/tickers` 固定 | public_json失敗時はfallback |
| 銘柄詳細チャート | `data/public_json/ticker_recent/1y/ohlcv_ma` 優先 | `data/tickers` 固定 | 詳細本体は別途 `data/tickers` を読む |
| 銘柄詳細メタ/理由文/RCI/RSI | `data/tickers` | `data/tickers` | 次フェーズの軽量化対象 |

## 4. legacyモードの扱い

- `?dataMode=legacy` は、public_json切替後の安全弁として残す。
- 通常URLでpublic_jsonに問題が出た場合でも、legacy URLで従来JSONを読める。
- `data/tickers` を退避するまでは、legacyモードは検証・切り戻し用として維持する。
- 将来 `data/tickers` を圧縮退避する場合は、legacyモードの運用方針を再定義する必要がある。

## 5. 銘柄詳細ページの現状

- 詳細チャートはpublic_json優先になった。
- ただし詳細ページ本体は `assets/page_ticker.js` の `loadTickerPayload(code)` 経由で `data/tickers/{code}.json` を読む。
- `data/tickers` が必要な主な理由:
  - 銘柄名
  - 市場
  - セクター
  - 業種
  - タグ
  - links
  - RCI/RSI
  - strategyバッジ
  - strategy理由文
  - trendTurn系
  - 詳細テクニカル指標
- 次フェーズでは `ticker_meta` と `ticker_detail_recent` のような軽量JSONへ分離する設計が有力。

## 6. data整理の結果

### 削減前後

- data整理前: 約30G
- `public_json_test` / `daily_records` / `rankings` / `overview` 退避削除直後: 約21G
- `overview` 復元後: 約25G

### 圧縮退避後に削除したもの

- `data/public_json_test`
- `data/daily_records`
- `data/rankings`

### 一度削除したが復元したもの

- `data/overview`

### 現在残している主な大容量data

| 対象 | 容量 | 残す理由 |
|---|---:|---|
| `data/tickers` | 約21G | 詳細ページのメタ情報・理由文・RCI/RSI・legacy用 |
| `data/overview` | 約4.0G | 現行画面が `market_pulse.json` を読むため |
| `data/public_json` | 約132M | 通常チャート表示の主データ |
| `data/warehouse_test` | 約210M | public_json再生成元のPoC warehouse |
| `data/ohlcv` | 約198M | 正式データ/再生成元候補 |
| `data/ohlcv_raw` | 約197M | raw取得データ/検証用 |

## 7. overview削除で404になった経緯

- data整理時に `data/overview` をアーカイブ退避後に削除した。
- その後、ランキングチャート一覧画面で以下のエラーが出た。

```text
JSON 読み込み失敗: ./data/overview/2026-04-30/market_pulse.json (404)
```

- 原因は、現行画面がまだ `data/overview/{date}/market_pulse.json` を直接読んでいたため。
- 復旧優先で、以下のアーカイブから `data/overview` だけを復元した。

```text
~/Desktop/kabu_doragon_data_archive/overview_daily_records_rankings_20260505.tar.gz
```

## 8. overview復元結果

- `data/overview/2026-04-30/market_pulse.json` の存在を確認済み。
- JSON妥当性確認済み。
- `127.0.0.1:8010/data/overview/2026-04-30/market_pulse.json` が `200` になることを確認済み。
- `data/overview` はGit管理外/ignore対象のため、復元してもGit差分には出ない。

## 9. 次フェーズ候補

1. `data/overview` の軽量化
   - 現行画面が本当に読む `market_pulse` / 最新overviewだけを小さく生成する。
   - 全日付・全派生JSONを常時展開しない構成にする。

2. 銘柄詳細ページの `data/tickers` 依存削減
   - `data/public_json/ticker_meta/{code}.json`
   - `data/public_json/ticker_detail_recent/1y/{code}.json`
   - これらを生成し、詳細ページの通常表示から `data/tickers` 読み込みを外す。

3. `data/warehouse_test` の本番化
   - `data/warehouse` へ正式化するか検討する。
   - J-Quants更新後の差分追記フローを設計する。

4. `data/tickers` 退避
   - 詳細ページの通常表示が `data/tickers` なしで動くことを確認後、削除ではなく圧縮退避候補にする。

5. Git履歴掃除
   - 今回は未実行。
   - backup / remote整合性 / 他ブランチ影響を確認した別タスクとして扱う。

## 10. main merge前の注意点

- merge後、別PCでpullしてもGit管理外dataは自動では来ない。
- `data/tickers`, `data/public_json`, `data/overview`, `data/warehouse_test`, `data/ohlcv`, `data/ohlcv_raw` の配置手順が必要。
- `data/overview` は削除しない。現行画面で `market_pulse.json` が必要。
- `localhost:8000` は別rootを配信している可能性があるため、KabuDragon実配信確認は `127.0.0.1:8010` を優先する。
- `?dataMode=legacy` は安全弁として残す。
- `git gc` / `git filter-repo` はまだ実行しない。履歴掃除は別フェーズ。

