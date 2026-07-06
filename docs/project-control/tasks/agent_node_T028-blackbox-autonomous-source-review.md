---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17BlackboxAutonomousSourceReview
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T027-blackbox-test-plan-v17.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: TODO
---

# agent_node_T028 blackbox trio implementation

## Target

本任务只做一件事：

在 A 组核心闭环完成后，正式落地 3 个端到端黑盒：

- 自主源码审查
- 终端失败后继续推进
- 小范围修复闭环

## Group And Dependency

- Group: `C`
- Sequence: `C3`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T020`
  - `agent_node_T021`
  - `agent_node_T022`
  - `agent_node_T023`
  - `agent_node_T024`
  - `agent_node_T027`
- Parallel rule:
  - 必须等 A1-A6 全部完成后才能开始

## Involved Files

- `server/src/agent/` 下新增黑盒测试文件
- 直接相关的 test helper / mock helper

## Minimal Change Points

- 落地 3 个黑盒场景
- 只补必要 test helper
- 不借机重写主链

## Acceptance Criteria

- 自主源码审查：
  - 至少两步自主 locate/read 或 terminal search/read
  - 首次目标不准也能继续推进
- 终端失败后继续推进：
  - 第一次命令失败后能读 `package.json` 或改命令
  - 新高风险命令重新审批
- 小范围修复闭环：
  - 完成 `read -> edit proposal -> approval -> write/test`
  - 成功或失败都给完整结果

## Test Type

黑盒

## Verification

- 3 个黑盒场景运行结果
- 中间可见轨迹断言

## Risk Points

- 如果 A 组未完全收口，黑盒只会变成脆弱快照
- 如果中间断言太弱，会掩盖“看起来通过，实际没有推进”的问题

