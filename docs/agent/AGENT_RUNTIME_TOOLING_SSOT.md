# UIChat Mira Agent Runtime / Tooling SSOT

> Status: current truth for `dev` after the 2026-07-21 working thread.
>
> Scope: Agent-visible read/search tools, CodeGraph runtime ownership, Planner structured-output narration, and provider compatibility boundaries.
>
> This file is the single source of truth for the scope above. When old task cards, screenshots, chat history, or older notes conflict with this document, this document wins until implementation and this file are updated together.

## 1. Agent-visible tool contracts

### 1.1 Read is exactly four cognitive actions

```text
Read
├─ read_discover
├─ grep
├─ read_open
└─ codebase_explore
```

Semantics:

- `read_discover`: directory, filename, and path discovery. It does not silently become general full-text search.
- `grep`: deterministic workspace text/pattern search for literals, symbols, references, imports, config keys, error strings, and similar exact search work.
- `read_open`: read a known target, including line/range selection.
- `codebase_explore`: code relationships, architecture, call/dependency paths, and impact analysis. Candidates must be re-read/verified against the active workspace before becoming Evidence.

Older operations such as `read`, `read_list`, `read_locate`, `read_extract`, and `read_slice` may remain runtime primitives / compatibility surfaces, but they are not normal Planner-visible cognitive actions.

Rule:

> Planner-visible tools describe user-level cognitive actions. Lower-level providers and primitives are implementation details.

### 1.2 `grep` belongs to Read

`grep` is observation/search, not process execution. Its runtime may use ripgrep or another provider internally, but Planner should not need to shell out through `terminal_session` for normal code search.

### 1.3 Public web and local news are separate

```text
Network Search
├─ web_search
└─ news_search
```

- `web_search`: public internet search through Tavily / SearXNG behind Harness.
- `news_search`: local News Hub retrieval over already-ingested news/cache data.

Invariant:

> `web_search` must not inspect a query, infer news intent, query News Hub first, and silently short-circuit the public web request.

Capability mapping:

```text
Web Research  -> web_search
News Research -> news_search
```

## 2. CodeGraph / `codebase_explore` runtime contract

### 2.1 Microapp configuration is provider configuration, not workspace ownership

The CodeGraph microapp configures and validates a CodeGraph provider/runtime:

```text
CodeGraph microapp
├─ command
├─ start args
├─ version / telemetry probes
├─ app-data root
├─ timeout
└─ enabled state
```

The directory used by CodeGraph Studio is only a **debug/smoke workspace**.

It is not:

- an authorization boundary for Agent conversations;
- the only directory CodeGraph may inspect;
- a required match for the current conversation workspace.

After the microapp is enabled/configured, any conversation with a resolved active workspace may invoke `codebase_explore` against that workspace.

```text
Studio debug workspace: D:\some\debug-project
                         │
                         └─ proves provider/config can run

Conversation A workspace: D:\project-a -> CodeGraph runtime/index for project-a
Conversation B workspace: D:\project-b -> CodeGraph runtime/index for project-b
Conversation C workspace: D:\project-a -> reuses project-a runtime when config matches
```

### 2.2 Agent runtime ownership is workspace-scoped

For Agent calls:

```text
workspaceRoot = Harness active conversation workspace
provider config = active CodeGraph microapp config
runtime cache ownership = workspace + provider/runtime fingerprint
```

Threads do not own CodeGraph processes.

Multiple conversations using the same workspace and same provider configuration should reuse one healthy workspace runtime/index rather than spawning one process per thread.

Different workspaces get distinct workspace-bound runtimes/indexes.

Provider configuration changes invalidate the fingerprint and replace the cached runtime as needed.

### 2.3 Fake and real providers obey the same ownership rule

A fake/test provider may remain available for Studio/runtime testing. It is simply another configured provider implementation.

The Agent ownership rule must not branch on whether the configured command basename is literally:

```text
codegraph
codegraph.cmd
codegraph.exe
```

Wrapper launchers such as `node`, shims, or other compatible commands are valid configuration inputs. Detect/start/health prove whether the provider actually works.

### 2.4 Fake provider retrieval output is explicit-only

The fake CodeGraph provider is a protocol/runtime fixture. It must not fabricate plausible code-search candidates by default.

Current contract:

```text
no FAKE_QUERY_CANDIDATES / FAKE_EXPLORE_CANDIDATES / FAKE_AFFECTED_CANDIDATES
-> candidates: []

explicit FAKE_*_CANDIDATES JSON
-> return only those injected candidates
```

There are no built-in canned paths such as `server/src/agent/planner.ts`, `docs/architecture/README.md`, or other pseudo-search results.

This distinction matters because a fake provider may validate process startup, MCP handshake, health, query transport, candidate normalization, and verification plumbing, but it must never look like it actually searched an arbitrary workspace unless the test explicitly injected matching fixture data.

### 2.5 `.codegraph` presence is not a generic provider blocker

A previous bug applied the repo-pollution guard to every configured provider. That meant a provider declaring external-index support could be rejected merely because the target workspace already contained a `.codegraph` directory.

Current rule:

- If the provider reports external-index support as `ready`, an existing `.codegraph` directory is not by itself a runtime blocker.
- The repo-local pollution/index guard is applied only when the provider explicitly cannot relocate its index and the declared repo-local `.codegraph` behavior is required.

This is important for arbitrary Agent workspaces: the contents of a target project must not make an otherwise valid configured provider appear generically `provider_unavailable` for an unrelated guard.

### 2.6 Studio smoke and Agent invocation are separate concerns

Studio actions (`detect`, `start`, `health`, Smoke Status, Smoke Query) validate the Studio debug runtime.

Agent invocation uses the same provider configuration but binds it to the conversation workspace.

A Studio `ready` status therefore means the configured provider/runtime passed Studio validation for the debug workspace. Agent E2E success is separately proven when `codebase_explore` on the active conversation workspace returns candidates that pass source verification.

### 2.7 CodeGraph Evidence contract remains unchanged

- Planner sees `codebase_explore`, not raw native CodeGraph tools.
- Candidate output is not automatically Evidence.
- Candidate source must be re-read/verified from the active workspace.
- Verified excerpts with paths/ranges may enter Evidence.
- Fallback remains available when the provider truly cannot answer.

Do not redesign this contract as part of workspace/runtime fixes.

### 2.8 Acceptance condition

CodeGraph integration is E2E-healthy for an Agent workspace when:

```text
microapp provider config enabled
-> conversation resolves workspaceRoot
-> workspace-bound manager is created/reused
-> manager reaches ready
-> CodeGraph query/explore returns candidates
-> workspace verification succeeds
-> verifiedChunkCount > 0 for a query that should have matches
```

A generic `provider_unavailable` with `verifiedChunkCount=0` is not a successful CodeGraph result and must not be treated as proof that the integration is connected.

A fake provider returning zero candidates by default is also not proof of real CodeGraph retrieval. Real retrieval acceptance requires a real provider or an explicitly injected fixture candidate that matches source created by the test.

## 3. Planner structured output and live public narration

### 3.1 Planner still calls AgentTaskModel

Planner invokes AgentTaskModel to maintain the runtime plan and select the next action.

The structured decision envelope contains fields such as:

```text
type
reason
query
toolId
args
question
planPatch
```

Execution waits for a complete parsed/validated decision.

### 3.2 Live “inner OS” is public Planner narration

The UI narration area should surface the model-generated public `reason` while the structured decision is streaming, for example:

```text
正在确认当前目标和剩余任务……
正在检查 CodeGraph workspace 绑定……
发现还需要确认 manager 创建路径……
下一步准备定位相关实现。
```

This is user-facing working narration, not exposure of hidden private chain-of-thought.

### 3.3 Structured output streams while execution remains gated

Supported structured paths currently stream text deltas:

- OpenAI-compatible: `stream: true` with `response_format: json_schema`.
- Ollama: `stream: true` with schema format.

Flow:

```text
AgentTaskModel
-> structured JSON deltas
-> accumulate raw decision text
-> extract public reason from incomplete JSON
-> plannerThought / plannerThoughtStreaming
-> UI updates narration
-> complete JSON
-> parse / normalize / validate
-> execute next action
```

Invariant:

> Partial structured output may update narration, but it is never executable as a partial decision.

### 3.4 Stream failure boundary

- If native structured streaming fails before any native delta, text-JSON fallback may be used.
- If native structured streaming already emitted partial JSON, do not concatenate a second independently generated JSON object. Propagate the failure instead.

### 3.5 Strict-schema synthetic null normalization

Strict schemas may encode optional tool fields as nullable. Synthetic `null` object fields are removed before Harness validates tool args so optional fields recover normal omission semantics.

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

## 4. Provider compatibility remains an open boundary

`openai-compatible` describes a broad protocol family. It does not prove behavioral identity for every advanced feature.

Do not assume identical vendor behavior for:

- `response_format: json_schema`;
- `strict: true`;
- structured-output streaming;
- supported JSON Schema subsets;
- tool-call deltas / parallel calls;
- reasoning/thinking fields;
- usage and finish-reason normalization.

Provider-specific compatibility should be isolated behind provider/gateway contracts rather than leaking vendor conditionals through Planner/Harness.

A Cloudflare-hosted protocol gateway was discussed as an architectural option, but no such gateway is implemented by the changes documented here.

## 5. Do-not-regress rules

1. Keep the Planner-visible Read surface at four cognitive actions unless a proven semantic gap requires change.
2. Do not make `read_discover` a hidden full-text search tool again.
3. Do not route public web searches into local News Hub based on query wording.
4. Do not use Studio debug workspace identity as an Agent CodeGraph authorization/availability condition.
5. Do not create one CodeGraph process per conversation when conversations share the same workspace/configuration.
6. Do not treat an existing `.codegraph` directory as a generic blocker for providers that support external indexes.
7. Do not special-case Fake vs Real provider ownership semantics.
8. Do not let the fake CodeGraph provider return canned retrieval candidates when no test explicitly injected candidates.
9. Do not expose raw CodeGraph native tools to Planner; keep `codebase_explore` as the controlled surface.
10. Do not trust CodeGraph candidates as Evidence until workspace source verification succeeds.
11. Do not execute partial Planner structured output.
12. Do not claim CodeGraph E2E is fixed merely because Studio says `ready`; verify an Agent workspace call with real verified chunks.

## 6. Current validation notes

Implemented on `dev` in this working thread:

- `grep` added to Read and Read exposure reduced to four public actions.
- `web_search` and local `news_search` separated.
- wrapper launchers allowed for Agent-owned CodeGraph managers.
- Agent CodeGraph manager cache changed from thread-scoped to workspace-scoped reuse.
- repo-pollution guard narrowed so externally indexed providers are not blocked merely by an existing `.codegraph` directory.
- fake CodeGraph canned retrieval candidates removed; candidate results now require explicit `FAKE_*_CANDIDATES` injection.
- regression coverage added for fake-provider empty-by-default retrieval and explicit candidate injection.
- regression coverage added for wrapper launchers, cross-thread same-workspace reuse, and arbitrary workspaces containing `.codegraph` when external-index support is available.
- Planner native structured output changed to stream public narration while preserving complete-decision validation.

Still requires real-environment verification:

> Run `codebase_explore` from a conversation whose workspace is independent of the Studio debug path and confirm the workspace-bound runtime reaches `ready`, returns expected **real-provider** CodeGraph candidates, and produces verified chunks.