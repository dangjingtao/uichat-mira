# Agent V1.5 T04：移除静态 Plan 层与 AgentPlan 运行时影响

## 项目与阶段

- 仓库：https://github.com/dangjingtao/uichat-mira
- 制卡核验基线：`main@0e7e4ab36ee22dbfa2384c770f71f298ddbf35d8`
- 阶段：UIChat Mira Agent V1.5 稳定化
- 目标主线：`Planner → Normalize → Policy → ToolNode / Retrieve → Evidence → Planner`

## 全局冻结边界

1. Planner 是唯一语义决策中心；模型侧结构化输出仍然只有 `nextAction`。
2. Normalize 只做工具暴露成员校验、参数/路径规范化、Schema 校验，并冻结 `pendingToolCall`；不得换工具、改意图或改写 action。
3. Policy 只审批或拒绝冻结后的 `pendingToolCall`；不得改工具、参数或任务意图。
4. ToolNode 只执行冻结后的调用并产出真实结果；Retrieve 只产出真实检索结果。
5. Evidence 只忠实整理执行事实，不判断整项任务是否完成，不选择下一工具。
6. 工具/检索完成后必须经过 Evidence，再回 Planner。等待审批、terminal error、max-iteration 终态不得继续执行工具。
7. `capabilityIntent.selectedToolIds` 不得进入执行链；`selectedToolId` 仅允许作为 legacy/UI/trace 派生兼容字段。
8. 不新增语义节点、任务模型 selector、关键词 router、Planner action rewrite guard、静态计划机或兼容补丁层。
9. 不讨论 Agent V2、DAG、多智能体、并发工具、长期记忆、Harness 大改、MCP 市场或前端重做。
10. 只做本卡范围；禁止“顺手优化宇宙”。


## 任务目标

移除当前无真实规划能力但仍占据 graph、state、prompt 和 trace 的静态 `planStep`。Agent V1.5 使用 Planner 每轮输出一个 `nextAction` 的递归闭环，不维护预先冻结的步骤列表。

## 前置依赖

- T01 已合并。
- 可与 T02 并行施工，但必须独立 PR。

## 重点检查文件

- `server/src/agent/graph/build-graph.ts`
- 当前 `planStep` 实现文件
- `server/src/agent/graph/state.ts`
- `server/src/agent/types.ts`
- `server/src/agent/planner/node.ts`
- Planner prompt builder 与 trace tests

## 施工要求

1. Graph 不再经过 `planStep`。
2. Planner prompt 不再注入 `state.plan`、AgentPlan steps 或静态完成约束。
3. `AgentPlan` 不得参与工具选择、停止判断、任务覆盖或 Generate。
4. 清理仅为静态 plan 服务的状态字段、node trace 和测试。
5. 若产品 trace 仍需展示“执行计划”概念，只能显示 Planner 当轮 nextAction 的可读解释，不得恢复静态步骤机。
6. 不新增 replacement plan node、Step DAG、todo manager 或 hidden plan state。
7. Planner 仍然一次只输出一个 nextAction，并在 Evidence 回流后重新决策。

## 明确不做

- 不改 Planner prompt 的完整内容策略；T08 负责正向增强。
- 不改 Evidence。
- 不改工具暴露。
- 不做前端 trace 重设计。

## 验收标准

- [ ] `planStep` 不再注册或进入 Agent graph runtime。
- [ ] Planner prompt 与决策代码不再读取 `state.plan` / AgentPlan。
- [ ] 不存在新的静态步骤表、DAG 或兼容 plan shadow state。
- [ ] 用户请求仍能直接进入 Planner 并产生 answer / ask_user / retrieve / use_tool。
- [ ] 旧 plan trace 不再误导为真实执行约束。
- [ ] 既有主线终态和 C 合同不受影响。

## 最小测试范围

- Graph 测试：首轮请求直接到 Planner，不出现 planStep。
- Planner 测试：即使 state 中注入 legacy plan，也不影响 nextAction。
- 回归：多轮 tool/evidence 回流不依赖 plan step index。
- typecheck。

## 完工交付物

施工完成后必须提交可核验材料：

1. commit SHA 与 `base..head` diff 范围；
2. 实际改动文件清单；
3. 行为变化摘要，逐条对应本卡验收标准；
4. 新增/修改测试源码路径；
5. 实际执行的测试命令、原始结果与 typecheck 结果；
6. 明确说明是否影响既有 Agent 主线黑盒；
7. 所有测试源码与报告均须为 git tracked files，不接受只贴口头摘要。
---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-11
layer: project-control
module: AgentRuntime
feature: StaticPlanRemoval
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: TODO
---
