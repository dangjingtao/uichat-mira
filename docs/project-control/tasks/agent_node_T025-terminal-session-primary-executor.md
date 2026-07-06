---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: AgentLoopV17TerminalPrimaryExecutor
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T021-agent-execution-observation.md
  - docs/project-control/tasks/agent_node_T022-tool-node-recoverable-failure.md
  - docs/chat/agent-loop-v1.7-construction-plan.md
task_state: DONE
---

# agent_node_T025 terminal session primary executor

## Target

本任务只做一件事：

把 `terminal_session` 明确纳入 `Planner -> Policy/Approval -> Execute -> Observation -> Planner` 主闭环，作为主力工程 Executor。

本卡按一个任务卡管理，但分两阶段：

- `B1a`：terminal observation mapping 设计、fixture、单测准备
- `B1b`：接入 `toolNode / approval / resume`

## Group And Dependency

- Group: `B`
- Sequence: `B1`
- Depends on:
  - `agent_node_T019`
  - `agent_node_T020`
  - `agent_node_T021`
- Parallel rule:
  - `B1a` 可在 A1-A3 稳定后开始
  - 凡是涉及 `tool-node.ts / resume.ts / approval` 的实际接入，必须等 `agent_node_T022` 完成后开始

## Involved Files

- `server/src/mcp/tools/terminal-session.tool.ts`
- `server/src/agent/nodes/tool-node.ts`
- `server/src/mcp/core/permissions.ts`
- `server/src/agent/resume.ts`
- `server/src/agent/__tests__/tool-node.test.ts`
- `server/src/mcp/tools/terminal-session.tool.test.ts`

## Minimal Change Points

- `B1a`：
  - 终端 observation mapping 设计
  - fixture 与单测准备
- `B1b`：
  - 把终端结果写入统一 observation
  - 保证新命令、新 cwd、新 env、新 timeout 重新走审批链

## Acceptance Criteria

- terminal success / failure / waiting approval 都能产出统一 observation
- 新命令不得复用旧审批
- `terminal_session` 不得变成旁路工具

## Test Type

集成

## Verification

- terminal 结果结构测试
- 审批恢复与新命令重审测试
- `2026-07-06` 已执行：`pnpm --filter @ui-chat-mira/server test -- src/mcp/core/permissions.test.ts src/agent/__tests__/execution-observation.test.ts src/agent/__tests__/resume.test.ts src/mcp/core/invocations.test.ts`
- `2026-07-06` 已执行：`pnpm check`

## Risk Points

- 与 `tool-node.ts` 的 recoverable failure 改造强耦合
- 极易被做成“终端特殊通道”
