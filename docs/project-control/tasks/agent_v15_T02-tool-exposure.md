---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-11
layer: project-control
module: AgentRuntime
feature: ToolExposure
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: DONE
---

# Agent V1.5 T02：Tool Exposure 收敛

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

把工具选择前置层收敛为纯“可见工具集合构造”：符合安全与产品边界的工具数量不超过 20 时全部暴露给 Planner；超过 20 时才使用 embedding/rerank/tool-search 做候选召回。最终工具选择始终由 Planner 完成。

## 前置依赖

- T01 已合并。

## 重点检查文件

- `server/src/harness/exposure.ts`
- `server/src/harness/profiles/resolver.ts`
- `server/src/harness/tool-candidates.ts` 及相关 matcher/rerank 实现
- `server/src/agent/intent/node.ts`
- `server/src/agent/graph/build-graph.ts`
- `server/src/harness/exposure.test.ts`
- `server/src/harness/tool-candidates.test.ts`

## 合法的预过滤边界

可以保留：

- 工具是否注册、启用、可用；
- 外部 MCP 是否启用；
- sandbox/runtime 是否可用；
- workspace/root/产品 surface 限制；
- 安全元数据、审批元数据与 exposure 专用 schema；
- 明确的用户/产品配置禁用。

必须删除或退出 exposure 决策：

- greeting/casual/low-intent 判断；
- 基于自然语言关键词判断“这是 workspace 任务还是 web 任务”；
- 基于 command 关键词决定是否展示 terminal；
- rule score 直接替用户决定工具类别；
- top1 或固定 8 个工具的默认截断；
- 对候选工具作语义改名、替换或强制排序为最终选择。

## 施工要求

1. 先计算满足硬边界的 eligible tools。
2. `eligibleTools.length <= 20` 时，Planner 收到全部 eligible tools，不运行 embedding/rerank 语义筛选。
3. `eligibleTools.length > 20` 时，允许召回一个候选集合；候选集合只代表 exposure，不代表 selected tool。
4. Planner 必须看到每个候选工具的稳定 ID、清晰描述、输入 schema、风险/审批摘要。
5. 不得产生 `selectedToolIds`、top1 choice 或任何“推荐即决定”的状态。
6. 召回失败时应有保守、可解释的 exposure fallback，不得静默变成“无工具”。
7. 删除 exposure 层的自然语言 router 后，不得把相同逻辑搬进 PrepareContext、Normalize 或 Planner guard。
8. 保持 Harness 注册、策略、安全边界和外部工具启用逻辑不变。

## 明确不做

- 不删除 tool selector graph 节点；由 T03 处理。
- 不修改 read public surface；由 T07 处理。
- 不修改 Planner prompt；由 T08 处理。
- 不把全部工具无条件暴露，必须先经过硬安全/产品边界。

## 验收标准

- [ ] 20 个及以下 eligible tools 全量进入 Planner exposure。
- [ ] 21 个及以上才触发候选召回。
- [ ] exposure 输出中不存在 final selected tool / selectedToolIds。
- [ ] greeting、workspace/web、terminal keyword gate 不再影响 exposure。
- [ ] 禁用、不可用、越界、sandbox 缺失等硬边界仍有效。
- [ ] 召回失败有明确 fallback 与 trace，不会把可用工具误报为空。
- [ ] Planner 可从 exposure 中自行选择任一可见工具。

## 最小测试范围

- 单测：0、1、20、21、50 个 eligible tools 的 exposure 行为。
- 单测：硬边界过滤仍生效，语义关键词过滤已移除。
- 集成测试：超过 20 时召回只缩小可见集，不写 selectedToolIds。
- 回归测试：terminal/web/read 不因用户措辞缺少关键词而被语义隐藏。
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

## Review Evidence

- 施工线程复整改复审通过：T02 相关测试 3 个文件共 67/67 通过。
- `git diff --check` 通过。
- 移除 rule-based scoring 和默认 8 工具截断，召回结果不再受语义关键词影响。
- server typecheck 仍受既有 `server/src/microapps/codegraph/index.ts:543` 阻断，未发现本次整改新增的 typecheck 错误。
