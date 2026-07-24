# XLSX formatting baseline

The bundled `templates/minimal_xlsx/xl/styles.xml` provides semantic style slots.

| Style index | Role | Font | Number format |
|---|---|---|---|
| 0 | default | theme/default | General |
| 1 | input / assumption | blue | General |
| 2 | formula / computed | black | General |
| 3 | cross-sheet formula | green | General |
| 4 | header | bold black | General |
| 5 | currency input | blue | `$#,##0;($#,##0);"-"` |
| 6 | currency formula | black | same currency format |
| 7 | percentage input | blue | `0.0%` |
| 8 | percentage formula | black | `0.0%` |
| 9 | integer input | blue | `#,##0` |
| 10 | integer formula | black | `#,##0` |
| 11 | year input | blue | `0` |
| 12 | key assumption | blue on yellow | General |

## Financial color convention

- hard-coded inputs / assumptions: `0000FF` blue;
- formulas / computed values: `000000` black;
- cross-sheet reference formulas: `00B050` or the template's equivalent green semantic style.

Style encodes business meaning. Do not recolor formulas as inputs or inputs as formulas merely for decoration.

## Adding styles

When adding number formats, fonts, fills, borders, or cell XFs:

1. append new definitions instead of mutating unrelated existing ones;
2. keep `count` attributes correct;
3. preserve the required first two fill records (`none`, `gray125`);
4. use a new `numFmtId >= 164` for custom formats;
5. apply the resulting cell style index explicitly through the cell `s` attribute.

For editing an existing workbook, preserve its existing style table and clone/append only the styles needed for the requested change.
