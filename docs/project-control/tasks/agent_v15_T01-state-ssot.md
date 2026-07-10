# Agent V1.5 T01：State 单一事实源与字段所有权

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

建立并落实 Agent 运行态的字段所有权，先消除当前多节点重复写入、兼容字段反向参与决策和同义状态并存的问题。后续各卡只能在本卡所有权合同内施工。

## 前置依赖

无。此卡必须最先合并。

## 重点检查文件

- `server/src/agent/graph/state.ts`
- `server/src/agent/types.ts`
- `server/src/agent/node-runtime.ts`
- `server/src/agent/planner/node.ts`
- `server/src/agent/tool-call-normalize.ts` 或当前 Normalize 实现文件
- `server/src/agent/policy.ts` 或当前 Policy 实现文件
- `server/src/agent/tool-node.ts` 或当前 ToolNode 实现文件
- `server/src/agent/retrieve-node.ts` 或当前 Retrieve 实现文件
- Agent graph 输出映射与相关测试

施工前先以当前主线确认真实路径，不得因路径变化扩大范围。

## 最终所有权合同

| 状态/事实 | 唯一语义 owner | 约束 |
|---|---|---|
| Planner 可见工具集合 / `toolExposure` | Tool Exposure 构造入口 | 其他节点只读，不得再次筛选或改写 |
| `nextAction` | Planner | 其他节点只能执行、拒绝或报告结构错误，不得生成替代 action |
| `currentTaskFrame` / goal completion | Planner | PrepareContext 可做无语义初始化；其他节点不得更新任务完成度 |
| `pendingToolCall` | Normalize | toolId、args、inputHash 一经冻结，Policy/ToolNode 不得替换 |
| `policyDecision` / `pendingApproval` | Policy | ToolNode 不得创建或改写审批语义 |
| 工具执行结果 | ToolNode | Policy 不得伪造 completed/failed execution；Retrieve 不得覆盖工具结果 |
| 检索执行结果 | Retrieve | 与工具结果分离，不能复用 `lastToolExecution` 冒充 |
| `evidence` | Evidence | 本卡冻结 owner；具体迁移与语义收敛由 T06 完成 |
| `selectedToolId` | 输出层派生兼容 | 不得作为 Agent 内部决策输入，不得由 Planner/Policy/ToolNode写入 |

## 施工要求

1. 在代码中形成可执行的 owner 边界，不得只新增一份说明文档。
2. 清理 `selectedToolId` 在运行态的写入和读取；仅允许输出层从真实执行记录派生兼容值。
3. `currentTaskFrame` 只能由 PlannerNode 更新；ToolNode、Retrieve、Evidence、Policy 不得追加“完成度”或“下一步”。
4. `pendingToolCall` 的 toolId、args、inputHash 只能由 Normalize 创建/更新。下游可以读取和标记消费结果，但不得重建或替换调用。
5. `policyDecision` 与 `pendingApproval` 只能由 Policy 创建/更新；ToolNode 只验证已批准事实。
6. Policy 不得写入或伪造工具执行结果。
7. 不得通过新增一组同义字段规避迁移，例如同时保留 `selectedToolId`、`chosenToolId`、`resolvedToolId` 作为决策源。
8. 对 T06 才会完成的 Evidence 写入迁移，必须在本卡明确冻结接口和唯一 owner；不得继续新增直接 `evidence.push/append` 写点。
9. 不得改变 C 合同：recoverable failure 与 terminal failure 的终态语义保持不变。

## 明确不做

- 不在本卡新增 Evidence 语义或完成度判断。
- 不修改工具暴露算法。
- 不删除 selector、planStep 或 Planner guard；这些由后续卡处理。
- 不做大规模类型重命名和目录重构。

## 验收标准

- [ ] 存在一份与代码一致的字段 owner 表，并能从实现中逐项核验。
- [ ] `selectedToolId` 不再进入执行或 Planner 决策，只在输出/trace 兼容层派生。
- [ ] `currentTaskFrame` 不再由 ToolNode、Retrieve、Policy、Evidence 写入。
- [ ] `pendingToolCall` 的 toolId/args/inputHash 只有 Normalize 能写。
- [ ] `pendingApproval` 与 `policyDecision` 只有 Policy 能写。
- [ ] Policy 不再制造工具执行结果。
- [ ] 未新增任何同义状态或影子 owner。
- [ ] 现有 mainline 测试通过，且 owner 约束有专属测试。

## 最小测试范围

- 单测：各 owner 节点的写入合同。
- 集成测试：Planner → Normalize → Policy → ToolNode 中 frozen call 不被改写。
- 回归测试：`selectedToolId` 无法绕过 `nextAction.use_tool` 进入执行。
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
feature: StateOwnership
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: TODO
---
