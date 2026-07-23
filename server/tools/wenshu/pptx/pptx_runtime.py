#!/usr/bin/env python3
"""WenShu PPT runtime backed by Kimi's original ``kimi_ppt_dsl`` pipeline.

This file is intentionally a thin Mira adapter. It materializes a JSON-equivalent
PPTD project into ``.pptd``/``.page`` files, delegates validation/rendering to the
vendored Kimi converter, and keeps PPTX inspection as a small deterministic step.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from pptx import Presentation


def emit(payload: dict[str, Any], code: int = 0) -> None:
    stream = sys.stdout if code == 0 else sys.stderr
    print(json.dumps(payload, ensure_ascii=False), file=stream)
    raise SystemExit(code)


def load_json(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        value = json.load(fh)
    if not isinstance(value, dict):
        raise ValueError("spec must be a JSON object")
    return value


def _safe_project_path(root: Path, relative_path: str) -> Path:
    text = str(relative_path).replace("\\", "/").strip()
    if not text or text.startswith("/") or ":" in text.split("/", 1)[0]:
        raise ValueError(f"PPTD project path must be relative: {relative_path}")
    target = (root / text).resolve()
    resolved_root = root.resolve()
    if target != resolved_root and resolved_root not in target.parents:
        raise ValueError(f"PPTD project path escapes project root: {relative_path}")
    return target


def _normalize_project(spec: dict[str, Any]) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Accept the native project contract and a narrow legacy inline-pages shape.

    Native contract:
      {"entry": {..., "pages": ["pages/01.page"]},
       "pageFiles": {"pages/01.page": {...}}}

    Legacy compatibility is deliberately limited to inline page dictionaries. They
    are materialized as page files without translating element semantics; Kimi's
    checker remains the source of truth and will reject invalid element fields.
    """
    if isinstance(spec.get("entry"), dict):
        entry = dict(spec["entry"])
        raw_files = spec.get("pageFiles")
        if not isinstance(raw_files, dict):
            raise ValueError("spec.pageFiles must be an object keyed by .page path")
        page_files: dict[str, dict[str, Any]] = {}
        for key, value in raw_files.items():
            if not isinstance(key, str) or not key.endswith(".page"):
                raise ValueError("spec.pageFiles keys must be relative .page paths")
            if not isinstance(value, dict):
                raise ValueError(f"spec.pageFiles[{key!r}] must be an object")
            page_files[key] = value
    else:
        inline_pages = spec.get("pages")
        if not isinstance(inline_pages, list) or not all(isinstance(page, dict) for page in inline_pages):
            raise ValueError(
                "spec must use native PPTD project form {entry,pageFiles}; "
                "legacy compatibility only accepts pages as inline page objects"
            )
        entry = {key: value for key, value in spec.items() if key != "pages"}
        page_files = {}
        refs: list[str] = []
        for index, page in enumerate(inline_pages, 1):
            ref = f"pages/slide_{index:02d}.page"
            refs.append(ref)
            page_files[ref] = page
        entry["pages"] = refs

    refs = entry.get("pages")
    if not isinstance(refs, list) or not refs or not all(isinstance(ref, str) for ref in refs):
        raise ValueError("spec.entry.pages must be a non-empty array of .page paths")
    missing = [ref for ref in refs if ref not in page_files]
    if missing:
        raise ValueError(f"spec.pageFiles missing referenced page(s): {', '.join(missing)}")
    return entry, page_files


def materialize_project(spec: dict[str, Any], root: Path) -> Path:
    entry, page_files = _normalize_project(spec)
    entry_path = root / "presentation.pptd"
    entry_path.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    for relative_path, page in page_files.items():
        target = _safe_project_path(root, relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(page, ensure_ascii=False, indent=2), encoding="utf-8")
    return entry_path


def _load_kimi_runtime(extract_root: Path):
    bundle_dir = Path(__file__).with_name("kimi_ppt_dsl_bundle")
    parts = sorted(bundle_dir.glob("part-*.b85"))
    if not parts:
        raise FileNotFoundError(f"Bundled Kimi PPT DSL runtime not found: {bundle_dir}")
    encoded = "".join(part.read_text(encoding="ascii") for part in parts)
    archive_bytes = base64.b85decode(encoded.encode("ascii"))
    with zipfile.ZipFile(io.BytesIO(archive_bytes), "r") as package:
        package.extractall(extract_root)
    sys.path.insert(0, str(extract_root))
    from kimi_ppt_dsl.checker.runner import run_checks
    from kimi_ppt_dsl.converter import Converter
    return run_checks, Converter


def _validation_payload(result: Any, page_count: int) -> dict[str, Any]:
    return {
        "pageCount": page_count,
        "issues": [issue.to_dict() for issue in result.issues],
        "errors": result.error_count,
        "warnings": result.warning_count,
        "engine": "kimi_ppt_dsl",
    }


def validate_spec(spec: dict[str, Any]) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="mira-wenshu-pptd-") as project_dir, tempfile.TemporaryDirectory(
        prefix="mira-wenshu-kimi-ppt-runtime-"
    ) as runtime_dir:
        root = Path(project_dir)
        entry_path = materialize_project(spec, root)
        run_checks, _ = _load_kimi_runtime(Path(runtime_dir))
        result = run_checks(str(entry_path))
        entry, _ = _normalize_project(spec)
        return _validation_payload(result, len(entry["pages"]))


def create_presentation(spec: dict[str, Any], output: str) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="mira-wenshu-pptd-") as project_dir, tempfile.TemporaryDirectory(
        prefix="mira-wenshu-kimi-ppt-runtime-"
    ) as runtime_dir:
        root = Path(project_dir)
        entry_path = materialize_project(spec, root)
        run_checks, Converter = _load_kimi_runtime(Path(runtime_dir))
        validation_result = run_checks(str(entry_path))
        entry, _ = _normalize_project(spec)
        validation = _validation_payload(validation_result, len(entry["pages"]))
        if validation_result.error_count:
            raise ValueError(f"Kimi PPTD checker found {validation_result.error_count} blocking error(s)")
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # Converter runs the original checker again before rendering. Keep that
        # invariant rather than bypassing Kimi's own completion gate.
        Converter().convert(entry_path, output_path, embed_fonts=False)
        prs = Presentation(str(output_path))
        return {
            "output": str(output_path),
            "slides": len(prs.slides),
            "validation": validation,
            "engine": "kimi_ppt_dsl",
        }


def inspect_presentation(input_path: str) -> dict[str, Any]:
    prs = Presentation(input_path)
    slides = []
    for idx, slide in enumerate(prs.slides, 1):
        texts: list[str] = []
        pictures = tables = charts = 0
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                text = shape.text.strip()
                if text:
                    texts.append(text)
            if shape.shape_type == 13:
                pictures += 1
            if getattr(shape, "has_table", False):
                tables += 1
            if getattr(shape, "has_chart", False):
                charts += 1
        slides.append(
            {
                "index": idx,
                "text": "\n".join(texts)[:4000],
                "textShapeCount": len(texts),
                "pictures": pictures,
                "tables": tables,
                "charts": charts,
            }
        )
    return {
        "file": input_path,
        "slideCount": len(slides),
        "textSlideCount": sum(1 for slide in slides if slide["text"]),
        "slides": slides,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["create", "validate", "inspect"])
    parser.add_argument("--spec")
    parser.add_argument("--input")
    parser.add_argument("--output")
    args = parser.parse_args()
    try:
        if args.operation == "create":
            if not args.spec or not args.output:
                raise ValueError("create requires --spec and --output")
            data = create_presentation(load_json(args.spec), args.output)
        elif args.operation == "validate":
            if not args.spec:
                raise ValueError("validate requires --spec")
            data = validate_spec(load_json(args.spec))
        else:
            if not args.input:
                raise ValueError("inspect requires --input")
            data = inspect_presentation(args.input)
        emit({"status": "success", "data": data})
    except Exception as exc:
        emit({"status": "error", "error": type(exc).__name__, "message": str(exc)}, 1)


if __name__ == "__main__":
    main()
