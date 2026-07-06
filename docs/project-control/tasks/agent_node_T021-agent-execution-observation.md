---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17ExecutionObservation
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T019-planner-observation-context.md
  - docs/project-control/tasks/agent_node_T020-current-task-frame.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: DONE
---

# agent_node_T021 agent execution observation

## Target

本任务只做一件事：

把 Executor 执行结果统一成 `AgentExecutionObservation`，供 `PlannerObservationContext` 消费。

这是 `v1.7` A 组第三张卡。

## Group And Dependency

- Group: `A`
- Sequence: `A3`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T020`
- Parallel rule:
  - 不允许与其它 A 组卡并行实现
  - `B / C` 组只有在本卡接口稳定后才能启动设计或并行准备

## Involved Files

- `server/src/agent/types.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/nodes/shared.ts`
- `server/src/agent/node-runtime.ts`

## Minimal Change Points

- 新增 `AgentExecutionObservation`
- 增加 observation 映射 helper
- 明确 `completed / failed_recoverable / failed_terminal / waiting_approval`
- 不在本任务修改 `routeAfterTool`

## Acceptance Criteria

- 四类 observation 状态结构完整
- tool/retrieve/approval/generate 至少能映射到统一 observation
- `PlannerObservationContext.latestObservation` 可以直接消费该结构

## Test Type

单测

## Verification

- observation helper 单测
- 状态映射单测

## Risk Points

- 如果 observation 只做日志不进入 Planner 统一观察入口，就没有闭环价值
- 如果试图同时重写 evidence 全结构，会扩大任务范围
