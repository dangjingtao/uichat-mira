# DOCX Skill — WenShu Runtime Reference

This reference documents the runtime surface consumed by Mira's `docx` Skill.

## Task-level capability

The Agent-visible write surface is a single capability:

```text
office_document
```

It delegates to `executeOfficeRuntimeTask()` and does not expose the underlying `docx`, OOXML, ZIP, or XML implementation as Planner tools.

## Create

Required:

- `operation: "create"`
- `outputPath`: workspace-relative `.docx`

Optional:

- `title`
- `paragraphs[]`
  - `text`
  - `style`: `title | heading1 | heading2 | heading3 | body`
  - `bold`
- `tables[]`
  - `rows: string[][]`

The output is written inside the active workspace and emitted as a document artifact.

## Review

Required:

- `operation: "review"`
- `inputPath`: workspace-relative existing `.docx`
- `targetText`: exact visible text anchor
- at least one of `commentText` or `replacementText`

Optional:

- `outputPath`; defaults to `<source>-wenshu.docx`
- `author`; defaults to `Mira`

Behavior:

- `commentText` creates a native Word comment anchored to the target text.
- `replacementText` creates a tracked deletion for the target text and a tracked insertion for the replacement.
- the source file is never overwritten.

## Current editing boundary

The current review runtime intentionally accepts only exact text that can be localized inside a simple Word text run. It refuses lossy rewriting when the target is embedded in a complex run or unsupported structure.

This is a safety boundary, not a claim of complete arbitrary DOCX editing.

## Verification

After create or review, the Skill should use the normal Read capability to open the output and confirm the requested content/structure before finalizing the task.
