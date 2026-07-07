---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-07
layer: project-control
module: AgentRuntime
feature: FailedToolPathContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/agent-runtime-t29-t33-ledger.md
  - server/src/routes/proxy-provider/chat-agent-approval.smoke.test.ts
  - server/src/agent/__tests__/toolcall-loop-regression.test.ts
  - server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts
task_state: READY_FOR_REVIEW
---

# agent_node_T030 Failed Tool Path Contract

## Target

固化 Agent failed tool 的主链合同，明确 terminal failure 与 recoverable failure 的不同终态，并同步最小测试断言。

## Source Task Pack

- External task id: `T30`
- External title: `失败路径合同裁决卡`

## Background

当前三处测试仍按旧合同断言 failed tool 必然导致 `AgentGraph failed` 或 chat `finishReason=error`：

- `server/src/routes/proxy-provider/chat-agent-approval.smoke.test.ts`
- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
- `server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts`

但当前主链实现已经是 C 合同：

- `failureKind === "terminal"`：走全局失败路径，`AgentGraph.status=failed`，chat `finishReason=error`
- `failureKind === "recoverable"`：写 failed evidence，进入 bounded recovery；恢复耗尽后转 Generate，输出 guarded answer，`AgentGraph.status=completed`，chat `finishReason=stop`

## Allowed Changes

- 只同步这 3 处测试对失败路径终态的合同断言
- 可补极小注释，说明 failed tool 与 graph failed 已经脱钩

## Forbidden Changes

- 不重写 Agent Graph
- 不重写 Harness
- 不修改 `failureKind` 分类规则本身
- 不新增大规模黑盒测试
- 不把所有 failed tool 都改成 completed
- 不把 terminal failure 也吞成 guarded answer
- 不为了全绿删除失败路径测试
- 不顺手修改 terminal result 语义
- 不引入 structured failure code
- 不补 edit 或 workspace mutation summary contract
- 不回填 `T29` done，除非 `T29` 重新跑出的 `server/test-report` 全绿且没有其它阻断

## Acceptance Criteria

1. 对 recoverable failed tool 用例，断言：
   - `lastToolExecution.status === "failed"`
   - `evidence.latestSummary.status === "failed"`
   - `evidence.latestSummary.answerReadiness.canAnswer === false`
   - `result.status === "completed"`
   - `answer` 是 guarded answer，不能声称文件已成功打开或任务已完成
   - `generate` 可以被调用
2. 对 terminal failed tool 用例，必须仍断言：
   - `result.status === "failed"`
   - `errorMessage` 或 `terminalReason` 存在
   - 不走正常 guarded answer 完成路径
3. chat route smoke 中：
   - recoverable failed tool 应允许 `finishReason = "stop"`
   - 应允许持久化 assistant message
   - `assistant metadata.agent.status` 应为 `completed`
   - 但内容必须是 guarded answer，不得 fake success
4. 必须保留“不会 fake success”的断言，只是不要再把 recoverable failed tool 等同于全局 failed。

## Verification

- 三处测试语义与 C 合同一致。
- terminal failure 和 recoverable failure 至少各有一个明确断言。
- 不引入 `T31/T32/T33` 的内容。

## Implementation

- 已同步 `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
  - recoverable failed tool 断言补齐 `failureKind="recoverable"`、`result.status="completed"`、guarded answer、`generate` 可执行
  - 新增 terminal failed tool 用例，固定 `protocol mismatch` 仍走 `result.status="failed"`、`errorMessage/terminalReason` 存在、`generate` 不执行
- 已同步 `server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts`
  - recoverable failed tool 断言补齐 `failureKind="recoverable"` 和 guarded answer 路径
  - 新增 terminal failed tool 用例，断言 graph 失败而不是转 guarded answer
- 已同步 `server/src/routes/proxy-provider/chat-agent-approval.smoke.test.ts`
  - recoverable failed tool smoke 固定 guarded answer 输出，断言 `finishReason="stop"`、assistant message 可持久化、`assistant metadata.agent.status="completed"`
  - 新增 terminal failed tool smoke，断言 `finishReason="error"`、不持久化 assistant message、`generate` 不执行

## Verification Evidence

```bash
cd server
pnpm exec vitest run src/agent/__tests__/toolcall-loop-regression.test.ts src/agent/__tests__/agentgraph-mainline-blackbox.test.ts src/routes/proxy-provider/chat-agent-approval.smoke.test.ts
```

结果：

```txt
3 passed
26 passed
```

## Remaining Constraints

- `T29` 仍是上游依赖，当前没有在本卡内回填 `server/test-report` 全绿。
- 本卡只更新 failed tool 路径合同断言；`T31/T32/T33` 仍保持 `TODO`。
