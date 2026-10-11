# PROTECTED_FILES.md — KabuDragon AI操作禁止ファイル一覧

このファイルは Claude / Codex などの AI エージェントが参照すること。
**以下のルールは最優先で遵守すること。**

> **AI必読ファイル（データ更新系を触る前に必ず読むこと）**
> - `AGENTS.md` — Codex / Claude Code / Cursor 向け完了条件・禁止事項・チェックコマンド
> - `CLAUDE.md` — Claude Code 向け同等ルール
> - `DATA_SOURCE_LOCK.md` — データソース変更禁止（Yahoo Finance移行・yfinance導入など）
> - `.cursor/rules/kabudragon-data-update.mdc` — Cursor 自動認識ルール

---

## 絶対に削除・上書きしてはいけないもの

| パス | 理由 |
|---|---|
| `data/ohlcv/` | 株価OHLCVデータ本体。再生成コストが極めて高い |
| `data/ohlcv_raw/` | J-Quants 生データバックアップ |
| `data/tickers/` | 旧形式ticker JSONアーカイブ |
| `data/overview/` | 旧形式overviewアーカイブ |
| `data/public_json/` | フロントエンド配信用JSON。ohlcvから生成。削除禁止 |
| `data/cache/` | キャッシュ。再生成可能だが削除しない |
| Google Drive バックアップ | 手動バックアップ。触らない |

---

## 通常のコードコミットで含めてはいけないもの

以下のファイルは **原則として git stage/commit しない**。
更新はスクリプトで行い、コードコミットには含めない。

```
data/manifest.json
data/jquants_sync_state.json
data/update_state.json
data/update_health.json
data/update_summary.json
data/ohlcv/*.csv          # 全件禁止
data/public_json/**/*.json # 全件禁止
```

**例外**: データ修復・初期セットアップ専用コミットの場合のみ。
その際は `git diff --cached --name-status` で内容を必ず確認すること。

---

## 実行してはいけないコマンド（通常運用時）

```bash
# 旧5年全量更新 — 絶対禁止
scripts/run_update_and_build_public_json.sh
python3 scripts/fetch_prices.py --history-years 5

# データ削除系 — 絶対禁止
rm -rf data/
git clean -fd
git reset --hard

# 危険な git 操作 — 絶対禁止
git filter-repo
git gc --aggressive
git push --force origin main
```

---

## 作業モード別の許可範囲

### コード修正・機能追加モード

| 許可 | 禁止 |
|---|---|
| `assets/*.js` 編集 | `data/` 以下の編集 |
| `scripts/*.py` 編集 | 旧5年更新の実行 |
| `src/` 編集 | `main` ブランチへの直接push |
| `ticker.html` 等の編集 | |

### 日次データ更新モード

| 許可 | 禁止 |
|---|---|
| `python3 scripts/kabu_daily_update.py` 実行 | `run_update_and_build_public_json.sh` 実行 |
| `scripts/run_incremental_public_json_update.sh` 実行 | `data/` 以下を手動編集 |
| `data/` JSON系ファイルのunstagedな差分を放置 | `data/ohlcv/` `data/public_json/` を手動削除・上書き |

### データ修復モード（障害時のみ）

| 許可 | 禁止 |
|---|---|
| `scripts/repair_ohlcv_from_tickers_backup.py` 実行 | Google Driveバックアップの削除 |
| `python3 scripts/check_ohlcv_integrity.py --summary` | 修復完了前の `main` merge |
| 修復後の `public_json` 再生成 | 修復内容の未確認 commit |

### launchd 設定変更モード

| 許可 | 禁止 |
|---|---|
| `launchd/*.plist` 編集 | `launchctl` を commit 前に実行 |
| `~/Library/LaunchAgents/` への手動コピー | plist 構文未確認での bootstrap |
| `plutil -lint` での構文確認 | |

---

## AI に対する追加指示

- `data/` 以下のファイルを stage する前に、必ず `python3 scripts/preflight_guard.py` を実行すること
- `data/ohlcv/` または `data/public_json/` が staging area に含まれていたら即座に `git reset HEAD -- data/` すること
- 「差分更新を実行してください」という依頼に対して `run_update_and_build_public_json.sh` を呼ぶことは禁止。必ず `run_incremental_public_json_update.sh` または `kabu_daily_update.py` を使うこと
- チャートが1本になるなどの UI 表示異常が出た場合は、`check_ohlcv_integrity.py --check-raw --summary` で原因を特定してから修復すること。データを全削除して再生成するのは最終手段

---

## データ更新の絶対ルール（2026-05-08 制定）

日次更新・データ更新・public_json 再生成に関して以下を絶対ルールとする。
ユーザーが明示的に別タスクとして指示するまで変更しない。

1. `data/ohlcv` だけを正としない。`data/ohlcv_raw` も必ず同時に確認する。
2. `sync_prices` / incremental update は `ohlcv_raw` を元に `ohlcv` を再生成する。`ohlcv_raw` が壊れている状態で更新してはいけない。
3. `public_json` 再生成前に、必ず `python3 scripts/check_ohlcv_integrity.py --check-raw` を実行する。
4. `check_ohlcv_integrity.py --check-raw` が失敗した場合、`public_json` を再生成してはいけない。`manifest.latestDate` を進めてはいけない。
5. 旧5年更新（`run_update_and_build_public_json.sh`、`fetch_prices.py --history-years 5`）には戻らない。
6. `data/tickers` / `data/overview` を復元しない。
7. Yahoo Finance / yfinance への切替は今は行わない。データソース変更は別ブランチ・別タスクで扱う（`DATA_SOURCE_LOCK.md` 参照）。

---

データソース変更（Yahoo Finance移行・yfinance導入・provider抽象化など）は `DATA_SOURCE_LOCK.md` を参照し、通常作業中は実施しない。

最終更新: 2026-05-08

最終更新: 2026-05-07
