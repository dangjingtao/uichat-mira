# Task 01 Submission Pack: AgentGraph Mainline Blackbox

## Review Materials

### 1. 待审实现

- Blackbox regression test implementation:
  - [agentgraph-mainline-blackbox.test.ts](/D:/workspace/rag-demo/server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts)

### 2. 变更 diff 与 runtime 影响说明

- Diff summary:
  - [agentgraph-blackbox-diff.txt](/D:/workspace/rag-demo/server/test-report/agentgraph-blackbox-diff.txt)
- Review summary:
  - [agentgraph-blackbox-summary.md](/D:/workspace/rag-demo/server/test-report/agentgraph-blackbox-summary.md)
- One-page review sheet:
  - [agentgraph-blackbox-review.md](/D:/workspace/rag-demo/server/test-report/agentgraph-blackbox-review.md)

Runtime change conclusion:

- Planner runtime modified: No
- Normalize runtime modified: No
- Policy runtime modified: No
- ToolNode runtime modified: No
- Evidence runtime modified: No
- AgentGraph runtime modified: No

### 3. 测试结果

- Raw vitest output:
  - [agentgraph-blackbox-vitest.txt](/D:/workspace/rag-demo/server/test-report/agentgraph-blackbox-vitest.txt)

Command:

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/agentgraph-mainline-blackbox.test.ts
```

Result:

- Passed
- `1` test file
- `9` tests

### 4. Typecheck 结果

- Raw typecheck output:
  - [agentgraph-blackbox-typecheck.txt](/D:/workspace/rag-demo/server/test-report/agentgraph-blackbox-typecheck.txt)

Command:

```bash
pnpm --filter @ui-chat-mira/server typecheck
```

Result:

- Passed

## Blackbox Entry Compliance

- Test entry: `agentGraph.run(...)`
- Internal node direct call as test entry: No
- Internal node direct mock-and-call as test entry: No

## Coverage Against Task 01

| Case | Status | Evidence |
| --- | --- | --- |
| A1 | Covered | `A1 direct answer completes without entering the tool chain` |
| A2 | Covered | `A2 use_tool goes through normalize and executes one concrete Harness call` |
| A3 | Covered | `A3 selectedToolIds do not bypass planner or trigger ToolNode when planner answers` |
| A4 | Covered | `A4 capability-like ids are rejected before Harness execution` |
| A5 | Covered | `A5 repeated same tool call is guarded and does not execute twice` |
| A6 | Covered | `A6 "." and "/workspace" normalize to the same repeated fingerprint` |
| A7 | Covered | `A7 waiting_approval stops the run before ToolNode executes` |
| A8 | Covered | `A8 failed tool does not continue with extra tool execution or fake success`, `A8 maxIterations does not issue a second tool execution` |

Coverage conclusion:

- Covered task-card items: `8 / 8`
- At least `7` covered: Yes
- Required special cases present:
  - `selectedToolIds` does not bypass Planner / Normalize: Yes
  - `use_tool` must pass Harness: Yes
  - repeated tool guard: Yes
  - `waiting_approval` stops and does not continue executing tools: Yes

## Source Revision

- Current HEAD after report refresh: `1bb364f032cdef482fda367e2ff218047eaaca78`

## Consistency Check

- Report conclusion matches test file contents: Yes
- Report conclusion matches vitest output file: Yes
- Report conclusion matches typecheck output file: Yes
