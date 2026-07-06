---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17UserVisibleExecutionTrace
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T019-planner-observation-context.md
  - docs/project-control/tasks/agent_node_T021-agent-execution-observation.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
  - docs/chat/chat-execution-trace-design.md
task_state: TODO
---

# agent_node_T026 user visible execution trace

## Target

本任务只做一件事：

把内部 execution node 事件整理成用户能看懂的推进轨迹，覆盖失败、恢复决策、新动作、审批等待、恢复执行。

这是 `v1.7` C 组第一张卡。

## Group And Dependency

- Group: `C`
- Sequence: `C1`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T020`
  - `agent_node_T021`
- Parallel rule:
  - A1-A3 稳定后可并行开始
  - 黑盒最终落地不依赖本卡先完成，但用户可见文案必须在黑盒前稳定

## Involved Files

- `server/src/agent/trace.ts`
- `server/src/agent/node-runtime.ts`
- `server/src/agent/nodes/tool-node.ts`
- `server/src/agent/resume.ts`
- `docs/chat/chat-execution-trace-design.md`

## Minimal Change Points

- 补 execution node `summary / details`
- 用用户能懂的话描述：
  - 失败
  - 再决策
  - 新动作
  - 审批等待
  - 恢复执行

## Acceptance Criteria

- 用户能看见“失败 -> 再决策 -> 新动作 -> 最终结果”
- 不要求复杂 UI
- 不只输出 JSON 或内部字段名

## Test Type

集成

## Verification

- execution node 事件测试
- trace summary/details 断言

## Risk Points

- 如果直接依赖未稳定 observation 字段，会导致返工
- 容易把“内部调试信息”误当“用户可见轨迹”

