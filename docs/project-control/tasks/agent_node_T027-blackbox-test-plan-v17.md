---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17BlackboxTestPlan
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T026-user-visible-execution-trace.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: TODO
---

# agent_node_T027 blackbox test plan v1.7

## Target

本任务只做一件事：

先把 `v1.7` 的 3 个黑盒场景方案写清楚，不直接落测试代码。

只保留以下 3 个用户可见场景：

- 自主源码审查
- 终端失败后继续推进
- 小范围修复闭环

## Group And Dependency

- Group: `C`
- Sequence: `C2`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T020`
  - `agent_node_T021`
- Parallel rule:
  - A1-A3 稳定后可并行开始
  - 不得提前写最终黑盒测试实现

## Involved Files

- `docs/chat/agent-loop-v1.7-construction-plan.md`
- `docs/project-control/tasks/`
- `server/src/agent/` 下待新增黑盒测试文件位置说明

## Minimal Change Points

- 为 3 个场景写：
  - 输入
  - 期望用户可见行为
  - 中间关键断言
  - 禁止行为
  - 结束条件

## Acceptance Criteria

- 三个场景都形成可执行的黑盒测试方案
- 不扩成大而散的黑盒池
- 不把所有测试都变成黑盒

## Test Type

黑盒方案设计

## Verification

- 文档审查
- 黑盒断言结构审查

## Risk Points

- 现在直接写测试代码会被 A4-A6 主链改动冲掉
- 场景边界不收死，后续会膨胀成无法维护的验收集

