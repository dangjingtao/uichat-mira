# XLSX READ / ANALYZE

Reading and analysis must never modify the source workbook.

Use `scripts/xlsx_reader.py` for initial structure discovery of `.xlsx`, `.xlsm`, `.csv`, and `.tsv` files. pandas/openpyxl may be used read-only for deeper analysis when available.

## Rules

- preserve the source file byte-for-byte;
- aggregate directly from the loaded data, not from re-derived/guessed values;
- preserve requested numeric precision when presenting results;
- distinguish empty cached formula values from confirmed business nulls;
- do not infer that a formula failed merely because a read-only library sees an empty cache;
- do not write a modified workbook unless the user actually requested an edit/create operation.

For large workbooks, discover sheet names, dimensions, columns, nulls, duplicates, and a small preview before loading unnecessary data into context.
