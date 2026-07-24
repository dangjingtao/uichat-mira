#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Read-only spreadsheet structure/data discovery helper derived from MiniMax minimax-xlsx."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load(path: str, sheet: str | None = None):
    try:
        import pandas as pd
    except ImportError as exc:
        raise RuntimeError("pandas/openpyxl are required for read analysis") from exc

    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(path)
    suffix = source.suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        value = pd.read_excel(path, sheet_name=sheet if sheet else None)
        if isinstance(value, dict):
            return value
        return {sheet or "Sheet1": value}
    if suffix in (".csv", ".tsv"):
        sep = "\t" if suffix == ".tsv" else ","
        last: Exception | None = None
        for encoding in ("utf-8-sig", "gbk", "utf-8", "latin-1"):
            try:
                return {source.stem: pd.read_csv(path, sep=sep, encoding=encoding)}
            except Exception as exc:
                last = exc
        raise ValueError(f"Unable to decode {path}: {last}")
    raise ValueError(f"Unsupported spreadsheet format: {suffix}")


def analyze(sheets: dict) -> dict:
    result: dict[str, object] = {}
    for name, df in sheets.items():
        nulls = df.isnull().sum()
        result[name] = {
            "rows": int(df.shape[0]),
            "columns": int(df.shape[1]),
            "columnNames": [str(value) for value in df.columns],
            "dtypes": {str(col): str(dtype) for col, dtype in df.dtypes.items()},
            "nullCounts": {str(col): int(count) for col, count in nulls.items() if int(count) > 0},
            "duplicateRows": int(df.duplicated().sum()),
            "preview": json.loads(df.head(5).to_json(orient="records", force_ascii=False)),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Read/analyze XLSX/XLSM/CSV/TSV without modifying source")
    parser.add_argument("file")
    parser.add_argument("--sheet")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        payload = {"file": args.file, "sheets": analyze(load(args.file, args.sheet))}
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
