# DOCX Skill Package — WenShu Runtime Reference

This reference documents the deterministic DOCX runtime surface bundled with Mira WenShu.

It does **not** declare a live formal SkillInstance or a Planner-visible Skill tool contract.

## Runtime ownership

Current implementation:

```text
server/src/microapps/office-suite/
  contract.ts
  create.ts
  document.ts
  document-review.ts
  runtime.ts
```

A task-level `office_document` implementation also exists in the codebase, but the bundled DOCX Skill Package itself does not automatically activate or expand Harness exposure.

## Create

Structured DOCX creation is implemented with `docx@9`.

Supported high-level document structure currently includes:

- optional document title;
- paragraphs;
- semantic paragraph styles: `title | heading1 | heading2 | heading3 | body`;
- current run-level bold flag;
- simple tables using rows/cells;
- native `.docx` output.

The output is returned through the common Office Runtime artifact contract.

## Review

Existing DOCX review is non-destructive by default.

Supported native Word semantics:

- comments anchored to exact visible text;
- `comments.xml` creation when required;
- document relationship and content-type wiring for comments;
- comment range start/end and comment reference nodes;
- `w:trackRevisions` enablement in `settings.xml`;
- tracked insertions using `w:ins`;
- tracked deletions using `w:del` + `w:delText`;
- output to a distinct `.docx` copy.

## Append-copy helper

`document.ts` retains a package-level append-paragraph helper used by the Office Runtime verification surface.

It inserts paragraphs before terminal `w:sectPr` when present and writes a new DOCX artifact rather than overwriting the source.

This is a deterministic runtime helper, not a general arbitrary editing API.

## Current editing boundary

The review engine intentionally accepts only exact text that can be localized inside a simple Word text run.

It refuses a rewrite when the target run contains unsupported extra structure that could be lost by reconstructing the run.

Examples of structures that must not be claimed as generally lossless today include complex fields, drawings, or other compound OOXML runs that cannot be safely localized by the current implementation.

This is a safety boundary, not a claim of complete arbitrary DOCX editing.

## Formal Skill Runtime boundary

The DOCX Skill Package is bundled, but formal Agent Skill integration remains deferred until the shared Skill Runtime contract provides:

- versioned `SkillDefinition`;
- active `SkillInstance`;
- state/stage;
- accepted-Evidence-driven reducer;
- stage-specific tool constraints;
- completion evaluation and lifecycle/version truth.

When integrated, Skill constraints may only narrow already Harness-eligible tools. The Skill must not push tools into canonical `toolExposure` merely because DOCX semantics were selected.

## Verification

After create or review, the deterministic operation should verify that:

- the output artifact exists;
- the DOCX remains readable;
- requested content/comment/revision semantics are present;
- review output is distinct from the source;
- unsupported complex edits fail explicitly rather than silently degrading content.
