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
task_state: DONE
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

## Acceptance Evidence

- 代码改动：
  - `server/src/agent/planner/prompt.ts`
  - `server/src/agent/planner/parse.ts`
  - `server/src/agent/planner/action-types.ts`
  - `server/src/agent/planner/node.ts`
  - `server/src/agent/graph/routes.ts`
  - `server/src/agent/__tests__/next-action-planner.test.ts`
  - `server/src/agent/__tests__/graph.test.ts`
- 本轮完成：
  - planner prompt 明确接入失败恢复、换参数、换工具、`ask_user`、恢复预算与迭代预算规则
  - planner parse / allowed action contract 正式接受 `ask_user`
  - bounded replan prompt 不再只允许 `answer / retrieve / use_tool / error`
  - `pendingApproval` 存在时，planner 不再调用 task model、不再产出 `answer/error` 终局动作，只保留等待审批态
  - `routeAfterNextAction` 在 `pendingApproval` 仍存在时直接回 `approval`，不会把“planner 没出新动作”误收成错误终局
  - 恢复预算语义已统一为“超过 replan 上限才算 exhausted”；预算耗尽时会直接给出明确终局，不再继续 `use_tool`
  - 新增和更新单测，覆盖 `ask_user` 合法输出、主 prompt 推进规则、bounded replan 恢复规则、allowed action trace、pending approval 停住语义与 recovery exhausted 运行级行为
- 验证结果：
  - `pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/next-action-planner.test.ts`
  - 结果：`63 passed`
  - `pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/graph.test.ts`
  - 结果：`32 passed`
  - `pnpm check`
  - 结果：通过；本轮把 `pendingApproval` 分支改成“不产出 nextAction”后引入的 `server/src/agent/planner/node.ts` 类型合同缺陷已修复，`T024` 不再阻断仓库级 typecheck
