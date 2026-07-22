---
name: docx
description: "Create and review Word documents (.docx) through Mira WenShu. Use for DOCX creation, document review, native comments, tracked-change replacements, and format-preserving task routing."
---

# Part 1: Routing

Choose the route from the user's real input and desired output. Do not treat every Word task as raw file editing.

## Route A — Existing DOCX whose formatting matters

Use this route when the user provides an existing `.docx` and wants it reviewed or changed while preserving the original document as the foundation.

1. Read the document first with the public Read capability when the exact target text or document context is not already known.
2. Use `office_document` with `operation=review` for supported edits:
   - native Word comments anchored to exact visible text;
   - suggested replacements represented as Track Changes deletion + insertion;
   - non-destructive output to a new `.docx`.
3. Re-open the generated output with `read_open` before declaring the task complete.

Do not use `edit_file`, raw ZIP surgery, or arbitrary XML replacement on `.docx` binaries.

Current safe editing boundary: review anchors must resolve to exact visible text in a simple Word text run. If the runtime refuses a complex run, do not force a lossy rewrite.

## Route B — DOCX used only as a content source

If the `.docx` is only reference material and its formatting does not matter, use the normal public Read surface (`read_discover` when discovery is needed, then `read_open`) to obtain the needed content.

Do not create a modified DOCX unless the user actually requested a document artifact.

## Route C — Create a new DOCX

Use `office_document` with `operation=create`.

Describe the document using high-level structure:

- title;
- paragraphs with semantic styles (`title`, `heading1`, `heading2`, `heading3`, `body`);
- simple tables expressed as rows and cells;
- an explicit workspace-relative `.docx` output path.

After creation, re-open the output with `read_open` and verify that the requested title/content structure exists.

# Part 2: Execution

## Primary execution capability

The Skill uses one task-level write capability:

```text
office_document
```

It is not an atomic Office SDK. Do not invent tool calls such as `add_paragraph`, `set_run`, `add_comment`, `set_cell`, or raw OOXML operations.

### Create

```text
operation=create
outputPath=<workspace-relative .docx>
title=<optional>
paragraphs=[...]
tables=[...]
```

### Review existing DOCX

```text
operation=review
inputPath=<workspace-relative existing .docx>
outputPath=<new workspace-relative .docx, optional>
targetText=<exact visible anchor>
commentText=<optional>
replacementText=<optional>
author=<optional>
```

At least one of `commentText` or `replacementText` is required for review.

A replacement is a review suggestion, not a silent overwrite: the old text is written as a tracked deletion and the replacement as a tracked insertion.

# Hard Rules

1. Never overwrite the source DOCX during review. Always produce a new artifact.
2. Never use text-file editing tools on a DOCX binary.
3. Read before editing when the exact anchor is not known.
4. Do not claim success until the output file has been re-opened or otherwise verified through accepted Evidence.
5. Preserve user language in filenames and document content when practical.
6. Keep large document bytes out of Planner/Skill semantic context; use workspace paths and artifact references.
7. If an operation is outside the current WenShu contract, report the limitation instead of pretending that arbitrary lossless Word editing is supported.

# Quality Standard

A completed DOCX task should satisfy all applicable checks:

- the requested output file exists;
- the document can be opened by Mira's Read path;
- requested content is present;
- review tasks preserve the source file and create a distinct output;
- comments/revisions are used when the user asked for review semantics rather than silently rewriting text;
- no placeholder or invented content is introduced unless the user requested generation.

For the exact runtime contract and current boundaries, read `references/office-runtime-reference.md`.
