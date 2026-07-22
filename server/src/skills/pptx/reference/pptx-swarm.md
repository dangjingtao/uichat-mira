# PPTX Swarm Reference

Status: Current
Source: Mira-authored implementation reference

## When to use

Use this guidance for large presentation work, typically 20+ slides, or when creating multiple related decks in one task.

## Core rule

The Parent Agent remains the only control loop. `pptx-swarm` is not a nested Agent and does not create another Planner.

Recommended project semantics:

1. Understand audience, objective, required decks and slide counts.
2. Complete the content/specification for the whole requested set before bulk creation.
3. Apply one coherent theme and layout system.
4. Validate all presentation specs before creating artifacts.
5. Fix blocking layout errors before delivery.
6. Create and inspect the requested decks, then report artifact results clearly.

## Batch behavior

For multiple decks or large slide counts:

```text
all specs
-> validate all
-> repair blocking issues
-> create batch
-> inspect outputs
-> deliver/report
```

Do not treat each slide as an independent Agent task, and do not create one sub-Agent per slide.

## Completion

The work is complete only when the requested deck set exists, slide counts and content structure match the task, validation has no unresolved blocking issues, and created PPTX artifacts have been inspected or otherwise verified.
