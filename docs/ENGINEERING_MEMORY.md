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
  - harness/agentgraph-harness-protocol.md
  - harness/README.md
  - tooling-runtime/tools-protocol.md
  - skill/README.md
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
- 大规模多 Agent 编排；
- 并发工具执行主链；
- 长期记忆大系统；
- Harness 全面重写；
- 大型前端重设计。

## 2. 产品与工程定位

UIChat Mira 是本地优先、桌面优先、多 Provider 的个人 AI 工作台。

长期方向仍然包括 Chat、RAG、Agent、MCP、Skill 与微应用共存，但每项能力必须分别证明：

- 产品入口存在；
- 边界清楚；
- 失败语义明确；
- 有真实验证；
- 有回归保护。

## 3. Agent Runtime 当前真相

`AgentGraph` 是稳定运行时门面，不等于某个底层图框架。

应用默认主链是 Pi-style 滚动决策：

```text
AgentRun
  -> AgentGraph stable facade
  -> Pi Loop
  -> Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
```

LangGraph 可以保留为兼容、对照和回归路径，但不是默认主链。

## 4. Agent 主线不变量

必须保护：

1. Planner 只决定下一步，不直接执行工具；
2. Normalize 校验并冻结 `pendingToolCall`；
3. Policy 只审批冻结后的 exact invocation；
4. Tool 只执行 Policy 已决定的调用；
5. Tool / Retrieve 不直接写累计 Evidence；
6. Evidence 是累计证据的单一写入者；
7. 工具或检索完成后必须先进入 Evidence，再回 Planner；
8. capability intent 只影响候选暴露，不得绕过 frozen invocation；
9. 审批等待、terminal error、recovery exhausted 不得继续执行工具；
10. Generate 只依据已经进入 Evidence 的真实结果回答；
11. Evidence answerable 不等于用户任务已经完成。

完整协议见 [[harness/agentgraph-harness-protocol]]。

## 5. Planner 与完成判断

Planner 是 task-model 驱动的下一步决策器，不是静态步骤播放器。

它要持续区分：

- 当前证据是否能回答局部问题；
- 用户请求的全部目标是否已经完成；
- 下一步应该直接回答、继续读、调用工具、请求审批还是恢复失败。

计划列表是轻量任务方向，不是事实仓库。工具结果、Evidence、推理和自然语言答案不能塞进计划项代替运行时状态。

## 6. Approval 与恢复

审批授权绑定 exact invocation：

- `toolId`；
- `toolCallId`；
- `inputHash`。

命令、参数、cwd、env、timeout 或目标资源变化后，必须重新判断审批。

恢复必须从 checkpoint 和冻结调用继续，不得重新根据自然语言猜一套参数。

Recoverable 与 terminal 合同不重开：

- recoverable 失败可以继续恢复；
- 恢复预算耗尽后进入 guarded answer；
- terminal 失败不进入 Generate；
- 前端 finish reason 必须与 Graph 状态一致。

## 7. Harness 当前定位

Harness 是 Agent 的工具控制平面，不是 Agent 的大脑。

Harness 负责：

- capability / tool registry；
- ToolExposure；
- schema 与 metadata；
- risk / approval boundary；
- workspace boundary；
- invocation；
- external MCP projection；
- trace / audit；
- 结果到 `llmContent` 的统一投影。

Harness 不负责：

- 多步任务下一步决策；
- 用户目标完成判断；
- 最终自然语言回答；
- 用工具注册表替代 Planner。

## 8. Tool 体系

当前工具应保持少而清楚：

- Read：定位、打开、抽取、切片；
- Edit：受控写入与替换；
- Search：统一搜索入口；
- Terminal：受审批、工作区和运行时约束的进程能力。

不要重新把工具拆成几十个相互重叠的原子入口，也不要用正则堆叠代替稳定 schema 和运行时合同。

## 9. Skill 与 SubAgent

Skill 的基础真相是渐进式披露和动态上下文，不等于 Tool，也不要求每个 Skill 都拥有状态机。

SubAgent 用于边界清楚的工作包：

- Main Agent 保留目标、治理、审批、恢复、Evidence 和最终交付；
- forked Skill Agent 执行被委派的领域任务；
- Skill 私有运行时不能绕过 Harness；
- completed Artifact 应直接交回宿主，不让 Main Planner 无意义重做。

这仍然是受控工程能力，不是开放式多智能体自治平台。

## 10. CodeGraph 当前受控合同

Planner 只看见单一产品入口 `codebase_explore`。

原生 query / explore / affected 留在 wrapper 内部。候选结果不是最终 Evidence，必须经过原文读取验证后才能进入 Evidence。

降级链保持：

```text
CodeGraph
  -> scoped search_text
  -> workspace_inventory
  -> read_file_slice
```

## 11. 文档真相合同

文档站必须区分：

- 当前真相；
- 施工与验证；
- 方案与实验；
- 历史归档；
- 待核验。

无状态文档不能默认进入当前真相。YAML 与旧式头部必须得到一致解析。超过 90 天未核验的当前文档应显示过期提示。

## 12. 判断冲突

当文档互相冲突时：

1. 先看代码与真实验证；
2. 再看 current-contract / current-snapshot；
3. 再看本页；
4. 再看施工记录；
5. 最后才看设计、计划和历史资料。

任何施工线程都不能仅凭一段总结重开已经稳定的运行时合同。
