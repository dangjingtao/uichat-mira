---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-07
layer: project-control
module: AgentRuntime
feature: TerminalResultSemantics
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/agent-runtime-t29-t33-ledger.md
  - docs/tooling-runtime/tools-protocol.md
  - server/src/agent/evidence.ts
task_state: TODO
---

# agent_node_T031 Terminal Result Semantics

## Target

为 `terminal_session` 的结果补齐三层语义，明确区分：

1. `processCompleted`
2. `commandSucceeded`
3. `taskSatisfied`

本任务只补结果语义，不重写 Harness，也不改 Agent Graph 主链。

## Source Task Pack

- External task id: `T31`
- External title: `terminal result 语义拆分`

## Allowed Changes

- `server/src/agent/evidence.ts`
- `terminal_session` 相关 summary 和 data 类型
- generate 阶段针对 terminal 的可读摘要
- 与 terminal summary 直接相关的最小测试

## Forbidden Changes

- 不重写 Harness
- 不改 Agent Graph 主链
- 不新增大规模黑盒
- 不把所有工具 summary 一起重构
- 不把 `taskSatisfied` 做成复杂 Planner 或 AI 判断

## Required Data Shape

`terminal_session` summary data 至少应表达：

```ts
processCompleted: boolean
commandSucceeded: boolean | null
taskSatisfied: "yes" | "no" | "unknown"
exitCode?: number | null
timedOut?: boolean
truncated?: boolean
binaryDetected?: boolean
unreadableReason?: string
```

## Acceptance Criteria

1. `exitCode === 0` 时，只能说明命令成功完成，不能夸大为业务任务一定完成。
2. `exitCode !== 0` 时，必须说明命令执行完成但失败。
3. `timeout`、`truncated`、`binary`、`unreadable` 场景继续保持受限回答。
4. Generate fallback 或 summary 不泄漏工具协议细节。
5. 测试覆盖 `exitCode === 0`、`exitCode !== 0`，以及至少一个受限场景。

## Verification

- 运行与 `terminal_session` summary 相关的最小测试集。
- 确认 `completed` 不再被误读为“任务成功”。
- 确认失败命令仍可被解释为“命令已执行但失败”，而不是“无法回答”。
