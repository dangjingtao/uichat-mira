#!/usr/bin/env python3
"""WenShu presentation runtime.

Independent PPTD-like JSON AST -> PPTX implementation using python-pptx.
Coordinates use point units (the imported skill convention treats 1 px = 1 pt).
No unavailable third-party PPT converter is required.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import math
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


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


def pt_to_in(value: float) -> float:
    return float(value) / 72.0


def rgb(value: Any, default: str = "000000") -> RGBColor:
    text = str(value or default).strip().lstrip("#")
    if len(text) == 8:
        text = text[:6]
    if not re.fullmatch(r"[0-9a-fA-F]{6}", text):
        text = default
    return RGBColor.from_string(text.upper())


def resolve_color(value: Any, theme: dict[str, Any], default: str = "#000000") -> str:
    if isinstance(value, str) and value.startswith("$"):
        colors = theme.get("colors") if isinstance(theme.get("colors"), dict) else {}
        return str(colors.get(value[1:], default))
    return str(value or default)


def bounds(item: dict[str, Any]) -> tuple[float, float, float, float]:
    raw = item.get("bounds", [0, 0, 100, 40])
    if not isinstance(raw, list) or len(raw) != 4:
        raise ValueError("element bounds must be [x,y,w,h]")
    return tuple(float(v) for v in raw)  # type: ignore[return-value]


def get_style(content: dict[str, Any], theme: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    ref = content.get("style")
    styles = theme.get("textStyles") if isinstance(theme.get("textStyles"), dict) else {}
    if isinstance(ref, str) and ref.startswith("$") and isinstance(styles.get(ref[1:]), dict):
        result.update(styles[ref[1:]])
    result.update({k: v for k, v in content.items() if k != "style"})
    return result


class RichTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.runs: list[tuple[str, dict[str, Any]]] = []
        self.stack: list[dict[str, Any]] = [{}]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        current = dict(self.stack[-1])
        if tag in ("b", "strong"): current["bold"] = True
        if tag in ("i", "em"): current["italic"] = True
        if tag == "u": current["underline"] = True
        if tag == "br":
            self.runs.append(("\n", current))
            return
        attr = dict(attrs)
        style = attr.get("style") or ""
        color_match = re.search(r"color\s*:\s*([^;]+)", style, re.I)
        if color_match: current["color"] = color_match.group(1).strip()
        size_match = re.search(r"font-size\s*:\s*([\d.]+)", style, re.I)
        if size_match: current["fontSize"] = float(size_match.group(1))
        self.stack.append(current)

    def handle_endtag(self, tag: str) -> None:
        if tag != "br" and len(self.stack) > 1:
            self.stack.pop()

    def handle_data(self, data: str) -> None:
        if data:
            self.runs.append((data, dict(self.stack[-1])))


def add_text(slide: Any, item: dict[str, Any], theme: dict[str, Any]) -> None:
    x, y, w, h = bounds(item)
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    style = get_style(content, theme)
    box = slide.shapes.add_textbox(Inches(pt_to_in(x)), Inches(pt_to_in(y)), Inches(pt_to_in(w)), Inches(pt_to_in(h)))
    frame = box.text_frame
    frame.clear()
    frame.margin_left = Pt(float(style.get("paddingLeft", style.get("padding", 0))))
    frame.margin_right = Pt(float(style.get("paddingRight", style.get("padding", 0))))
    frame.margin_top = Pt(float(style.get("paddingTop", style.get("padding", 0))))
    frame.margin_bottom = Pt(float(style.get("paddingBottom", style.get("padding", 0))))
    frame.word_wrap = bool(style.get("wordWrap", True))
    valign = str(style.get("verticalAlign", "top")).lower()
    frame.vertical_anchor = {"top": MSO_ANCHOR.TOP, "middle": MSO_ANCHOR.MIDDLE, "center": MSO_ANCHOR.MIDDLE, "bottom": MSO_ANCHOR.BOTTOM}.get(valign, MSO_ANCHOR.TOP)
    paragraph = frame.paragraphs[0]
    align = str(style.get("align", "left")).lower()
    paragraph.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT, "justify": PP_ALIGN.JUSTIFY}.get(align, PP_ALIGN.LEFT)
    paragraph.level = int(style.get("level", 0) or 0)
    text = str(style.get("text", ""))
    parser = RichTextParser()
    parser.feed(text)
    runs = parser.runs or [(re.sub(r"<[^>]+>", "", text), {})]
    for value, run_style in runs:
        run = paragraph.add_run()
        run.text = value
        font = run.font
        font.name = str(run_style.get("fontFamily", style.get("fontFamily", "Arial")))
        font.size = Pt(float(run_style.get("fontSize", style.get("fontSize", 18))))
        font.bold = bool(run_style.get("bold", style.get("bold", False)))
        font.italic = bool(run_style.get("italic", style.get("italic", False)))
        font.underline = bool(run_style.get("underline", style.get("underline", False)))
        font.color.rgb = rgb(resolve_color(run_style.get("color", style.get("color")), theme))


def shape_type(value: str) -> Any:
    key = value.replace("-", "_").replace(" ", "_").upper()
    aliases = {"RECT": "RECTANGLE", "ROUND_RECT": "ROUNDED_RECTANGLE", "LINE": "LINE", "ELLIPSE": "OVAL"}
    key = aliases.get(key, key)
    return getattr(MSO_SHAPE, key, MSO_SHAPE.RECTANGLE)


def add_shape(slide: Any, item: dict[str, Any], theme: dict[str, Any]) -> None:
    x, y, w, h = bounds(item)
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    shape = slide.shapes.add_shape(shape_type(str(content.get("shape", "rectangle"))), Inches(pt_to_in(x)), Inches(pt_to_in(y)), Inches(pt_to_in(w)), Inches(pt_to_in(h)))
    fill = content.get("fill")
    if fill in (None, "none", "transparent"):
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = rgb(resolve_color(fill, theme, "#FFFFFF"))
        if content.get("transparency") is not None:
            shape.fill.transparency = int(content["transparency"])
    line = content.get("line") if isinstance(content.get("line"), dict) else {}
    if line.get("color"):
        shape.line.color.rgb = rgb(resolve_color(line.get("color"), theme))
    if line.get("width") is not None:
        shape.line.width = Pt(float(line["width"]))
    rotation = item.get("rotation", content.get("rotation"))
    if rotation is not None:
        shape.rotation = float(rotation)


def decode_image(source: str) -> str | io.BytesIO:
    if source.startswith("data:") and ";base64," in source:
        return io.BytesIO(base64.b64decode(source.split(",", 1)[1]))
    return source


def add_image(slide: Any, item: dict[str, Any]) -> None:
    x, y, w, h = bounds(item)
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    source = str(content.get("src", content.get("path", "")))
    if not source:
        return
    slide.shapes.add_picture(decode_image(source), Inches(pt_to_in(x)), Inches(pt_to_in(y)), Inches(pt_to_in(w)), Inches(pt_to_in(h)))


def add_table(slide: Any, item: dict[str, Any], theme: dict[str, Any]) -> None:
    x, y, w, h = bounds(item)
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    rows = content.get("rows") if isinstance(content.get("rows"), list) else []
    if not rows:
        return
    cols = max((len(row) for row in rows if isinstance(row, list)), default=1)
    table = slide.shapes.add_table(len(rows), cols, Inches(pt_to_in(x)), Inches(pt_to_in(y)), Inches(pt_to_in(w)), Inches(pt_to_in(h))).table
    for r_idx, row in enumerate(rows):
        if not isinstance(row, list): continue
        for c_idx, value in enumerate(row[:cols]):
            cell = table.cell(r_idx, c_idx)
            if isinstance(value, dict):
                text = str(value.get("text", value.get("value", "")))
                cell.fill.solid()
                cell.fill.fore_color.rgb = rgb(resolve_color(value.get("fill", "#FFFFFF"), theme))
            else:
                text = str(value)
            cell.text = text
            for paragraph in cell.text_frame.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(float(content.get("fontSize", 14)))
                    run.font.name = str(content.get("fontFamily", "Arial"))
                    run.font.color.rgb = rgb(resolve_color(content.get("color", "#111111"), theme))
                    if r_idx == 0 and content.get("header", True): run.font.bold = True


def add_chart(slide: Any, item: dict[str, Any], theme: dict[str, Any]) -> None:
    x, y, w, h = bounds(item)
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    categories = [str(value) for value in content.get("categories", []) or []]
    series = content.get("series") if isinstance(content.get("series"), list) else []
    data = CategoryChartData()
    data.categories = categories
    for item_series in series:
        if isinstance(item_series, dict):
            data.add_series(str(item_series.get("name", "Series")), [float(v or 0) for v in item_series.get("values", [])])
    kind = str(content.get("type", "column")).lower()
    chart_type = {"bar": XL_CHART_TYPE.BAR_CLUSTERED, "line": XL_CHART_TYPE.LINE, "pie": XL_CHART_TYPE.PIE}.get(kind, XL_CHART_TYPE.COLUMN_CLUSTERED)
    chart = slide.shapes.add_chart(chart_type, Inches(pt_to_in(x)), Inches(pt_to_in(y)), Inches(pt_to_in(w)), Inches(pt_to_in(h)), data).chart
    chart.has_legend = bool(content.get("legend", True))
    chart.has_title = bool(content.get("title"))
    if chart.has_title: chart.chart_title.text_frame.text = str(content["title"])


def add_icon(slide: Any, item: dict[str, Any], theme: dict[str, Any]) -> None:
    # Portable fallback: icon content remains editable text/glyph instead of a raster.
    content = item.get("content") if isinstance(item.get("content"), dict) else {}
    text_item = dict(item)
    text_item["content"] = {
        "text": str(content.get("text", content.get("icon", "●"))),
        "fontSize": content.get("fontSize", 28),
        "fontFamily": content.get("fontFamily", "Segoe UI Symbol"),
        "color": content.get("color", "$primary"),
        "align": content.get("align", "center"),
        "verticalAlign": content.get("verticalAlign", "middle"),
    }
    add_text(slide, text_item, theme)


def add_background(slide: Any, background: Any, theme: dict[str, Any], page_size: tuple[float, float]) -> None:
    if isinstance(background, str):
        fill = slide.background.fill
        fill.solid(); fill.fore_color.rgb = rgb(resolve_color(background, theme, "#FFFFFF"))
    elif isinstance(background, dict) and background.get("type") == "image" and background.get("src"):
        slide.shapes.add_picture(decode_image(str(background["src"])), 0, 0, Inches(pt_to_in(page_size[0])), Inches(pt_to_in(page_size[1])))
    elif isinstance(background, dict) and background.get("color"):
        fill = slide.background.fill
        fill.solid(); fill.fore_color.rgb = rgb(resolve_color(background["color"], theme, "#FFFFFF"))


def add_page(prs: Presentation, page: dict[str, Any], theme: dict[str, Any], page_size: tuple[float, float]) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, page.get("background"), theme, page_size)
    for item in page.get("elements", []) or []:
        if not isinstance(item, dict): continue
        element_type = str(item.get("elementType", item.get("type", "text"))).lower()
        if element_type == "text": add_text(slide, item, theme)
        elif element_type == "shape": add_shape(slide, item, theme)
        elif element_type == "image": add_image(slide, item)
        elif element_type == "table": add_table(slide, item, theme)
        elif element_type == "chart": add_chart(slide, item, theme)
        elif element_type == "icon": add_icon(slide, item, theme)


def validate_spec(spec: dict[str, Any]) -> dict[str, Any]:
    raw_size = spec.get("size", [1280, 720])
    if not isinstance(raw_size, list) or len(raw_size) != 2:
        return {"pageCount": 0, "issues": [{"severity": "error", "type": "invalid_size"}], "errors": 1, "warnings": 0}
    page_w, page_h = float(raw_size[0]), float(raw_size[1])
    pages = spec.get("pages") if isinstance(spec.get("pages"), list) else []
    issues: list[dict[str, Any]] = []
    for p_idx, page in enumerate(pages, 1):
        if not isinstance(page, dict):
            issues.append({"severity": "error", "page": p_idx, "type": "invalid_page"}); continue
        rects: list[tuple[float, float, float, float, str, str]] = []
        for e_idx, item in enumerate(page.get("elements", []) or [], 1):
            if not isinstance(item, dict): continue
            element_id = str(item.get("id", f"element-{e_idx}"))
            try: x, y, w, h = bounds(item)
            except Exception as exc:
                issues.append({"severity": "error", "page": p_idx, "elementId": element_id, "type": "invalid_bounds", "message": str(exc)}); continue
            if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > page_w or y + h > page_h:
                issues.append({"severity": "error", "page": p_idx, "elementId": element_id, "type": "out_of_bounds", "bounds": [x, y, w, h]})
            if str(item.get("elementType", item.get("type", ""))).lower() == "text":
                content = item.get("content") if isinstance(item.get("content"), dict) else {}
                text = re.sub(r"<[^>]+>", "", str(content.get("text", "")))
                font_size = float(content.get("fontSize", 18) or 18)
                chars_per_line = max(1, int(w / max(font_size * 0.55, 1)))
                lines = max(1, math.ceil(len(text) / chars_per_line)) + text.count("\n")
                estimated = lines * font_size * float(content.get("lineHeight", 1.25) or 1.25)
                if estimated > h * 1.15:
                    issues.append({"severity": "warning", "page": p_idx, "elementId": element_id, "type": "possible_text_overflow", "estimatedHeight": round(estimated, 1), "height": h})
            rects.append((x, y, w, h, element_id, str(item.get("elementType", item.get("type", ""))).lower()))
        for i, a in enumerate(rects):
            for b in rects[i + 1:]:
                if a[5] == "shape" or b[5] == "shape": continue
                ix = max(0.0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
                iy = max(0.0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
                overlap = ix * iy
                smaller = min(a[2] * a[3], b[2] * b[3])
                if smaller > 0 and overlap / smaller > 0.35:
                    issues.append({"severity": "warning", "page": p_idx, "type": "possible_occlusion", "elements": [a[4], b[4]], "overlapRatio": round(overlap / smaller, 3)})
    return {
        "pageCount": len(pages), "issues": issues,
        "errors": sum(1 for issue in issues if issue["severity"] == "error"),
        "warnings": sum(1 for issue in issues if issue["severity"] == "warning"),
    }


def create_presentation(spec: dict[str, Any], output: str) -> dict[str, Any]:
    validation = validate_spec(spec)
    if validation["errors"]:
        raise ValueError(f"presentation spec has {validation['errors']} blocking validation errors")
    prs = Presentation()
    raw_size = spec.get("size", [1280, 720])
    page_size = (float(raw_size[0]), float(raw_size[1]))
    prs.slide_width = Inches(pt_to_in(page_size[0])); prs.slide_height = Inches(pt_to_in(page_size[1]))
    theme = spec.get("theme") if isinstance(spec.get("theme"), dict) else {}
    for page in spec.get("pages", []) or []:
        if isinstance(page, dict): add_page(prs, page, theme, page_size)
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    prs.save(output)
    return {"output": output, "slides": len(prs.slides), "validation": validation}


def inspect_presentation(input_path: str) -> dict[str, Any]:
    prs = Presentation(input_path)
    slides = []
    for idx, slide in enumerate(prs.slides, 1):
        texts: list[str] = []; pictures = tables = charts = 0
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                text = shape.text.strip()
                if text: texts.append(text)
            if shape.shape_type == 13: pictures += 1
            if getattr(shape, "has_table", False): tables += 1
            if getattr(shape, "has_chart", False): charts += 1
        slides.append({"index": idx, "text": "\n".join(texts)[:2000], "pictures": pictures, "tables": tables, "charts": charts})
    return {"file": input_path, "slideCount": len(slides), "slides": slides}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["create", "validate", "inspect"])
    parser.add_argument("--spec"); parser.add_argument("--input"); parser.add_argument("--output")
    args = parser.parse_args()
    try:
        if args.operation == "create":
            if not args.spec or not args.output: raise ValueError("create requires --spec and --output")
            data = create_presentation(load_json(args.spec), args.output)
        elif args.operation == "validate":
            if not args.spec: raise ValueError("validate requires --spec")
            data = validate_spec(load_json(args.spec))
        else:
            if not args.input: raise ValueError("inspect requires --input")
            data = inspect_presentation(args.input)
        emit({"status": "success", "data": data})
    except Exception as exc:
        emit({"status": "error", "error": type(exc).__name__, "message": str(exc)}, 1)


if __name__ == "__main__":
    main()
