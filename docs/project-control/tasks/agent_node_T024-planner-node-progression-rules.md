---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17PlannerProgressionRules
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T019-planner-observation-context.md
  - docs/project-control/tasks/agent_node_T023-route-after-tool-back-to-planner.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: TODO
---

# agent_node_T024 planner node progression rules

## Target

本任务只做一件事：

让 `PlannerNode` 基于 `PlannerObservationContext` 做失败恢复、换工具、换参数、ask_user、耗尽预算后的终局决策。

这是 `v1.7` A 组第六张卡，也是 A 组主线收口卡。

## Group And Dependency

- Group: `A`
- Sequence: `A6`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T023`
- Parallel rule:
  - 不允许与其它 A 组卡并行实现
  - `prompt.ts` 是并改禁区

## Involved Files

- `server/src/agent/planner/prompt.ts`
- `server/src/agent/next-action-planner*`
- `server/src/agent/__tests__/next-action-planner.test.ts`

## Minimal Change Points

- Planner prompt 改为基于 `PlannerObservationContext`
- 增加 recoverable failure、retry、耗尽恢复预算、ask_user 规则
- 不引入大型计划系统、任务树或新的 Agent 框架

## Acceptance Criteria

- Planner 能根据失败 observation 改走下一步
- 不会把 recoverable failure 直接收成全局 `error`
- 不会假装工具已经成功
- 恢复预算耗尽后能给出明确终局

## Test Type

单测

## Verification

- `next-action-planner` 定向单测
- 失败推进规则单测

## Risk Points

- 这是最容易发散成“重做 Planner”的卡，必须只做推进规则
- 输入事实不完整时，prompt 规则会失效

