from __future__ import annotations


def summarize_sector_strength(records: list[dict[str, object]]) -> list[dict[str, object]]:
    grouped: dict[str, dict[str, float | int]] = {}
    for record in records:
        sector = str(record.get("sector") or record.get("market") or "未分類")
        grouped.setdefault(sector, {"count": 0, "sum": 0.0})
        change = record.get("changePercent")
        grouped[sector]["count"] += 1
        grouped[sector]["sum"] += float(change or 0)
    rows = []
    for sector, values in grouped.items():
        count = int(values["count"])
        average_change = (float(values["sum"]) / count) if count else 0.0
        rows.append({"label": sector, "count": count, "averageChangePercent": round(average_change, 4)})
    return sorted(rows, key=lambda item: (item["averageChangePercent"], item["count"]), reverse=True)


def summarize_tag_counts(records: list[dict[str, object]]) -> list[dict[str, object]]:
    counts: dict[str, int] = {}
    for record in records:
        for tag in record.get("tags") or []:
            normalized = str(tag).strip()
            if not normalized:
                continue
            counts[normalized] = counts.get(normalized, 0) + 1
    return [{"label": tag, "count": count} for tag, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]


def summarize_theme_counts(records: list[dict[str, object]]) -> list[dict[str, object]]:
    counts: dict[str, int] = {}
    for record in records:
        for theme in record.get("themes") or []:
            label = str(theme or "").strip()
            if not label:
                continue
            counts[label] = counts.get(label, 0) + 1
    return [{"label": label, "count": count} for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]

