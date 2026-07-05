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

| Case | Input | Expected State | Actual State | Assertion Fields |
| --- | --- | --- | --- | --- |
| valid `use_tool` / policy allow / completed evidence / answer-ready generate | Planner emits `use_tool read_open {"path":"README.md"}`; Harness returns completed `read_open` content | `pendingToolCall` is frozen during normalize; policy allows; ToolNode executes once; evidence has one completed tool execution; answer-ready summary triggers generate | `completed`; no pending tool/approval; `lastToolExecution.toolId=read_open`; `evidence.toolExecutions.length=1`; `latestSummary.answerReadiness.canAnswer=true`; answer present | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, normalize trace `status=frozen`, Harness/generate call counts |
| `selectedToolIds` cannot execute by itself | Tool selection trace has `selectedToolIds=["read_open"]`; Planner emits `answer`, not `use_tool` | No normalize, no pending tool call, no ToolNode execution | `completed`; `agent-tool-select` trace contains selected id; `agent-tool-call-normalize` never runs; Harness calls `0`; answer present | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, selectedToolIds trace, normalize/Harness call counts |
| invalid args bounded replan | Planner emits schema-invalid `read_open {"missing":"README.md"}` twice | Tool never executes; planner gets one bounded replan; safe generate answer after second invalid args | `completed`; planner model called `2`; Harness calls `0`; generate model calls `0`; answer says no tool executed | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, planner/Harness/generate call counts |
| policy reject / deny | Planner emits valid `read_open`; policy mocked to `deny` | Tool never executes; run fails with policy error | `failed`; no pending tool/approval; no `lastToolExecution`; no latest tool summary; Harness calls `0`; `policyDecision.type=deny`; `errorMessage` present | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `errorMessage`, policy decision, Harness/generate call counts |
| policy pending approval | Planner emits `use_tool terminal_session {"command":"dir"}`; policy requires approval | Stops at approval; ToolNode not executed | `waiting_approval`; frozen `pendingToolCall` present; `pendingApproval.toolCallId` matches frozen call id; no `lastToolExecution`; Harness calls `0` | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, policy decision, Harness/generate call counts |
| Harness pending approval | Planner emits valid `read_open`; policy allows; Harness returns `awaiting_approval` | Stops at approval; frozen call retained; awaiting approval evidence is not answer-ready | `waiting_approval`; `lastToolExecution.status=awaiting_approval`; `latestSummary.status=awaiting_approval`; `latestSummary.answerReadiness.canAnswer=false` | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, Harness call count |
| repeated guard | First planner emits `read_open README.md`; completed evidence is not answer-ready; second planner emits the same call | Duplicate tool call is blocked; Harness still executes only once; generate answers from existing evidence | `completed`; planner model called `2`; Harness calls `1`; repeated guard trace `true`; one tool execution | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, repeated guard trace, call counts |
| `maxIterations` | Planner emits valid `read_open`; `maxIterations=1` | After first tool execution, route goes to generate, not a second tool loop | `completed`; planner model called `1`; Harness calls `1`; generate calls `1` | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, call counts |
| failed tool | Planner emits valid `read_open`; Harness returns failed `File not found` | Failed evidence is written; no fake success; no final generation | `failed`; `lastToolExecution.status=failed`; `latestSummary.status=failed`; `latestSummary.answerReadiness.canAnswer=false`; `errorMessage=File not found`; generate calls `0` | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `errorMessage`, summary readiness, call counts |
| timedOut tool | Planner emits `terminal_session {"command":"pwd"}`; policy mocked allow; Harness returns completed terminal result with `timedOut=true` | Timed-out evidence is not answer-ready and does not satisfy answer stop rule | `completed`; `lastToolExecution.status=completed`; `latestSummary.status=completed`; `latestSummary.data.timedOut=true`; `latestSummary.answerReadiness.canAnswer=false`; second planner answer then generate | `status`, `pendingToolCall`, `pendingApproval`, `lastToolExecution`, `evidence.latestSummary`, `answer`, timedOut data, readiness |

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
10 passed
```

## Review 02 Result

结论：

- `PASS`。当前回归从 `agentGraph.run` 入口验证链路，不是单函数测试。

覆盖矩阵：

- 见上方 `Acceptance Coverage` 表。

阻断问题：

- 无运行时代码阻断问题。
- 本次整改发现的是测试矩阵缺口：缺少 `selectedToolIds` 不得进入执行链、缺少 timedOut 非 answer-ready 断言。已通过新增链路 case 修复。
