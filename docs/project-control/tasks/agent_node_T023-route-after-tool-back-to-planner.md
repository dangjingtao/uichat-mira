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
task_state: done
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

### Verification Result

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/graph.test.ts src/agent/__tests__/tool-node.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`2` files, `42` tests)
- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/graph.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`1` file, `31` tests)
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: passed

## Evidence

- Changed files:
  - `server/src/agent/graph/routes.ts`
  - `server/src/agent/__tests__/graph.test.ts`

- Diff summary:
  - `routeAfterTool` 现在按 `lastToolExecution` 分流，而不是把工具后路径统一收成默认回工具选择
  - `failed_terminal` 明确走 `error`
  - `failed_recoverable` 在恢复预算未耗尽时回 `toolSelectStep`
  - `failed_recoverable` 在恢复预算耗尽后改走 `generate` 终止当前循环
  - 图级测试补齐了 completed / recoverable / terminal / recovery exhausted 分支

## Loop Stop Evidence

- 恢复失败计数累加位置：
  - [tool-node.ts](D:/workspace/rag-demo/server/src/agent/nodes/tool-node.ts:465)
  - 当 `failureKind === "recoverable"` 时，`recoveryAttemptCount = (state.lastToolExecution?.recoveryAttemptCount ?? 0) + 1`

- 恢复上限判断位置：
  - [routes.ts](D:/workspace/rag-demo/server/src/agent/graph/routes.ts:121)
  - `routeAfterTool` 读取 `lastToolExecution.recoveryAttemptCount`
  - 当前 MVP 上限固定为 `2`

- 恢复耗尽后的终止路径：
  - [routes.ts](D:/workspace/rag-demo/server/src/agent/graph/routes.ts:123)
  - `recoveryAttemptCount >= 2` 后不再回 `toolSelectStep`，而是走 `generate`

- 图级终止证据：
  - [graph.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/graph.test.ts:730) 证明一次 recoverable failure 后会回 Planner 主链，而不是直接走全局 `error`
  - [graph.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/graph.test.ts:810) 证明同一工具连续两次 recoverable failure 后：
    - `lastToolExecution.recoveryAttemptCount === 2`
    - 不会再进入下一次 `agent-next-action-planner`
    - 不会再进入下一次 `agent-tool`
    - 结果改走既定终止路径 `generate`

## Risk Points

- 这里很容易与 `maxIterations`、审批等待、post-tool review 互相踩
- 如果同时改 `build-graph` 和其它节点实现，容易扩大任务范围
