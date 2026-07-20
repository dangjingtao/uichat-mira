# UIChat Mira Agent Runtime / Tooling SSOT

> Status: current truth for the `dev` branch changes made in the 2026-07-21 working thread.
>
> Scope: Agent-visible read/search tools, CodeGraph runtime ownership, Planner structured-output streaming, and the currently unresolved provider-compatibility boundary.
>
> This document is the single source of truth for the scope above. When chat history, old task cards, screenshots, or older design notes conflict with this document, this document wins until it is explicitly updated together with the implementation.

## 1. Current top-level contracts

### 1.1 Agent-visible Read surface is exactly four cognitive actions

The public Read surface is intentionally small:

```text
Read
├─ read_discover
├─ grep
├─ read_open
└─ codebase_explore
```

Semantics:

- `read_discover`: discover objects. Directory listing, file/path discovery, filename-oriented locate. It must not silently become general full-text search.
- `grep`: deterministic text/pattern search. Use for literals, symbols, references, imports, config keys, error strings, and regex-like workspace search.
- `read_open`: read known content. Use when the target file/object is already known; line/range selection belongs here.
- `codebase_explore`: relationship-oriented code understanding. Use for architecture, symbol relationships, call/dependency paths, and impact analysis. Candidate evidence must be re-read/verified against the active workspace before becoming Evidence.

The following older read operations remain implementation primitives / compatibility surfaces and are not part of the normal Agent-visible cognitive surface:

```text
read
read_list
read_locate
read_extract
read_slice
```

Rule:

> Tool names exposed to Planner describe user-level cognitive actions. Lower-level primitives/providers are runtime implementation details and should not be re-exposed unless a real semantic gap is proven.

### 1.2 `grep` belongs to Read, not Terminal

`grep` is classified as observation/search over workspace content, not as process execution.

The runtime may use ripgrep or another implementation internally, but Planner should reason about the action as `grep`, not about shelling out to `rg` through `terminal_session`.

### 1.3 Network search is split into two explicit tools

The public search surface is:

```text
Network Search
├─ web_search
└─ news_search
```

Semantics:

- `web_search`: public internet search only. Current providers are Tavily / SearXNG behind Harness.
- `news_search`: local News Hub search only. It searches already-ingested local news/cache data through the News Hub retrieval path (keyword/vector/fusion/rerank as configured).

Important invariant:

> `web_search` must not inspect the query, infer “news intent”, search the local News Hub first, and short-circuit the public web search.

Planner chooses between `web_search` and `news_search`; the tool itself must not silently change information domains.

Capability mapping:

```text
Web Research  -> web_search
News Research -> news_search
```

## 2. CodeGraph / `codebase_explore` runtime truth

### 2.1 Ownership model

For Agent invocations, the active conversation/thread workspace owns the CodeGraph runtime binding.

```text
Agent invocation
  workspaceRoot = Harness active workspace
  thread binding = current thread (when available)

CodeGraph Studio
  supplies runtime/provider configuration
  does NOT own the Agent invocation workspace
```

Studio may provide:

- command
- start args
- version probe args
- telemetry probe args
- app-data root
- timeout / enable configuration

Studio workspace identity must not be used as the Agent workspace ownership contract.

### 2.2 Wrapper launchers are valid configuration inputs

Agent-owned repo-local manager creation must not require the configured command basename to be literally one of:

```text
codegraph
codegraph.cmd
codegraph.exe
```

Wrapper/launcher configurations such as `node`, shims, or other compatible launch commands may still create an Agent-owned manager. Provider usability is proven later by runtime detect/start/health, not by a filename heuristic during ownership selection.

The Agent manager binds:

```text
workspaceRoot        = active Agent workspace
allowedWorkspaceRoot = active Agent workspace
```

Therefore a Studio workspace mismatch must not by itself force the Agent path back to the Studio singleton manager.

### 2.3 What remains true about CodeGraph safety/verification

The existing CodeGraph contract is not being redesigned here:

- Planner sees `codebase_explore`, not raw native CodeGraph tools.
- Candidate results are not automatically Evidence.
- Workspace source verification/re-read remains required before verified evidence is trusted.
- Repo-local `.codegraph` handling remains a provider/runtime concern.
- Telemetry/workspace/runtime checks remain relevant; this SSOT only removes incorrect Studio-workspace ownership coupling from the Agent path.

### 2.4 Verification status of the latest workspace-mismatch fix

Implementation for the workspace-ownership regression has landed on `dev`, including a regression test that creates an Agent-owned manager with a wrapper launcher and verifies:

```text
workspaceRoot == active Agent workspace
allowedWorkspaceRoot == active Agent workspace
workspaceMatches == true
```

However:

> End-to-end local runtime verification against the user's actual CodeGraph setup is still pending.

Do not describe the CodeGraph issue as fully closed until an actual Agent `codebase_explore` run in a non-Studio workspace returns verified chunks without the old `workspace_mismatch` gap.

Also note: wrapper launchers that ultimately invoke CodeGraph may still expose provider-specific repo-local index behavior; that is separate from the Studio-workspace ownership bug.

## 3. Planner structured output and live public narration

### 3.1 Planner still uses AgentTaskModel

The Planner node invokes the AgentTaskModel to maintain the task plan and decide the next action.

The relevant public decision envelope remains structured and contains fields such as:

```text
type
reason
query
toolId
args
question
planPatch
```

The final action must only execute after the complete structured decision has been parsed/validated.

### 3.2 Live “inner OS” means public Planner narration, not hidden chain-of-thought

The UI red-box narration area should show a live, user-facing `reason`/working narration such as:

```text
正在确认当前目标和剩余任务……
正在检查 CodeGraph workspace 绑定……
发现还需要确认 manager 创建路径……
下一步准备定位相关实现。
```

This is public working narration about what the Agent is checking / finding / preparing to do.

It is not a requirement to expose hidden private chain-of-thought.

### 3.3 Native structured Planner output now streams text deltas

The Planner structured-output path now supports streaming for the currently handled adapters:

- OpenAI-compatible: structured request with `stream: true` and `response_format: json_schema`.
- Ollama: structured generation with `stream: true` and `format: schema`.

Flow:

```text
AgentTaskModel
  -> structured stream deltas
  -> Planner accumulates raw JSON text
  -> extract public `reason` while JSON is incomplete
  -> emit plannerThought / plannerThoughtStreaming
  -> UI updates narration live
  -> complete JSON arrives
  -> parse / validate / Harness schema validation
  -> execute next action
```

Important invariant:

> Streaming narration does not make partially generated decisions executable.

Only the public narration is surfaced early; action execution still waits for a complete validated decision object.

### 3.4 Stream failure behavior

Fallback behavior is deliberately bounded:

- If native structured streaming fails before any native delta is emitted, the Planner may fall back to the existing text-JSON path.
- If native structured streaming has already emitted partial JSON, do not append a second independently generated JSON object. That would manufacture an invalid multi-object Planner response. The error must propagate instead.

### 3.5 Strict-schema synthetic null normalization

Strict JSON-schema generation may represent optional tool fields as required-but-nullable fields.

Before Harness validates tool args, synthetic `null` object fields are stripped so optional arguments return to normal omission semantics.

Example:

```json
{
  "pattern": "Planner",
  "root": null,
  "extensions": null
}
```

normalizes to:

```json
{
  "pattern": "Planner"
}
```

before the existing Harness tool schema validator sees the args.

## 4. Provider compatibility: still unresolved as a general problem

The current Provider catalog still classifies multiple vendors through the broad `openai-compatible` chat adapter.

That does **not** prove behavioral compatibility for every advanced feature.

In particular, do not assume that every OpenAI-compatible provider/model has identical behavior for:

- `response_format: json_schema`
- `strict: true`
- structured-output streaming
- supported JSON Schema subset
- tool choice / parallel tool calling
- reasoning/thinking fields
- streaming delta shape
- finish reasons / usage fields

The observed Planner error:

```text
Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.
```

is a Mira fallback error string, not a provider-native diagnostic. It can hide more specific upstream structured-output failures when a native path fails and the Planner falls back.

Current truth:

> Provider-specific structured-output capability/strategy is not yet fully modeled. Volcengine compatibility must be validated against the actual model/endpoint behavior rather than inferred solely from `openai-compatible` classification.

A future protocol gateway / adapter platform on Cloudflare was discussed, but **no CF gateway implementation was made in this thread**. Do not treat that discussion as shipped architecture.

## 5. Files / implementation areas touched by this truth

Primary implementation areas include:

```text
server/src/mcp/tools/
server/src/mcp/managed-codegraph/
server/src/agent/planner/
server/src/services/provider-proxy.service/
server/src/harness/profiles/
server/src/microapps/news-hub/
```

Key concrete files involved in the latest fixes include:

```text
server/src/mcp/managed-codegraph/repo-local-manager-cache.ts
server/src/mcp/managed-codegraph/repo-local-manager-cache.test.ts
server/src/agent/planner/structured-provider-hook.ts
server/src/agent/planner/parse.ts
server/src/agent/planner/streamed-structured-output.test.ts
server/src/services/provider-proxy.service/task-structured-output.ts
```

## 6. Validation matrix

| Area | Implementation state | Runtime verification state |
| --- | --- | --- |
| Read surface reduced to 4 public actions | Landed on `dev` | Contract tests added previously; do not re-expand casually |
| `grep` as Read tool | Landed on `dev` | Uses existing search runtime; normal integration validation still applies |
| `web_search` / `news_search` split | Landed on `dev` | Search-domain contract implemented; provider/local-news behavior should be regression-tested in app |
| CodeGraph Agent workspace ownership | Fix landed on `dev` | **Pending end-to-end validation in user's real workspace/setup** |
| Wrapper launcher can create Agent-owned CodeGraph manager | Landed + regression test | Unit/regression coverage added; actual provider behavior may still differ |
| Planner public narration streaming | Landed on `dev` | **Needs real provider validation, especially Volcengine structured streaming** |
| Generic provider structured-output capability strategy | Not solved | Open design/implementation issue |
| Cloudflare protocol gateway | Discussion only | Not implemented |

## 7. Known key commits from this working thread

These are useful anchors, not a substitute for the contracts above:

```text
074e8bd  test: cover grep read tool

e436d98  test: lock public read surface to four tools

ae8511b  test: keep web search independent from local news cache

97587a1  fix: decouple agent CodeGraph runtime from studio workspace
ea6e78d  test: bind agent CodeGraph runtime to active workspace

a5142fd  feat: stream native planner structured output
e894a5b  feat: surface streamed planner narration
3bc29a4  fix: normalize streamed structured planner args
1903d3f  test: cover streamed planner narration contract
74c04f9  fix: avoid mixed planner streams after partial native output
```

## 8. Do-not-regress rules

1. Do not grow the public Read surface by exposing implementation primitives just because a runtime primitive exists.
2. Do not let `read_discover` silently become a second full-text search tool; content search belongs to `grep`.
3. Do not let `web_search` silently route to local News Hub based on query wording.
4. Do not bind Agent `codebase_explore` ownership to the CodeGraph Studio workspace.
5. Do not use the configured command basename as the Agent workspace ownership decision.
6. Do not trust CodeGraph candidates as Evidence before workspace source verification.
7. Do not fake Planner narration with arbitrary loading phrases when real public `reason` deltas are available.
8. Do not execute a partially streamed Planner decision.
9. Do not concatenate text fallback JSON after a native structured JSON stream has already begun.
10. Do not equate `openai-compatible` with complete advanced-feature compatibility across providers.

## 9. Next verification targets

Before declaring this scope stable, verify in the actual desktop app:

1. Run `codebase_explore` from a conversation whose active workspace differs from the Studio workspace. Confirm the result no longer contains the old Studio `workspace_mismatch` gap and returns verified chunks.
2. Test the actual configured CodeGraph launcher form (literal executable vs wrapper/shim) and confirm repo-local index behavior does not introduce a different blocker.
3. With the user's Volcengine AgentTaskModel, observe whether structured JSON deltas arrive incrementally and whether the UI red-box narration updates before the final Planner decision completes.
4. If Volcengine rejects or buffers `json_schema + stream`, capture the provider-native error/response and model that as an explicit provider/model capability instead of hiding it behind generic `openai-compatible` behavior.
