#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import (
    RANKINGS_DIR,
    parse_codes,
    write_json,
)
from src.app.shared_view_data import load_records_by_date, resolve_explicit_dates, resolve_selected_dates
from src.screening.ranking import (
    build_ranking_payload,
    pick_top,
    score_watch_candidate,
    sort_lower_shadow_records,
    sort_rebound_signal_records,
    sort_strategy_records,
    sort_trend_turn_records,
)


def _is_fresh_record(record: dict[str, object], selected_date: str) -> bool:
    row_date = str(record.get("date") or "").strip()
    if not row_date or row_date != selected_date:
        return False
    quality = record.get("dataQuality")
    if not isinstance(quality, dict):
        return True
    reasons = quality.get("reasonCodes")
    reason_codes = {str(item).strip() for item in reasons} if isinstance(reasons, list) else set()
    if "NO_OHLCV" in reason_codes or "STALE_ND" in reason_codes:
        return False
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build date-based ranking JSON files")
    parser.add_argument("--days", type=int, default=60, help="Recent trading dates to build")
    parser.add_argument("--limit", type=int, default=50, help="Rows per ranking")
    parser.add_argument("--end-date", help="Build until this date")
    parser.add_argument("--from-date", help="Build from this date forward")
    parser.add_argument("--codes", help="Comma separated ticker codes")
    parser.add_argument("--dates", help="Comma separated trading dates to build")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    codes = parse_codes(args.codes)
    if codes:
        print(f"warning: partial ranking build for {len(codes)} code(s); shared ranking JSON will be overwritten")
    explicit_dates = resolve_explicit_dates(args.dates)
    _, selected_dates = resolve_selected_dates(
        days=args.days,
        end_date=args.end_date,
        from_date=args.from_date,
        explicit_dates=explicit_dates,
    )
    per_date = load_records_by_date(selected_dates, codes)

    for date_value in selected_dates:
        records = [record for record in per_date[date_value] if _is_fresh_record(record, date_value)]
        gainers = pick_top(records, "changePercent", True, args.limit)
        losers = pick_top(records, "changePercent", False, args.limit)
        volume_spike = pick_top(records, "volumeRatio25", True, args.limit)
        new_high = [record for record in records if record.get("newHigh52w")]
        new_high.sort(
            key=lambda item: (
                float(item.get("changePercent") or 0),
                float(item.get("distanceToMa25") or 0),
                float(item.get("close") or 0),
            ),
            reverse=True,
        )
        new_high = new_high[: args.limit]
        deviation25 = pick_top(records, "distanceToMa25", True, args.limit)
        deviation75 = pick_top(records, "distanceToMa75", True, args.limit)
        deviation200 = pick_top(records, "distanceToMa200", True, args.limit)
        lower_shadow = sort_lower_shadow_records(records)[: args.limit]
        watch_candidates = sorted(records, key=score_watch_candidate, reverse=True)[: args.limit]
        rebound_signal = sort_rebound_signal_records(records)[: args.limit]
        trend_turn = sort_trend_turn_records(records)[: args.limit]
        strategy_minervini = sort_strategy_records(records, "minervini_trend_template")[: args.limit]
        strategy_stage2 = sort_strategy_records(records, "stan_weinstein_stage2")[: args.limit]
        strategy_turtle = sort_strategy_records(records, "turtle_donchian_breakout")[: args.limit]
        strategy_canslim = sort_strategy_records(records, "can_slim")[: args.limit]
        strategy_rsi2 = sort_strategy_records(records, "rsi2_pullback")[: args.limit]

        output_dir = RANKINGS_DIR / date_value
        write_json(output_dir / "gainers.json", build_ranking_payload(date_value, "値上がり率", gainers))
        write_json(output_dir / "losers.json", build_ranking_payload(date_value, "値下がり率", losers))
        write_json(output_dir / "volume_spike.json", build_ranking_payload(date_value, "出来高増加", volume_spike))
        write_json(output_dir / "new_high.json", build_ranking_payload(date_value, "新高値", new_high))
        write_json(output_dir / "deviation25.json", build_ranking_payload(date_value, "25日線乖離", deviation25))
        write_json(output_dir / "deviation75.json", build_ranking_payload(date_value, "75日線乖離", deviation75))
        write_json(output_dir / "deviation200.json", build_ranking_payload(date_value, "200日線乖離", deviation200))
        write_json(output_dir / "lower_shadow.json", build_ranking_payload(date_value, "下ひげ", lower_shadow))
        write_json(
            output_dir / "watch_candidates.json",
            build_ranking_payload(date_value, "監視候補", watch_candidates),
        )
        write_json(
            output_dir / "rebound_signal.json",
            build_ranking_payload(date_value, "反発シグナル", rebound_signal),
        )
        write_json(
            output_dir / "trend_turn.json",
            build_ranking_payload(date_value, "ベース・リカバリー", trend_turn),
        )
        write_json(
            output_dir / "strategy_minervini.json",
            build_ranking_payload(date_value, "Minervini Trend Template", strategy_minervini),
        )
        write_json(
            output_dir / "strategy_stage2.json",
            build_ranking_payload(date_value, "Stan Weinstein Stage 2", strategy_stage2),
        )
        write_json(
            output_dir / "strategy_turtle.json",
            build_ranking_payload(date_value, "Turtle Donchian Breakout", strategy_turtle),
        )
        write_json(
            output_dir / "strategy_canslim.json",
            build_ranking_payload(date_value, "CAN SLIM", strategy_canslim),
        )
        write_json(
            output_dir / "strategy_rsi2.json",
            build_ranking_payload(date_value, "RSI(2) Pullback", strategy_rsi2),
        )
        print(f"built rankings: {date_value} ({len(records)} records)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
