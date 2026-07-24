# XLSX VALIDATE — deterministic checks only

Validation is performed by code, not by asking a model to inspect the workbook and decide whether execution probably succeeded.

## Tier 1 — static package/formula validation

Run:

```bash
python3 scripts/formula_check.py output.xlsx --report
```

This route checks package/formula structure that can be determined without executing Excel formulas, including malformed/missing package parts, formula error cells, broken sheet references, and shared-formula integrity.

A non-zero exit code is a validation failure. Repair the workbook/protocol and run the checker again.

## Tier 2 — dynamic recalculation

When actual formula execution is required and LibreOffice is available:

```bash
python3 scripts/libreoffice_recalc.py output.xlsx recalculated.xlsx
python3 scripts/formula_check.py recalculated.xlsx --report
```

LibreOffice absence is not evidence that recalculation succeeded. Report Tier-2 as unavailable rather than silently falling back to "calculation mode auto" and calling it recalculated.

Do not replace the requested final workbook with a degraded verification copy. If recalculation produces a distinct artifact only for validation, preserve the intended deliverable and clearly distinguish the verification artifact.

## Execution contract

- accepted operation + successful deterministic execution = success;
- unsupported/invalid protocol = explicit failure;
- no LLM semantic readback gate;
- no silent fallback from unsupported behavior to a guessed alternative.
