#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
shared_strings_builder.py — Generate a valid sharedStrings.xml from a list of strings.
"""

import argparse
import html
import sys

HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
SST_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def escape_text(s: str) -> tuple[str, bool]:
    escaped = html.escape(s, quote=False)
    return escaped, s != s.strip()


def build_xml(strings: list[str]) -> str:
    n = len(strings)
    lines = [HEADER, f'<sst xmlns="{SST_NS}" count="{n}" uniqueCount="{n}">']
    for index, value in enumerate(strings):
        escaped, preserve = escape_text(value)
        if preserve:
            lines.append(f'  <si><t xml:space="preserve">{escaped}</t></si>  <!-- index {index} -->')
        else:
            lines.append(f'  <si><t>{escaped}</t></si>  <!-- index {index} -->')
    lines.append("</sst>")
    return "\n".join(lines) + "\n"


def deduplicate(strings: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in strings:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate xl/sharedStrings.xml")
    parser.add_argument("strings", nargs="*")
    parser.add_argument("--file", "-f")
    parser.add_argument("--index", action="store_true")
    args = parser.parse_args()
    try:
        raw = [line.rstrip("\n") for line in open(args.file, encoding="utf-8") if line.strip()] if args.file else list(args.strings)
    except OSError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if not raw:
        print("ERROR: No strings provided", file=sys.stderr)
        raise SystemExit(1)
    strings = deduplicate(raw)
    if args.index:
        for index, value in enumerate(strings):
            print(f"{index}: {value!r}")
    else:
        print(build_xml(strings), end="")


if __name__ == "__main__":
    main()
