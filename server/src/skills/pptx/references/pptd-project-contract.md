# PPTX Skill — Native PPTD project contract

Read this reference when constructing a new deck, when `entry/pages/pageFiles` validation fails, or when page-path ownership is unclear.

## Runtime boundary

`office_presentation` accepts one JSON transport object:

```json
{
  "entry": { "...native presentation.pptd fields...": "..." },
  "pageFiles": {
    "pages/01.page": { "...native page fields...": "..." }
  }
}
```

WenShu materializes `entry` as `presentation.pptd`, writes every `pageFiles` value to its relative `.page` path, then delegates checking and rendering to Kimi's original `kimi_ppt_dsl` pipeline.

Do not invent a second inline AST and do not place page objects directly inside `entry.pages`.

## Root entry

Supported root fields:

```json
{
  "title": "Deck title",
  "size": [1280, 720],
  "theme": {
    "colors": {},
    "textStyles": {},
    "tableStyles": {}
  },
  "pages": ["pages/01.page", "pages/02.page"]
}
```

Rules:

- `size` is `[width, height]`; `[1280, 720]` is the normal 16:9 canvas.
- `pages` must be a non-empty array of relative `.page` paths.
- Paths must not be absolute, contain `..`, or escape the project root.
- Every path must exist exactly once in `pageFiles`.
- Unreferenced `pageFiles` entries are rejected.
- Page order is exactly the order in `entry.pages`.

## Theme

### Colors

Define reusable colors in `theme.colors`:

```json
{
  "primary": "#C15F3C",
  "text": "#1F2937",
  "surface": "#FFF8F3"
}
```

Use a theme reference as `"$primary"`. References must point to an existing color and must not form cycles.

Accepted literal color forms include `#RGB`, `#RRGGBB`, and `#RRGGBBAA`.

### Text styles

```json
{
  "title": {
    "fontSize": 40,
    "fontFamily": "Arial, Microsoft YaHei",
    "color": "$text",
    "fontStyle": "normal",
    "lineHeight": 1.1,
    "letterSpacing": 0,
    "marginTop": 0
  }
}
```

A text element references this as `"style": "$title"` inside `content`.

`fontFamily` may contain one font or a Latin/East-Asian pair separated by a comma. WenShu does not embed the large Kimi font pack; choose common system fonts and allow PowerPoint fallback.

### Table styles

A table may use a `"$styleName"` reference from `theme.tableStyles` or an inline table-style object. Theme table styles support font size/family, header/body colors, alternating body fills, first-column styling, and borders.

## Page file

```json
{
  "pageType": "content",
  "background": { "type": "solid", "color": "#FFFFFF" },
  "notes": "Optional presenter notes",
  "elements": []
}
```

Known page types:

- `cover`
- `table_of_contents`
- `chapter`
- `content`
- `final`
- `unknown`

`elements` are rendered in array order. Later elements are above earlier elements, so backgrounds and containers should normally appear before their text.

## Positioned element fields

Every positioned element uses:

```json
{
  "elementType": "text",
  "elementId": "unique-id-on-page",
  "bounds": [80, 80, 600, 120]
}
```

Rules:

- `elementId` must be unique within a page.
- `bounds` is `[x, y, width, height]` in canvas units.
- Width and height must be positive.
- Keep elements within the slide canvas unless the visual effect is intentional and the checker permits it.

Transform fields are element-specific, not universally shared. `rotation`, `opacity`, and `flip` are supported only by element families whose renderer explicitly implements them. Do not apply those fields to `table` or `chart` in the current protocol; they are not rendered.

## Fill, border and shadow

Solid fill:

```json
{ "type": "solid", "color": "$primary" }
```

Gradient fill:

```json
{
  "type": "gradient",
  "gradientType": "linear",
  "angle": 0,
  "stops": [
    { "position": 0, "color": "#FFFFFF" },
    { "position": 1, "color": "#F3D5C6" }
  ]
}
```

Image fill:

```json
{
  "type": "image",
  "src": "assets/hero.png",
  "fit": { "mode": "cover" },
  "opacity": 1
}
```

Image sources must resolve to real workspace files before rendering. The current renderer does not accept data URIs.

Border:

```json
{ "style": "solid", "width": 1, "color": "#D1D5DB" }
```

Border styles: `solid`, `dash`, `dot`, `none`.

Shadow:

```json
{ "blur": 12, "color": "#00000033", "offset": [0, 6] }
```

## Text is never a top-level string

A text element must contain `content.text`:

```json
{
  "elementType": "text",
  "elementId": "title",
  "bounds": [80, 64, 1120, 96],
  "content": {
    "text": "Real editable title",
    "style": "$title",
    "align": ["left", "middle"]
  }
}
```

`align` is a two-item array: `[horizontal, vertical]`.

Horizontal values: `left`, `center`, `right`, `justify`, `distributed`.

Vertical values: `top`, `middle`, `bottom`.

Putting `text` beside `elementType` or omitting `content` is invalid and must not be repaired by silently creating an empty text box.
