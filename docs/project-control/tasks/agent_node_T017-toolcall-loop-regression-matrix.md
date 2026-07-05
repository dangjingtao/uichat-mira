---
status: done
owner: agent-runtime
last_verified: 2026-07-05
layer: project-control
module: AgentRuntime
feature: ToolCallLoopRegressionMatrix
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - server/src/agent/__tests__/toolcall-loop-regression.test.ts
  - docs/harness/agentgraph-harness-protocol.md
---

# agent_node_T017：ToolCall Loop Regression Matrix

## Target

建立后端黑盒回归矩阵，证明主链能跑完：

```txt
nextAction.use_tool
-> toolCallNormalize
-> policy
-> tool
-> evidence
-> planner / generate
```

## Scope

Allowed:

- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
- `docs/project-control/agent-nodes-workboard.md`
- `docs/project-control/tasks/agent_node_T017-toolcall-loop-regression-matrix.md`

Forbidden:

- Harness exposure
- sandbox
- UI tests
- Agent V2

## Acceptance Coverage

- valid `use_tool` freezes a planner tool call and keeps `toolCallId / inputHash` aligned through execution evidence.
- policy `allow` routes to `ToolNode`.
- completed tool execution appends `evidence.toolExecutions`.
- answer-ready `evidence.latestSummary` routes to `generate`.
- schema-invalid args do not execute the tool and use bounded replan at most once.
- policy `deny` does not execute the tool.
- policy approval returns `waiting_approval`.
- Harness approval pause returns `waiting_approval` with frozen `pendingToolCall`.
- repeated same tool args trigger repeated guard and skip duplicate execution.
- `maxIterations` routes to `generate`.
- failed tool writes failed evidence and does not report success.

Each case asserts:

- `status`
- `pendingToolCall`
- `pendingApproval`
- `lastToolExecution`
- `evidence.latestSummary`
- `answer`, `blockedReason`, or `errorMessage`

## Implementation

Added:

- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`

The test file mocks provider planning, tool exposure, Harness invocation, and final generation. It uses `agentGraph.run` as the entry point and does not call node internals directly.

## Verification

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/toolcall-loop-regression.test.ts
```

Result:

```txt
8 passed
```
