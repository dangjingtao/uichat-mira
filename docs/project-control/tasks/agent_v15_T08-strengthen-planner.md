# Agent V1.5 T08：Planner 正向决策能力强化

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

在前置 selector、shadow decider、Evidence completion logic 和复杂 Read 工具面清理后，正向增强 Planner 的输入与决策合同，使其能基于用户完整目标、相关历史、工具合同、结构化任务状态及最新 facts/gaps/error 自主决定 answer、ask_user、retrieve 或 use_tool。

## 前置依赖

- T05 已合并。
- T06 已合并。
- T07 已合并。
- 此卡最后合并。

## 重点检查文件

- `server/src/agent/planner/node.ts`
- Planner prompt builder / context builder
- `server/src/agent/graph/state.ts`
- `server/src/agent/types.ts`
- relevant conversation history 组装入口
- `server/src/agent/__tests__/next-action-planner.test.ts`
- Agent graph black-box / loop regression tests

## Planner 必须获得的输入

1. 当前用户请求及与当前任务相关的有限历史，不是只给最后一句，也不是塞入完整无限会话。
2. T02/T07 生成的 Planner-visible tools：稳定 ID、互斥描述、input schema、风险/审批摘要。
3. `currentTaskFrame`：当前目标、已确认对象、未覆盖目标、阻塞点、恢复次数/完成判据。该状态只由 PlannerNode 维护。
4. 最新 Evidence：actionTaken、facts/proven、missing/gaps、error、truncated、raw/artifact refs。
5. 最近调用事实：toolId、normalized args/inputHash、结果状态；只作事实，不作强制 guard。
6. iteration/maxIterations、pending approval、terminal/recoverable 状态。

## Planner 决策原则

- 先判断完整用户目标是否已覆盖，再决定 answer；“某条 evidence 可解释”不等于“整项任务已完成”。
- 部分覆盖时继续选择最有信息增益的下一动作。
- 目标或必要参数确实无法从已有上下文推断时才 ask_user。
- recoverable failure 后可以换参数、换可见工具、读取辅助信息或基于失败事实回答；不得假装成功。
- 选择工具时只从当前 exposure 中选择，并输出准确 args。
- 相同调用已经完成且没有新 gap 时，通常应复用 evidence；但该判断由 Planner 完成，不由 guard 改写。
- evidence truncated 或 missing 明确时，不得仅因存在结果就 answer。
- answer 必须基于已有 evidence；没有证据时不得编造工具结果。
- waiting approval、terminal error、max-iteration 终态遵守冻结路由。

## 输出合同

1. 模型结构化输出仍只有一个 `nextAction`；不新增第二个 selector 输出或 completion verdict 节点。
2. 保持既有 action 类型集合；不得为了本卡新增大量 action type。
3. PlannerNode 可以维护自身 `currentTaskFrame`，但不得把该状态交给其他节点决定或写入。
4. 任何 parser/validator 只能拒绝非法输出，不能生成替代语义 action。

## 施工要求

1. 将 task selector 过去独占的“最近若干消息”能力迁入 Planner 的 relevant history 组装，但不得恢复 selector。
2. 去掉对 `answerReadiness.canAnswer`、static plan、selectedToolIds 的依赖。
3. 工具描述必须与 T07 public contract 对齐，避免 read tools 重叠。
4. Prompt 中明确“evidence 是事实，不是完成命令”。
5. 不通过堆叠大量硬编码例外来提高测试通过率。
6. 不要求模型暴露 chain-of-thought；只需输出既有结构化 nextAction 与可审计 reason（若现有合同已有 reason）。

## 明确不做

- 不新增 Planner 之外的决策模型。
- 不新增静态 plan、goal-coverage node、regex completion engine。
- 不修改 Harness 大架构。
- 不增加大规模黑盒套件；只补本卡必要主线场景。

## 验收标准

- [ ] Planner 能看到相关历史、public tools、currentTaskFrame、latest evidence facts/gaps/error。
- [ ] 不再读取 static plan、selectedToolIds、Evidence canAnswer。
- [ ] 简单单目标在证据充分后 answer。
- [ ] 多目标请求只完成一部分时不会提前 answer。
- [ ] truncated/missing evidence 会触发合理 continue/ask_user，而非机械收口。
- [ ] recoverable failure 可继续推进，恢复耗尽按 C 合同收口。
- [ ] 相同调用历史不会被外部 guard 改写，Planner 能基于事实避免无意义重复。
- [ ] Planner 选择 public read tools 时能区分 discover 与 open。
- [ ] 最终回答有 evidence grounding，不编造执行事实。

## 最小测试范围

- Planner 单测：简单单目标已覆盖 → answer。
- Planner 单测：多目标仅部分覆盖 → continue/use_tool/retrieve，而非 answer。
- Planner 单测：truncated + explicit gap → 不提前 answer。
- Planner 单测：recoverable failure → 合理恢复；恢复耗尽 → guarded answer。
- Planner 单测：相关历史影响工具参数；无关历史被裁剪。
- Graph 集成：discover → Evidence → Planner → open → Evidence → Planner → answer。
- Graph 集成：相同 tool/args 已有有效 evidence，Planner 不产生无意义循环。
- 现有核心黑盒最小回归与 typecheck。

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
feature: PlannerStrengthening
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: TODO
---
