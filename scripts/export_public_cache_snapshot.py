#!/usr/bin/env python3
"""Export one exact restored legacy cache without changing source files."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tarfile
from pathlib import Path

ALLOWED_ROOTS = {
    "ohlcv", "ohlcv_raw", "public_json", "manifest.json", "update_health.json",
    "update_summary.json", "update_state.json", "jquants_sync_state.json",
    "tse_listed_components.csv", "watchlist.json", "inactive_codes.json",
}


def digest(path: Path) -> str:
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def export_snapshot(source: Path, output: Path, requested_key: str, matched_key: str, *,
                    scope: dict | None = None) -> dict:
    source, output = source.resolve(), output.resolve()
    if not re.fullmatch(r"kabu-pages-data-Linux-main-[0-9]+", requested_key) or matched_key != requested_key:
        raise ValueError("export requires an exact matching legacy main cache")
    if output.exists() or output.is_relative_to(source) or source.is_relative_to(output):
        raise ValueError("export output must be new and separate from source data")
    if not source.is_dir():
        raise ValueError("source data directory is missing")
    if scope is None:
        paths = sorted(path for path in source.rglob("*") if path.is_file())
    else:
        codes = sorted(set(scope["codes"]) | set(scope.get("validationOnlyCodes", [])))
        if not scope["codes"] or any(not re.fullmatch(r"[0-9A-Z]{4}", code) for code in codes):
            raise ValueError("invalid bounded export scope")
        paths = []
        for code in codes:
            for parent, suffix in (("ohlcv_raw", ".csv"), ("ohlcv", ".csv"),
                                   ("public_json/ticker_meta", ".json"),
                                   ("public_json/ticker_recent/1y/ohlcv_ma", ".json")):
                path = source / parent / f"{code}{suffix}"
                if not path.is_file():
                    raise ValueError(f"bounded source is missing {path.relative_to(source)}")
                paths.append(path)
            for parent in ("corporate_actions", "public_json/ticker_detail_recent/1y"):
                path = source / parent / f"{code}.json"
                if path.exists():
                    paths.append(path)
        paths.extend(path for path in (source / "public_json/overview_lite").rglob("*.json") if path.is_file())
        paths.extend(source / name for name in ALLOWED_ROOTS if (source / name).is_file())
        paths = sorted(set(paths))
    if (source.is_symlink() or any(path.is_symlink() for path in source.iterdir()) or
            any(path.is_symlink() or not path.resolve().is_relative_to(source) for path in paths)):
        raise ValueError("source snapshot must not contain symlinks")
    if any(path.name not in ALLOWED_ROOTS for path in source.iterdir()):
        raise ValueError("source contains files outside the legacy public cache contract")
    manifest = json.loads((source / "manifest.json").read_text())
    if not manifest.get("latestDate") or not list((source / "ohlcv_raw").glob("*.csv")):
        raise ValueError("snapshot has no manifest date or raw price history")
    hashes = {str(path.relative_to(source)): digest(path) for path in paths if path.is_file()}
    output.mkdir(parents=True)
    archive = output / "public-cache.tar.gz"
    with tarfile.open(archive, "w:gz", compresslevel=1) as tar:
        for path in paths:
            tar.add(path, arcname=str(Path("data") / path.relative_to(source)), recursive=False)
    for name, before in hashes.items():
        if digest(source / name) != before:
            raise ValueError(f"source changed during export: {name}")
    if scope is None and {str(path.relative_to(source)) for path in source.rglob("*") if path.is_file()} != set(hashes):
        raise ValueError("source file inventory changed during export")
    report = {
        "sourceCacheKey": requested_key, "latestDate": manifest["latestDate"],
        "fileCount": len(hashes), "sourceFilesUnchanged": True,
        "archiveSha256": digest(archive), "sourceFileHashes": hashes,
        "repairCodes": sorted(scope["codes"]) if scope else None,
        "validationOnlyCodes": sorted(scope.get("validationOnlyCodes", [])) if scope else [],
    }
    (output / "source_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--scope-file", type=Path)
    args = parser.parse_args()
    report = export_snapshot(args.data_dir, args.output_dir,
                             os.environ.get("SOURCE_CACHE_KEY", ""), os.environ.get("MATCHED_CACHE_KEY", ""),
                             scope=json.loads(args.scope_file.read_text()) if args.scope_file else None)
    print(json.dumps({key: value for key, value in report.items() if key != "sourceFileHashes"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
