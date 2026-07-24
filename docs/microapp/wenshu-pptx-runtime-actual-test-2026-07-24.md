# Mira WenShu PPT Runtime — Actual Test Report

Date: 2026-07-24  
Target: current `dev` implementation of `server/tools/wenshu/pptx/pptx_runtime.py` and its 12-part bundled Kimi runtime  
Code changes during this test package: **none**

## Conclusion

The Kimi-backed renderer is broadly functional and produces editable PPTX files across the main element families. It is **not yet safe to claim “all PPT generation is guaranteed correct.”** Several concrete contract and verification defects remain.

## Test environment

- Python 3.13.5
- python-pptx 1.0.2
- Pillow 12.2.0
- lxml 6.1.1
- LibreOffice headless compatibility pass
- Exact Mira adapter and exact 12-part bundled Kimi core reconstructed from `dev`
- Font pack and large stock-image assets intentionally excluded

## Coverage

### Runtime entry points

- `validate`
- `create`
- `inspect`
- CLI `validate/create/inspect`
- PPTX ZIP integrity
- final slide-count verification
- final text readback verification
- LibreOffice open/export compatibility

### Pages and presentation

- all 6 page types: cover, table of contents, chapter, content, final, unknown
- 16:9 slide size
- notes
- solid, linear-gradient, radial-gradient, and image backgrounds
- image-background masks: solid and radial gradient
- multi-slide realistic deck

### Text

- Chinese, English, numbers, punctuation
- all 15 horizontal/vertical alignment combinations
- theme styles and inline styles
- font size/family/color
- line height
- rotation, opacity, flip
- horizontal and vertical text
- wrap off
- text gradient and shadow
- rich text: bold, italic, underline, strike, subscript, superscript, color span, hyperlink, list, line break
- LaTeX fallback path

### Shapes and lines

- **all 177 mapped PowerPoint shape names**
- connector types
- all arrow-end types: none, arrow, stealth, diamond, oval
- solid/dash/dot borders
- solid/linear/radial/image fills
- opacity, rotation, flip, shadow
- shape adjustments
- custom SVG path shape

### Images

- PNG
- JPEG
- WEBP conversion
- SVG
- local HTTP image download
- fill/contain/cover
- crop
- ellipse/rounded masks
- opacity, border, shadow, rotation
- shape image fill
- page image background

### Icons

- known Font Awesome-style names
- unknown-name fallback
- fill, border, shadow

### Tables

- theme table style
- inline table style
- row/column dimensions
- alternating fills
- first-column style
- per-edge borders
- merged rows/columns
- cell alignment and multiline text
- cell fills
- table shadow

### Charts

All 8 chart enums were generated and visually inspected:

- bar/column
- line
- area
- scatter
- pie/doughnut
- radar
- combo with secondary axis
- bubble

Additional chart paths tested:

- horizontal and vertical bars
- 100% stacked bars
- stacked area
- smooth/dash/dot lines
- circle/square/diamond/triangle markers
- chart and per-series data labels
- chart title and legend
- chart fill and border
- axis labels, lines, grid lines, min/max, number format, titles
- null values and null-handling option
- negative values
- per-series fill/border/name

## Quantitative results

- Main positive matrix: **23 / 25 passed** through the full Mira adapter
- Additional advanced matrix: **7 / 8 passed**; the remaining case intentionally exposed unsupported bounds expressions
- CLI smoke: **validate/create/inspect all passed**
- All 177 mapped shapes rendered
- All 8 chart types rendered
- Generated PPTX files opened/exported through LibreOffice with matching page counts: **36 / 36**
- Blocking-invalid specs correctly rejected: legacy AST, missing/extra page, path traversal, missing text content, duplicate ID, invalid shape, invalid opacity, circular color reference, empty chart data

## Confirmed defects

### P0 — Relative image paths are not project/workspace-relative

A relative source such as `assets/sample.png` resolves against the process current working directory, not the temporary PPTD project or selected workspace. Under a different cwd, the checker emits only a warning and the renderer inserts a gray placeholder while `create` still succeeds.

Impact: an apparently completed deck may contain the wrong image.

### P0 — Missing images do not block completion

A nonexistent image produces `SrcNotFoundWarning`, but creation succeeds with a placeholder picture and can be reported as completed.

Impact: requested visual content may be silently lost.

### P0 — Data URI images crash during rendering

Validation reports zero errors and warnings, but `data:image/...;base64,...` is treated as a filesystem name and fails with `File name too long`.

Impact: the declared/expected image input form is not usable.

### P0 — Rich-text decks can be falsely rejected after successful rendering

The final verifier flattens the original HTML/LaTeX into one exact string, while PowerPoint readback contains paragraph breaks and normalized superscript/subscript text. The PPTX is valid, editable, and opens in LibreOffice, but the adapter raises `expected text was not written`.

Impact: successful rich-text generation is returned as a tool failure.

### P1 — Obvious text overflow is not detected

A very long Chinese string at 28px in a 120×40 box passed validation with zero warnings and generated successfully.

Impact: validation cannot guarantee readable slide layout.

### P1 — Bar/area marker configuration passes validation but crashes renderer

Adding `seriesStyle.*.marker` to bar or area series yields zero checker errors, then rendering fails because those python-pptx series objects do not expose `marker`.

Impact: checker and renderer contracts disagree.

### P1 — Chart/table transforms are silently ignored

Chart and table models accept base fields such as rotation, opacity, and flip. Generated OOXML contains none of the requested transform/alpha flags. Creation succeeds without warning.

Impact: accepted styling instructions may be silently lost.

### P1 — Bounds-expression implementation is unreachable through the parser

The resolver contains expression support such as `#element.right + 20`, but `_parse_bounds` converts every item directly to float. Expression input is rejected with `ParseError`.

Impact: resolver capability and accepted DSL contract disagree.

### P2 — `wrap` checker/parser mismatch

Outer text-level `wrap` is implemented and rendered, but the format checker reports it as `UnknownKeyWarning`.

Impact: valid input creates noisy false warnings.

### P2 — Formula result depends on optional runtime dependency

In this test environment, LaTeX-to-OMML dependency was unavailable, so formulas followed the implemented text-fallback path. The output remained readable but was not a native editable Office equation.

Impact: formula fidelity must be verified in the actual installed Runtime Pack before claiming native equation support.

### Expected limitation — Icons without the large assets/font pack

Icons render through the lightweight fallback path. They are usable as simple symbols but are not always high-fidelity Font Awesome glyphs.

## Compatibility evidence

LibreOffice opened and exported every PPTX that the renderer produced, including:

- 177-shape gallery
- all chart types
- rich-text output that the adapter falsely rejected
- background/mask/image-fill cases
- advanced table
- realistic multi-slide deck
- warning-only placeholder and overflow cases

This proves package readability, not semantic correctness; placeholder images and overflow remain real failures despite successful opening.

## Release judgment

**Renderer core:** strong and usable.  
**Current adapter contract:** not ready for a blanket “generation guaranteed correct” claim.

Minimum blocking set before that claim:

1. make image resolution workspace/project-relative and block missing requested assets;
2. reject or correctly decode Data URIs;
3. replace rich-text exact-string verification with structured/segment-aware verification;
4. make overflow verification reliable enough to block visibly unreadable content;
5. align chart-series validation with renderer capabilities;
6. either implement or reject chart/table transform fields;
7. remove or implement bounds-expression support consistently.
