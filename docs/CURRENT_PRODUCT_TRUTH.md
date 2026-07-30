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
  - AGENT_CURRENT_TRUTH.md
  - harness/agentgraph-harness-protocol.md
  - skill/README.md
  - knowledge-base/README.md
  - provider/README.md
---

# UIChat Mira 当前产品真相

> 这页只记录当前已经成立的产品事实、能力边界和阶段重点。愿景、POC、路线图和施工过程不能覆盖这里。

## 当前阶段

从 **2026 年 8 月**开始，UIChat Mira 进入功能稳定迭代阶段。

当前优先级：

1. 真实可用性与失败恢复；
2. 已有能力的回归测试；
3. 当前契约一致；
4. 可观测性、诊断与 Evidence；
5. 文档与实现保持同一份真相；
6. 小步、可验证、可回退的增量。

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
- 可选微应用与外部 Runtime。

## 当前已经成立的能力

### 桌面运行与发布

- Electron 与 Tauri 两条桌面路径并存；
- 主项目提供统一开发、构建、校验和发布脚本；
- 桌面端是当前主要产品形态。

### Chat 与 Provider

- 支持多 Provider；
- Provider / Model Gateway 是模型接入统一入口；
- Chat 是产品入口，但不是全部产品边界。

### Knowledge Base 与 Evaluation

- 知识库、RAG 与相关评测能力已经存在；
- 评测用于验证能力，不替代真实产品验收；
- 具体检索链、schema 和工作台以对应 current-contract 为准。

### Agent

完整事实见 [[AGENT_CURRENT_TRUTH]]。

当前已经成立：

- `AgentRun` 是产品运行真相；
- `AgentGraph` 是稳定门面；
- Pi Loop 是应用默认 Main Agent Runtime；
- LangGraph 是显式兼容与测试对照 Runtime；
- Main Planner 维护 global goal 与下一步；
- concrete tool 经过 Normalize / Policy / Harness / Evidence；
- bounded multi-step work package 可以通过 `delegate_task` 交给 Generic SubAgent；
- 任务型 Skill 可以把领域施工交给 Skill-owned SubAgent 或 deterministic Skill Flow；
- Parent 保留 approval、recovery、terminal contract 与最终交付；
- SubAgent 是单层、受控、task-local execution，不是开放式多 Agent 系统。

当前已知偏差：recoverable recovery exhausted 被 `dev` 实现为 terminal error，和 settled guarded-answer C contract 不一致；该问题尚未在本轮文档整理中修复。

### Harness / Tool / MCP

- Harness 是 concrete tool 的候选、边界、审批、执行、结果和审计控制平面；
- 工具体系按 Read、Edit、Search、Terminal 等受控能力组织；
- Mira 以 MCP Host 为主，external MCP 必须经过 Harness 治理；
- `delegate_task` 属于 Agent Runtime，不是普通 Harness Tool；
- Skill-private Runtime 不暴露给 Main Planner，也不能凭声明获得可用性。

### Skill

- Skill 是渐进式披露的领域能力包；
- SkillContext、ExecutionProfile、ToolExposure、Runtime readiness 与 Approval 是独立真相源；
- Context-only Skill 可以增强 Main Planner；
- Task Skill 可以使用 forked SubAgent；
- Stateful Skill Flow 是可选确定性 controller；
- V1 禁止 nested SubAgent 与 recursive delegation。

### 微应用

- 微应用框架与若干具体能力已经进入实现或试验；
- 每个微应用必须单独判断生命周期；
- `docs/microapp/` 中存在大量 design、POC 和 runtime notes，不能因为文档存在就推断为正式产品能力。

## 当前不能这样宣传

以下说法不属于当前真相：

- “Mira 已经是完整自主软件工厂”；
- “已经是成熟开放式多 Agent 平台”；
- “已经有 Agent V2、DAG scheduler 或并发 Agent 编排”；
- “所有 Skill 和 SubAgent 都可以获得任意工具”；
- “所有微应用和 POC 都已可用于生产”；
- “已经完成通用长期记忆系统”；
- “已经完成强隔离 Sandbox”；
- “手机端、服务器端和网页端已经是正式交付形态”；
- “所有模型都天然支持 vision、image、tool 等全部能力”；
- “文档里写过的计划就是产品承诺”。

## 稳定迭代的判断标准

一个功能只有同时满足以下条件，才适合进入当前真相：

- 有真实产品入口；
- 有明确边界与失败语义；
- 有代码锚点；
- 有可重复验证；
- 有回归保护；
- 文档写清已实现和尚未实现；
- 不依赖施工线程口头结论。

## 真相优先级

1. 当前代码与可重复验证；
2. current-contract / current-snapshot；
3. 工程共同记忆；
4. 正在施工的 checklist / workboard / ledger；
5. design / plan / research / POC；
6. historical / superseded / archive。

代码和 settled contract 冲突时，必须同时公开当前行为与目标合同，不能用其中一个偷偷抹掉另一个。

## 维护规则

- 产品能力变化时先更新对应 current-contract，再更新这页；
- 新功能验证前只能进入施工与验证或方案与实验；
- 当前文档超过 90 天未核验应显示过期；
- 无状态、无核验信息的文档进入待核验；
- 已知实现偏差必须写明影响与修复状态。