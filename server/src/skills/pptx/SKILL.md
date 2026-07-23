---
name: pptx
description: "Create editable PowerPoint presentations with WenShu through Kimi's native multi-file PPTD DSL, mandatory checking, rendering, and final PPTX inspection."
---

# Core route

Use one task-level capability:

```text
office_presentation
```

Do not expose `add_slide`, `add_text`, raw OOXML, `python-pptx`, or renderer primitives to the Agent. The Agent produces a complete Kimi PPTD project; WenShu checks and renders it.

# Required project contract

`spec` must use the native multi-file form:

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
- Every referenced path must exist exactly once in `pageFiles`.
- Do not put inline page objects in `entry.pages`.
- Do not invent another JSON AST or translate this contract into a custom renderer format.
- Coordinates use Kimi's canvas units and every positioned element uses `bounds: [x, y, width, height]`.

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
    "align": {
      "horizontal": "left",
      "vertical": "middle"
    }
  }
}
```

`content.text` may contain Kimi-supported lightweight rich text. Theme style references such as `$title` and `$body` are preferred for consistency.

# Supported elements

Use Kimi's original element fields:

- `text`: `content.text`, style, font, alignment, gradient and shadow;
- `shape`: `shapeName`, fill, border, shadow and optional arrows;
- `image`: `src`, fit, crop, border and shadow;
- `icon`: `iconName`, fill, border and shadow;
- `table`: rows, cells, widths, heights and table style;
- `chart`: type, data, axes, legend, labels and series styles.

Images may use workspace-relative files or data URIs. Fonts are not embedded by WenShu; use common system font families and allow PowerPoint fallback. The bundled runtime keeps Kimi's lightweight icon renderer but does not ship a large font or stock-image library.

# Workflow

1. Understand goal, audience, slide count and content hierarchy.
2. Design the complete deck structure and theme first.
3. Produce the complete `entry + pageFiles` project.
4. Run `operation=validate`.
5. Fix every blocking checker error and review meaningful warnings.
6. Run `operation=create` only after validation passes.
7. Inspect the generated PPTX and verify slide count and actual text content.
8. Deliver the `.pptx` artifact, not only the intermediate spec.

For long decks, prepare all page files before creating. Do not validate and deliver one slide at a time.

# Hard rules

1. Kimi's checker/parser/renderer are the source of truth; do not bypass them.
2. A generated file existing on disk is not completion.
3. If requested text is absent from the final PPTX inspection, the task failed and must be repaired.
4. Keep native text, shapes, tables and charts editable whenever supported.
5. Do not claim arbitrary lossless editing of an existing complex PPTX.

# Completion

A PPT task is complete only when:

- the native PPTD project has no blocking checker errors;
- the generated `.pptx` exists and opens through inspection;
- final slide count matches `entry.pages`;
- expected text is read back from the final PPTX;
- important layout warnings are fixed or explicitly reported;
- the final artifact is the generated PPTX.
