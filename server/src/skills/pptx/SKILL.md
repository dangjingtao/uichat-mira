---
name: pptx
description: "Create PowerPoint presentations through Mira WenShu using a structured PPTD-like presentation AST, mandatory layout validation, and editable PPTX output."
---

# Core route

Presentation creation uses one high-level capability:

```text
office_presentation
```

Do not expose `add_slide`, `add_text`, `add_chart`, raw OOXML or python-pptx primitives to the Agent.

# Presentation AST

Build the complete presentation specification before creation.

Top level:
- `size: [width, height]`
- `theme.colors`
- `theme.textStyles`
- `pages[]`

Each page can define:
- background color or image;
- positioned `elements[]`.

Supported element types:
- `text`
- `shape`
- `image`
- `icon`
- `table`
- `chart`

Every positioned element uses:

```text
bounds: [x, y, width, height]
```

The WenShu convention treats one coordinate unit as one point.

Text supports theme style references, font family/size/color, bold/italic/underline, alignment, vertical alignment and lightweight rich-text markup.
Charts support column, bar, line and pie.
Tables and charts remain editable PowerPoint objects.

# Workflow

1. Understand presentation goal, audience, slide count and content hierarchy.
2. Build the whole deck structure before polishing individual slides.
3. Create a consistent theme and page layout system.
4. Produce the complete AST.
5. Run `operation=validate`.
6. Fix blocking `out_of_bounds` errors and review overflow/occlusion warnings.
7. Run `operation=create`.
8. Inspect the generated PPTX before declaring completion.

For long decks, structure the deck in sections and finish the whole generation pass before final validation/delivery. Do not validate and deliver one slide at a time.

# Design rules

- Slides are not document pages. Compress content into hierarchy, evidence and visual structure.
- Keep title/body typography consistent through theme styles.
- Use alignment and spacing deliberately rather than filling every empty area.
- Prefer editable native text, tables, charts and shapes over unnecessary rasterization.
- Images may be local paths or data URIs available to the runtime.
- Do not create overlapping elements unless the overlap is intentional.

# Current editing boundary

This Skill creates new PPTX files and inspects PPTX outputs/existing files.
It does **not** promise arbitrary lossless modification of an existing complex PPTX. Do not pretend otherwise.

# Hard rules

1. Validate before create.
2. Blocking validation errors must be fixed before generation.
3. Review meaningful overflow/occlusion warnings; do not blindly ignore them.
4. Do not use direct binary editing for PPTX.
5. Keep generated artifacts editable where the runtime supports native PowerPoint objects.
6. Inspect the final artifact and use accepted Evidence before completion.

# Completion

A PPT task is complete only when:
- the spec has no blocking validation errors;
- the generated `.pptx` exists and can be inspected;
- slide count/content structure matches the requested deliverable;
- important layout warnings have been fixed or explicitly reported;
- the final output is the generated PPTX artifact, not only the intermediate JSON AST.
