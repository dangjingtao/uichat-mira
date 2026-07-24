#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Tier-2 deterministic formula recalculation via LibreOffice headless."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def find_soffice() -> str | None:
    candidates = [
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "soffice",
        "libreoffice",
    ]
    for candidate in candidates:
        found = shutil.which(candidate)
        if found:
            return found
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def version(soffice: str) -> str:
    try:
        result = subprocess.run([soffice, "--version"], capture_output=True, timeout=10, check=False)
        return result.stdout.decode(errors="replace").strip() or "unknown"
    except Exception:
        return "unknown"


def recalculate(input_path: str, output_path: str, timeout: int = 60) -> tuple[bool, str, int]:
    soffice = find_soffice()
    if not soffice:
        return False, "LibreOffice not found; Tier-2 recalculation unavailable", 2
    if not os.path.isfile(input_path):
        return False, f"Input file not found: {input_path}", 1

    with tempfile.TemporaryDirectory(prefix="xlsx_recalc_") as temp_dir:
        source_name = os.path.basename(input_path)
        temp_input = os.path.join(temp_dir, source_name)
        shutil.copy2(input_path, temp_input)
        profile_dir = os.path.join(temp_dir, "lo-profile")
        os.makedirs(profile_dir, exist_ok=True)
        profile_uri = Path(profile_dir).resolve().as_uri()
        out_dir = os.path.join(temp_dir, "out")
        os.makedirs(out_dir, exist_ok=True)
        cmd = [
            soffice,
            "--headless",
            "--norestore",
            "--nodefault",
            "--nolockcheck",
            f"-env:UserInstallation={profile_uri}",
            "--convert-to",
            "xlsx",
            "--outdir",
            out_dir,
            temp_input,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=timeout, check=False)
        except subprocess.TimeoutExpired:
            return False, f"LibreOffice timed out after {timeout}s", 1
        except Exception as exc:
            return False, f"LibreOffice execution failed: {exc}", 1

        if result.returncode != 0:
            return False, (
                f"LibreOffice exited with code {result.returncode}; "
                f"stderr={result.stderr.decode(errors='replace').strip()}"
            ), 1

        expected = os.path.join(out_dir, Path(source_name).stem + ".xlsx")
        candidates = [expected] if os.path.isfile(expected) else [
            os.path.join(out_dir, name)
            for name in os.listdir(out_dir)
            if name.lower().endswith(".xlsx")
        ]
        produced = next((path for path in candidates if os.path.isfile(path)), None)
        if not produced:
            return False, (
                "LibreOffice exited successfully but produced no recalculated XLSX; "
                f"stdout={result.stdout.decode(errors='replace').strip()}"
            ), 1

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        shutil.copy2(produced, output_path)
        if not os.path.isfile(output_path) or os.path.getsize(output_path) <= 0:
            return False, "Recalculated output was not written", 1
    return True, f"Recalculation complete with {version(soffice)}: {output_path}", 0


def main() -> None:
    parser = argparse.ArgumentParser(description="LibreOffice headless XLSX recalculation")
    parser.add_argument("input", nargs="?")
    parser.add_argument("output", nargs="?")
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if args.check:
        soffice = find_soffice()
        if not soffice:
            print("LibreOffice NOT available")
            raise SystemExit(2)
        print(f"LibreOffice available: {soffice}")
        print(f"Version: {version(soffice)}")
        raise SystemExit(0)

    if not args.input or not args.output:
        parser.error("input and output are required unless --check is used")
    ok, message, code = recalculate(args.input, args.output, args.timeout)
    print(("OK: " if ok else "ERROR: ") + message)
    raise SystemExit(code)


if __name__ == "__main__":
    main()
