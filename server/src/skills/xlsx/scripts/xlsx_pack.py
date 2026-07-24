#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Pack a working OOXML directory into an XLSX file after XML validation."""

import os
import sys
import zipfile
import xml.etree.ElementTree as ET


def validate_xml_files(source_dir: str) -> list[str]:
    bad: list[str] = []
    for dirpath, _, filenames in os.walk(source_dir):
        for fname in filenames:
            if not (fname.endswith(".xml") or fname.endswith(".rels")):
                continue
            fpath = os.path.join(dirpath, fname)
            try:
                ET.parse(fpath)
            except ET.ParseError as exc:
                bad.append(f"{os.path.relpath(fpath, source_dir)}: {exc}")
    return bad


def pack(source_dir: str, xlsx_path: str) -> None:
    if not os.path.isdir(source_dir):
        raise FileNotFoundError(source_dir)
    if not os.path.isfile(os.path.join(source_dir, "[Content_Types].xml")):
        raise ValueError("Missing [Content_Types].xml")
    bad = validate_xml_files(source_dir)
    if bad:
        raise ValueError("Malformed OOXML: " + "; ".join(bad))
    os.makedirs(os.path.dirname(os.path.abspath(xlsx_path)), exist_ok=True)
    with zipfile.ZipFile(xlsx_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for dirpath, _, filenames in os.walk(source_dir):
            for fname in filenames:
                fpath = os.path.join(dirpath, fname)
                archive.write(fpath, os.path.relpath(fpath, source_dir))
    print(f"Packed XLSX: {xlsx_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: xlsx_pack.py <source_dir> <output.xlsx>", file=sys.stderr)
        raise SystemExit(1)
    try:
        pack(sys.argv[1], sys.argv[2])
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
