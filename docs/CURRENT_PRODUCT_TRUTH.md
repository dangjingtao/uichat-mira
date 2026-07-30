---
status: current
owner: project-owner
last_verified: 2026-07-30
layer: wiki
module: Project
feature: ProductTruth
doc_type: current-snapshot
canonical: true
related:
  - ENGINEERING_MEMORY.md
  - harness/agentgraph-harness-protocol.md
  - skill/README.md
  - knowledge-base/README.md
  - provider/README.md
---

# UIChat Mira 当前产品真相

> 这页只记录当前已经成立的产品事实、能力边界和阶段重点。愿景、POC、路线图和施工过程不能覆盖这里。

## 当前阶段

从 **2026 年 8 月**开始，UIChat Mira 进入功能稳定迭代阶段。

当前优先级是：

1. 真实可用性与失败恢复；
2. 已有能力的回归测试；
3. 当前契约的一致性；
4. 可观测性、诊断与证据；
5. 文档与实现保持同一份真相；
6. 小步、可验证、可回退的增量改进。

这不等于停止开发，而是停止用新功能掩盖旧能力没有站稳的问题。

## 产品定位

UIChat Mira 是一个 **本地优先、桌面优先、多 Provider 的个人 AI 工作台**。

产品主线不是 OpenAI-only，也不是单一聊天壳。当前工程同时容纳：

- Chat；
- Provider / Model Gateway；
- Knowledge Base / RAG；
- Evaluation；
- Agent；
- Harness 与工具执行；
- MCP Host；
- Skill / SubAgent；
- 可选微应用与外部运行时。

## 当前已经成立的能力

### 桌面运行与发布

- Electron 与 Tauri 两条桌面路径并存；
- 主项目提供统一的开发、构建、校验与发布脚本；
- 桌面端是当前主要产品形态。

### Chat 与 Provider

- 支持多 Provider，而不是绑定单一模型供应商；
- Provider / Model Gateway 已经成为模型接入的统一入口；
- Chat 是产品入口，但不是全部产品边界。

### Knowledge Base 与 Evaluation

- 知识库、检索增强生成与相关评测能力已经存在；
- 评测用于验证真实能力，不用于替代真实产品验收；
- 具体检索链、schema 和评测工作台以对应 current-contract 为准。

### Agent 与 Harness

- Agent 采用滚动决策与 Evidence 驱动的执行闭环；
- Harness 是工具控制平面，负责暴露、schema、审批、边界、执行、审计与结果投影；
- Planner 负责下一步决策，Harness 不负责替代 Planner；
- 工具结果必须进入 Evidence，最终回答不能依据想象补齐执行结果；
- 审批、恢复、终止和可观察状态已经属于当前运行时合同。

### Tool / MCP / Skill

- 当前工具体系按 Read、Edit、Search、Terminal 等受控能力组织；
- Mira 以 MCP Host 为主，外部 MCP 能力必须经过 Harness 治理；
- Skill 已经形成渐进式披露与动态上下文能力；
- SubAgent / forked Skill Agent 已经进入工程运行时，但它不是“无限自治的多智能体平台”。

### 微应用

- 微应用框架与若干具体能力已经进入实现或试验；
- 每个微应用必须单独判断当前状态；
- `docs/microapp/` 中存在大量设计、POC 和运行记录，不能因为文档存在就推断为正式产品能力。

## 当前不能这样宣传

以下说法不属于当前真相：

- “Mira 已经是完整的自主软件工厂”；
- “所有微应用和 POC 都已经可用于生产”；
- “已经完成通用长期记忆系统”；
- “已经完成强隔离 Sandbox”；
- “已经具备成熟的 Agent V2、多 Agent 调度或 DAG scheduler”；
- “手机端、服务器端和网页端已经是正式交付形态”；
- “所有模型都天然支持 vision、image、tool 等全部能力”；
- “文档里写过的计划就是产品承诺”。

这些方向可以继续研究，但必须留在“方案与实验”区，直到代码、验证和产品入口共同成立。

## 稳定迭代的判断标准

一个功能只有同时满足以下条件，才适合进入“当前真相”：

- 有真实产品入口；
- 有明确边界与失败语义；
- 有代码锚点；
- 有可重复验证；
- 有回归保护；
- 文档写明已经实现和尚未实现的部分；
- 不依赖某个施工线程的口头结论。

## 真相优先级

发生冲突时，按以下顺序判断：

1. 当前代码与可重复验证证据；
2. `current-contract` / `current-snapshot` 且核验日期有效的文档；
3. 工程共同记忆；
4. 正在施工的 checklist、workboard、ledger；
5. design、plan、research、POC；
6. historical、superseded、archive。

历史资料可以解释“为什么走到这里”，不能重新定义“现在是什么”。

## 维护规则

- 产品能力发生变化时，先更新对应 current-contract，再更新这页；
- 新功能在验证前只能进入“施工与验证”或“方案与实验”；
- 当前文档超过 90 天未核验，站点应标记为过期；
- 无状态、无核验信息的文档进入“待核验”，不得自动出现在当前真相入口。
