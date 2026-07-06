---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17RouteAfterTool
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T022-tool-node-recoverable-failure.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: TODO
---

# agent_node_T023 route after tool back to planner

## Target

本任务只做一件事：

修改 `routeAfterTool`，把工具后主链收成“等待审批 -> approval；可恢复失败 -> 回 Planner；终止失败 -> error”。

这是 `v1.7` A 组第五张卡。

## Group And Dependency

- Group: `A`
- Sequence: `A5`
- Depends on:
  - `agent_node_T022`
- Parallel rule:
  - 不允许与其它 A 组卡并行实现
  - `routes.ts` 是并改禁区

## Involved Files

- `server/src/agent/graph/routes.ts`
- `server/src/agent/graph/build-graph.ts`
- `server/src/agent/__tests__/graph.test.ts`

## Minimal Change Points

- `routeAfterTool` 增加 `failed_recoverable` 分支
- MVP 固定 `failed_recoverable -> toolSelectStep`
- 保持 `waiting_approval -> approval`
- 保持 `failed_terminal -> error`

## Acceptance Criteria

- 工具失败不再默认直接 `error`
- recoverable failure 会回 `toolSelectStep`
- 仍受 `maxIterations / maxRecoveryAttempts` 限制

## Test Type

集成

## Verification

- `graph` 路由集成测试
- 循环边界相关测试

## Risk Points

- 这里很容易与 `maxIterations`、审批等待、post-tool review 互相踩
- 如果同时改 `build-graph` 和其它节点实现，容易扩大任务范围

