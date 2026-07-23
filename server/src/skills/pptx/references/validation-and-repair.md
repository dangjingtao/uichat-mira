# PPTX Skill — Validation and repair loop

Read this reference after `office_presentation operation=validate` returns errors or meaningful warnings, or when the final PPTX inspection does not match the requested deck.

## Required loop

```text
build complete entry + pageFiles
→ office_presentation validate
→ repair blocking errors
→ validate again
→ office_presentation create
→ office_presentation inspect
→ repair if final slide count/content is wrong
→ deliver artifact
```

Do not call `create` while validation contains blocking errors. Do not treat a file existing on disk as completion.

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

Ensure every `entry.pages` path exists in `pageFiles` with exactly the same normalized relative path. Missing pages also cause final slide-count verification failure.

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

Provide a valid workspace-resolved image path or a data URI. Do not use an inaccessible URL or a path outside the workspace.

### `EmptyDataWarning`, `CountMismatchWarning`, `InconsistentRowsWarning`

For tables/charts:

- provide real rows/data records;
- keep `names` aligned with the `y` series list;
- keep table rows compatible with the column count;
- make `columnWidths` and `rowHeights` sum to approximately `1.0`.

## Overflow and layout warnings

Warnings are not automatically fatal, but meaningful ones must be reviewed.

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

## Final inspection gate

After `create`, `inspect` must confirm:

- `slideCount` equals `entry.pages.length`;
- requested text appears in the final editable PPTX;
- expected pictures/tables/charts are present when requested;
- no accidental blank page exists.

The Python runtime already fails creation when expected text from `content.text` is missing. The Parent Agent must treat that failure as recoverable tool evidence, fix the project, and retry rather than claiming partial success.

## What not to do

- Do not bypass Kimi's checker with a direct `python-pptx` script.
- Do not generate a raster image of each slide as the default solution.
- Do not delete requested content merely to make validation pass.
- Do not ignore all warnings mechanically.
- Do not deliver only `pptx-spec.json`, `.pptd`, or `.page` files when the user asked for PowerPoint.
