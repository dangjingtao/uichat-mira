#!/usr/bin/env python3
"""WenShu PDF runtime.

Create and process PDFs using ReportLab, pikepdf and pdfplumber. The CLI accepts
a JSON spec for creation and JSON data for form/metadata operations.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


def emit(payload: dict[str, Any], code: int = 0) -> None:
    stream = sys.stdout if code == 0 else sys.stderr
    print(json.dumps(payload, ensure_ascii=False), file=stream)
    raise SystemExit(code)


def load_json(path_or_json: str | None) -> dict[str, Any]:
    if not path_or_json:
        return {}
    if os.path.exists(path_or_json):
        with open(path_or_json, "r", encoding="utf-8") as fh:
            value = json.load(fh)
    else:
        value = json.loads(path_or_json)
    if not isinstance(value, dict):
        raise ValueError("JSON payload must be an object")
    return value


def parse_pages(value: str | None, total: int) -> list[int]:
    if not value:
        return list(range(total))
    result: list[int] = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            start_idx = max(0, int(start) - 1)
            end_idx = min(total, int(end))
            result.extend(range(start_idx, end_idx))
        else:
            idx = int(part) - 1
            if 0 <= idx < total:
                result.append(idx)
    return sorted(set(result))


def find_cjk_font() -> str | None:
    candidates = [
        os.environ.get("MIRA_CJK_FONT"),
        r"C:\Windows\Fonts\msyh.ttf",
        r"C:\Windows\Fonts\simhei.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def create_pdf(spec: dict[str, Any], output: str) -> dict[str, Any]:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4, LETTER, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    page_name = str(spec.get("pageSize", "A4")).upper()
    page_size = LETTER if page_name == "LETTER" else A4
    if str(spec.get("orientation", "portrait")).lower() == "landscape":
        page_size = landscape(page_size)
    margins = spec.get("margins") if isinstance(spec.get("margins"), dict) else {}
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        output,
        pagesize=page_size,
        leftMargin=float(margins.get("left", 2.0)) * cm,
        rightMargin=float(margins.get("right", 2.0)) * cm,
        topMargin=float(margins.get("top", 2.0)) * cm,
        bottomMargin=float(margins.get("bottom", 2.0)) * cm,
        title=str(spec.get("title", "")),
        author=str(spec.get("author", "Mira")),
        subject=str(spec.get("subject", "")),
    )
    font_name = "Helvetica"
    font_path = find_cjk_font()
    if font_path and font_path.lower().endswith(".ttf"):
        try:
            pdfmetrics.registerFont(TTFont("WenShuCJK", font_path))
            font_name = "WenShuCJK"
        except Exception:
            pass
    styles = getSampleStyleSheet()
    align_map = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT, "justify": TA_JUSTIFY}
    style_defs = spec.get("styles") if isinstance(spec.get("styles"), dict) else {}

    def style(name: str, fallback: str, **overrides: Any) -> ParagraphStyle:
        base = styles[fallback]
        user = style_defs.get(name) if isinstance(style_defs.get(name), dict) else {}
        values = {
            "fontName": user.get("fontName", font_name),
            "fontSize": float(user.get("fontSize", overrides.pop("fontSize", base.fontSize))),
            "leading": float(user.get("leading", overrides.pop("leading", base.leading))),
            "textColor": colors.HexColor(str(user.get("color", overrides.pop("color", "#222222")))),
            "alignment": align_map.get(str(user.get("align", overrides.pop("align", "left"))), TA_LEFT),
            **overrides,
        }
        return ParagraphStyle(f"WenShu-{name}", parent=base, **values)

    style_map = {
        "title": style("title", "Title", fontSize=22, leading=30, align="center"),
        "heading1": style("heading1", "Heading1", fontSize=16, leading=22),
        "heading2": style("heading2", "Heading2", fontSize=13, leading=19),
        "body": style("body", "BodyText", fontSize=10.5, leading=17, align="justify"),
        "caption": style("caption", "BodyText", fontSize=8.5, leading=12, color="#666666"),
    }
    story: list[Any] = []
    title = spec.get("title")
    if isinstance(title, str) and title.strip():
        story.append(Paragraph(title, style_map["title"]))
        story.append(Spacer(1, 12))
    for block in spec.get("blocks", []) or []:
        if not isinstance(block, dict):
            continue
        kind = str(block.get("type", "paragraph"))
        if kind in ("paragraph", "heading1", "heading2", "caption"):
            text = str(block.get("text", ""))
            style_key = "body" if kind == "paragraph" else kind
            story.append(Paragraph(text.replace("\n", "<br/>"), style_map[style_key]))
            story.append(Spacer(1, float(block.get("spaceAfter", 6))))
        elif kind == "table":
            rows = block.get("rows")
            if not isinstance(rows, list) or not rows:
                continue
            table = Table(rows, repeatRows=1 if block.get("header", True) else 0)
            commands: list[tuple[Any, ...]] = [
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTSIZE", (0, 0), (-1, -1), float(block.get("fontSize", 9))),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#B8B8B8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
            if block.get("header", True):
                commands += [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(str(block.get("headerColor", "#EDEDED")))),
                    ("FONTNAME", (0, 0), (-1, 0), font_name),
                ]
            table.setStyle(TableStyle(commands))
            story.extend([table, Spacer(1, 10)])
        elif kind == "image":
            src = str(block.get("src", ""))
            if src and Path(src).exists():
                img = Image(src)
                width = block.get("width")
                height = block.get("height")
                if width:
                    img.drawWidth = float(width) * cm
                if height:
                    img.drawHeight = float(height) * cm
                story.extend([img, Spacer(1, 8)])
        elif kind == "spacer":
            story.append(Spacer(1, float(block.get("height", 12))))
        elif kind == "pageBreak":
            story.append(PageBreak())

    page_number = bool(spec.get("pageNumbers", False))
    def on_page(canvas: Any, document: Any) -> None:
        if not page_number:
            return
        canvas.saveState()
        canvas.setFont(font_name, 8)
        canvas.drawCentredString(page_size[0] / 2, 0.9 * cm, str(document.page))
        canvas.restoreState()
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return {"output": output, "bytes": Path(output).stat().st_size}


def extract_text(input_path: str, pages: str | None) -> dict[str, Any]:
    import pdfplumber
    with pdfplumber.open(input_path) as pdf:
        indexes = parse_pages(pages, len(pdf.pages))
        result = [{"page": i + 1, "text": pdf.pages[i].extract_text() or ""} for i in indexes]
    return {"pages": result, "pageCount": len(result)}


def extract_tables(input_path: str, pages: str | None) -> dict[str, Any]:
    import pdfplumber
    result: list[dict[str, Any]] = []
    with pdfplumber.open(input_path) as pdf:
        indexes = parse_pages(pages, len(pdf.pages))
        for i in indexes:
            for t_idx, table in enumerate(pdf.pages[i].extract_tables() or [], 1):
                result.append({"page": i + 1, "table": t_idx, "rows": table})
    return {"tables": result, "count": len(result)}


def extract_images(input_path: str, output_dir: str) -> dict[str, Any]:
    import pikepdf
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    outputs: list[str] = []
    with pikepdf.Pdf.open(input_path) as pdf:
        for page_index, page in enumerate(pdf.pages, 1):
            resources = page.obj.get("/Resources", {})
            xobjects = resources.get("/XObject", {}) if resources else {}
            for name, obj in xobjects.items():
                try:
                    if obj.get("/Subtype") != "/Image":
                        continue
                    raw = pikepdf.PdfImage(obj)
                    stem = destination / f"page-{page_index:03d}-{str(name).lstrip('/')}"
                    output = raw.extract_to(fileprefix=str(stem))
                    outputs.append(str(output))
                except Exception:
                    continue
    return {"outputDir": str(destination), "files": outputs, "count": len(outputs)}


def form_info(input_path: str) -> dict[str, Any]:
    import pikepdf
    fields: list[dict[str, Any]] = []
    with pikepdf.Pdf.open(input_path) as pdf:
        acro = pdf.Root.get("/AcroForm")
        if not acro:
            return {"fields": [], "count": 0}
        for field in acro.get("/Fields", []):
            obj = field.get_object()
            fields.append({
                "name": str(obj.get("/T", "")),
                "type": str(obj.get("/FT", "")),
                "value": str(obj.get("/V", "")),
                "alternateName": str(obj.get("/TU", "")),
            })
    return {"fields": fields, "count": len(fields)}


def fill_form(input_path: str, output: str, data: dict[str, Any]) -> dict[str, Any]:
    import pikepdf
    with pikepdf.Pdf.open(input_path) as pdf:
        acro = pdf.Root.get("/AcroForm")
        if not acro:
            raise ValueError("PDF has no AcroForm")
        acro["/NeedAppearances"] = True
        updated: list[str] = []
        for field in acro.get("/Fields", []):
            obj = field.get_object()
            name = str(obj.get("/T", ""))
            if name in data:
                obj["/V"] = pikepdf.String(str(data[name]))
                updated.append(name)
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        pdf.save(output)
    return {"output": output, "updated": updated}


def merge_pdfs(inputs: list[str], output: str) -> dict[str, Any]:
    import pikepdf
    merged = pikepdf.Pdf.new()
    count = 0
    for input_path in inputs:
        with pikepdf.Pdf.open(input_path) as source:
            merged.pages.extend(source.pages)
            count += len(source.pages)
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    merged.save(output)
    return {"output": output, "pages": count, "inputs": len(inputs)}


def split_pdf(input_path: str, output_dir: str) -> dict[str, Any]:
    import pikepdf
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    outputs: list[str] = []
    with pikepdf.Pdf.open(input_path) as pdf:
        for idx, page in enumerate(pdf.pages, 1):
            out = pikepdf.Pdf.new()
            out.pages.append(page)
            target = destination / f"page-{idx:03d}.pdf"
            out.save(target)
            outputs.append(str(target))
    return {"outputDir": str(destination), "files": outputs, "count": len(outputs)}


def rotate_pdf(input_path: str, output: str, degrees: int, pages: str | None) -> dict[str, Any]:
    import pikepdf
    with pikepdf.Pdf.open(input_path) as pdf:
        indexes = parse_pages(pages, len(pdf.pages))
        for index in indexes:
            page = pdf.pages[index]
            current = int(page.obj.get("/Rotate", 0) or 0)
            page.obj["/Rotate"] = (current + degrees) % 360
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        pdf.save(output)
    return {"output": output, "rotatedPages": [i + 1 for i in indexes], "degrees": degrees}


def crop_pdf(input_path: str, output: str, box: list[float], pages: str | None) -> dict[str, Any]:
    import pikepdf
    if len(box) != 4:
        raise ValueError("crop box must contain four numbers: x0,y0,x1,y1")
    with pikepdf.Pdf.open(input_path) as pdf:
        indexes = parse_pages(pages, len(pdf.pages))
        for index in indexes:
            pdf.pages[index].obj["/CropBox"] = pikepdf.Array(box)
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        pdf.save(output)
    return {"output": output, "croppedPages": [i + 1 for i in indexes], "box": box}


def meta_get(input_path: str) -> dict[str, Any]:
    import pikepdf
    with pikepdf.Pdf.open(input_path) as pdf:
        info = {str(key).lstrip("/"): str(value) for key, value in pdf.docinfo.items()}
    return {"metadata": info}


def meta_set(input_path: str, output: str, data: dict[str, Any]) -> dict[str, Any]:
    import pikepdf
    allowed = {"Title", "Author", "Subject", "Keywords", "Creator", "Producer"}
    with pikepdf.Pdf.open(input_path) as pdf:
        for key, value in data.items():
            normalized = str(key).lstrip("/").title()
            if normalized in allowed:
                pdf.docinfo[pikepdf.Name(f"/{normalized}")] = pikepdf.String(str(value))
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        pdf.save(output)
    return {"output": output, "updated": [str(k).title() for k in data if str(k).title() in allowed]}


def md_to_pdf(input_path: str, output: str) -> dict[str, Any]:
    import markdown2
    from xhtml2pdf import pisa
    text = Path(input_path).read_text(encoding="utf-8")
    html = markdown2.markdown(text, extras=["tables", "fenced-code-blocks", "header-ids", "strike"])
    css = """
    @page { size: A4; margin: 2cm; }
    body { font-family: sans-serif; font-size: 11pt; line-height: 1.55; color: #1f2937; }
    h1 { font-size: 22pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
    table { border-collapse: collapse; width: 100%; }
    th,td { border: 1px solid #aaa; padding: 5px; }
    pre { background: #f3f4f6; padding: 8px; }
    """
    document = f"<html><head><meta charset='utf-8'><style>{css}</style></head><body>{html}</body></html>"
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    with open(output, "wb") as fh:
        status = pisa.CreatePDF(document, dest=fh, encoding="utf-8")
    if status.err:
        raise RuntimeError(f"xhtml2pdf reported {status.err} errors")
    return {"output": output, "bytes": Path(output).stat().st_size}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=[
        "create", "extract_text", "extract_tables", "extract_images",
        "form_info", "form_fill", "merge", "split", "rotate", "crop",
        "meta_get", "meta_set", "md2pdf",
    ])
    parser.add_argument("--input")
    parser.add_argument("--inputs", nargs="*")
    parser.add_argument("--output")
    parser.add_argument("--output-dir")
    parser.add_argument("--spec")
    parser.add_argument("--data")
    parser.add_argument("--pages")
    parser.add_argument("--degrees", type=int)
    parser.add_argument("--box")
    args = parser.parse_args()
    try:
        op = args.operation
        if op == "create":
            if not args.output or not args.spec: raise ValueError("create requires --output and --spec")
            data = create_pdf(load_json(args.spec), args.output)
        elif op == "extract_text":
            if not args.input: raise ValueError("extract_text requires --input")
            data = extract_text(args.input, args.pages)
        elif op == "extract_tables":
            if not args.input: raise ValueError("extract_tables requires --input")
            data = extract_tables(args.input, args.pages)
        elif op == "extract_images":
            if not args.input or not args.output_dir: raise ValueError("extract_images requires --input and --output-dir")
            data = extract_images(args.input, args.output_dir)
        elif op == "form_info":
            if not args.input: raise ValueError("form_info requires --input")
            data = form_info(args.input)
        elif op == "form_fill":
            if not args.input or not args.output: raise ValueError("form_fill requires --input and --output")
            data = fill_form(args.input, args.output, load_json(args.data))
        elif op == "merge":
            inputs = args.inputs or []
            if not inputs or not args.output: raise ValueError("merge requires --inputs and --output")
            data = merge_pdfs(inputs, args.output)
        elif op == "split":
            if not args.input or not args.output_dir: raise ValueError("split requires --input and --output-dir")
            data = split_pdf(args.input, args.output_dir)
        elif op == "rotate":
            if not args.input or not args.output or args.degrees is None: raise ValueError("rotate requires --input --output --degrees")
            data = rotate_pdf(args.input, args.output, args.degrees, args.pages)
        elif op == "crop":
            if not args.input or not args.output or not args.box: raise ValueError("crop requires --input --output --box")
            box = [float(x.strip()) for x in args.box.split(",")]
            data = crop_pdf(args.input, args.output, box, args.pages)
        elif op == "meta_get":
            if not args.input: raise ValueError("meta_get requires --input")
            data = meta_get(args.input)
        elif op == "meta_set":
            if not args.input or not args.output: raise ValueError("meta_set requires --input and --output")
            data = meta_set(args.input, args.output, load_json(args.data))
        else:
            if not args.input or not args.output: raise ValueError("md2pdf requires --input and --output")
            data = md_to_pdf(args.input, args.output)
        emit({"status": "success", "data": data})
    except Exception as exc:
        emit({"status": "error", "error": type(exc).__name__, "message": str(exc)}, 1)


if __name__ == "__main__":
    main()
