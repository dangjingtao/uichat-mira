---
name: xlsx
description: "Open, create, read, analyze, edit, fix, and validate Excel/spreadsheet files through an XML-first workflow derived from MiniMax's MIT-licensed minimax-xlsx skill. Preserve existing workbook structure, keep formulas live, and use deterministic scripts for packing and validation."
license: MIT
metadata:
  upstream: "MiniMax-AI/skills/skills/minimax-xlsx"
  upstreamCommit: "60aaae52bb2af8162732751a4332f62a5fef518b"
---

# Mira WenShu XLSX

This Skill uses the MiniMax XLSX workflow as its implementation baseline.

SkillContext provides execution instructions and package resources only. It does not expand canonical ToolExposure. Use the currently exposed generic file/terminal capabilities to materialize and run this package. Do not route XLSX work back through the legacy openpyxl `office_spreadsheet` create/modify path when this Skill is active.

## Task routing

| Task | Method | Reference |
|---|---|---|
| READ / ANALYZE existing data | `scripts/xlsx_reader.py` + pandas when available | `skill://xlsx/references/read-analyze.md` |
| CREATE new `.xlsx` | copy `templates/minimal_xlsx/`, edit OOXML, pack | `skill://xlsx/references/create.md` + `skill://xlsx/references/format.md` |
| EDIT existing `.xlsx/.xlsm` | unpack → targeted OOXML edit → pack | `skill://xlsx/references/edit.md` |
| FIX formulas | unpack → repair `<f>` nodes → pack | `skill://xlsx/references/fix.md` |
| VALIDATE formulas/package | deterministic scripts | `skill://xlsx/references/validate.md` |

Do not load every reference at once. Read only the reference needed for the current route.

## CREATE

Start from `skill://xlsx/templates/minimal_xlsx/`; do not build a package from an ad-hoc ZIP layout.

Core flow:

```text
plan workbook structure
→ copy minimal_xlsx template
→ edit workbook/sharedStrings/styles/worksheet XML
→ scripts/xlsx_pack.py
→ scripts/formula_check.py
→ optional scripts/libreoffice_recalc.py when real recalculation is available/required
→ deliver .xlsx
```

Every derived value must remain an Excel formula. Hardcode only raw facts, user inputs, and explicit assumptions.

## EDIT / FIX

Never recreate an existing workbook from scratch merely to make an edit. Never use an openpyxl round-trip as the default edit path for an existing complex workbook because it can lose unsupported OOXML structures.

Use:

```text
scripts/xlsx_unpack.py input.xlsx workdir/
→ edit only the requested OOXML nodes
→ scripts/xlsx_pack.py workdir/ output.xlsx
→ scripts/formula_check.py output.xlsx
```

Preserve sheet names, unrelated cells, VBA/pivot/chart/sparkline/package parts, relationships, and formatting unless the request explicitly changes them.

For `.xlsm`, preserve `vbaProject.bin` and all existing package relationships/content types.

## READ / ANALYZE

Reading and analysis must not modify the source file. Use `scripts/xlsx_reader.py` for structure/data discovery. pandas/openpyxl may be used for read-only analysis when available; they are not the write path for CREATE/EDIT.

## Formula rules

1. Derived/projected/linked values stay as formulas, never Python-computed pasted values.
2. Cross-sheet references must target real sheet names.
3. Do not silently replace unsupported formulas, chart types, styles, or workbook structures with guessed alternatives.
4. A protocol or package construct that cannot be preserved or executed faithfully must fail explicitly.

## Deterministic validation

Validation is code, not model judgment.

- `scripts/xlsx_pack.py` rejects malformed XML before packing.
- `scripts/formula_check.py` performs static formula/package checks.
- `scripts/libreoffice_recalc.py` is an optional Tier-2 recalculation path when LibreOffice is actually available.

Do not use an LLM to inspect generated values and decide whether deterministic code "probably worked". If a deterministic operation fails, repair the protocol/input or implementation.

Dynamic recalculation is not silently downgraded to success. If LibreOffice is unavailable, report that Tier-2 recalculation was unavailable; do not claim that formulas were recalculated.

## Financial formatting baseline

- hard-coded input / assumption font: blue `0000FF`
- formula / computed result font: black `000000`
- cross-sheet reference formula font: green `00B050`

Read `skill://xlsx/references/format.md` before building a styled financial workbook.

## Hard rules

1. CREATE uses the OOXML template path.
2. EDIT/FIX preserve the original package and edit OOXML surgically.
3. Never flatten live formulas into hardcoded calculated outputs.
4. Never silently drop workbook structures to make an operation easier.
5. Never fabricate source citations or business data.
6. Never treat model visual/readback judgment as an execution-success gate.
7. Always write the requested final workbook artifact, not only intermediate XML/spec files.

## Completion

A task is complete when the requested deterministic operation succeeded, the final workbook artifact was written, and the required deterministic validation for that route passed. Optional Tier-2 recalculation is only claimed when it actually ran successfully.

## Upstream

Implementation baseline: MiniMax `minimax-xlsx`, MIT licensed, pinned to upstream commit `60aaae52bb2af8162732751a4332f62a5fef518b`. Mira-specific changes are limited to Skill routing, capability boundaries, and package paths.