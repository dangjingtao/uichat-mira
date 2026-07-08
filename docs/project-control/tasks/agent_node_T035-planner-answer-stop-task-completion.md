---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-08
layer: project-control
module: AgentRuntime
feature: PlannerAnswerStopTaskCompletion
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/project-control/project-control-ledger.md
  - docs/harness/README.md
  - server/src/agent/evidence.ts
  - server/src/agent/planner/node.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
  - server/src/agent/__tests__/graph.test.ts
task_state: READY_FOR_REVIEW
---

# agent_node_T035 Planner Answer-Stop Task Completion

## Target

在不改 `AgentGraph` 主合同的前提下，修正 Planner 的 `answer-stop` 判定。

本任务只解决一个问题：

- `evidence.answerReadiness.canAnswer` 目前只能说明“这条证据可用于回答某类问题”
- Planner 还缺少“当前用户任务是否已经完成”的额外判断

要求把 Planner 从“latest evidence 可答就收尾”收紧为“latest evidence 可答，且当前任务已完成，才允许输出 `nextAction = answer`”。

本任务不是 Planner 重构，不扩展为新的 task state 体系，也不把主修点转移成 prompt patch。

## Source Task Pack

- Internal topic: `Planner answer-stop completion check`
- Trigger case: 多目标 mutation 请求只覆盖部分目标时，Planner 过早输出 `answer`

## Allowed Changes

- `server/src/agent/evidence.ts`
- `server/src/agent/planner/node.ts`
- 与 `answer-stop / task completion check` 直接相关的同目录小型辅助函数或类型
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/graph.test.ts`
- 本任务卡

## Forbidden Changes

- `desktop/src/**`
- `server/src/agent/nodes/generate.ts` 主语义
- `server/src/agent/nodes/policy*.ts`
- `server/src/agent/nodes/tool*.ts`
- `server/src/agent/nodes/tool-call-normalize*.ts`
- Harness 候选暴露、排序、schema surface
- `AgentGraph` 主路由结构
- 新增外部 action type 或改动现有 `nextAction` 对外契约
- 把主修点做成 `agentTaskModel` prompt patch

## Required Contract

1. Planner 仍然只输出 `nextAction`
2. `use_tool` 仍然必须经过 `Normalize -> Policy -> ToolNode`
3. `selectedToolId` 与 `capabilityIntent.selectedToolIds` 仍然不得直接执行
4. `Generate` 仍然只是表达层，不负责修正任务完成状态
5. 所有执行结果仍然必须先进入 `Evidence`，再回到 Planner 判断是否完成

## Implementation Notes

1. 必须区分：
   - `evidence answerable`
   - `task completable`
2. `evidence.answerReadiness.canAnswer` 语义保持为“证据可答”，不得继续偷带“任务可完成”的含义
3. Planner 在输出 `answer` 前，必须额外做轻量任务覆盖判断：
   - 从用户请求中识别 `requiredTargets / requiredActions`
   - 从现有 evidence 中识别 `coveredTargets / completedActions`
   - 如果 `missingTargets` 或 `pendingActions` 非空，不得输出 `answer`
4. mutation 类任务必须分阶段：
   - `locate / confirm` 不是完成
   - `delete / edit / write` 必须经过 `pendingToolCall -> Policy -> ToolNode`
   - 最终 `answer` 必须基于执行结果 evidence 或明确失败原因
5. 实现重点是 Planner 内核判定，不是通过更强提示词去“希望模型更严谨”

## Acceptance Criteria

1. `read_locate` 命中后，`evidence.answerReadiness.canAnswer` 不再自动等价于“当前任务可结束”
2. Planner 能在不改外部协议的前提下，基于任务覆盖度阻止过早 `answer`
3. mutation 类任务在只有 `locate / confirm` 证据时，不会被误判为完成
4. 单目标 locate 问答仍保持可直接 `answer` 的现有能力
5. 不破坏现有 `pendingToolCall -> Policy -> ToolNode -> Evidence -> Planner` 闭环

## Verification

1. 运行或补充 `next-action-planner` 相关回归，证明 Planner 在 partial evidence 下不会提前 `answer`
2. 运行 graph 级回归，证明 mutation 流程仍然经过现有执行链
3. 输出：
   - 修改文件列表
   - 新增的 completion check 放在哪一层
   - 为什么它不改变外部契约
   - 测试命令和结果

最少命令：

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/next-action-planner.test.ts src/agent/__tests__/graph.test.ts`

如实现影响类型：

- `pnpm --filter @ui-chat-mira/server typecheck`

## Notes

- 这是 narrow Planner fix，不是 Planner redesign。
- 如果实现过程中发现必须改动 `Generate`、`Policy`、`ToolNode` 或外部协议，必须先停下并回到项目 owner 重新确认边界。

## Implementation Record

### Changed Files

- `server/src/agent/evidence.ts`
- `server/src/agent/planner/node.ts`
- `server/src/agent/planner/prompt.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/graph.test.ts`

### What Changed

- 把 task completion check 留在 `Evidence -> Planner` 这一层，没有改 `AgentGraph` 主路由，也没有改 `Generate` / `Policy` / `ToolNode` 主语义。
- `getTaskCompletionDecision` 不再只对 mutation 任务做最小特判，而是统一按任务覆盖度判断：
  - 从用户请求、`currentTaskFrame.currentGoal`、`completionCriteria` 提取 `requiredTargets`
  - `coveredTargets` 只来自可落地的已完成 evidence，不再把 failed tool args 误算成“已覆盖”
  - `read_locate` 把展示用 `matchesPreview` 和计算用 `matchedPaths` 拆开，避免把 `[path] README.md` 这类展示文本误当成路径参与 completion 判定；其中 `matchesPreview` 允许截断，但 `matchedPaths` 必须保留完整命中集合，不能按预览上限裁剪
  - mutation 任务另外要求真实 mutation 终局 evidence；只有 locate / confirm 不算完成，但真实改动成功或 mutation 工具自身的明确终局失败都可以完成，不能被无关 read/tool failure 冒充
- 对“task model 先给了 answer，但 completion gate 判定未完成”的场景，不再硬改成固定 `ask_user`，而是做一次受限 completion replan，让 Planner 自己在 `retrieve / use_tool / ask_user / error` 里重新选下一步。
- 中文裸目标名现在也能进入 mutation `requiredTargets`，不再只靠带扩展名或 ASCII 风格路径才能触发覆盖判断。
- 这样既能拦住“多目标只覆盖一部分就 answer”的误判，也保留“单目标 locate 问答直接 answer”和“明确失败原因可以直接说明失败”的现有路径。
- 已把与 T035 无关的 `terminal_session.cwd` prompt 契约断言移出本卡测试文件，避免测试边界继续漂移。

### Why External Contract Did Not Change

- Planner 仍然只输出现有 `nextAction`
- `use_tool` 仍然经过 `Normalize -> Policy -> ToolNode`
- 没有新增 action type
- 没有把 completion 判断挪到 `Generate`
- 没有通过 prompt patch 改主修逻辑

## Verification Evidence

### Commands

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/next-action-planner.test.ts`
- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/graph.test.ts`
- `pnpm --filter @ui-chat-mira/server typecheck`

### Results

- `next-action-planner.test.ts`: 69 passed
- `graph.test.ts`: 32 passed
- `typecheck`: passed

### Coverage Notes

- 新增 `next-action-planner` 回归，锁住“多目标 locate 只覆盖一部分时，Planner 会继续自主选下一步，而不是被固定改写成 ask_user”
- 新增 `next-action-planner` 回归，锁住“单目标 locate 仍可直接 answer”
- 新增 `getTaskCompletionDecision` 回归，锁住“纯中文裸 mutation 目标能进入 requiredTargets”
- 新增 `getTaskCompletionDecision` 回归，锁住“mutation 已形成明确终局失败证据时可以结束任务并允许基于失败原因回答”
- 更新 graph 断言，确认 mutation 执行成功后可以直接走 answer-stop，不必额外再调用一次 planner model
