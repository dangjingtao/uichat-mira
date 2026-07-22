#!/usr/bin/env python3
"""Finalize WenShu XLSX artifacts after create/modify.

Writes real OOXML core properties and applies creation-only presentation defaults
without changing an existing workbook's view settings during modification.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


def emit(payload: dict[str, Any], code: int = 0) -> None:
    stream = sys.stdout if code == 0 else sys.stderr
    print(json.dumps(payload, ensure_ascii=False), file=stream)
    raise SystemExit(code)


def load_spec(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        value = json.load(fh)
    if not isinstance(value, dict):
        raise ValueError("spec must be a JSON object")
    return value


def finalize(file_path: str, spec: dict[str, Any], mode: str) -> dict[str, Any]:
    wb = load_workbook(file_path)
    metadata = spec.get("metadata") if isinstance(spec.get("metadata"), dict) else {}
    mapping = {
        "creator": "creator",
        "lastModifiedBy": "lastModifiedBy",
        "title": "title",
        "subject": "subject",
        "description": "description",
        "keywords": "keywords",
        "category": "category",
    }
    updated: list[str] = []
    for source_key, property_key in mapping.items():
        value = metadata.get(source_key)
        if value is None:
            continue
        setattr(wb.properties, property_key, str(value))
        updated.append(source_key)

    if mode == "create":
        sheet_specs = spec.get("sheets") if isinstance(spec.get("sheets"), list) else []
        explicit_gridline_sheets = {
            str(item.get("name", ""))
            for item in sheet_specs
            if isinstance(item, dict) and item.get("showGridLines") is not None
        }
        for ws in wb.worksheets:
            if ws.title not in explicit_gridline_sheets:
                ws.sheet_view.showGridLines = False

    if wb.calculation is not None:
        wb.calculation.calcMode = "auto"
        wb.calculation.fullCalcOnLoad = True
        wb.calculation.forceFullCalc = True

    wb.save(file_path)
    return {
        "file": file_path,
        "mode": mode,
        "metadataUpdated": updated,
        "sheetCount": len(wb.worksheets),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--spec", required=True)
    parser.add_argument("--mode", choices=["create", "modify"], required=True)
    args = parser.parse_args()
    try:
        if not Path(args.input).exists():
            raise FileNotFoundError(args.input)
        result = finalize(args.input, load_spec(args.spec), args.mode)
        emit({"status": "success", "data": result})
    except Exception as exc:
        emit({"status": "error", "error": type(exc).__name__, "message": str(exc)}, 1)


if __name__ == "__main__":
    main()
