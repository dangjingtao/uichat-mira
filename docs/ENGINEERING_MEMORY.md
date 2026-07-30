---
status: current
owner: project-owner
last_verified: 2026-07-30
layer: wiki
module: Project
feature: EngineeringMemory
doc_type: current-snapshot
canonical: true
related:
  - CURRENT_PRODUCT_TRUTH.md
  - AGENT_CURRENT_TRUTH.md
  - harness/agentgraph-harness-protocol.md
  - harness/README.md
  - skill/README.md
  - tooling-runtime/tools-protocol.md
  - project-control/project-control-ledger.md
---

# UIChat Mira 工程共同记忆

> 这页记录当前工程必须共同遵守的主线、合同和阶段边界。具体实现细节以代码、真实验证和链接到的 current-contract 为准。

## 1. 当前阶段

UIChat Mira 从 2026 年 8 月开始进入 **功能稳定迭代阶段**。

当前优先：

- 已有功能真实可用；
- 失败可诊断、可恢复、可停止；
- 回归测试覆盖关键合同；
- 前端状态与后台真实状态一致；
- 工具执行和 Evidence 可信；
- 文档与实现保持同一份真相；
- 新增能力小步、可验证、可回退。

当前不主动重开：

- Agent V2；
- DAG scheduler；
- 开放式多 Agent 编排；
- 并发工具执行主链；
- 长期记忆大系统；
- Harness 全面重写；
- 大型前端重设计。

## 2. 产品与工程定位

UIChat Mira 是本地优先、桌面优先、多 Provider 的个人 AI 工作台。

Chat、RAG、Agent、MCP、Skill、SubAgent 与微应用可以共存，但每项能力必须分别证明：

- 产品入口存在；
- 边界清楚；
- 失败语义明确；
- 有真实验证；
- 有回归保护；
- 文档没有把计划包装成现状。

## 3. Agent Runtime 当前真相

完整总真相见 [[AGENT_CURRENT_TRUTH]]。

`AgentGraph` 是稳定运行时门面，不等于底层图框架。

```text
AgentRun
  -> AgentGraph stable facade
  -> Pi Loop（应用默认）
  -> Main Planner
  -> direct action / governed delegation
  -> Evidence
  -> Planner or frozen delivery
  -> Generate
  -> Finalize
```

LangGraph 保留为显式兼容、历史测试和回归对照路径，不是应用默认主链。

## 4. 当前三类执行路径

### Main Agent direct

纯回答、检索或一个 concrete tool call 即可完成的简单动作由 Main Planner 直接处理。

### Generic delegation

边界明确、可独立验收的多步工作包可以通过 `delegate_task` 交给 Generic SubAgent。

- Child 拥有 task-local tool loop；
- Main Planner 保留 global goal 与最终验收；
- Child 不可再次委派；
- completed 后回 Main Planner。

### Skill-owned execution

任务型 primary Skill 可以把领域施工交给 Skill-owned SubAgent 或 deterministic Skill Flow。

- Parent 保留对话、审批、恢复、Evidence、终止与最终交付；
- Child 负责领域局部规划、工具循环、Runtime、Evidence 与 Artifact；
- completed 后冻结交付并直接 Generate，不让 Main Planner重做施工；
- needs_input 由 Parent 提问；
- recoverable 返回受限恢复面；
- terminal failure 不进入 Generate。

当前 SubAgent 是受控、单层、任务局部的执行所有权转移，不是多 Agent 自治平台。

## 5. Agent 主线不变量

必须保护：

1. Main Planner 维护完整用户目标和全局完成判断；
2. 普通 concrete tool 由 Normalize 冻结 `pendingToolCall`；
3. Policy 只审批冻结后的 exact invocation；
4. Tool 只执行与 Policy 一致的调用；
5. Tool / Retrieve / Child result 不直接改写累计 Evidence；
6. Evidence 是累计证据的单一写入者；
7. 工具、检索或 Child observation 必须先进入 Evidence；
8. capability match、ranking 与 `selectedToolId` 不得成为 invocation；
9. waiting approval、terminal error、recovery exhausted 不得继续执行工具；
10. Generate 只依据 frozen finalization packet 引用的真实 Evidence；
11. Evidence answerable 不等于用户 global goal completed；
12. Generic Child completed 不等于 global completed；
13. Skill-owned Child completed 不得被 Main Planner 无意义重做；
14. observability 不得成为第二控制平面。

## 6. Planner 与完成判断

Planner 是 task-model 驱动的下一步决策器，不是静态步骤播放器。

它持续区分：

- 当前证据能否解释局部问题；
- 用户请求是否整体完成；
- 剩余工作是否适合 direct tool；
- 是否应委派一个完整工作包；
- 是否需要用户输入、审批或恢复。

`planList` 是轻量方向，不是事实仓库。工具结果、Evidence、推理和回答不能塞进计划项代替状态。

Pi Loop 没有全局 iteration cap；局部 schema replan 与 recoverable failure 有预算。

## 7. Approval 与恢复

审批绑定：

- `toolId`；
- `toolCallId`；
- `inputHash`。

命令、参数、cwd、env、timeout 或目标资源变化后必须重新判断。

恢复必须使用 checkpoint 和 frozen invocation，不重新根据用户文字猜参数。

SubAgent approval 还必须保存 transcript checkpoint。旧批准不能变成可复用权限。

### Settled C contract

- recoverable 失败进入 Evidence 并可以恢复；
- 恢复耗尽后进入 guarded answer；
- Graph completed，Chat finish reason stop；
- terminal failure Graph failed，finish reason error；
- terminal failure 不进入 Generate。

### 当前 dev 已知漂移

截至 2026-07-30，Planner 在 recovery exhausted 时直接返回 `error`，导致 Graph failed 且跳过 Generate。

这是高优先级实现漂移，不是 C contract 改版。不得用当前错误行为覆盖 settled contract。

## 8. Harness 当前定位

Harness 是 concrete tool 的控制平面，不是 Agent 的大脑。

Harness 负责：

- capability / tool registry；
- ToolExposure；
- schema 与 metadata；
- risk / approval；
- workspace boundary；
- invocation；
- external MCP projection；
- trace / audit；
- result 到 `llmContent` 的投影。

Harness 不负责：

- Main global planning；
- Generic / Skill Child local planning；
- 用户目标完成判断；
- 最终回答。

`delegate_task` 属于 Agent Runtime，不是 Harness Tool；Child 的 concrete tools 仍必须受治理。

Skill-private Runtime 不暴露给 Main Planner，也不能绕过 Parent 治理。

## 9. Tool 体系

当前工具应保持少而清楚：

- Read：发现、打开、抽取、切片；
- Edit：受控写入与替换；
- Search：统一搜索入口；
- Terminal：受审批、工作区和 Runtime 约束的进程能力。

不要把工具重新拆成几十个重叠入口，也不要用正则堆叠代替 schema 与 Runtime contract。

## 10. Skill 与 SubAgent

Skill 本体是渐进式披露的领域能力包，不等于 Tool、权限或 Runtime。

必须分开：

- SkillContext；
- ExecutionProfile；
- ToolExposure；
- Runtime readiness；
- Policy / Approval。

Context-only Skill 可以只增强 Main Planner。

Task Skill 可以使用 forked SubAgent。Stateful Skill Flow 是可选确定性 controller，不是所有 Skill 的默认状态机。

V1 禁止 nested SubAgent 与 recursive `delegate_task`。

## 11. CodeGraph

Planner 只看见单一产品入口 `codebase_explore`。

原生 query / explore / affected 留在 wrapper 内。候选不是最终 Evidence，必须经过 workspace source verification。

```text
CodeGraph
  -> scoped search_text
  -> workspace_inventory
  -> read_file_slice
```

CodeGraph 是代码理解加速器，不是第二个 Planner。

## 12. 文档真相合同

文档站必须区分：

- 当前真相；
- 施工与验证；
- 方案与实验；
- 历史归档；
- 待核验。

当代码与 settled contract 冲突时，必须同时记录：

- 目标合同；
- 当前行为；
- 影响；
- 修复状态。

不能只选一边，让另一边消失。

## 13. 判断冲突

1. 当前代码与可重复验证；
2. [[AGENT_CURRENT_TRUTH]] 或对应 current-contract；
3. 本页；
4. 施工、测试与评审记录；
5. design / plan / POC；
6. historical / superseded。

任何施工线程都不能仅凭一段总结重开已经稳定的运行时合同。