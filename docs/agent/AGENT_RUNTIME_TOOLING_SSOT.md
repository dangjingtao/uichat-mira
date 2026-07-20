# UIChat Mira Agent Runtime / Tooling SSOT

> Status: current truth for `dev` after the 2026-07-21 working thread.
>
> Scope: Agent-visible tools, Harness exposure/ranking, approval boundaries, CodeGraph runtime ownership, Planner public narration, and provider compatibility.
>
> When older task cards, screenshots, chat history, or notes conflict with this file, this file wins until implementation and this file are updated together.

## 1. Public Agent tool surface

### 1.1 Read is exactly four cognitive actions

```text
Read
├─ read_discover
├─ grep
├─ read_open
└─ codebase_explore
```

- `read_discover`: directory / filename / path discovery.
- `grep`: deterministic literal, symbol, reference, config-key, and text search.
- `read_open`: read a known file/target/range.
- `codebase_explore`: architecture, dependency, call-flow, relationship, and impact exploration through the controlled CodeGraph wrapper.

Legacy operations such as `read`, `read_list`, `read_locate`, `read_extract`, and `read_slice` may remain implementation primitives or compatibility surfaces. They are not public Planner tools.

### 1.2 Edit is exactly four direct actions

```text
Edit
├─ write_file
├─ replace_block
├─ delete_path
└─ move_path
```

- `write_file`: create a file or replace full file content with explicit overwrite semantics.
- `replace_block`: exact bounded text replacement.
- `delete_path`: delete a file or directory; recursive directory deletion must be explicit.
- `move_path`: move or rename a file or directory.

The older `edit_file(operation=...)` and `workspace_mutation(operation=...)` implementations may remain registered for persisted/legacy invocation compatibility, but they are not public Planner tools.

Invariant:

> Planner chooses the concrete edit action directly. There is no public executable wrapper layer whose only job is to choose write / replace / delete / move.

### 1.3 Network Search has two distinct tools

```text
Network Search
├─ web_search
└─ news_search
```

- `web_search`: public internet search.
- `news_search`: local News Hub / locally collected news-source retrieval.

`web_search` must not silently inspect wording and route into local News Hub instead of performing the requested public search.

### 1.4 Terminal is a full execution capability

```text
Terminal
└─ terminal_session
```

`terminal_session` is the stable execution contract for shell, Node, Python, Git, package managers, scripts, PTY-backed persistent sessions, long processes, and process-tree ownership.

It is not a generic integration container, but Harness must not hide it because a request initially looks like a Read, Browser, Search, or other task.

### 1.5 Browser / Mail / future capability packs

Browser Action, Mail, external MCP, Feishu, WeCom, and future capabilities extend what Mira can act on. They do not replace the core Read/Edit/Search/Terminal tool surface.

A multi-step task may legitimately move between domains:

```text
Browser
-> Read / transform
-> Edit
-> Terminal verification
-> Browser assert
```

No task-domain heuristic may permanently isolate one domain from the others.

## 2. Harness exposure and ranking contract

### 2.1 Harness is not a shadow Planner

Harness does not decide which task phase the Agent is in.

Harness must not hide a registered public tool because of:

- browser intent;
- query keywords;
- semantic relevance score;
- task-domain guesses;
- sandbox suitability guesses;
- terminal-need guesses;
- chat-vs-agent domain heuristics.

The core rule is:

> Registered public tools remain available to Planner. Harness only ranks when the public tool count exceeds the context budget.

### 2.2 <= 20 public tools: expose all

```text
publicToolCount <= 20
-> expose every public tool
-> do not run candidate ranking
-> caller topK / maxTools / minScore must not shrink the tool set
```

This means a normal Mira installation with roughly 15 core tools should give Planner the full tool set every turn.

### 2.3 > 20 public tools: expose ranked top 20

```text
publicToolCount > 20
-> rank available public tools for the current turn
-> expose exactly the best available 20
```

Ranking may use embedding / rerank infrastructure, but ranking is only a context-budget mechanism.

It is not an authorization mechanism.

Rules:

- no score threshold may reduce exposure below the top-20 budget;
- `topK`, `maxTools`, or `minScore` supplied by older callers must not arbitrarily shrink the Planner-visible set;
- if ranking infrastructure fails, expose a deterministic 20-tool fallback rather than applying extra policy gates;
- Browser intent does not create a Browser-only tool set.

### 2.4 The only availability distinctions before ranking

Public-surface classification and explicit user enablement remain factual availability inputs, not semantic filtering:

- internal Read primitives are not public tools;
- legacy Edit wrappers are not public tools;
- external MCP tools require the user's explicit Agent Access enablement.

Harness must not add additional semantic/runtime policy blocks on top of those facts.

## 3. Approval is execution-time policy, not exposure-time censorship

Approval remains enabled.

Current approval contract is invocation-bound:

```text
toolId + exact inputHash
```

Changing reviewed arguments such as command, cwd, env, timeout, or other inputs requires a new approval when the tool contract requires approval.

Workspace-bound operations may also require approval when targeting outside the active workspace according to their execution contract.

Invariant:

> Approval may stop execution pending user consent. It must not be used by Harness as a reason to pretend the tool does not exist.

Core side-effect tools keep their declared approval metadata, including `terminal_session` and public Edit actions.

## 4. CodeGraph / `codebase_explore` runtime contract

### 4.1 Microapp configuration is provider configuration, not workspace ownership

The CodeGraph microapp owns provider/runtime configuration:

```text
command
start args
version / telemetry probes
app-data root
timeout
enabled state
```

The Studio workspace is only a debug/smoke target.

It is not:

- an Agent authorization boundary;
- the only directory CodeGraph may inspect;
- a required match for the current conversation workspace.

### 4.2 Agent runtime ownership is workspace-scoped

For Agent calls:

```text
workspaceRoot = current Harness conversation workspace
provider config = active CodeGraph microapp config
runtime cache ownership = workspace + provider/runtime fingerprint
```

Threads do not own CodeGraph processes.

Multiple conversations using the same workspace/configuration should reuse the same healthy workspace runtime/index.

Different workspaces get distinct workspace-bound runtimes/indexes.

### 4.3 Fake and real providers use the same ownership rule

A fake/test provider is just another provider implementation for protocol/runtime testing.

Agent ownership must not depend on the launcher basename being literally `codegraph`, `codegraph.cmd`, or `codegraph.exe`. Wrappers such as `node`, shims, or compatible launch commands are valid configuration inputs.

### 4.4 Fake provider retrieval is explicit-only

The fake CodeGraph provider must never fabricate plausible code-search results by default.

```text
no FAKE_QUERY_CANDIDATES / FAKE_EXPLORE_CANDIDATES / FAKE_AFFECTED_CANDIDATES
-> candidates: []

explicit FAKE_*_CANDIDATES JSON
-> return only injected candidates
```

There are no canned pseudo-results such as `server/src/agent/planner.ts` or other hard-coded fake search targets.

### 4.5 CodeGraph Evidence contract

- Planner sees `codebase_explore`, not raw native CodeGraph tools.
- Provider candidates are not automatically Evidence.
- Candidate source must be re-read/verified against the active workspace.
- Only verified source excerpts may become workspace Evidence.

Real E2E acceptance requires:

```text
workspace-bound runtime ready
-> real provider query/explore returns expected candidates
-> source verification succeeds
-> verifiedChunkCount > 0 for a query that should match
```

Studio `ready` alone is not E2E proof.

## 5. Planner structured output and public live narration

Planner still calls AgentTaskModel to maintain the runtime plan and choose the next action.

The structured decision envelope includes fields such as:

```text
type
reason
query
toolId
args
question
planPatch
```

Supported native structured paths stream JSON deltas so public `reason` narration can update while the decision is being generated.

Flow:

```text
AgentTaskModel
-> structured JSON deltas
-> accumulate raw decision text
-> extract public reason from incomplete JSON
-> plannerThought / plannerThoughtStreaming
-> UI updates public working narration
-> complete JSON
-> parse / normalize / validate
-> execute next action
```

Partial structured output may update public narration, but partial decisions are never executable.

If native structured streaming fails before emitting any native delta, fallback may be used. If partial native JSON has already been emitted, a second independent JSON stream must not be concatenated onto it.

Strict-schema synthetic `null` values for optional tool arguments are normalized back to omitted optional fields before Harness schema validation.

## 6. Provider compatibility boundary

`openai-compatible` describes a broad protocol family. It does not prove behavioral identity for advanced features.

Do not assume identical behavior for:

- `response_format: json_schema`;
- `strict: true`;
- structured-output streaming;
- supported JSON Schema subsets;
- tool-call deltas / parallel calls;
- reasoning/thinking fields;
- usage and finish-reason normalization.

Provider-specific compatibility should remain isolated behind provider/gateway contracts rather than leaking vendor conditionals through Planner/Harness.

A Cloudflare-hosted protocol gateway was discussed as an architectural option but is not implemented by the changes documented here.

## 7. Do-not-regress rules

1. Keep public Read at `read_discover`, `grep`, `read_open`, `codebase_explore`.
2. Keep public Edit at `write_file`, `replace_block`, `delete_path`, `move_path`.
3. Do not expose legacy Read primitives or Edit wrappers as normal Planner tools.
4. Do not let Harness infer Browser/task intent and isolate tool domains.
5. Do not let Harness hide registered public tools based on sandbox/domain/relevance heuristics.
6. If public tools are <=20, expose all of them.
7. If public tools are >20, ranking exists only to produce the Planner-visible top 20.
8. Do not let caller `topK`, `maxTools`, or `minScore` arbitrarily shrink the <=20 set or reduce overflow exposure below the top-20 budget.
9. Keep explicit external MCP Agent Access as the user-controlled availability switch.
10. Keep approval at execution time; do not turn approval into exposure-time tool censorship.
11. Do not route public web search into local News Hub based on wording.
12. Do not use Studio debug workspace identity as an Agent CodeGraph availability condition.
13. Do not create one CodeGraph process per conversation when conversations share the same workspace/configuration.
14. Do not let fake CodeGraph return canned retrieval candidates without explicit fixture injection.
15. Do not trust CodeGraph candidates as Evidence until workspace source verification succeeds.
16. Do not expose raw CodeGraph native tools to Planner.
17. Do not execute partial Planner structured output.

## 8. Current validation notes

Implemented on `dev` in this working thread:

- Read converged to four public actions and `grep` added as a first-class Read action.
- Edit converged to four direct public actions without a public operation-wrapper layer.
- `web_search` and local `news_search` separated.
- Browser-intent hard isolation removed.
- Harness semantic/domain/sandbox/terminal exposure gates removed for registered public tools.
- Harness changed to expose all public tools at <=20 and rank/expose top 20 only when the set exceeds 20.
- Explicit external MCP Agent Access remains the user-controlled external availability gate.
- Execution-time approval remains unchanged.
- CodeGraph Agent runtime ownership changed to workspace-scoped reuse independent of Studio debug workspace.
- Fake CodeGraph canned candidates removed; fixture candidates require explicit injection.
- Planner native structured output streams public narration while preserving complete-decision validation.

Still requires real-environment verification:

> Run the previous Browser -> HTML -> save workflow and confirm Planner can naturally transition from Browser tools to `write_file` / `terminal_session` without the tool surface claiming those tools are unavailable.

> Run `codebase_explore` from a conversation workspace independent of Studio debug path and confirm a real provider returns verified chunks.