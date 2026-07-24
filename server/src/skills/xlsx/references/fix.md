# XLSX FIX — repair formulas without rebuilding the workbook

Formula repair is an EDIT operation.

## Flow

```text
unpack original workbook
→ locate broken `<f>` nodes
→ repair only affected formulas/references
→ pack to a new workbook
→ run formula_check.py
→ optionally recalculate with LibreOffice and re-run formula_check.py
```

## Rules

- Preserve the original workbook package and unrelated content.
- Do not replace formulas with Python-computed hardcoded values.
- Do not guess a missing business input. Fix only formulas/references that can be determined from the workbook/task.
- Broken cross-sheet references must resolve to an actual sheet name.
- Shared-formula groups must retain a valid primary definition and consumers.
- When a formula depends on a renamed/moved range, update all required dependent references consistently.

A failed formula must not be hidden by deleting the formula or replacing it with zero/blank unless that is explicitly the requested business logic.
