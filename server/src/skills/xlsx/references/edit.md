# XLSX EDIT — preserve the original package

Use this route whenever an existing `.xlsx` or `.xlsm` is being changed.

## Required flow

```text
scripts/xlsx_unpack.py input.xlsx workdir/
→ locate exact workbook/sheet/style/shared-string nodes
→ change only requested OOXML
→ scripts/xlsx_pack.py workdir/ output.xlsx
→ scripts/formula_check.py output.xlsx
```

## Integrity rules

1. Never create a new workbook to simulate an edit.
2. Preserve all original sheets unless the request explicitly adds/removes one.
3. Preserve unrelated cells and formatting.
4. Preserve unknown package parts and relationships.
5. Preserve `vbaProject.bin` and macro relationships/content types for `.xlsm`.
6. Do not use openpyxl round-trip as the default edit path for complex existing workbooks.
7. Do not silently drop pivots, sparklines, charts, external links, VBA, custom XML, or unsupported structures.

## Locating targets

Do not trust a human-described row number when a label is also provided. Locate the real row/cell by its text/value first, then edit the corresponding XML node.

For text stored in shared strings, resolve the `<v>` index through `xl/sharedStrings.xml` before deciding which cell contains the target label.

## Formulas

To add or replace a formula, edit the cell's `<f>` node directly and clear stale cached values when appropriate:

```xml
<c r="B3" s="2"><f>SUM('Sales Data'!D2:D13)</f><v></v></c>
```

## Structural changes

When inserting rows/columns or adding sheets, update every dependent OOXML structure that the operation affects: cell references, formula ranges, merged cells, dimensions, hyperlinks, drawings/chart references, tables, relationships, and content types where applicable.

If the requested change cannot be performed without loss to an unsupported structure, fail explicitly instead of reconstructing a degraded workbook.
