---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-11
layer: project-control
module: AgentRuntime
feature: ShadowDeciderRemoval
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
task_state: DONE
---

# Agent V1.5 T05：移除 Shadow Deciders、桥接器与 Action Rewrite

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

删除 Planner 前后所有会替 Planner 判断任务完成、选择具体工具、挑选路径或改写 `nextAction` 的影子决策器。结构错误可以拒绝，安全风险可以阻断，但任何节点都不能把 Planner 的语义 action 改成另一种 action。

## 前置依赖

- T03 已合并。
- T04 已合并。

## 重点检查文件

- `server/src/agent/planner/node.ts`
- Planner local intent guard 实现
- list→open / locate→open bridge 实现
- repeated action/tool guard 实现
- `server/src/agent/evidence.ts` 中为 guard 提供完成判断的 helper
- Normalize、graph routing 与 Planner tests

## 必须删除的行为

- `getPlannerAnswerStopDecision` 或同义强制 answer 逻辑；
- 根据 evidence `canAnswer` 在 Planner 调用前直接收尾；
- list→open 自动桥接；
- locate→open 自动挑路径；
- 本地关键词 intent guard 把 action 改为 `read_open/read_locate/read_list/error`；
- same tool + same args 后直接改写为 answer/blocked；
- Planner 输出后置“纠正”为另一工具或另一 action；
- 任何以 safety/guard 命名但实际做语义选择的 helper。

## 可以保留的行为

- JSON/schema 解析失败时返回结构错误；
- Normalize 对 exposure membership、plain object、path/schema 做拒绝；
- Policy 做权限/风险/审批判断；
- max-iteration、waiting approval、terminal error 的机械路由终止；
- 将历史调用 fingerprint、已有 evidence、错误与缺口作为事实提供给 Planner。

## 施工要求

1. Planner 模型成功输出的合法 `nextAction` 必须原样进入后续结构/策略检查。
2. 不允许 helper 返回一个与 Planner 不同的 toolId、args 或 action type。
3. 重复调用历史只能成为 Planner context 事实；是否重试、换参数、回答由 Planner 决定。
4. 路径候选只能作为 Evidence 事实；具体打开哪个路径由 Planner 决定。
5. 删除逻辑后同步删除死 trace、死 reason、死 tests，不得搬到 Evidence、Exposure 或 Read wrapper。
6. 保持 terminal/recoverable/waiting approval 的冻结路由不变。

## 明确不做

- 不在本卡重写 Planner prompt；T08 负责。
- 不在本卡重构 Evidence schema；T06 负责。
- 不在本卡合并 read tools；T07 负责。

## 验收标准

- [ ] Planner 调用前不存在基于 evidence 的强制 answer。
- [ ] Planner 调用后不存在 local-intent、bridge、repeat guard 的 action 改写。
- [ ] list/locate 结果不会自动触发 open。
- [ ] 相同 toolId+args 不会被 guard 自动改成 answer；历史会进入 Planner context。
- [ ] Normalize 对合法 action 只接受或拒绝，不替换。
- [ ] 未出现改名后的等价 shadow decider。
- [ ] 结构、安全和终态机械 guard 仍正常。

## 最小测试范围

- 单测：合法 Planner action 在 PlannerNode 返回值中保持 toolId/args/action type 不变。
- 单测：list/locate evidence 不触发自动 open。
- 单测：重复 fingerprint 只进入 context，不改写 action。
- 集成：Planner 选择 exposure 外工具被拒绝，不被替换。
- 回归：waiting approval、terminal error、max iterations 不继续执行。
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

- 2026-07-11 复审通过：Planner 前后不再存在 answer stop、coverage transition、local intent、list/locate bridge、重复调用 action rewrite 或 completion replan 逻辑。
- `getTaskCompletionDecision`、`buildAnswerCompletionReplanMessages`、`AgentTaskCompletionDecision` 及相关死代码已删除；旧 Shadow Decider 测试已删除或改写为新合同测试。
- T05 专项、Graph、tool-loop、blackbox、Normalize 共 5 个测试文件通过，73/73 通过。
- 新合同覆盖合法 Planner action 原样保留、list/locate 不自动 open、重复 fingerprint 不改写 action、Normalize 对暴露外工具拒绝且不替换。
- `git diff --check` 通过；server typecheck 仍受既有 `server/src/microapps/codegraph/index.ts:543` 阻断。
