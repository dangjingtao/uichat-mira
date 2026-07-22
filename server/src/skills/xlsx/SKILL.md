---
name: xlsx
description: "Create, modify and validate Excel workbooks through Mira WenShu. Supports formula-driven models, styling, charts, conditional formatting, named ranges, citations and finance modeling workflows."
---

# Routing

Use `office_spreadsheet` for `.xlsx` creation, modification, inspection, recalculation preparation and verification.

```text
office_spreadsheet
  create
  modify
  inspect
  recalc
  verify
```

Do not expose `set_cell`, `add_chart`, `merge_cells` or other openpyxl/Excel SDK primitives as Agent tools. Those operations belong inside the workbook spec.

# Workbook specification

The high-level spec supports:
- workbook metadata;
- sheets;
- row arrays and addressed cells;
- native Excel formulas;
- fonts, fills, alignment, borders and number formats;
- column widths, row heights, freeze panes and gridline visibility;
- merged ranges;
- comments and hyperlinks;
- conditional formatting;
- column/bar/line/pie charts;
- named ranges;
- `Sources` entries with source name, URL and notes.

# Formula rule — mandatory

If a value can be derived by a workbook formula, keep it as an Excel formula.

Allowed hardcoded values:
- true raw/historical reported data;
- user-provided inputs;
- explicit assumptions.

Do not calculate projected, rolled-forward, allocated, linked or valuation outputs in Python and paste final numbers into cells. The delivered workbook must remain linked, traceable and updateable.

# External data

When external data is used, preserve citations in the workbook. Use at least:

```text
Source Name | Source URL
```

Do not fabricate citations or hide source URLs behind calculated values.

# Finance routing

Finance work uses the same `office_spreadsheet` runtime but stricter modeling semantics.

## Three-statement model
Use when the task requires linked Income Statement / Balance Sheet / Cash Flow, forecast schedules, working capital, debt, retained earnings, cash roll-forward or a forecast foundation for valuation.

Required principles:
- Raw Data remains historical-only.
- Historical mappings reconcile to reported totals before forecast opening balances are used.
- Forecast/derived outputs are formula-linked.
- Include visible Balance Check.
- Reconcile Balance Sheet cash to Cash Flow ending cash by year.
- Retained earnings roll-forward must reconcile.

## DCF
Build from a forecast model unless the user explicitly asks for a simplified standalone DCF.
Keep NOPAT, UFCF, WACC, terminal value, discounting, EV → Equity Value → implied share price and sensitivities formula-linked.

## Comps
Use for peer tables, trading multiples, valuation ranges and implied valuation. Keep market/company data sourced, assumptions visible and calculations formula-linked.

# Recalculation and validation

Create/modify flows perform recalculation preparation and verification.

Recalculation provider order:
1. optional Python `formulas` library when available;
2. LibreOffice headless when available;
3. set workbook calculation mode to automatic/full recalculation on open.

Verification checks formula errors and compatibility risks. Do not present a workbook as fully validated when blocking reconciliation/model checks remain unresolved.

# Hard rules

1. Existing workbook modification is non-destructive by default; write a new `.xlsx`.
2. Do not flatten formulas to hardcoded results.
3. Do not silently drop workbook structure just to make an edit easier.
4. External data requires source citations.
5. After creation/modification, verification Evidence is required before completion.
6. Complex finance tasks must include their model checks before delivery.

# Completion

A workbook task is complete only when:
- requested workbook/artifact exists and is readable;
- formulas/sheets/formatting/charts requested by the task are present;
- recalculation preparation completed;
- verification has no unresolved blocking errors;
- source citations are present when external data was used;
- finance-specific reconciliation checks required by the task are present and resolved.
