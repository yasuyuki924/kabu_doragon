# CLAUDE.md — KabuDragon Data Update Safety Rules

Claude Code は、KabuDragonでデータ更新系を触る場合、
**このファイルを必ず読むこと。**
このルールに反する作業が必要になった場合は、実装せずにユーザーへ確認すること。

---

## 最重要ルール

KabuDragonのデータ更新系では、**画面が一時的に戻っただけで完了扱いしない。**

完了条件（すべて満たすこと）:

1. `data/ohlcv` が正常
2. `data/ohlcv_raw` が正常
3. `data/public_json` が正常
4. `python3 scripts/check_ohlcv_integrity.py --check-raw` が OK
5. `python3 scripts/check_daily_update_result.py` が OK

この条件を満たさない限り、「修復完了」「大丈夫」「更新成功」と報告してはいけない。

---

## ohlcv_raw が壊れているときの禁止事項

`data/ohlcv_raw` が壊れている状態では、**絶対に `public_json` を再生成しない。**

理由:
- `sync_prices` / incremental update は `data/ohlcv_raw` を元に `data/ohlcv` を再生成する
- `data/ohlcv` だけ修復しても `data/ohlcv_raw` が壊れていれば、次回更新で再び壊れる
- この状態で `public_json` を再生成すると、ローソク足が2本・3本になる不具合が発生する

---

## 更新前チェック（必須）

`public_json` 再生成前に必ず実行:

```bash
.venv/bin/python scripts/check_ohlcv_integrity.py --check-raw
```

失敗した場合:
- `public_json` を再生成しない
- `manifest.latestDate` を進めない
- `update_summary` を success 扱いにしない
- 原因ログを出して停止する

---

## 更新後チェック（必須）

更新後に必ず実行:

```bash
.venv/bin/python scripts/check_daily_update_result.py
```

失敗した場合:
- 更新成功扱いにしない
- 「大丈夫」と報告しない
- `logs/daily_update_postcheck_YYYYMMDD.log` を確認する

---

## 完了判定チェックリスト

以下がすべて OK のときだけ完了:

- [ ] `check_ohlcv_integrity.py --check-raw` が OK
- [ ] `check_daily_update_result.py` が OK
- [ ] 代表銘柄 6327, 7162, 7203, 9983 の `ohlcv` が正常（1200行以上、直近1年200行以上、最大ギャップ10日以内）
- [ ] 同銘柄の `ohlcv_raw` が正常（同条件）
- [ ] 同銘柄の `public_json` が 100行以上（通常 245行前後）
- [ ] `manifest.latestDate` と `public_json` 最終日が一致
- [ ] ローソク足 2本化・3本化がない

---

## 異常時のルール

異常が出た場合:

1. 勝手に修復を繰り返さない
2. まず更新を止める
3. 原因ログを報告する
4. 修復は最小範囲で1回だけ
5. 原因が不明なまま `public_json` を再生成しない

---

## データ更新の禁止事項

以下は **絶対に禁止**:

| 禁止コマンド・操作 | 理由 |
|---|---|
| `scripts/run_update_and_build_public_json.sh` | 旧5年全量更新 — 禁止 |
| `fetch_prices.py --history-years 5` | 旧5年全量更新 — 禁止 |
| `scripts/run_jquants_close_retry.sh` 直接実行 | 旧フロー — 禁止 |
| `data/tickers` 復元 | 旧形式 — 禁止 |
| `data/overview` 復元 | 旧形式 — 禁止 |
| Yahoo Finance / yfinance 切替 | `DATA_SOURCE_LOCK.md` 参照 |
| `data/ohlcv` だけ直して完了扱い | `ohlcv_raw` も確認しないと再破壊される |
| `public_json` だけ再生成して完了扱い | `ohlcv_raw` が壊れていれば翌日に再破壊される |
| `git reset --hard` / `git clean` / `rm -rf data/` | データ消失リスク |
| `main` ブランチへの直接 push / force push | 禁止 |

---

## 日次更新の正しい入口

```bash
# 正しい入口
python3 scripts/kabu_daily_update.py
```

内部で `check_ohlcv_integrity.py --check-raw` と `check_daily_update_result.py` を自動実行する。

---

## 参照ファイル

| ファイル | 内容 |
|---|---|
| `AGENTS.md` | Codex / 全AIエージェント向けルール（フロントエンド含む） |
| `PROTECTED_FILES.md` | 削除・上書き禁止ファイル一覧、絶対ルール |
| `DATA_SOURCE_LOCK.md` | データソース変更禁止（Yahoo Finance移行など） |
| `reports/kabudragon_daily_update_postcheck.md` | post-check 運用ガイド |
| `reports/kabudragon_ohlcv_raw_repair_plan.md` | ohlcv_raw 修復手順 |
| `reports/kabudragon_daily_update_stability_plan.md` | 日次更新安定化計画 |
