---
name: pdf
description: "Create and process PDF files through Mira WenShu. Supports structured report creation, Markdown conversion, text/table/image extraction, forms, merge/split/rotate/crop, and metadata operations."
---

# Routing

## Create a new PDF
Use `office_pdf` with `operation=create` and a structured `spec`.

The spec may contain:
- `title`, `author`, `subject`
- `pageSize`: `A4` or `LETTER`
- `orientation`: `portrait` or `landscape`
- `margins`
- `styles`
- `blocks`: `heading1`, `heading2`, `paragraph`, `caption`, `table`, `image`, `spacer`, `pageBreak`
- `pageNumbers`

Content quality, facts, outline and citations must be prepared before calling the deterministic runtime. Do not fabricate sources.

## Convert Markdown
Use `operation=md2pdf` when the real source is an existing Markdown artifact and conversion is desired. Do not route every PDF creation through Markdown.

## Process existing PDF
Supported operations:
- `extract_text`
- `extract_tables`
- `extract_images`
- `form_info`
- `form_fill`
- `merge`
- `split`
- `rotate`
- `crop`
- `meta_get`
- `meta_set`

# Execution contract

Primary capability:

```text
office_pdf
```

Page selections are 1-based, e.g. `1,3-5`.
Crop boxes use PDF point coordinates `[x0,y0,x1,y1]`.
Merge uses `inputPaths[]`.
Split/image extraction use an `outputDir` and may produce multiple artifacts.

# Hard rules

1. Never edit PDF bytes with `edit_file` or arbitrary binary replacement.
2. Preserve the source PDF for transformations; write a distinct output artifact by default.
3. Use the public Read surface to inspect context when needed, but use `office_pdf` for PDF-specific processing.
4. Do not claim generation/processing succeeded until accepted Evidence confirms the output/result.
5. Generated factual reports must use real, verifiable information and citations when citations are required.
6. Match the user's requested language and requested document structure.

# Completion

A PDF task is complete only when all applicable conditions hold:
- requested extraction/inspection result exists in Evidence;
- generated or modified artifact exists and is readable;
- requested page/form/metadata operation is reflected in the result;
- multi-output operations report their output directory/file count;
- source files remain preserved unless the user explicitly requested otherwise.
