# PPTX Skill — Validation and repair loop

Read this reference after `office_presentation operation=validate` returns errors or meaningful warnings.

## Required loop

```text
build complete entry + pageFiles
→ office_presentation validate
→ repair blocking protocol errors
→ office_presentation create
→ deliver artifact
```

`inspect` is a separate diagnostic operation. Do not use semantic readback, visual guessing, or LLM judgment as a mandatory completion gate after deterministic rendering.

## Reading an issue

Checker issues include:

- `severity`: `ERROR` or `WARNING`;
- `category`: `FORMAT`, `REPAIR`, `OVERFLOW`, or `LAYOUT`;
- `issue_type`;
- `source_file` and line when available;
- `page_id`, `element_id`, and `element_tag`;
- `attribute`, `actual_value`, and `expected`.

Repair the precise page file and element named by the issue. Do not rewrite the entire deck blindly when one element is invalid.

## Blocking format/contract errors

### `MissingFieldError`

Typical causes:

- a text element has no `content`;
- an image has no `src`;
- a shape has no valid `shapeName`;
- a chart lacks required data/field mappings.

Repair the missing native field. Never silence this by inserting an empty object or blank string unless blank content is genuinely intended.

### `InvalidStructureError`, `InvalidKeyWarning`, `UnknownKeyWarning`

Typical causes:

- old inline `pages[]` AST was used;
- a field is placed at the wrong level;
- a custom field name was invented;
- `align` is an object instead of `[horizontal, vertical]`.

Compare against:

- `skill://pptx/references/pptd-project-contract.md`
- `skill://pptx/references/element-cookbook.md`
- `skill://pptx/references/minimal-deck.json`

Delete unknown fields rather than expecting the renderer to infer their meaning.

### `YamlSyntaxError`, `ParseError`

Although Mira transports the project as JSON, the runtime materializes YAML-compatible `.pptd/.page` files. Fix malformed values, invalid enum strings, inconsistent structures, and non-serializable content.

### `PageNotFoundWarning`

Ensure every `entry.pages` path exists in `pageFiles` with exactly the same normalized relative path. A missing page is a protocol defect and must be fixed before rendering.

## Blocking semantic errors

### `DuplicateIdError`

Every `elementId` must be unique within its page. Rename the duplicate and preserve meaningful IDs for later repair.

### `InvalidColorError`, `UndefinedRefError`, `CircularRefError`

- Use a supported literal color or an existing `$themeColor` reference.
- Define a referenced color/style before use.
- Break circular references.

### `InvalidShapeError`

Use a supported PowerPoint shape name. Prefer common names such as `rect`, `roundRect`, `ellipse`, `line`, and ordinary arrows.

### `OpacityRangeError`, `ValueRangeWarning`, `NegativeSizeError`, `ZeroSizeWarning`

- Keep opacity within `[0, 1]`.
- Keep width/height positive.
- Keep gradient stop positions and other ratios within their documented ranges.

### `EmptySrcError`, `SrcNotFoundWarning`

Provide an existing workspace-resolved image file. The current renderer does not accept data URIs. Missing assets must be fixed as input/protocol errors; do not rely on placeholder fallback behavior.

### `EmptyDataWarning`, `CountMismatchWarning`, `InconsistentRowsWarning`

For tables/charts:

- provide real rows/data records;
- keep `names` aligned with the `y` series list;
- keep table rows compatible with the column count;
- make `columnWidths` and `rowHeights` sum to approximately `1.0`.

## Overflow and layout warnings

Warnings are not automatically fatal, but meaningful ones must be reviewed before the valid protocol is sent to the renderer.

### `TextOverflowWarning`

Repair in this order:

1. shorten or restructure copy;
2. increase text-box height/width without breaking margins;
3. reduce font size modestly;
4. adjust line height;
5. split content across slides when density remains excessive.

Do not shrink important body text into unreadability just to clear the warning.

### `TextUnderfillWarning`

A text box may be much larger than its content. Tighten bounds when the excess space harms alignment; otherwise it may be acceptable.

### `TextOcclusionWarning`

A later element overlaps and covers text. Fix z-order or bounds. Because element array order is z-order, move the intended background/container earlier than its text.

### `TextDriftWarning`

The text box partially crosses a container boundary. Re-align the text box so it is clearly inside or outside the container rather than straddling it accidentally.

### `BoundsOutsideWarning`, `BoundsCalcWarning`, `BoundsExprError`

Use numeric `[x, y, width, height]` values unless a verified expression is needed. Keep deliberate bleed small and keep all readable content inside the slide canvas.

### `TextContrastWarning`

Increase contrast between text and its effective background. Prefer theme-level corrections when the problem affects multiple slides.

## Renderer contract

After the checker accepts the protocol, renderer behavior must be deterministic:

- supported legal input must render as specified;
- unsupported input must fail explicitly;
- missing assets must fail explicitly;
- accepted fields must not be silently ignored;
- the renderer must not substitute semantic guesses or placeholder content and still report success.

If a legal protocol input exposes a renderer defect, fix the checker/protocol/renderer contract. Do not add an LLM or post-render semantic fallback.

## What not to do

- Do not bypass Kimi's checker with a direct `python-pptx` script.
- Do not generate a raster image of each slide as the default solution.
- Do not delete requested content merely to make validation pass.
- Do not ignore all warnings mechanically.
- Do not use `inspect` or an LLM to redefine a successful deterministic render as failed based on semantic comparison.
- Do not deliver only `pptx-spec.json`, `.pptd`, or `.page` files when the user asked for PowerPoint.
