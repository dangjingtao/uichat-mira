---
name: docx
description: "Create and review Word documents (.docx) through Mira WenShu. Covers structured DOCX creation, native comments, tracked changes, non-destructive review copies, and safe format-preserving routing boundaries."
---

# Current execution status

This is the bundled DOCX Skill Package.

Current execution path:

```text
primary Skill = docx
-> forked Skill-owned SubAgent
-> optional exposed read_open / read_extract
-> office_document private Runtime
-> Evidence + DOCX Artifact
-> Parent delivery
```

`office_document` is a ready Skill-private Runtime. It is not a global Main Planner Tool and is not added to ToolExposure merely because this Skill matched.

DOCX uses the deterministic Node / OOXML Domain Runtime and does not require the optional `wenshu-office` Python Runtime Pack. Never introduce Python, `PYTHONPATH`, package installation, or `terminal_session` as a DOCX fallback.

# Part 1: Routing semantics

## Route A — Existing DOCX whose formatting matters

Use the existing `.docx` as the document foundation and preserve it by default.

Supported deterministic review semantics:

- native Word comments anchored to exact visible text;
- suggested replacements represented as Track Changes deletion + insertion;
- non-destructive output to a new `.docx` copy.

Do not use plain-text editing, arbitrary ZIP surgery, or blind XML replacement on DOCX binaries.

Current safe editing boundary: review anchors must resolve to exact visible text in a simple Word text run. If the runtime refuses a complex run, do not force a lossy rewrite.

## Route B — DOCX used only as a content source

If the `.docx` is only reference material and formatting does not matter, reading/extraction remains separate from document mutation. Do not create a modified DOCX artifact unless the task requests one.

## Route C — Create a new DOCX

The deterministic Runtime supports structured creation with:

- title;
- semantic paragraph styles (`title`, `heading1`, `heading2`, `heading3`, `body`);
- bold text at the current paragraph-run level;
- simple tables expressed as rows and cells;
- native `.docx` output.

# Part 2: Deterministic Runtime

Implementation anchors:

```text
server/src/microapps/office-suite/
  create.ts
  document-review.ts
  document.ts
  runtime.ts
  contract.ts
```

Capabilities include:

- `docx@9` structured DOCX creation;
- Office package inspection and artifact handling;
- native `comments.xml` creation and relationship/content-type wiring;
- comment range/reference anchors;
- `w:trackRevisions` enablement;
- tracked insertion/deletion through `w:ins`, `w:del`, and `w:delText`;
- non-destructive output copies;
- refusal of unsafe complex-run rewrites.

The SubAgent invokes semantic `office_document` actions through the managed private Runtime adapter. It must not select an executable, runtime path, shell launcher, or implementation module.

# Capability boundary

Current execution profile requires:

```text
allowed Harness tools: read_open, read_extract
private Runtime: office_document (ready)
workspaceBound: true
```

The profile is a requirement envelope. Harness tools remain subject to current registration, exposure, Policy and approval. A missing workspace or unavailable required capability must be returned as a structured requirement/failure, never hidden by writing into the Skill package or Runtime directory.

# Hard Rules

1. Never overwrite the source DOCX during review unless an explicit future contract says otherwise.
2. Never use text-file editing tools on a DOCX binary.
3. Do not force lossy rewrites when the exact edit target cannot be localized safely.
4. Keep large document bytes out of semantic Skill state; use file/artifact references.
5. Do not claim arbitrary lossless Word editing beyond the deterministic contract.
6. Skill match does not register Tool, expand ToolExposure, or grant permission.
7. `office_document` remains private to the active Skill-owned SubAgent.
8. Never route DOCX execution through Python or `terminal_session`.
9. A completed Artifact must not be rebuilt by the Parent.

# Completion

A completed DOCX operation satisfies all applicable checks:

- deterministic Runtime success is recorded;
- the requested output file exists;
- requested content is present;
- review tasks preserve the source file and create a distinct output;
- comments/revisions use native Word structures when requested;
- unsupported complex edits fail explicitly instead of silently degrading the document.

For exact Runtime fields and boundaries, read `references/office-runtime-reference.md`.