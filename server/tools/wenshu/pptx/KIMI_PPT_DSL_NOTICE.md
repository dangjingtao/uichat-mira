# Kimi PPT DSL runtime snapshot

WenShu's PPT execution layer vendors a minimal source snapshot of the Kimi PPT DSL checker/parser/renderer supplied for this integration.

Included:

- multi-file `.pptd` / `.page` parser;
- format, repair, bounds, overflow and contrast checks;
- PowerPoint renderer, rich text, editable shapes/tables/charts;
- lightweight icon-name renderer and fallback shapes.

Excluded deliberately:

- bundled font files and font embedding assets;
- stock photos, large image libraries and other heavyweight media;
- generated caches and development-only files.

The runtime archive is split into ordered Base85 text parts only to keep repository transport reliable. `pptx_runtime.py` reconstructs it, rejects missing/out-of-order parts, performs path-safe extraction, and always calls the original checker before rendering.

The supplied snapshot did not contain a redistribution license file. Confirm redistribution terms before a public binary release; this notice is not a license grant.
