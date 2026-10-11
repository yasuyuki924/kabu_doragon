# KabuDragon Data Source Lock

最終更新: 2026-05-07

---

## 現在の正式データソース

現在の正式データソースは **J-Quants** とする。

通常更新入口:

- `scripts/kabu_daily_update.py`（推奨・安全チェック付き統一入口）
- `scripts/run_incremental_public_json_update.sh`（launchd / kabu_daily_update.py が呼ぶ）
- launchd early / main / catchup の3ジョブ

---

## 今は変更しないこと

以下は、ユーザーが明示的に別タスクとして指示するまで変更しない。

- Yahoo Finance への移行
- yfinance への移行
- J-Quants と Yahoo Finance の併用
- データソース抽象化
- provider 切替機能
- 旧5年更新フローへの復帰
- `data/tickers` の復元
- `data/overview` の復元

---

## 禁止

通常作業では以下を実行しない。

- `scripts/run_update_and_build_public_json.sh`（旧5年更新 — 絶対禁止）
- `scripts/run_jquants_close_retry.sh`（旧クローズリトライ — 禁止）
- `fetch_prices.py --history-years 5`（旧全量取得 — 絶対禁止）

---

## 理由

現在は軽量化後の `public_json` / `ohlcv` / J-Quants差分更新を安定化する段階。
データソース変更を混ぜると、更新失敗・チャート破損・manifest不整合の原因になる。

---

## 将来の移行方針

Yahoo Finance / yfinance / 他データソースへの移行は、将来別タスクとして扱う。
その場合は、既存J-Quants更新とは混ぜず、別ブランチ・別設計・別検証で進める。

---

## AI作業時のルール

Claude Code / Codex / Cursor は、通常作業中にデータソース変更を提案・実装しない。
必要になった場合は、実装せずに「**別タスクとして切り出すべき**」と報告する。

関連ドキュメント:
- `PROTECTED_FILES.md` — 削除・上書き禁止ファイル一覧
- `reports/kabudragon_daily_update_stability_plan.md` — 日次更新安定化計画
