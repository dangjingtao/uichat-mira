#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Static XLSX formula/package validator derived from MiniMax minimax-xlsx."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NSP = f"{{{NS}}}"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
EXCEL_ERRORS = {"#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#NULL!", "#NUM!", "#N/A"}


def sheet_names(z: zipfile.ZipFile) -> dict[str, str]:
    root = ET.fromstring(z.read("xl/workbook.xml"))
    return {
        sheet.get(f"{{{REL_NS}}}id", ""): sheet.get("name", "")
        for sheet in root.findall(f".//{NSP}sheet")
    }


def sheet_files(z: zipfile.ZipFile) -> dict[str, str]:
    root = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    out: dict[str, str] = {}
    for rel in root:
        rid = rel.get("Id", "")
        target = rel.get("Target", "")
        if "worksheets" not in target:
            continue
        target = target.lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        out[rid] = target
    return out


def defined_names(z: zipfile.ZipFile) -> set[str]:
    root = ET.fromstring(z.read("xl/workbook.xml"))
    return {
        item.get("name", "")
        for item in root.findall(f".//{NSP}definedName")
        if item.get("name")
    }


def extract_sheet_refs(formula: str) -> list[str]:
    refs = [m.group(1) for m in re.finditer(r"'([^']+)'!", formula)]
    refs += [
        m.group(1)
        for m in re.finditer(r"(?<!')([A-Za-z_\u4e00-\u9fff][A-Za-z0-9_.·\u4e00-\u9fff]*)!", formula)
    ]
    return refs


def check(path: str) -> dict:
    result = {
        "file": path,
        "sheets_checked": [],
        "formula_count": 0,
        "error_count": 0,
        "errors": [],
    }
    try:
        z = zipfile.ZipFile(path, "r")
    except Exception as exc:
        result["errors"].append({"type": "file_error", "message": str(exc)})
        result["error_count"] = 1
        return result

    with z:
        required = {"[Content_Types].xml", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"}
        missing = sorted(required - set(z.namelist()))
        if missing:
            result["errors"].append({"type": "missing_package_part", "parts": missing})
            result["error_count"] += len(missing)
            return result

        try:
            names_by_rid = sheet_names(z)
            files_by_rid = sheet_files(z)
            valid_names = set(names_by_rid.values())
            names = defined_names(z)
        except Exception as exc:
            result["errors"].append({"type": "workbook_structure_error", "message": str(exc)})
            result["error_count"] += 1
            return result

        for rid, sheet_name in names_by_rid.items():
            ws_path = files_by_rid.get(rid)
            if not ws_path or ws_path not in z.namelist():
                result["errors"].append({
                    "type": "missing_worksheet",
                    "sheet": sheet_name,
                    "relationship": rid,
                    "path": ws_path,
                })
                result["error_count"] += 1
                continue
            result["sheets_checked"].append(sheet_name)
            try:
                root = ET.fromstring(z.read(ws_path))
            except Exception as exc:
                result["errors"].append({"type": "worksheet_xml_error", "sheet": sheet_name, "message": str(exc)})
                result["error_count"] += 1
                continue

            shared_primary: set[str] = set()
            shared_consumers: list[tuple[str, str]] = []
            for cell in root.findall(f".//{NSP}c"):
                ref = cell.get("r", "?")
                cell_type = cell.get("t", "n")
                value = cell.find(f"{NSP}v")
                formula = cell.find(f"{NSP}f")

                if cell_type == "e":
                    error_value = value.text if value is not None else None
                    result["errors"].append({
                        "type": "error_value" if error_value else "malformed_error_cell",
                        "sheet": sheet_name,
                        "cell": ref,
                        "value": error_value,
                    })
                    result["error_count"] += 1

                if formula is None:
                    continue
                f_type = formula.get("t", "")
                si = formula.get("si")
                text = formula.text or ""
                if f_type == "shared":
                    if text:
                        if si is not None:
                            shared_primary.add(si)
                    elif si is not None:
                        shared_consumers.append((ref, si))
                        continue

                if text:
                    result["formula_count"] += 1
                    if any(token in text for token in EXCEL_ERRORS):
                        result["errors"].append({"type": "formula_contains_error_token", "sheet": sheet_name, "cell": ref, "formula": text})
                        result["error_count"] += 1
                    for target in extract_sheet_refs(text):
                        if target not in valid_names:
                            result["errors"].append({
                                "type": "broken_sheet_ref",
                                "sheet": sheet_name,
                                "cell": ref,
                                "formula": text,
                                "missing_sheet": target,
                            })
                            result["error_count"] += 1

            for ref, si in shared_consumers:
                if si not in shared_primary:
                    result["errors"].append({
                        "type": "orphan_shared_formula",
                        "sheet": sheet_name,
                        "cell": ref,
                        "shared_id": si,
                    })
                    result["error_count"] += 1

        result["defined_names"] = sorted(names)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Static formula/package validation for XLSX files")
    parser.add_argument("file")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--report", action="store_true")
    parser.add_argument("-o", "--output")
    args = parser.parse_args()

    result = check(args.file)
    payload = {
        "status": "success" if result["error_count"] == 0 else "errors_found",
        **result,
    }
    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered if (args.json or args.report) else rendered)
    raise SystemExit(0 if result["error_count"] == 0 else 1)


if __name__ == "__main__":
    main()
