# XLSX CREATE — XML template workflow

Use this route only for a brand-new workbook.

## Required flow

```text
plan sheets / formulas / strings / styles
→ copy skill://xlsx/templates/minimal_xlsx/
→ edit OOXML directly
→ scripts/xlsx_pack.py
→ scripts/formula_check.py
→ optional scripts/libreoffice_recalc.py when real recalculation is required and available
→ deliver .xlsx
```

Do not use openpyxl as the write engine for CREATE.

## Formula-first rule

Every derived value must remain a live Excel formula. Hardcode only:

- raw/historical facts;
- user-provided inputs;
- explicit assumptions.

Formula cell example:

```xml
<c r="B5" s="2"><f>SUM(B2:B4)</f><v></v></c>
```

Cross-sheet formula example:

```xml
<c r="C5" s="3"><f>'Assumptions'!B2</f><v></v></c>
```

Formula text never includes a leading `=` inside `<f>`.

## Minimal template

The package starts with:

```text
[Content_Types].xml
_rels/.rels
xl/workbook.xml
xl/_rels/workbook.xml.rels
xl/styles.xml
xl/sharedStrings.xml
xl/worksheets/sheet1.xml
```

For every added sheet, keep these synchronized:

1. `xl/workbook.xml` sheet declaration;
2. `xl/_rels/workbook.xml.rels` relationship;
3. `[Content_Types].xml` worksheet override;
4. the actual `xl/worksheets/sheetN.xml` file.

Template relationship IDs `rId1`, `rId2`, and `rId3` are already used by the first sheet, styles, and shared strings. Additional worksheets should use unused relationship IDs.

## Shared strings

Text cells should normally reference `xl/sharedStrings.xml` using `t="s"` and a zero-based string index.

```xml
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
  <si><t>Revenue</t></si>
  <si><t>Gross Profit</t></si>
</sst>
```

```xml
<c r="A1" t="s" s="4"><v>0</v></c>
```

Escape XML characters correctly. Use `xml:space="preserve"` when leading/trailing spaces matter.

## Sheet rules

- max 31 characters;
- forbidden characters: `/ \\ ? * [ ] :`;
- escape `&` as `&amp;` in XML;
- quote sheet names containing spaces in formulas.

## Package integrity

Do not invent alternate package parts or silently omit required relationships. `xlsx_pack.py` must reject malformed XML before writing the archive.
