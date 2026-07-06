---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17CurrentTaskFrame
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T019-planner-observation-context.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: DONE
---

# agent_node_T020 current task frame

## Target

本任务只做一件事：

把 `currentTaskFrame` 落成运行时最小任务板，至少承载当前目标、当前子任务、当前阻塞点、当前已确认对象、完成判据。

这是 `v1.7` A 组第二张卡，必须跟随 `A1` 串行推进。

## Group And Dependency

- Group: `A`
- Sequence: `A2`
- Depends on:
  - `agent_node_T019`
- Parallel rule:
  - 不允许与其它 A 组卡并行实现

## Involved Files

- `server/src/agent/types.ts`
- `server/src/agent/graph/state.ts`
- `server/src/agent/node-runtime.ts`
- `server/src/agent/nodes/prepare-context*`
- `server/src/agent/nodes/tool-node.ts`
- `server/src/agent/nodes/retrieve*`

## Minimal Change Points

- 新增 `CurrentTaskFrame` 类型
- 在 `AgentGraphState` 中增加 `currentTaskFrame`
- 明确哪些节点写、哪些节点只读
- 不在本任务引入大型计划系统、任务树或 DAG

## Acceptance Criteria

- `CurrentTaskFrame` 最小字段完整
- 明确：
  - `PlannerNode` 是主更新者
  - `Executor` 只追加客观结果
  - `Generate/Evaluate` 只读
- 至少存在初始化与一次更新路径

## Test Type

单测

## Verification

- 类型与 state 初始化单测
- 节点写入权相关单测

## Risk Points

- 没写清确认对象覆盖规则，后续会积累脏状态
- 如果让多个节点同时推理任务状态，会把责任重新打散
