# AgentGraph Mainline Blackbox Summary

- Current HEAD: `68e11d7ce8157cf6f8ab73c66eeb289d264c5675`
- New test file: `server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts`
- Runtime modified: No

## Diff

### Added files

- `server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts`
- `server/test-report/agentgraph-blackbox-summary.md`
- `server/test-report/agentgraph-blackbox-vitest.txt`
- `server/test-report/agentgraph-blackbox-typecheck.txt`

### Runtime impact

- Planner runtime modified: No
- Normalize runtime modified: No
- Policy runtime modified: No
- ToolNode runtime modified: No
- Evidence runtime modified: No
- AgentGraph runtime modified: No

### Change nature

- Only blackbox regression tests and review reports were added.
- No file under `server/src/agent/graph.ts`, `server/src/agent/routes.ts`, `server/src/agent/next-action-planner.ts`, `server/src/agent/tool-call-normalize.ts`, `server/src/agent/policy-node.ts`, `server/src/agent/tool-node.ts`, `server/src/agent/evidence.ts`, or `desktop/**` was modified.

## Scope

This task added blackbox regression coverage for the public `agentGraph.run(...)` entry and did not modify runtime files.

## Blackbox Entry

- Test entry: `agentGraph.run(...)`
- Internal node direct call: No
- Internal node direct mock-and-call as test entry: No
- Public runtime contract assertions included:
  - planner returns `answer`
  - planner returns `use_tool`
  - selectedToolIds does not bypass planner / normalize
  - Harness execution happens through the public runtime path
  - repeated tool guard stops duplicate execution
  - waiting approval stops before tool execution continues

## Coverage Matrix

| Case | Covered | Evidence |
| --- | --- | --- |
| A1. Direct answer does not enter tool chain | Yes | `A1 direct answer completes without entering the tool chain` |
| A2. `use_tool` must pass Normalize -> Policy -> ToolNode -> Evidence | Yes | `A2 use_tool goes through normalize and executes one concrete Harness call` |
| A3. `selectedToolIds` cannot bypass Planner / Normalize | Yes | `A3 selectedToolIds do not bypass planner or trigger ToolNode when planner answers` |
| A4. capability-like id must not execute | Yes | `A4 capability-like ids are rejected before Harness execution` |
| A5. repeated tool call guard | Yes | `A5 repeated same tool call is guarded and does not execute twice` |
| A6. `.` and `/workspace` are equivalent repeat fingerprints | Yes | `A6 "." and "/workspace" normalize to the same repeated fingerprint` |
| A7. `waiting_approval` stops before ToolNode execution | Yes | `A7 waiting_approval stops the run before ToolNode executes` |
| A8. failed / `maxIterations` does not keep executing tools or fake success | Yes | `A8 failed tool does not continue with extra tool execution or fake success`, `A8 maxIterations does not issue a second tool execution` |

## Verification

### Command

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/agentgraph-mainline-blackbox.test.ts
```

Result:

- Passed
- `1` test file
- `9` tests

### Command

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent
```

Result:

- Passed
- `17` test files
- `214` tests

### Command

```bash
pnpm --filter @ui-chat-mira/server typecheck
```

Result:

- Passed

## Notes

- The A4 runtime surface currently reports a user-facing error in Chinese indicating that no local workspace read tool is available for this turn. The blackbox assertion accepts that current product behavior.
- No runtime files under `server/src/agent/graph.ts`, `server/src/agent/routes.ts`, `server/src/agent/nodes/*`, or `desktop/**` were modified.
- Covered task-card items: 8 of 8.
