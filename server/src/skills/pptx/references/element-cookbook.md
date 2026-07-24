# PPTX Skill — Native element cookbook

Read this reference only when a deck needs exact text, shape, image, icon, table, chart, or rich-text fields.

All examples are page-level objects placed inside `pageFiles[pagePath].elements`.

## Text

```json
{
  "elementType": "text",
  "elementId": "body-copy",
  "bounds": [96, 180, 720, 220],
  "wrap": true,
  "content": {
    "text": "Plain text or <strong>lightweight rich text</strong>.",
    "style": "$body",
    "fontSize": 22,
    "fontFamily": "Arial, Microsoft YaHei",
    "color": "$text",
    "lineHeight": 1.35,
    "letterSpacing": 0,
    "marginTop": 0,
    "textDirection": "horizontal",
    "align": ["left", "top"],
    "shadow": {
      "blur": 4,
      "color": "#00000022",
      "offset": [0, 2]
    }
  }
}
```

Supported lightweight rich text includes:

- paragraphs: `<p>`;
- inline style: `<span style="color:#C15F3C;font-size:24px;font-family:Arial, Microsoft YaHei">`;
- emphasis: `<strong>`, `<b>`, `<em>`, `<i>`, `<u>`;
- strike/sup/sub: `<s>`, `<del>`, `<sup>`, `<sub>`;
- links: `<a href="https://example.com">`;
- lists: `<ul>`, `<ol>`, `<li>`;
- line breaks: `<br>`;
- LaTeX inside `\(...\)`.

Keep rich text small and predictable. Do not paste a full HTML document or CSS layout into `content.text`.

## Shape

```json
{
  "elementType": "shape",
  "elementId": "card",
  "bounds": [72, 120, 520, 360],
  "shapeName": "roundRect",
  "fill": {
    "type": "solid",
    "color": "#FFF8F3"
  },
  "border": {
    "style": "solid",
    "width": 1,
    "color": "#F3D5C6"
  },
  "shadow": {
    "blur": 16,
    "color": "#00000022",
    "offset": [0, 8]
  }
}
```

For connector-like shapes, `arrow` is `[startArrow, endArrow]`. Arrow values include `none`, `arrow`, `stealth`, `diamond`, and `oval`.

Use a known `shapeName`; invalid names are checker errors. Prefer common PowerPoint names such as `rect`, `roundRect`, `ellipse`, `line`, and simple arrows.

## Image

```json
{
  "elementType": "image",
  "elementId": "hero-image",
  "bounds": [760, 120, 440, 420],
  "src": "assets/hero.png",
  "fit": { "mode": "cover" },
  "crop": {
    "left": 0,
    "top": 0,
    "right": 0,
    "bottom": 0
  },
  "border": {
    "style": "solid",
    "width": 1,
    "color": "#E5E7EB"
  }
}
```

Fit modes: `fill`, `contain`, `cover`.

`src` must resolve to an existing file inside the selected workspace before rendering. Do not use data URIs with the current renderer and do not reference arbitrary paths outside the workspace.

## Icon

```json
{
  "elementType": "icon",
  "elementId": "rocket",
  "bounds": [1040, 72, 72, 72],
  "iconName": "fas:rocket",
  "fill": {
    "type": "solid",
    "color": "$primary"
  }
}
```

Icons use Font Awesome-style names such as `fas:rocket`. The bundled WenShu runtime keeps a lightweight icon renderer and does not ship the large Kimi font collection or a stock-image library.

Use known, tested icon names. Do not rely on unknown-name fallback as a valid protocol behavior; unsupported icon names should be treated as protocol defects rather than accepted semantic substitutions.

## Table

```json
{
  "elementType": "table",
  "elementId": "metrics-table",
  "bounds": [96, 180, 1088, 340],
  "columnWidths": [0.35, 0.25, 0.4],
  "rowHeights": [0.22, 0.26, 0.26, 0.26],
  "style": "$metrics",
  "rows": [
    [
      { "content": { "text": "Metric" } },
      { "content": { "text": "Value" } },
      { "content": { "text": "Comment" } }
    ],
    [
      { "content": { "text": "Activation" } },
      { "content": { "text": "68%" } },
      { "content": { "text": "Up 9 points" } }
    ],
    [
      { "content": { "text": "Retention" } },
      { "content": { "text": "42%" } },
      { "content": { "text": "Needs onboarding repair" } }
    ],
    [
      { "content": { "text": "NPS" } },
      { "content": { "text": "51" } },
      { "content": { "text": "Healthy signal" } }
    ]
  ]
}
```

Rules:

- `columnWidths` and `rowHeights` are ratios and should each sum to approximately `1.0`.
- A cell supports `content`, `fill`, `border`, `rowSpan`, and `colSpan`.
- Spanned cells occupy following grid positions; do not manually duplicate merged placeholders.
- Cell `content` uses the same text-content fields as a text element.
- Do not specify table-level rotation, opacity, or flip in the current protocol; the renderer does not implement those transforms.

Example table theme:

```json
{
  "metrics": {
    "fontSize": 18,
    "fontFamily": "Arial, Microsoft YaHei",
    "headerFill": "#C15F3C",
    "headerColor": "#FFFFFF",
    "headerBold": true,
    "bodyFill": ["#FFFFFF", "#FFF8F3"],
    "bodyColor": "#1F2937",
    "border": {
      "style": "solid",
      "width": 1,
      "color": "#E5E7EB"
    }
  }
}
```

## Chart

```json
{
  "elementType": "chart",
  "elementId": "revenue-chart",
  "bounds": [96, 180, 1088, 390],
  "type": "bar",
  "data": [
    { "quarter": "Q1", "revenue": 42, "profit": 8 },
    { "quarter": "Q2", "revenue": 55, "profit": 12 },
    { "quarter": "Q3", "revenue": 67, "profit": 17 },
    { "quarter": "Q4", "revenue": 81, "profit": 23 }
  ],
  "x": "quarter",
  "y": ["revenue", "profit"],
  "names": ["Revenue", "Profit"],
  "colors": ["#C15F3C", "#3E8F6A"],
  "options": {
    "direction": "vertical",
    "barWidth": 0.65,
    "stacked": false,
    "fontFamily": "Arial, Microsoft YaHei"
  },
  "xAxis": {
    "show": true,
    "label": { "color": "#6B7280", "fontSize": 14 },
    "axisLine": { "style": "solid", "color": "#D1D5DB", "width": 1 }
  },
  "yAxis": {
    "show": true,
    "label": { "color": "#6B7280", "fontSize": 14 },
    "gridLine": { "style": "dash", "color": "#E5E7EB", "width": 1 },
    "min": 0,
    "numberFormat": "#,##0"
  },
  "legend": {
    "show": true,
    "position": "bottom",
    "fontSize": 14
  },
  "dataLabels": {
    "show": false
  }
}
```

Chart types: `bar`, `line`, `area`, `scatter`, `pie`, `radar`, `combo`, `bubble`.

Important fields:

- `x`: category field name;
- `y`: one field or an array of value field names;
- `names`: display names matching the `y` series order;
- `size`: numeric field for bubble charts;
- `seriesStyle`: map keyed by series field, supporting the fields implemented for that chart family;
- `secondaryAxis`: secondary value-axis configuration for combo charts.

Do not set `seriesStyle.*.marker` on `bar` or `area` charts; the current renderer does not implement markers for those series types. Do not specify chart-level rotation, opacity, or flip; those transforms are not implemented.

Keep chart data inside the DSL as actual records. Do not turn a chart into a screenshot unless the task explicitly requires raster output.

## Layering and layout

Element order is z-order: the last element is topmost.

A safe composition order is:

1. page background;
2. large decorative shapes/images;
3. cards and containers;
4. charts/tables;
5. text;
6. icons and small accents.

Intentional overlap is allowed, but text covered by later elements triggers `TextOcclusionWarning`. Partial boundary crossings may trigger `TextDriftWarning`.
