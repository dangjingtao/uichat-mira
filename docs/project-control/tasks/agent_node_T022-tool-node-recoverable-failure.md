---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17ToolNodeRecoverableFailure
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T021-agent-execution-observation.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: DONE
---

# agent_node_T022 tool node recoverable failure

## Target

本任务只做一件事：

让 `toolNode` 的可恢复失败不再默认终止 `AgentGraph`，而是写入 failed observation / evidence / lastToolExecution，交回后续主链处理。

这是 `v1.7` A 组第四张卡，也是 `tool-node.ts` 的高风险改动卡。

## Group And Dependency

- Group: `A`
- Sequence: `A4`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T020`
  - `agent_node_T021`
- Parallel rule:
  - 不允许与其它 A 组卡并行实现
  - `B1` 凡是涉及 `tool-node.ts` 的接入，必须等本卡完成后才能开始

## Involved Files

- `server/src/agent/nodes/tool-node.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- `server/src/agent/__tests__/tool-node.test.ts`

## Minimal Change Points

- 区分 `failed_recoverable` 与 `failed_terminal`
- recoverable failure 不再设置全局 `errorMessage`
- 写入 failed observation / evidence / lastToolExecution
- 增加 `recoveryAttemptCount`

## Acceptance Criteria

- `file not found`、脚本缺失、常见非 0 exit code 等失败不会直接打进全局 error route
- failed observation / failed evidence / lastToolExecution 都可见
- terminal failure 仍能明确终止

## Test Type

单测

## Verification

- `tool-node` 定向单测
- 失败分类单测
- `2026-07-06` 已执行：`pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/tool-node.test.ts src/agent/__tests__/next-action-planner.test.ts`
- `2026-07-06` 已执行：`pnpm check`

## Risk Points

- recoverable 判定过宽会放过真正应终止的错误
- 这是 `tool-node.ts` 交界点，严禁与其它线程并改
