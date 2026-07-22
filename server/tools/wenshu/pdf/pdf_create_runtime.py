#!/usr/bin/env python3
"""Full WenShu PDF creation runtime.

Structured JSON spec -> professional PDF using ReportLab. Supports headings,
TOC, tables, images, matplotlib charts/equations, code blocks, links/markup,
page headers/footers and page numbers.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any


def emit(payload: dict[str, Any], code: int = 0) -> None:
    import sys

    stream = sys.stdout if code == 0 else sys.stderr
    print(json.dumps(payload, ensure_ascii=False), file=stream)
    raise SystemExit(code)


def load_json(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        value = json.load(fh)
    if not isinstance(value, dict):
        raise ValueError("spec must be a JSON object")
    return value


def find_cjk_font() -> str | None:
    candidates = [
        os.environ.get("MIRA_CJK_FONT"),
        r"C:\Windows\Fonts\msyh.ttf",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def register_fonts() -> tuple[str, str]:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    regular = "Helvetica"
    bold = "Helvetica-Bold"
    font_path = find_cjk_font()
    # ReportLab TTFont reliably supports TTF. TTC behavior varies by build, so
    # fall back to the standard font instead of making document generation fail.
    if font_path and font_path.lower().endswith(".ttf"):
        try:
            pdfmetrics.registerFont(TTFont("WenShuCJK", font_path))
            regular = "WenShuCJK"
            bold = "WenShuCJK"
        except Exception:
            pass
    return regular, bold


def color(value: Any, fallback: str = "#333333") -> Any:
    from reportlab.lib.colors import HexColor

    text = str(value or fallback).strip()
    if not text.startswith("#"):
        text = f"#{text}"
    try:
        return HexColor(text)
    except Exception:
        return HexColor(fallback)


def safe_anchor(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_-]+", "-", value.strip())
    return normalized.strip("-") or "section"


class WenShuDocTemplate:  # thin wrapper factory; actual subclass is created in build_pdf
    pass


def render_chart(block: dict[str, Any], destination: Path) -> Path:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    chart_type = str(block.get("chartType", block.get("kind", "bar"))).lower()
    categories = [str(item) for item in (block.get("categories") or [])]
    series = block.get("series") if isinstance(block.get("series"), list) else []
    width = float(block.get("figureWidth", 10))
    height = float(block.get("figureHeight", 5.5))
    fig, ax = plt.subplots(figsize=(width, height))

    if chart_type == "pie":
        first = series[0] if series and isinstance(series[0], dict) else {}
        values = [float(value or 0) for value in first.get("values", [])]
        labels = categories or [str(index + 1) for index in range(len(values))]
        ax.pie(values, labels=labels, autopct=block.get("autopct", "%1.1f%%"))
    elif chart_type == "line":
        x = list(range(len(categories)))
        for item in series:
            if not isinstance(item, dict):
                continue
            values = [float(value or 0) for value in item.get("values", [])]
            ax.plot(x[: len(values)], values, marker="o", label=str(item.get("name", "Series")))
        ax.set_xticks(x)
        ax.set_xticklabels(categories)
        if len(series) > 1:
            ax.legend()
    else:
        x = list(range(len(categories)))
        count = max(1, len(series))
        bar_width = 0.8 / count
        for index, item in enumerate(series):
            if not isinstance(item, dict):
                continue
            values = [float(value or 0) for value in item.get("values", [])]
            offsets = [value - 0.4 + bar_width / 2 + index * bar_width for value in x[: len(values)]]
            ax.bar(offsets, values, width=bar_width, label=str(item.get("name", "Series")))
        ax.set_xticks(x)
        ax.set_xticklabels(categories)
        if len(series) > 1:
            ax.legend()

    if block.get("title"):
        ax.set_title(str(block["title"]))
    if block.get("xLabel"):
        ax.set_xlabel(str(block["xLabel"]))
    if block.get("yLabel"):
        ax.set_ylabel(str(block["yLabel"]))
    if block.get("grid", True) and chart_type != "pie":
        ax.grid(axis="y", alpha=0.2)
    fig.tight_layout()
    fig.savefig(destination, dpi=int(block.get("dpi", 160)), bbox_inches="tight")
    plt.close(fig)
    return destination


def render_equation(block: dict[str, Any], destination: Path) -> Path:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    equation = str(block.get("latex", block.get("text", ""))).strip()
    if not equation:
        raise ValueError("equation block requires latex or text")
    if not equation.startswith("$"):
        equation = f"${equation}$"
    fig, ax = plt.subplots(
        figsize=(float(block.get("figureWidth", 8)), float(block.get("figureHeight", 1.4)))
    )
    ax.text(
        0.5,
        0.5,
        equation,
        fontsize=float(block.get("fontSize", 20)),
        horizontalalignment="center",
        verticalalignment="center",
        transform=ax.transAxes,
    )
    ax.axis("off")
    fig.savefig(destination, dpi=int(block.get("dpi", 180)), bbox_inches="tight", transparent=True)
    plt.close(fig)
    return destination


def build_pdf(spec: dict[str, Any], output: str) -> dict[str, Any]:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
    from reportlab.lib.pagesizes import A4, LETTER, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        BaseDocTemplate,
        Frame,
        Image,
        PageBreak,
        PageTemplate,
        Paragraph,
        Preformatted,
        Spacer,
        Table,
        TableStyle,
    )
    from reportlab.platypus.tableofcontents import TableOfContents

    page_name = str(spec.get("pageSize", "A4")).upper()
    page_size = LETTER if page_name == "LETTER" else A4
    if str(spec.get("orientation", "portrait")).lower() == "landscape":
        page_size = landscape(page_size)

    margins = spec.get("margins") if isinstance(spec.get("margins"), dict) else {}
    left = float(margins.get("left", 2.5)) * cm
    right = float(margins.get("right", 2.5)) * cm
    top = float(margins.get("top", 2.5)) * cm
    bottom = float(margins.get("bottom", 2.5)) * cm
    Path(output).parent.mkdir(parents=True, exist_ok=True)

    regular_font, bold_font = register_fonts()
    sample = getSampleStyleSheet()
    style_defs = spec.get("styles") if isinstance(spec.get("styles"), dict) else {}
    align_map = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT, "justify": TA_JUSTIFY}

    def make_style(
        key: str,
        parent: str,
        *,
        font_size: float,
        leading: float,
        space_before: float = 0,
        space_after: float = 6,
        default_color: str = "#333333",
        default_align: str = "left",
        bold: bool = False,
    ) -> ParagraphStyle:
        user = style_defs.get(key) if isinstance(style_defs.get(key), dict) else {}
        font_name = str(user.get("fontName", bold_font if bold else regular_font))
        return ParagraphStyle(
            f"WenShu-{key}",
            parent=sample[parent],
            fontName=font_name,
            fontSize=float(user.get("fontSize", font_size)),
            leading=float(user.get("leading", leading)),
            textColor=color(user.get("color"), default_color),
            alignment=align_map.get(str(user.get("align", default_align)).lower(), TA_LEFT),
            spaceBefore=float(user.get("spaceBefore", space_before)),
            spaceAfter=float(user.get("spaceAfter", space_after)),
            keepWithNext=bool(user.get("keepWithNext", key.startswith("heading"))),
        )

    styles = {
        "title": make_style("title", "Title", font_size=24, leading=32, space_after=18, default_align="center", bold=True),
        "heading1": make_style("heading1", "Heading1", font_size=17, leading=24, space_before=12, space_after=8, bold=True),
        "heading2": make_style("heading2", "Heading2", font_size=14, leading=21, space_before=10, space_after=6, bold=True),
        "heading3": make_style("heading3", "Heading3", font_size=12, leading=18, space_before=8, space_after=5, bold=True),
        "body": make_style("body", "BodyText", font_size=11, leading=17, space_after=7, default_align="justify"),
        "caption": make_style("caption", "BodyText", font_size=9, leading=13, space_after=8, default_color="#666666", default_align="center"),
        "reference": ParagraphStyle(
            "WenShu-reference",
            parent=sample["BodyText"],
            fontName=regular_font,
            fontSize=9.5,
            leading=14,
            leftIndent=24,
            firstLineIndent=-24,
            spaceAfter=5,
        ),
        "code": ParagraphStyle(
            "WenShu-code",
            parent=sample["Code"],
            fontName=regular_font if regular_font != "Helvetica" else "Courier",
            fontSize=8.5,
            leading=12,
            leftIndent=8,
            rightIndent=8,
            borderPadding=8,
            backColor=color("#F5F5F5"),
            textColor=color("#222222"),
            spaceBefore=6,
            spaceAfter=10,
        ),
    }

    toc_enabled = bool(spec.get("toc"))
    header = spec.get("header") if isinstance(spec.get("header"), dict) else {}
    footer = spec.get("footer") if isinstance(spec.get("footer"), dict) else {}
    page_numbers = bool(spec.get("pageNumbers", footer.get("pageNumbers", False)))
    skip_first_header_footer = bool(spec.get("skipFirstHeaderFooter", True))

    class Document(BaseDocTemplate):
        def afterFlowable(self, flowable: Any) -> None:
            if not isinstance(flowable, Paragraph):
                return
            style_name = getattr(flowable.style, "name", "")
            level_map = {
                styles["heading1"].name: 0,
                styles["heading2"].name: 1,
                styles["heading3"].name: 2,
            }
            if style_name not in level_map:
                return
            text = flowable.getPlainText()
            anchor = getattr(flowable, "_wenshu_anchor", None)
            if not anchor:
                anchor = f"section-{self.page}-{safe_anchor(text)}-{id(flowable)}"
            self.canv.bookmarkPage(anchor)
            self.canv.addOutlineEntry(text, anchor, level=level_map[style_name], closed=False)
            self.notify("TOCEntry", (level_map[style_name], text, self.page, anchor))

    doc = Document(
        output,
        pagesize=page_size,
        leftMargin=left,
        rightMargin=right,
        topMargin=top,
        bottomMargin=bottom,
        title=str(spec.get("title", "")),
        author=str(spec.get("author", "Mira")),
        subject=str(spec.get("subject", "")),
    )
    frame = Frame(left, bottom, page_size[0] - left - right, page_size[1] - top - bottom, id="main")

    def draw_header_footer(canvas: Any, document: Any) -> None:
        if skip_first_header_footer and document.page == 1:
            return
        canvas.saveState()
        header_text = str(header.get("text", "")).strip()
        footer_text = str(footer.get("text", "")).strip()
        canvas.setFillColor(color(header.get("color"), "#666666"))
        canvas.setFont(regular_font, float(header.get("fontSize", 8.5)))
        if header_text:
            canvas.drawString(left, page_size[1] - max(0.8 * cm, top * 0.55), header_text)
            if header.get("rule", True):
                canvas.setStrokeColor(color(header.get("ruleColor"), "#B8B8B8"))
                canvas.line(left, page_size[1] - max(1.05 * cm, top * 0.7), page_size[0] - right, page_size[1] - max(1.05 * cm, top * 0.7))
        canvas.setFillColor(color(footer.get("color"), "#666666"))
        canvas.setFont(regular_font, float(footer.get("fontSize", 8.5)))
        footer_y = max(0.65 * cm, bottom * 0.42)
        if footer_text:
            canvas.drawString(left, footer_y, footer_text)
        if page_numbers:
            page_prefix = str(footer.get("pagePrefix", ""))
            canvas.drawRightString(page_size[0] - right, footer_y, f"{page_prefix}{document.page}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=draw_header_footer)])

    story: list[Any] = []
    title = spec.get("title")
    if isinstance(title, str) and title.strip():
        story.append(Paragraph(title, styles["title"]))
        subtitle = spec.get("subtitle")
        if isinstance(subtitle, str) and subtitle.strip():
            subtitle_style = ParagraphStyle(
                "WenShu-subtitle",
                parent=styles["body"],
                alignment=TA_CENTER,
                textColor=color("#666666"),
                fontSize=12,
                leading=18,
                spaceAfter=10,
            )
            story.append(Paragraph(subtitle, subtitle_style))
        cover_meta = [str(item).strip() for item in [spec.get("author"), spec.get("date")] if isinstance(item, str) and item.strip()]
        if cover_meta:
            meta_style = ParagraphStyle(
                "WenShu-cover-meta",
                parent=styles["body"],
                alignment=TA_CENTER,
                textColor=color("#777777"),
                fontSize=10,
                leading=15,
                spaceAfter=12,
            )
            story.append(Paragraph(" · ".join(cover_meta), meta_style))

    if toc_enabled:
        toc_config = spec.get("toc") if isinstance(spec.get("toc"), dict) else {}
        if title:
            story.append(PageBreak())
        story.append(Paragraph(str(toc_config.get("title", "目录")), styles["heading1"]))
        toc = TableOfContents()
        toc.levelStyles = [
            ParagraphStyle("TOC-1", fontName=regular_font, fontSize=11, leading=18, leftIndent=0, firstLineIndent=0, spaceBefore=4),
            ParagraphStyle("TOC-2", fontName=regular_font, fontSize=10, leading=16, leftIndent=18, firstLineIndent=0),
            ParagraphStyle("TOC-3", fontName=regular_font, fontSize=9.5, leading=15, leftIndent=36, firstLineIndent=0),
        ]
        story.extend([toc, PageBreak()])

    table_count = 0
    figure_count = 0
    references = spec.get("references") if isinstance(spec.get("references"), list) else []

    with tempfile.TemporaryDirectory(prefix="mira-wenshu-pdf-") as temp_dir:
        temp = Path(temp_dir)
        for index, block_value in enumerate(spec.get("blocks", []) or []):
            if not isinstance(block_value, dict):
                continue
            block = block_value
            kind = str(block.get("type", "paragraph"))
            if kind in ("paragraph", "heading1", "heading2", "heading3", "caption"):
                text = str(block.get("text", ""))
                style_key = "body" if kind == "paragraph" else kind
                paragraph = Paragraph(text.replace("\n", "<br/>"), styles[style_key])
                if kind.startswith("heading") and block.get("id"):
                    setattr(paragraph, "_wenshu_anchor", safe_anchor(str(block["id"])))
                story.append(paragraph)
            elif kind == "reference":
                story.append(Paragraph(str(block.get("text", "")), styles["reference"]))
            elif kind == "table":
                rows = block.get("rows")
                if not isinstance(rows, list) or not rows:
                    continue
                table_count += 1
                caption = str(block.get("caption", "")).strip()
                if caption:
                    story.append(Paragraph(f"Table {table_count}. {caption}", styles["caption"]))
                rendered_rows = []
                for row in rows:
                    if not isinstance(row, list):
                        continue
                    rendered_rows.append([
                        Paragraph(html.escape(str(cell)) if not isinstance(cell, dict) else str(cell.get("text", "")), styles["body"])
                        for cell in row
                    ])
                table = Table(rendered_rows, repeatRows=1 if block.get("header", True) else 0)
                commands: list[tuple[Any, ...]] = [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LINEABOVE", (0, 0), (-1, 0), 1.5, colors.black),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.75, colors.black),
                    ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.black),
                ]
                table.setStyle(TableStyle(commands))
                story.extend([table, Spacer(1, 10)])
            elif kind == "image":
                source = str(block.get("src", ""))
                if not source or not Path(source).exists():
                    raise ValueError(f"image block source does not exist: {source}")
                figure_count += 1
                image = Image(source)
                max_width = page_size[0] - left - right
                requested_width = float(block.get("width", 0)) * cm if block.get("width") else max_width
                requested_height = float(block.get("height", 0)) * cm if block.get("height") else image.imageHeight * min(1.0, requested_width / max(image.imageWidth, 1))
                scale = min(1.0, max_width / max(requested_width, 1))
                image.drawWidth = requested_width * scale
                image.drawHeight = requested_height * scale
                story.append(image)
                if block.get("caption"):
                    story.append(Paragraph(f"Figure {figure_count}. {block['caption']}", styles["caption"]))
                else:
                    story.append(Spacer(1, 8))
            elif kind == "chart":
                figure_count += 1
                image_path = render_chart(block, temp / f"chart-{index}.png")
                max_width = page_size[0] - left - right
                width = min(float(block.get("width", 14)) * cm, max_width)
                height = float(block.get("height", 8)) * cm
                story.append(Image(str(image_path), width=width, height=height))
                if block.get("caption"):
                    story.append(Paragraph(f"Figure {figure_count}. {block['caption']}", styles["caption"]))
                else:
                    story.append(Spacer(1, 8))
            elif kind == "equation":
                image_path = render_equation(block, temp / f"equation-{index}.png")
                width = min(float(block.get("width", 10)) * cm, page_size[0] - left - right)
                height = float(block.get("height", 2)) * cm
                story.extend([Image(str(image_path), width=width, height=height), Spacer(1, 6)])
            elif kind == "code":
                code_text = str(block.get("code", block.get("text", "")))
                story.append(Preformatted(code_text, styles["code"], maxLineLength=int(block.get("maxLineLength", 110))))
                if block.get("caption"):
                    story.append(Paragraph(str(block["caption"]), styles["caption"]))
            elif kind == "spacer":
                story.append(Spacer(1, float(block.get("height", 12))))
            elif kind == "pageBreak":
                story.append(PageBreak())

        if references:
            story.extend([PageBreak(), Paragraph(str(spec.get("referencesTitle", "References")), styles["heading1"])])
            for index, reference in enumerate(references, 1):
                if isinstance(reference, dict):
                    text = str(reference.get("text", reference.get("title", "")))
                    url = str(reference.get("url", "")).strip()
                    if url:
                        text = f'{text} <a href="{html.escape(url)}" color="#333333">{html.escape(url)}</a>'
                else:
                    text = str(reference)
                story.append(Paragraph(f"[{index}] {text}", styles["reference"]))

        # TOC needs multiBuild; normal documents can still use the same method.
        doc.multiBuild(story)

    return {
        "output": output,
        "bytes": Path(output).stat().st_size,
        "tableCount": table_count,
        "figureCount": figure_count,
        "toc": toc_enabled,
        "pageNumbers": page_numbers,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["create"])
    parser.add_argument("--spec", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        data = build_pdf(load_json(args.spec), args.output)
        emit({"status": "success", "data": data})
    except Exception as exc:
        emit({"status": "error", "error": type(exc).__name__, "message": str(exc)}, 1)


if __name__ == "__main__":
    main()
