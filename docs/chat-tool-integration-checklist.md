# Chat Tool Integration Checklist

Status: Active
Owner: chat / runtime / mcp
Last verified: 2026-06-26
Layer: raw-source
Module: chat-runtime
Doc Type: checklist

## Purpose

This checklist turns the chat tool integration research and POC into an implementation sequence.

Related docs:

- `chat-tool-integration-research.md`
- `chat-tool-integration-poc.md`
- `harness-runtime-design.md`
- `uchat.md`

## Target

Deliver a minimal but real normal-chat tool loop with:

- model tool call
- backend `Harness` execution
- tool result continuation
- minimal `uchat` execution rendering

This checklist is for normal chat first, not RAG chat.

## Phase 0. Boundary Confirmation

- [ ] Confirm first-scope route is normal chat only
- [ ] Confirm first tool is `web_search` or one safe `read_*` capability
- [ ] Confirm POC does not expose edit / terminal / external MCP tools in chat
- [ ] Confirm tool execution plane remains `Harness` only
- [ ] Confirm raw tool output is not treated as ordinary visible assistant text by default

## Phase 1. Backend Tool Surface

- [ ] Add chat-facing tool surface resolver
- [ ] Resolve first allowlisted tool set for normal chat
- [ ] Map `Harness` capability definition into provider-facing tool definition
- [ ] Add max visible tool count / namespace trimming rule for POC
- [ ] Add tests for tool surface resolution

Suggested files:

- `server/src/routes/proxy-provider/chat-tool-surface.ts`
- `server/src/routes/proxy-provider/chat.routes.test.ts`

## Phase 2. Backend Tool Loop

- [ ] Add provider tool-call normalization contract
- [ ] Add normal-chat tool loop orchestrator
- [ ] Send tool definitions into the first model call
- [ ] Parse provider tool call response
- [ ] Translate tool call into `Harness` invocation
- [ ] Normalize tool result back into model continuation input
- [ ] Continue the loop until final assistant answer
- [ ] Add loop guard:
  - [ ] max tool steps
  - [ ] unsupported tool rejection
  - [ ] empty tool result handling
- [ ] Keep non-tool normal chat behavior unchanged when no tool is called

Suggested files:

- `server/src/routes/proxy-provider/chat-tool-loop.ts`
- `server/src/services/provider-proxy.service/tool-calls.ts`
- `server/src/routes/proxy-provider/chat.routes.ts`

## Phase 3. Harness Bridge

- [ ] Add chat-owned bridge from normalized tool call -> `Harness` invocation
- [ ] Reuse existing `Harness` invocation APIs and runtime contracts
- [ ] Normalize invocation result into chat-safe tool result payload
- [ ] Normalize invocation failure into chat-safe error payload
- [ ] Preserve invocation id for trace lookup
- [ ] Add tests for:
  - [ ] success
  - [ ] unsupported tool
  - [ ] invocation failure
  - [ ] timeout / empty output guard

Suggested files:

- `server/src/routes/proxy-provider/chat-tool-loop.ts`
- `server/src/mcp/harness/invocations.ts`
- `server/src/routes/proxy-provider/chat.routes.test.ts`

## Phase 4. Stream Event Contract

- [ ] Extend backend stream protocol to emit tool execution events
- [ ] Define minimal event set:
  - [ ] `tool:requested`
  - [ ] `tool:running`
  - [ ] `tool:succeeded`
  - [ ] `tool:failed`
- [ ] Include invocation id in success / failure events
- [ ] Include compact summary payload for `uchat`
- [ ] Keep final assistant text events compatible with current runtime

Suggested files:

- `server/src/routes/proxy-provider/stream-protocol.ts`
- `server/src/services/chat-stream-events.ts`

## Phase 5. Desktop Protocol Mapping

- [ ] Extend desktop chat protocol parser to understand tool events
- [ ] Map tool events into canonical `ChatRunEvent`
- [ ] Preserve compatibility for RAG events and text deltas
- [ ] Add unit tests for event mapping

Suggested files:

- `desktop/src/features/chat/core/protocol.ts`
- `desktop/src/shared/uchat/core/types.ts`

## Phase 6. UChat Rendering

- [ ] Add minimal tool execution render block inside `uchat`
- [ ] Show:
  - [ ] tool name
  - [ ] running state
  - [ ] success state
  - [ ] failure state
  - [ ] short summary
- [ ] Keep final assistant answer rendering unchanged
- [ ] Do not add a separate large tool console for POC
- [ ] Reuse current execution-trace visual language where possible
- [ ] Add tests for tool execution rendering

Suggested files:

- `desktop/src/shared/uchat/ui/UChatThreadView.tsx`
- `desktop/src/shared/uchat/ui/*`

## Phase 7. Persistence Rules

- [ ] Confirm user message persistence remains unchanged
- [ ] Confirm final assistant answer persistence remains unchanged
- [ ] Confirm raw tool output is not persisted as normal assistant bubble text
- [ ] Decide whether compact tool summary is:
  - [ ] trace-only
  - [ ] metadata-only
  - [ ] visible summary block
- [ ] Add regression tests around message persistence

Suggested files:

- `server/src/routes/proxy-provider/message-persistence.ts`
- `server/src/services/thread.service.ts`

## Phase 8. Error and Safety Handling

- [ ] Reject unsupported tool ids explicitly
- [ ] Reject over-limit tool loops explicitly
- [ ] Surface `Harness` execution failures as chat-visible failure states
- [ ] Ensure no destructive capability is accidentally exposed in POC
- [ ] Ensure provider empty assistant output does not fake success
- [ ] Add audit log / trace coverage for each tool step

## Phase 9. Manual Regression

- [ ] Normal chat with no tool call still behaves exactly as before
- [ ] Normal chat with one successful tool call returns final answer
- [ ] Tool failure produces clear user-visible failure state
- [ ] Tool execution trace can be found by invocation id
- [ ] Role + tool call can coexist
- [ ] Context summary + tool call can coexist
- [ ] Bound knowledge base thread that is not in RAG mode does not break
- [ ] Refreshing the thread does not corrupt visible messages

## Phase 10. Follow-up After POC

- [ ] Add approval wait state
- [ ] Add invocation trace drawer in `uchat`
- [ ] Add role-scoped toolset resolution
- [ ] Add route-scoped tool policy
- [ ] Add external MCP tool exposure
- [ ] Evaluate whether RAG graph should share the same tool loop or remain separate

## Recommended Build Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9

## Acceptance Marker

The POC can be considered complete when:

- normal chat can complete at least one end-to-end safe tool call
- `Harness` remains the only execution plane
- `uchat` renders minimal tool execution state
- final assistant response still lands through the normal chat path
- regression on non-tool normal chat remains green
