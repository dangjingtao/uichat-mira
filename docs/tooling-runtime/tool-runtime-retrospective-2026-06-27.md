Status: Current
Owner: runtime / mcp / tooling
Last verified: 2026-06-27
Layer: raw-source
Module: Tool
Feature: ToolRuntime
Doc Type: implementation-notes

# Tool Runtime Retrospective (2026-06-27)

## Scope

This retrospective covers the recent `Tool` runtime work around:

- built-in capability registration
- Harness registry boundaries
- external MCP projection
- Tools workbench surface
- related route / test / i18n drift

It does not cover future chat tool-loop product decisions in full.

## Executive Summary

The biggest issue was not missing capability depth in `read / search / edit / terminal`.

The biggest issue was boundary collapse:

- internal built-in tools
- external MCP projected tools
- tool workbench UI
- MCP product UI

were partially sharing one runtime surface without a strict source boundary.

That caused external MCP tools to appear inside the internal Tools workbench and even land under the wrong domain.

The main correction was:

- add an explicit tool `source`
- separate internal tool listing from external MCP discovered tools
- keep external projections on the MCP product surface instead of the internal workbench surface

## What Went Wrong

### 1. Product boundary was defined, but runtime boundary was not fully implemented

The intended product model was already clear:

- internal core tools belong to the internal tool workbench
- third-party MCP belongs to the MCP product line

But the runtime implementation still allowed both to share the same registry output surface.

Result:

- `/mcp/tools` returned both internal tools and external MCP projections
- the Tools page consumed `/mcp/tools`
- external capabilities leaked into the internal workbench

### 2. Tool definition lacked a first-class source field

Before the fix, the system had no stable `source` discriminator on `McpToolDefinition`.

That forced upper layers to infer identity from:

- tags
- projected id patterns
- domain guesses

This is structurally weak.

If a field is required to decide product visibility, it must be part of the contract.

### 3. External MCP projection reused an internal domain incorrectly

External MCP projected tools were registered with a hard-coded internal-looking domain.

That made the leak worse:

- the tool was not only visible in the wrong product surface
- it was also grouped under the wrong capability domain

This is a classic sign that domain semantics were being used for both:

- capability taxonomy
- product ownership

Those are not the same thing.

### 4. Registry acted like a raw map, not a visibility control plane

The Harness registry originally behaved like:

- register tool
- list all tools

That is not enough once there are multiple surfaces:

- internal workbench
- MCP product UI
- future chat tool surface

A registry in this architecture must support visibility policy, not just storage.

### 5. Tests lagged behind protocol and contract changes

Two separate cases appeared:

- web search config contract changed after adding `maxResults`, but route tests still asserted the old shape
- stdio test mocks still simulated the old framed protocol while `StdioMcpSession` had already moved to JSONL

This created fake failures and delayed real diagnosis.

## What Was Fixed

### Runtime contract

- `McpToolDefinition` now includes `source: "internal" | "external"`

### Registry visibility

- internal listing now uses internal-only filtering

### Route boundary

- `/mcp/tools` now returns internal built-in tools only

### External MCP projection

- projected MCP tools are still executable through Harness
- but they stay on the external MCP product surface
- they no longer appear in the internal Tools workbench listing

### Frontend product wording

- MCP UI copy no longer claims that external Discover results will appear in `/mcp/tools`

### Tests

- route tests updated for internal-only `/mcp/tools`
- web search config tests updated for `maxResults`
- stdio route tests updated to the current JSONL session protocol

## What We Learned

### 1. Product ownership must be encoded in protocol, not inferred in UI

If a tool can exist in multiple surfaces, ownership cannot be inferred from presentation logic.

It must be explicit in the runtime contract.

### 2. Domain is not source

`domain` answers:

- what kind of capability this is

`source` answers:

- who owns it
- where it should be surfaced

Mixing these two leads to leakage and mis-grouping.

### 3. Harness is the final boundary owner

The Harness runtime should own:

- capability registration
- invocation lifecycle
- approval boundary
- trace
- runtime visibility segmentation

UI must not reconstruct these boundaries after the fact.

### 4. Route shape is part of product architecture

`/mcp/tools` is not just a convenience endpoint.

It defines a real product surface.

Once a route is consumed by a product UI, its scope must be explicit and tested.

### 5. Test fixtures are also protocol clients

If a runtime protocol changes, tests that mock the protocol must be updated immediately.

Otherwise they become historical artifacts that manufacture false regressions.

## Hard Constraints Going Forward

These constraints should now be treated as active implementation rules.

### Surface rules

- Internal built-in tools and external MCP projected tools must not share the same product surface by default.
- `/mcp/tools` is reserved for internal tool workbench consumption.
- External discovered tools belong to MCP-installed server surfaces.

### Contract rules

- Every new `McpToolDefinition` must declare `source`.
- Visibility decisions must not depend on tag heuristics alone.
- A tool domain must not be reused to represent product ownership.

### Registry rules

- Registry APIs must support visibility filtering.
- New consumers must not call the raw “list everything” surface unless explicitly intended.

### Test rules

- Any route contract change must update route tests in the same change.
- Any stdio / SSE / invocation protocol change must update fixtures in the same change.
- Real capability work must ship with complete unit coverage for:
  - success paths
  - failure paths
  - boundary visibility
  - persistence / migration effects

## Remaining Follow-up

### Recommended next steps

1. Add a dedicated external projected tool surface route if a future UI needs it directly.
2. Review remaining docs that still describe external MCP tools as if they join the internal tool surface.
3. Review naming convergence between:
   - projected tool ids
   - docs that describe `external:<serverId>:<toolName>`
   - current runtime projection ids
4. Decide whether `browser_action` remains a valid internal domain or should be retired in a separate contract cleanup.

## Bottom Line

The most important outcome of this round was not “one more tool works”.

It was restoring the architectural rule that:

- internal tools
- external MCP
- chat tool exposure
- runtime execution

must share one Harness execution backbone without collapsing into one undifferentiated product surface.

## Maintainability Verdict

Current state:

- workable
- testable
- extendable
- not yet fully sealed

The maintainability win came from:

- explicit `source` on tool definitions
- shared invocation / trace / event contracts
- registry-driven capability lookup
- capability-specific runtimes for read / edit / terminal / web search

The remaining maintenance risk is mostly historical drift:

- old wording still exists in some docs
- some policy decisions are spread across environment, runtime, and tool layers
- future tools must keep their approval / workspace / provider decisions inside the harness decision path, not in UI heuristics
