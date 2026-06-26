# Chat Tool Integration Research

Status: Current
Owner: chat / runtime / mcp
Last verified: 2026-06-26
Layer: raw-source
Module: chat-runtime
Doc Type: research

## Purpose

This document summarizes external research for integrating `Harness` tool capability
into the current normal chat / `uchat` flow.

It focuses on three questions:

- What is the current mainstream product and protocol direction for chat tool calling?
- How do MCP, provider-native tool calling, and app-owned runtime fit together?
- What is the recommended integration direction for this project?

## Executive Summary

The industry direction is already clear:

- chat + tool calling is now a standard capability, not an experimental add-on
- MCP is becoming a common transport and capability projection layer
- approval, execution trace, and multi-step tool loops are moving into first-class product behavior

For this project, the recommended architecture remains:

`LLM tool call -> backend Harness -> trace / approval / result -> uchat`

Do not use provider-hosted remote MCP as the main product path.

Reason:

- the project already owns a backend `Harness` runtime
- `Harness` is where policy, approval, tracing, roots, and capability projection belong
- if provider-hosted MCP is allowed to bypass `Harness`, the project loses its strongest control plane

## Current Industry Signals

### 1. OpenAI has formalized tool calling and MCP as a primary path

OpenAI official docs now treat the following as one coherent capability family:

- built-in tools
- function calling
- tool search
- remote MCP servers

This means MCP-backed tool access is no longer a niche extension path.

Official references:

- [Using tools | OpenAI API](https://developers.openai.com/api/docs/guides/tools)
- [MCP and Connectors | OpenAI API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)

### 2. OpenAI still assumes application-owned execution loops

Even when tools are provider-compatible, the core execution model remains:

1. expose tools to the model
2. receive tool call intent
3. execute in the application runtime
4. return tool output
5. continue generation

This is compatible with a project-owned `Harness`.

Official reference:

- [Function calling | OpenAI API](https://developers.openai.com/api/docs/guides/function-calling)

### 3. Anthropic follows the same execution split

Anthropic officially distinguishes:

- client tools: application executes
- server tools: Anthropic executes

Claude also supports MCP connectors, but the split is still explicit: model decides,
host runtime controls execution.

Official references:

- [Tool use overview | Anthropic](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [MCP connector | Anthropic](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

### 4. MCP itself is transport and capability contract, not product UI

The MCP specification defines how tools are described and invoked, but it does not
dictate:

- chat UI behavior
- approval UX
- message visibility rules
- how a host product should visualize tool traces

This gives the project freedom to keep `uchat` as the owned product surface.

Official references:

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

### 5. Multi-step tool loops and approval are becoming standard

Tool calling is no longer treated as “single turn plus helper function”.

Mainstream systems now assume:

- multi-step tool loops
- partial completion states
- approval checkpoints
- tool result re-entry into the model

This is visible in:

- OpenAI MCP approval flow
- Anthropic tool_use / tool_result loop
- Vercel AI SDK tool calling abstractions

Official references:

- [MCP and Connectors | OpenAI API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [Tool use overview | Anthropic](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK 6](https://vercel.com/blog/ai-sdk-6)

## What This Means For This Project

## Existing Strengths

The backend already has meaningful runtime foundations:

- `Harness` registry
- invocation API
- invocation streaming API
- trace / events
- built-in read / edit / terminal / web-search capabilities
- external MCP capability projection

Relevant code:

- `server/src/mcp/harness/runtime.ts`
- `server/src/mcp/routes.ts`
- `server/src/mcp/external.ts`

This is a strong base. The project is not blocked by tool execution infrastructure.

## Current Gap

The current chat mainline is still text-first:

- `server/src/routes/proxy-provider/chat.routes.ts`
- `server/src/services/provider-proxy.service/index.ts`
- `desktop/src/shared/uchat/ui/UChatThreadView.tsx`

What is missing today:

- provider tool call parsing
- provider tool schema injection
- model -> tool -> model continuation loop
- approval wait projection into chat state
- tool execution trace rendering inside `uchat`
- persistence strategy for tool call / tool result messages

## Recommended Architectural Position

### Main recommendation

Use provider-native tool calling for model reasoning only.

Do not use provider-native remote MCP execution as the final product execution plane.

Instead:

1. expose project-selected tools to the model
2. receive tool call intent
3. translate tool call into a backend `Harness` invocation
4. execute through `Harness`
5. feed normalized tool result back into the model
6. surface execution state and summary through `uchat`

### Why this is the right fit

This keeps:

- safety policy in backend
- approval in backend
- roots and workspace boundary in backend
- observability in backend
- UI ownership in `uchat`
- future MCP / Skill / Tool / terminal capability on one execution plane

## Architecture Recommendation

The target shape should be:

### 1. Tool Surface

This is the model-facing definition layer.

It should answer:

- which tools are visible in this thread
- which tools are visible for this role
- which tools are visible for this route or mode
- what schema / description the model receives
- whether a capability is deferred or always loaded

This layer should not execute tools.

### 2. Execution Plane

This remains the existing `Harness`.

It owns:

- invocation lifecycle
- approval
- trace
- auth
- capability registry
- external MCP projection
- execution policy

### 3. Chat Orchestration Layer

This is the missing layer for normal chat.

It owns:

- sending tool definitions to the model
- interpreting provider tool call output
- invoking `Harness`
- feeding tool result back into the model
- mapping execution state to `uchat`

## Product Rules That Need Explicit Decisions

These are the main design decisions the project must not leave implicit.

### 1. Are tool results visible chat messages?

Recommended answer:

- raw tool output: not always visible
- execution summary: visible
- full detail: drawer / trace panel

Do not dump every tool payload into visible message bubbles by default.

### 2. Does approval live in chat or in Harness?

Recommended answer:

- policy and state live in `Harness`
- approval UI is rendered by chat

Chat should render approval, not own the approval state model.

### 3. Does tool output enter conversation history or request-only context?

Recommended answer:

- tool execution summary may become visible history
- raw tool outputs should usually be request-only or trace-only
- only normalized tool result messages should be returned to the LLM loop

### 4. How should tools coexist with Role / Summary / RAG?

Recommended order for normal chat requests:

1. thread request-only context
   - Role
   - contextSummary
2. visible conversation history
3. model tool choice
4. Harness execution
5. tool result continuation

For RAG chat:

1. request-only thread context
2. visible conversation history
3. retrieval / rerank / generate graph
4. optional tool loop only if explicitly enabled for the RAG route

Do not mix RAG internal node execution and general tool loop into one opaque step.

## Practical Recommendation

### Phase 1

Build a minimal normal-chat tool loop with one safe built-in capability.

Recommended first tools:

- `web_search`
- or a read-only `read_*` capability

Do not start with:

- unrestricted terminal
- destructive edit
- broad external MCP marketplace access

### Phase 2

Add `uchat` execution rendering:

- tool requested
- awaiting approval
- tool running
- tool succeeded
- tool failed
- compact result summary
- detail drawer for full trace

### Phase 3

Add scoped toolset resolution:

- thread-scoped toolset
- role-scoped toolset
- route-scoped toolset
- per-tool approval policy
- deferred tool loading / namespace grouping

## Risk Assessment

### Medium risk

- provider adapter complexity
- persistence semantics for tool outputs
- visible message vs request-only boundary

### High risk

- mixing RAG internal steps and tool loop without clear ownership
- bypassing `Harness` for provider-hosted MCP execution
- relying on prompt-only policy instead of backend enforcement

## Final Recommendation

Proceed with chat tool integration.

But proceed with these constraints:

- `Harness` stays the only execution plane
- provider-native tool calling is used only for decision-making
- `uchat` consumes unified execution events
- first milestone is a safe MVP with one or two read-only tools

This direction is aligned with current OpenAI, Anthropic, MCP, and AI SDK ecosystem practice,
while preserving the project’s strongest existing architecture choice: backend-owned runtime control.

## Sources

- [Using tools | OpenAI API](https://developers.openai.com/api/docs/guides/tools)
- [Function calling | OpenAI API](https://developers.openai.com/api/docs/guides/function-calling)
- [MCP and Connectors | OpenAI API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [Guide to Using the Responses API's MCP Tool](https://developers.openai.com/cookbook/examples/mcp/mcp_tool_guide)
- [Tool use overview | Anthropic](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [MCP connector | Anthropic](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [AI SDK 6](https://vercel.com/blog/ai-sdk-6)
