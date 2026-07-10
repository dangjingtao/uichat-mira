---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-11
layer: project-control
module: AgentRuntime
feature: EvidenceBoundary
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: TODO
---

# Agent V1.5 T06：Evidence 单一职责与显式回流节点

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

建立显式 Evidence 阶段，统一接收 ToolNode、Retrieve 以及可恢复的策略/执行事实，生成忠实、可核验的 evidence；移除 Evidence 对整项任务完成度、用户意图和下一步的判断。执行完成后固定回到 Planner。

## 前置依赖

- T01 已合并。
- T05 已合并。

## 重点检查文件

- `server/src/agent/evidence.ts`
- `server/src/agent/graph/build-graph.ts`
- `server/src/agent/tool-node.ts` 或当前实现
- `server/src/agent/retrieve-node.ts` 或当前实现
- `server/src/agent/policy.ts` 或当前实现
- `server/src/agent/planner/node.ts`
- `server/src/agent/graph/state.ts`
- Evidence / graph / recoverable failure tests

## Evidence 允许表达的内容

- source：tool / retrieval / policy fact；
- actionTaken：实际执行或拒绝了什么；
- status：completed / failed / blocked / truncated 等既有事实状态；
- keyFacts / proven：结果直接证明的事实；
- missing / gaps：结果没有包含或无法证明的内容；
- error：真实错误、退出码、超时、拒绝原因；
- rawRef / artifactRef；
- truncated 与范围信息。

## Evidence 禁止表达的内容

- 整项用户任务已经完成；
- `canAnswer` / `answerReadiness` / shouldAnswer；
- 用户属于 directory/file/web/command 哪种 intent；
- 下一步应该调用哪个工具；
- 不需要再次调用某工具；
- 根据关键词匹配推导目标覆盖度；
- 强制 Planner answer/continue/error。

## 施工要求

1. Graph 中增加或恢复清晰可见的 Evidence 节点，而非在 ToolNode/Retrieve 内直接 append evidence。
2. ToolNode 只写真实工具执行结果；Retrieve 只写真实检索结果；Policy 只写 policy fact。
3. Evidence 是 `evidence` 的唯一 writer。
4. Tool completed、retrieve completed、recoverable failure 均经过 Evidence 后回 Planner。
5. waiting approval 停止，不得先伪造执行 evidence；terminal failure 按 C 合同终止；recovery 耗尽后由既有 guarded Generate 收口。
6. 删除 Evidence 中 directory/file/web/command 关键词表、token intent 判断和 answer stop helper。
7. 删除 Planner prompt 中对 `answerReadiness.canAnswer=true` 的强制 answer 合同。
8. Evidence summary 必须保持原始结果可追溯，不能用概括覆盖或丢弃 raw/artifact 引用。
9. 检索与工具结果可以统一进入 Evidence，但不得互相伪装为同一种 execution record。

## 明确不做

- 不在 Evidence 中实现 goal coverage。
- 不在本卡增强 Planner；由 T08 完成。
- 不新增额外 Observation/Completion/Decision 节点。
- 不改变 frozen C contract。

## 验收标准

- [ ] Graph 可明确核验 `ToolNode/Retrieve → Evidence → Planner`。
- [ ] `evidence` 只有 Evidence 节点写入。
- [ ] ToolNode、Retrieve、Policy 不再直接 append evidence。
- [ ] Evidence 不包含 `canAnswer/shouldAnswer/taskComplete/nextTool` 语义。
- [ ] Evidence 不使用用户意图关键词表决定结果是否够用。
- [ ] completed、truncated、recoverable failure 均能提供真实 facts/gaps/error 给 Planner。
- [ ] waiting approval、terminal failure、recovery exhausted 行为符合冻结合同。
- [ ] Generate 仍能在已有 evidence 时生成 grounded final answer。

## 最小测试范围

- 单测：Tool/Retrieve 各状态到 Evidence 的事实映射。
- 单测：Evidence 不产出完成度与 nextAction 字段。
- Graph 集成：tool/retrieve completed 与 recoverable failure 经过 Evidence 回 Planner。
- 回归：waiting approval 不继续；terminal failure 不进 Generate；recovery exhausted 进入 guarded Generate。
- 回归：truncated evidence 明确 gaps，不被自动判定 answer。
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
