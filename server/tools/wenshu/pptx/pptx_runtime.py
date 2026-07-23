#!/usr/bin/env python3
"""WenShu PPT runtime backed by Kimi's original ``kimi_ppt_dsl`` pipeline.

This module is a thin Mira adapter. It materializes a native multi-file PPTD
project from JSON, delegates checking/rendering to the vendored Kimi runtime,
and verifies the produced PPTX by reading its final content back.
"""
from __future__ import annotations

import argparse
import base64
import html
import io
import json
import lzma
import shutil
import sys
import tarfile
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from pptx import Presentation


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _normalize_text(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    return " ".join(html.unescape("".join(parser.parts)).split())


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
    if not isinstance(spec.get("entry"), dict):
        raise ValueError("spec.entry must be the native PPTD root object")
    entry = dict(spec["entry"])
    raw_files = spec.get("pageFiles")
    if not isinstance(raw_files, dict):
        raise ValueError("spec.pageFiles must be an object keyed by relative .page path")

    page_files: dict[str, dict[str, Any]] = {}
    for key, value in raw_files.items():
        if not isinstance(key, str) or not key.endswith(".page"):
            raise ValueError("spec.pageFiles keys must be relative .page paths")
        if not isinstance(value, dict):
            raise ValueError(f"spec.pageFiles[{key!r}] must be an object")
        _safe_project_path(Path("."), key)
        page_files[key] = value

    refs = entry.get("pages")
    if not isinstance(refs, list) or not refs or not all(isinstance(ref, str) for ref in refs):
        raise ValueError("spec.entry.pages must be a non-empty array of relative .page paths")
    if any(not ref.endswith(".page") for ref in refs):
        raise ValueError("every spec.entry.pages item must end with .page")
    missing = [ref for ref in refs if ref not in page_files]
    if missing:
        raise ValueError(f"spec.pageFiles missing referenced page(s): {', '.join(missing)}")
    extras = [path for path in page_files if path not in refs]
    if extras:
        raise ValueError(f"spec.pageFiles contains unreferenced page(s): {', '.join(extras)}")
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


def _safe_extract_tar_xz(archive_bytes: bytes, extract_root: Path) -> None:
    if not archive_bytes.startswith(b"\xfd7zXZ\x00"):
        raise ValueError("Bundled Kimi PPT DSL runtime is not a valid XZ archive")
    tar_bytes = lzma.decompress(archive_bytes)
    root = extract_root.resolve()
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:") as package:
        members = package.getmembers()
        for member in members:
            if member.issym() or member.islnk():
                raise ValueError(f"Bundled Kimi runtime contains a forbidden link: {member.name}")
            target = (root / member.name).resolve()
            if target != root and root not in target.parents:
                raise ValueError(f"Bundled Kimi runtime escapes extraction root: {member.name}")
        for member in members:
            target = (root / member.name).resolve()
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile():
                raise ValueError(f"Bundled Kimi runtime contains an unsupported entry: {member.name}")
            target.parent.mkdir(parents=True, exist_ok=True)
            source = package.extractfile(member)
            if source is None:
                raise ValueError(f"Unable to read bundled Kimi runtime entry: {member.name}")
            with source, target.open("wb") as destination:
                shutil.copyfileobj(source, destination)


def _load_kimi_runtime(extract_root: Path):
    bundle_dir = Path(__file__).with_name("kimi_ppt_dsl_bundle")
    parts = sorted(bundle_dir.glob("part-*.b85"))
    if not parts:
        raise FileNotFoundError(f"Bundled Kimi PPT DSL runtime not found: {bundle_dir}")
    expected_names = [f"part-{index:03d}.b85" for index in range(1, len(parts) + 1)]
    actual_names = [part.name for part in parts]
    if actual_names != expected_names:
        raise ValueError(f"Bundled Kimi runtime parts are incomplete: {actual_names}")
    encoded = "".join(part.read_text(encoding="ascii") for part in parts)
    archive_bytes = base64.b85decode(encoded.encode("ascii"))
    _safe_extract_tar_xz(archive_bytes, extract_root)
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
        slides.append({
            "index": idx,
            "text": "\n".join(texts)[:4000],
            "textShapeCount": len(texts),
            "pictures": pictures,
            "tables": tables,
            "charts": charts,
        })
    return {
        "file": input_path,
        "slideCount": len(slides),
        "textSlideCount": sum(1 for slide in slides if slide["text"]),
        "slides": slides,
    }


def _expected_texts(spec: dict[str, Any]) -> list[str]:
    _, page_files = _normalize_project(spec)
    texts: list[str] = []
    for page in page_files.values():
        elements = page.get("elements")
        if not isinstance(elements, list):
            continue
        for element in elements:
            if not isinstance(element, dict) or element.get("elementType") != "text":
                continue
            content = element.get("content")
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                text = _normalize_text(content["text"])
                if text:
                    texts.append(text)
    return texts


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
        Converter().convert(entry_path, output_path, embed_fonts=False)
        inspection = inspect_presentation(str(output_path))
        if inspection["slideCount"] != len(entry["pages"]):
            raise ValueError(
                f"PPTX verification failed: expected {len(entry['pages'])} slides, got {inspection['slideCount']}"
            )
        expected_texts = _expected_texts(spec)
        actual_text = _normalize_text("\n".join(str(slide["text"]) for slide in inspection["slides"]))
        missing_texts = [text for text in expected_texts if text not in actual_text]
        if missing_texts:
            preview = ", ".join(repr(text[:80]) for text in missing_texts[:3])
            raise ValueError(f"PPTX verification failed: expected text was not written: {preview}")
        return {
            "output": str(output_path),
            "slides": inspection["slideCount"],
            "validation": validation,
            "inspection": inspection,
            "engine": "kimi_ppt_dsl",
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
