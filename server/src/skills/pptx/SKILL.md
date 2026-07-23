---
name: pptx
description: "Create editable PowerPoint presentations with WenShu through Kimi's native multi-file PPTD DSL, mandatory checking, rendering, and final PPTX inspection."
---

# Core route

The domain capability is:

```text
office_presentation
```

Do not expose `add_slide`, `add_text`, raw OOXML, `python-pptx`, or renderer primitives as the presentation method. The Agent produces a complete Kimi PPTD project; WenShu checks and renders it.

SkillContext does not expand canonical ToolExposure. When `office_presentation` is exposed, use it directly. When the current execution surface instead uses `write_file` and `terminal_session`, those calls may only materialize the native PPTD project and invoke WenShu's bundled Kimi runtime. Never author a replacement `python-pptx` renderer in the terminal.

# Progressive disclosure

Do not load every reference into context at once. Read the smallest resource needed for the current stage:

- `skill://pptx/references/minimal-deck.json` — read for the first native deck, after a schema failure, or when a compact known-good project is needed.
- `skill://pptx/references/pptd-project-contract.md` — read when constructing `entry`, `pageFiles`, theme, paths, fills, bounds, or text alignment.
- `skill://pptx/references/element-cookbook.md` — read only when exact rich-text, shape, image, icon, table, or chart fields are needed.
- `skill://pptx/references/validation-and-repair.md` — read after checker errors/warnings or failed final inspection.

References are L2 context resources, not new tools. Reading one does not alter ToolExposure or create a hidden Skill loop. Continue through the normal Parent Agent cycle:

```text
Planner → tool call → Evidence → Planner
```

A normal PPT task therefore involves several internal interactions: construct or update the project, validate, repair, create, inspect, and possibly repair again. Do not ask the user between these steps unless requirements are genuinely ambiguous or an approval boundary requires user action.

# Required project contract

`spec` uses the native multi-file form:

```json
{
  "entry": {
    "title": "Presentation title",
    "size": [1280, 720],
    "theme": {
      "colors": {},
      "textStyles": {},
      "tableStyles": {}
    },
    "pages": ["pages/01.page"]
  },
  "pageFiles": {
    "pages/01.page": {
      "pageType": "content",
      "background": { "type": "solid", "color": "#FFFFFF" },
      "elements": []
    }
  }
}
```

Rules:

- `entry.pages` contains relative `.page` paths only.
- Every referenced path exists exactly once in `pageFiles`.
- Do not put inline page objects in `entry.pages`.
- Do not invent another JSON AST or translate this contract into a custom renderer format.
- Coordinates use Kimi canvas units and every positioned element uses `bounds: [x, y, width, height]`.
- Element array order is z-order; later elements appear above earlier elements.

# Text contract — mandatory

Text must be placed in `content.text`. Never put text directly on the element and never omit `content`.

```json
{
  "elementType": "text",
  "elementId": "slide-title",
  "bounds": [80, 64, 1120, 96],
  "content": {
    "text": "真实写入 PowerPoint 的标题",
    "style": "$title",
    "fontSize": 38,
    "color": "#1F2937",
    "align": ["left", "middle"]
  }
}
```

`align` is `[horizontal, vertical]`, not an object.

`content.text` may contain Kimi-supported lightweight rich text. Theme style references such as `$title` and `$body` are preferred for consistency.

# Supported elements

Use Kimi's original element fields:

- `text`: `content.text`, style, font, alignment, gradient and shadow;
- `shape`: `shapeName`, fill, border, shadow and optional arrows;
- `image`: `src`, fit, crop, border and shadow;
- `icon`: `iconName`, fill, border and shadow;
- `table`: rows, cells, column widths, row heights and table style;
- `chart`: type, data, x/y fields, axes, legend, labels and series styles.

Images may use workspace-relative files or data URIs. Fonts are not embedded by WenShu; use common system font families and allow PowerPoint fallback. The bundled runtime keeps Kimi's lightweight icon renderer but does not ship a large font or stock-image library.

# Workflow

1. Understand goal, audience, slide count and content hierarchy.
2. Design the complete deck structure and theme first.
3. Read only the required L2 references.
4. Produce the complete `entry + pageFiles` project.
5. Run `operation=validate` or the equivalent bundled-runtime validation call.
6. Use checker Evidence to repair every blocking error and review meaningful warnings.
7. Validate again after repairs.
8. Run `operation=create` only after validation passes.
9. Inspect the generated PPTX and verify slide count and actual text content.
10. Repair and repeat when inspection does not satisfy the request.
11. Deliver the `.pptx` artifact, not only the intermediate spec/project files.

For long decks, prepare all page files before creating. Do not validate and deliver one slide at a time.

# Hard rules

1. Kimi's checker/parser/renderer are the source of truth; do not bypass them.
2. A generated file existing on disk is not completion.
3. If requested text is absent from final PPTX inspection, the task failed and must be repaired.
4. Keep native text, shapes, tables and charts editable whenever supported.
5. Do not claim arbitrary lossless editing of an existing complex PPTX.
6. `write_file` may persist project/spec files, but it is not the presentation renderer.
7. `terminal_session` may invoke the bundled runtime, but it must not generate a new ad-hoc renderer.

# Completion

A PPT task is complete only when:

- the native PPTD project has no blocking checker errors;
- the generated `.pptx` exists and opens through inspection;
- final slide count matches `entry.pages`;
- expected text is read back from the final PPTX;
- requested images/icons/tables/charts are present when applicable;
- important layout warnings are fixed or explicitly reported;
- the final artifact is the generated PPTX.
