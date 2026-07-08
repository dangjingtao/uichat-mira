---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-08
layer: project-control
module: AgentRuntime
feature: PlannerMutationCompletionRegressionTests
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/project-control/project-control-ledger.md
  - docs/project-control/tasks/agent_node_T035-planner-answer-stop-task-completion.md
  - server/src/agent/__tests__/next-action-planner.test.ts
  - server/src/agent/__tests__/graph.test.ts
  - server/src/agent/__tests__/toolcall-loop-regression.test.ts
task_state: DONE
---

# agent_node_T036 Planner Mutation Completion Regression Tests

## Target

为 Planner 的 mutation 完成判定补齐回归测试，锁住这次“部分 evidence 提前收尾”的缺陷，同时保证现有单目标 locate 问答路径不受影响。

本任务只收测试与验证，不扩大为 approval/resume 重构，不扩展 UI 观测面。

## Prerequisite

- `agent_node_T035` 已完成，或至少已经有可测试的 Planner completion check 实现

## Allowed Changes

- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/graph.test.ts`
- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
- 与这些测试直接相关的最小夹具调整
- 本任务卡

## Forbidden Changes

- 生产代码主语义，除非是 `agent_node_T035` 已批准范围内的变更
- `desktop/src/**`
- 新增与本问题无关的 observability/UI 逻辑
- 把这次缺陷解释成 prompt patch 问题，并在测试里接受 prompt 偶然稳定输出
- 把 mutation 流程缩短为绕过 `pendingToolCall -> Policy -> ToolNode`

## Required Coverage

1. 用户要求删除 `A` 和 `B`，只 locate 到 `A` 时不得 `answer`
2. `A` 和 `B` 都 locate 到后，仍不得直接 `answer`，必须进入删除准备 / 审批链路
3. 删除执行成功后才可以 `answer`
4. 用户只是问 `A` 在哪里时，locate 到 `A` 可以 `answer`
5. 不破坏现有 `pendingToolCall -> ToolNode -> Evidence -> Planner` 闭环

## Acceptance Criteria

1. 上述 5 类场景都有明确自动化回归
2. 测试断言直接落在 Planner/Graph 行为，不依赖人工解释日志
3. 测试能区分：
   - `evidence answerable`
   - `task completable`
4. mutation 场景中，`locate / confirm` 证据不会再被当成最终完成证据
5. 单目标 locate 问答仍然保留现有快速收尾路径

## Verification

最少命令：

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/next-action-planner.test.ts src/agent/__tests__/graph.test.ts src/agent/__tests__/toolcall-loop-regression.test.ts`

如实现影响类型：

- `pnpm --filter @ui-chat-mira/server typecheck`

输出要求：

- 每条新增用例对应哪条 coverage / acceptance
- 测试命令
- 测试结果摘要
- 如果有旧断言被更新，说明更新原因

## Notes

- 本任务的价值不在“多加几条 case”，而在把 Planner 的任务完成语义固定成可回归的合同。
- 如果测试通过仍然依赖 prompt 偶然稳定输出，而不是 Planner completion check 稳定判定，视为未完成。

## Implementation Record

### Changed Files

- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/graph.test.ts`
- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
- 本任务卡

### What Changed

- 在 `next-action-planner.test.ts` 补齐 mutation completion 相关 Planner 回归，明确区分：
  - `evidence answerable`
  - `task completable`
- 新增回归覆盖：
  - 多目标 locate 只覆盖一部分时，Planner 不得 `answer`
  - 多目标都 locate 到后，Planner 仍不得把 locate 证据当作任务已完成，必须继续进入 mutation 执行路径
  - 单目标 locate 问答仍可走现有直接 `answer` 快路径
- 在 `graph.test.ts` 补齐图级回归，确认 locate 完多目标后不会直接回答，而是继续进入 `pendingToolCall -> Policy -> approval` 链路。
- `toolcall-loop-regression.test.ts` 的联动更新只做了一件事：把一条旧断言稳定化，避免当前 Planner 的 recoverable failure 重试策略让该用例超时，同时继续守住“failed evidence 不会被伪装成成功完成”的旧合同。

### Why `toolcall-loop-regression.test.ts` Is In Scope

- T036 的 Acceptance 不是只看“Planner 有无多一条判断”，还要求“不破坏现有 `pendingToolCall -> ToolNode -> Evidence -> Planner` 闭环”。
- `toolcall-loop-regression.test.ts` 正是这条闭环的回归矩阵之一，所以它被列进最少命令不是额外夹带，而是为了证明这次 completion 语义收紧没有把既有 tool loop 弄坏。
- 本轮对该文件的修改不是扩需求，而是把一条旧用例从“隐含依赖早收尾”改成“显式模拟失败后仍无已完成证据”，让它继续准确覆盖闭环合同。

## Coverage Mapping

### Required Coverage 1

- `nextActionPlannerNode does not short-circuit to answer when a multi-target locate question still misses one target`
  - 多目标 locate 只覆盖一部分时不得 `answer`

### Required Coverage 2

- `nextActionPlannerNode still rejects planner answer when all mutation targets are only located but not executed`
  - 多目标都 locate 到后，仍不得直接 `answer`
- `agentGraph does not answer after locating all mutation targets and instead enters the approval chain before executing deletion`
  - locate 完后必须进入删除准备 / 审批链路

### Required Coverage 3

- `agentGraph resume path does not repeat a normalized workspace_mutation after approval`
  - 删除执行成功后才可以 `answer`

### Required Coverage 4

- `nextActionPlannerNode still short-circuits to answer for a single-target locate question once the target is covered`
  - 单目标 locate 问答保留现有快速收尾路径

### Required Coverage 5

- `agentGraph does not answer after locating all mutation targets and instead enters the approval chain before executing deletion`
  - 图级断言继续经过现有 `Policy / approval` 链路
- `toolCall loop failed tool writes failed evidence and never reports fake success`
  - 失败 evidence 仍然先回 Evidence，再由 Planner / Generate 处理；不会跳过闭环伪装成完成

### Acceptance Mapping

- Acceptance 1：
  - 上述 5 类场景现在都有自动化断言
- Acceptance 2：
  - 新增断言都直接落在 `nextAction`、`AgentGraph` 状态、`pendingApproval`、`pendingToolCall`、`tool execution count`
- Acceptance 3：
  - Planner 层用例直接证明“证据可答”不等于“任务完成”
- Acceptance 4：
  - locate / confirm 证据在 mutation 场景不再被当成最终完成证据
- Acceptance 5：
  - 单目标 locate 快收尾路径保留，Graph 级 tool loop 也未被破坏

## Verification Evidence

### Commands

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/next-action-planner.test.ts src/agent/__tests__/graph.test.ts src/agent/__tests__/toolcall-loop-regression.test.ts`
- `pnpm --filter @ui-chat-mira/server typecheck`

### Results

- `next-action-planner.test.ts`: `76` passed
- `graph.test.ts`: `33` passed
- `toolcall-loop-regression.test.ts`: `11` passed
- 合并命令结果：`120` passed
- `typecheck`: passed

### Old Assertion Updates

- `toolCall loop failed tool writes failed evidence and never reports fake success`
  - 旧断言会被当前 recoverable failure 重试路径拖到超时，不再稳定代表 T036 想验证的合同
  - 已改成显式两轮 Planner mock，并为该用例单独放宽 timeout
  - 更新原因不是放松合同，而是把断言重新对齐到“failed evidence 仍不能被当成已完成证据”
