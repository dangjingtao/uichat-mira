# Agent V1.5 T03：移除 Planner 前置工具选择与 selectedToolIds 链路

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

从 Agent runtime 主线移除 `toolSelectStep`、`toolGuardStep`、task-model selector、`selectedToolIds` 和 capability-to-tool final mapping。Tool Exposure 只给 Planner 提供候选工具，Planner 直接输出 `nextAction.use_tool`。

## 前置依赖

- T01 已合并。
- T02 已合并。

## 重点检查文件

- `server/src/agent/graph/build-graph.ts`
- `server/src/agent/intent/node.ts`
- `server/src/agent/intent/task-capability-selector.ts`
- `server/src/agent/intent/embedding-capability-matcher.ts`
- `server/src/agent/types.ts`
- `server/src/agent/planner/node.ts`
- selector、intent、graph 与 black-box 相关测试

## 施工要求

1. runtime 路由中不再存在 Planner 前的语义工具 selector 或 guard。
2. embedding/rerank 仅能在 T02 的 exposure 场景中召回候选，不能产出 final choice。
3. 删除 `selectToolWithTaskModel(...)` 在 Agent 主线中的调用。
4. 删除 `resolveSelectedToolIds(...)`、`selectedToolIds`、`selectedCapabilityId(s)` 对执行链的影响。
5. `capabilityIntent` 可以保留为非执行诊断信息的前提是：不写 final tool、不改 exposure、不进入 Normalize/Policy/ToolNode；没有必要则直接移除 runtime 状态。
6. Planner 输出 `use_tool(toolId,args)` 后直接进入 Normalize；Normalize 只验证该 toolId 是否属于 exposure。
7. `selectedToolId` 仍只允许作为输出/trace 派生兼容字段。
8. 删除 selector 后不得新增“轻量 selector”“fallback selector”“intent bridge”补位。
9. 清理已经失去意义的测试、trace label、类型和状态字段；不得保留死代码假装兼容。

## 明确不做

- 不修改静态 planStep；由 T04 处理。
- 不删除 Planner 内部 shadow decider；由 T05 处理。
- 不修改 Evidence 语义；由 T06 处理。
- 不新增新 action type。

## 验收标准

- [ ] Graph runtime 不再调用 `toolSelectStep`、`toolGuardStep` 或 task-model selector。
- [ ] Planner 是唯一输出最终 toolId/args 的语义节点。
- [ ] `selectedToolIds`、capability-like ID 无法进入 Normalize、Policy 或 ToolNode。
- [ ] Planner 选择的工具只接受 exposure membership + schema/policy 检查，不被再次替换。
- [ ] selector 相关死状态、死 trace、死测试已清理或改为 exposure 测试。
- [ ] answer / ask_user / retrieve / use_tool 基本路由保持可用。

## 最小测试范围

- Graph 集成：PrepareContext/Exposure → Planner → Normalize，不经过 selector/guard。
- 回归：仅设置 `selectedToolIds` 或 `selectedToolId` 不能触发工具。
- 回归：Planner 选择 exposure 内非 top1 工具仍能进入 Normalize。
- 回归：Planner 选择 exposure 外工具被 Normalize 拒绝，而非替换成其他工具。
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
feature: PretoolSelectorRemoval
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: TODO
---
