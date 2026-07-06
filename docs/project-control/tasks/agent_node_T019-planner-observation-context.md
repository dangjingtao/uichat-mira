---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17PlannerObservationContext
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: DONE
---

# agent_node_T019 planner observation context

## Target

本任务只做一件事：

为 `PlannerNode` 建立唯一观察入口 `PlannerObservationContext`，停止 `PlannerNode` 散读 `evidence / observations / lastToolExecution / pendingApproval`。

这是 `v1.7` A 组第一张卡，属于核心闭环主线。A 组必须单线程串行推进。

## Group And Dependency

- Group: `A`
- Sequence: `A1`
- Parallel rule:
  - 不允许与其它 A 组卡并行实现
  - `B / C` 组不得依赖未稳定的 `PlannerObservationContext`

## Involved Files

- `server/src/agent/types.ts`
- `server/src/agent/node-runtime.ts`
- `server/src/agent/planner/prompt.ts`
- `server/src/agent/graph/state.ts`
- 与本任务直接相关的 `docs/project-control/` 文档

## Minimal Change Points

- 新增 `PlannerObservationContext` 类型定义
- 设计或实现 `buildPlannerObservationContext(state)`
- 明确 `PlannerNode` 只消费统一观察视图
- 不在本任务改 recoverable failure 路由

## Acceptance Criteria

- `PlannerObservationContext` 至少包含：
  - `currentTaskFrame`
  - `latestObservation`
  - `recentObservations`
  - `latestEvidenceSummary`
  - `recovery`
  - `pendingApproval`
- `PlannerNode` prompt 组装不再直接散读多套状态
- 统一观察入口的来源字段和字段语义写清楚

## Test Type

单测

## Verification

- 类型与 helper 单测
- 如需调整 prompt 组装，增加对应单测

## Risk Points

- 只加类型不改消费路径，会形成“新对象挂着不用”的假收口
- 提前把过多运行时逻辑塞进观察入口，会扩大任务范围
