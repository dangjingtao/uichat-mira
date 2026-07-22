---
name: pptx-swarm
description: "Create long (20+ slide) or multiple PowerPoint presentations through Mira WenShu. Uses batch-first PPTD-like specs, unified validation, then creation and inspection."
---

# Routing

Use this Skill only when:
- a single requested presentation is 20 slides or more;
- the user asks for multiple presentations;
- the user explicitly asks for batch/long-deck generation.

For normal presentations under 20 slides, use `pptx`.

# Architecture mapping

Mira does **not** create a second nested Agent Loop to imitate another implementation's swarm architecture.

```text
Parent Agent
  -> pptx-swarm business semantics
  -> complete visual direction + outlines + all deck specs
  -> office_presentation
       validate complete batch
       create complete batch
       inspect complete batch
```

The business invariant is preserved: generate all complete specs first, then validate, then create/deliver. The control loop remains Mira's existing Parent Agent.

# Primary capability

```text
office_presentation
```

For several presentations use:

```text
operation=create_batch
presentations=[
  { outputPath: "deck-a.pptx", spec: {...} },
  { outputPath: "deck-b.pptx", spec: {...} }
]
```

Every `spec` follows the same PPTD-like AST used by `pptx`:
- `size`
- `theme`
- `pages[]`
- positioned `text / shape / image / icon / table / chart` elements

# Mandatory workflow

1. Finish content goals and visual direction for the complete request.
2. Finish all outlines.
3. Finish every complete deck spec before final conversion starts.
4. Validate all specs.
5. Fix blocking errors across the batch.
6. Create all PPTX outputs.
7. Inspect all outputs.
8. Only then treat the batch/long-deck request as complete.

Never create/check/deliver deck 1 while deck 2 still has no complete spec.

# Hard rules

1. Parent Agent is the only control loop; this Skill does not own a nested Agent runtime.
2. Do not expose slide/page primitives as Agent tools.
3. Do not deliver partial decks as if the batch were complete.
4. All batch entries must pass blocking validation before completion.
5. The current Runtime creates new presentations; it does not promise arbitrary lossless editing of complex existing PPTX files.

# Completion

A pptx-swarm task is complete only when:
- every requested deck spec existed before conversion/delivery began;
- every requested deck passed blocking validation;
- every requested `.pptx` exists and is inspectable;
- requested slide counts and sections are present;
- important layout warnings have been resolved or explicitly reported for the whole batch.
