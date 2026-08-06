---
name: xlsx
description: "Open, create, read, analyze, edit, fix, and validate Excel/spreadsheet files through an XML-first workflow derived from MiniMax's MIT-licensed minimax-xlsx skill. Preserve existing workbook structure, keep formulas live, and use deterministic scripts for packing and validation."
license: MIT
metadata:
  upstream: "MiniMax-AI/skills/skills/minimax-xlsx"
  upstreamCommit: "60aaae52bb2af8162732751a4332f62a5fef518b"
---

# Mira WenShu XLSX

This Skill uses the MiniMax XLSX workflow as its implementation baseline.

## Current execution readiness

The current Skill-owned SubAgent profile requests two distinct private Runtime bindings:

```text
office_spreadsheet
= ready compatibility runtime for inspection / recalculation / verification

wenshu_xlsx_xml_runtime
= XML-first create / edit / fix execution bridge
= pending
```

These bindings are not interchangeable.

A ready `office_spreadsheet` binding must never be presented as proof that XML-first create/edit/fix is ready. When the requested route requires XML package mutation and `wenshu_xlsx_xml_runtime` is still pending, return a structured capability gap. Do not silently downgrade to an openpyxl round-trip, legacy spreadsheet writer, terminal script, or model-generated claim of success.

SkillContext provides execution instructions and package resources only. It does not expand canonical ToolExposure. The Skill-owned SubAgent may use exposed read capabilities, but Python-backed XLSX execution must go through a managed private Runtime binding.

The managed invocation contains only a registered runtime/binding id, operation arguments, and workspace input/output paths. The launcher owns Python selection, managed Runtime Pack `PYTHONPATH`, script resolution, and result status. Never emit a Python executable, `PYTHONPATH`, shell command, `python -m`, `pip install`, or `conda install` instruction.

## Task routing

| Task | Required method | Current binding |
|---|---|---|
| READ / ANALYZE existing data | deterministic reader / inspection | `office_spreadsheet` when supported |
| RECALCULATE / VERIFY | deterministic compatibility runtime | `office_spreadsheet` |
| CREATE new `.xlsx` | minimal OOXML template → targeted XML → pack | `wenshu_xlsx_xml_runtime` required; currently pending |
| EDIT existing `.xlsx/.xlsm` | unpack → surgical OOXML edit → pack | `wenshu_xlsx_xml_runtime` required; currently pending |
| FIX formulas/package | targeted `<f>` / package repair → pack | `wenshu_xlsx_xml_runtime` required; currently pending |
| VALIDATE XML/package | deterministic scripts through managed binding | route-specific binding required |

Do not load every reference at once. Read only the reference needed for the current route.

## CREATE contract

When the XML-first binding is ready, CREATE must start from `skill://xlsx/templates/minimal_xlsx/`; do not build a package from an ad-hoc ZIP layout.

Canonical flow:

```text
plan workbook structure
→ copy minimal_xlsx template
→ edit workbook/sharedStrings/styles/worksheet XML
→ managed XML Runtime pack / formula validation
→ optional deterministic LibreOffice recalculation when actually available
→ deliver .xlsx
```

Every derived value must remain an Excel formula. Hardcode only raw facts, user inputs, and explicit assumptions.

Until `wenshu_xlsx_xml_runtime` is ready, this route is unavailable. Do not imitate completion through a different writer.

## EDIT / FIX contract

Never recreate an existing workbook from scratch merely to make an edit. Never use an openpyxl round-trip as the default edit path for a complex workbook because it can lose unsupported OOXML structures.

Required flow when the XML-first binding is ready:

```text
managed unpack
→ edit only requested OOXML nodes
→ managed pack
→ deterministic formula/package validation
```

Preserve sheet names, unrelated cells, VBA/pivot/chart/sparkline/package parts, relationships, and formatting unless the request explicitly changes them.

For `.xlsm`, preserve `vbaProject.bin` and existing package relationships/content types.

Until the required binding is ready, return a capability gap rather than a lossy fallback.

## READ / ANALYZE

Reading and analysis must not modify the source file. Use the ready deterministic inspection capability when it supports the requested operation. pandas/openpyxl may be implementation details of a managed Runtime; they are not Agent-selected execution paths.

## Formula rules

1. Derived/projected/linked values stay as formulas, never Python-computed pasted values.
2. Cross-sheet references must target real sheet names.
3. Do not silently replace unsupported formulas, chart types, styles, or workbook structures.
4. A construct that cannot be preserved or executed faithfully must fail explicitly.

## Deterministic validation

Validation is code, not model judgment.

- XML/package validation must reject malformed input before delivery.
- Formula checks must report actual failures.
- LibreOffice recalculation is only claimed when it really ran successfully.
- Missing Tier-2 recalculation must be reported as unavailable, not silently treated as success.

Do not use an LLM to decide that deterministic code “probably worked”.

## Financial formatting baseline

- hard-coded input / assumption font: blue `0000FF`
- formula / computed result font: black `000000`
- cross-sheet reference formula font: green `00B050`

Read `skill://xlsx/references/format.md` before building a styled financial workbook.

## Hard rules

1. CREATE / EDIT / FIX require the XML-first binding; it is currently pending.
2. `office_spreadsheet=ready` does not make XML-first write routes ready.
3. Never flatten live formulas into hardcoded calculated outputs.
4. Never silently drop workbook structures to make an operation easier.
5. Never fabricate source citations or business data.
6. Never treat model judgment as an execution-success gate.
7. Always deliver the requested final workbook Artifact for supported routes.
8. Never invoke XLSX Python scripts through `terminal_session`.
9. Never fall back to openpyxl round-trip for complex create/edit merely to avoid a capability gap.
10. Skill match does not grant Tool, Runtime, workspace, or approval.

## Completion

A supported XLSX task is complete only when:

- the exact required private binding was ready;
- the deterministic operation succeeded;
- the final workbook Artifact was written;
- route-specific validation passed;
- optional recalculation is claimed only when it actually ran.

A task requiring a pending binding is not complete; return the capability requirement explicitly.

## Upstream

Implementation baseline: MiniMax `minimax-xlsx`, MIT licensed, pinned to upstream commit `60aaae52bb2af8162732751a4332f62a5fef518b`. Mira-specific changes are limited to Skill routing, capability boundaries, package paths, and managed Runtime integration.