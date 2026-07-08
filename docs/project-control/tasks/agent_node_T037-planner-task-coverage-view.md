---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: PlannerTaskCoverageView
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/tasks/agent_node_T035-planner-answer-stop-task-completion.md
  - docs/project-control/tasks/agent_node_T036-planner-mutation-completion-regression-tests.md
  - server/src/agent/planner/node.ts
  - server/src/agent/evidence.ts
  - server/src/agent/types.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
  - server/src/agent/__tests__/graph.test.ts
task_state: TODO
---

# agent_node_T037 Planner Task Coverage View

## Target

在不引入大型计划机、不改变 `Planner -> Normalize -> Policy -> ToolNode -> Evidence -> Planner` 主线的前提下，为 Planner 增加轻量但刚性的 `TaskCoverageView`。

本任务只解决一个问题：

- Planner 目前容易把“latest evidence 可回答局部问题”误判成“当前用户任务已经完成”
- 结果是 `nextAction = answer` 过早发生，或者 ToolSelect / Harness query 只围绕眼前 evidence 打转，没有稳定围绕剩余任务缺口继续推进

本任务不是 `AgentGraph` 重构，不引入 DAG、多 Agent 或大型计划系统，也不把修复退化成更强 prompt 约束。

## Source Task Pack

- Internal topic: `Planner task coverage view`
- Trigger case 1: 多目标请求只覆盖一个目标时，Planner 过早 `answer`
- Trigger case 2: `read_locate` 命中后，Planner 没把“仍需 open / verify / execute”的剩余动作稳定传给后续 ToolSelect / Harness query

## Allowed Changes

- `server/src/agent/planner/node.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- 与 `currentTaskFrame / taskCoverageView / planner completion gate` 直接相关的最小辅助函数或类型
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/graph.test.ts`
- 本任务卡

## Forbidden Changes

- `desktop/src/**`
- `server/src/agent/nodes/generate.ts` 主语义
- `server/src/agent/nodes/policy*.ts`
- `server/src/agent/nodes/tool*.ts`
- `server/src/agent/nodes/tool-call-normalize*.ts`
- `server/src/harness/**`
- `AgentGraph` 主路由结构
- 引入 DAG / 多 Agent / 大型任务计划系统
- 新增外部 action type 或改动现有 `nextAction` 对外契约
- 把主修点做成 `agentTaskModel` prompt patch

## Required Contract

1. Planner 仍然只输出 `nextAction`
2. 所有 `use_tool` 仍然必须经过 `toolCallNormalize -> policyStep -> tool`
3. `selectedToolId` 与 `capabilityIntent.selectedToolIds` 仍然不得直接执行
4. `Generate` 仍然只是表达层，不负责修正任务完成状态
5. 所有执行结果仍然必须先进入 `Evidence`，再回到 Planner 判断是否完成
6. `TaskCoverageView` 必须是 `currentTaskFrame` 旁边的新增或派生视图，不能扩写成第二套执行主状态机

## Implementation Notes

1. Planner 必须显式区分：
   - `latestEvidenceSummary.answerReadiness.canAnswer`
   - `taskCoverageView.taskCompletable`
2. `taskCoverageView` 至少表达：
   - `requiredTargets`
   - `coveredTargets`
   - `pendingTargets`
   - `pendingActions`
   - `blockedReason`
   - `taskCompletable`
3. `answer-stop` 不得只看 `latestEvidenceSummary.answerReadiness.canAnswer`
4. Planner 在输出 `nextAction = answer` 前，必须同时满足：
   - latest evidence 可回答局部问题
   - `taskCoverageView.taskCompletable = true`
   - `pendingTargets` 为空
   - `pendingApproval / error / recovery exhaustion` 状态安全
5. ToolSelect / Harness query 必须携带“剩余未完成目标”，不能只携带原始 query + review notes
6. `TaskCoverageView` 的重点不是记录所有历史，而是稳定表达“当前还差什么”
7. mutation 类任务仍然必须分阶段：
   - `locate / confirm` 不是完成
   - `delete / edit / write` 必须经过现有执行链
   - 如用户请求里包含 verify / check / confirm 语义，写入后仍需保留验证缺口
8. repeated guard 不得把“同一工具反复尝试”偷转成“任务已完成可 answer”

## Required Coverage

1. 单目标 `read_list` 可收尾
2. `read_locate` 命中但仍需 `read_open` 时不得 `answer`
3. 多目标请求只完成一个时不得 `answer`
4. 多目标全部 covered 后才允许 `answer`
5. repeated guard 不能把“部分完成”误收成 `answer`

## Acceptance Criteria

1. Planner 不再把 `evidence answerable` 误判成 `task completable`
2. `TaskCoverageView` 由当前任务与现有 evidence 派生，不改变外部执行主线
3. Planner 可以把“剩余未完成目标”稳定传给后续 ToolSelect / Harness query
4. locate 命中、局部可答、工具重复等局部现象，不能再绕过任务覆盖判断直接收尾
5. 不破坏现有 `Normalize -> Policy -> ToolNode -> Evidence -> Planner` 闭环

## Verification

1. 运行或补充 `next-action-planner` 回归，证明 Planner 在 partial coverage 下不会提前 `answer`
2. 运行 graph 级回归，证明现有执行链不变
3. 输出：
   - 修改文件列表
   - `TaskCoverageView` 放在哪一层
   - 它如何表达剩余未完成目标
   - 为什么它不改变外部契约
   - 测试命令和结果

最少命令：

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/next-action-planner.test.ts src/agent/__tests__/graph.test.ts`

如实现影响类型：

- `pnpm --filter @ui-chat-mira/server typecheck`

## Notes

- 这是 Planner 判定层增强，不是 Planner redesign。
- 如果实现过程中发现必须改 `Harness` 主循环、`ToolNode`、`Policy` 或外部 action 契约，必须先停下并回到项目 owner 重新确认边界。
