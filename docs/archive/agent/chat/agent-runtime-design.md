---
status: superseded
owner: planning / chat / runtime
last_verified: 2026-07-18
layer: historical-design
module: Chat
feature: AgentRuntime
Doc Type: historical-plan
canonical: false
superseded_by:
  - ../harness/agentgraph-harness-protocol.md
related:
  - ../development/agent-observability.md
  - concepts/CONCEPT_AGENT.md
---

# Agent Runtime Design（历史设计输入）

> 本页已经退役，不再描述当前运行时真相。

当前 authoritative 文档：

- [AgentGraph 与 Harness 当前协议](../harness/agentgraph-harness-protocol.md)
- [Agent Observability](../development/agent-observability.md)

## 为什么退役

本页形成于 2026-06-27，当时 Agent Runtime 仍处于设计阶段，主要判断包括：

- 应用主链以 LangGraph `StateGraph` 编排
- `plan / capabilityIntent / routeStep` 是主要执行骨架
- AgentRun、审批恢复、Evidence 回流和 Harness result grounding 尚待建设
- `terminal_session` 仍被视为受限的后续能力

这些判断已经被后续实现替代。

## 当前与本页不同的关键事实

当前代码已经是：

```text
AgentRun
  -> AgentGraph 稳定门面
  -> Pi Loop（应用默认）
  -> Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
```

并且已经成立：

- Pi Loop 是应用默认运行时。
- LangGraph 只保留为显式兼容与测试对照运行时。
- Planner 只输出 `nextAction`。
- Normalize 冻结 `pendingToolCall`。
- Policy 与 approval 绑定 exact `inputHash`。
- Tool / Retrieve 完成后必须进入 Evidence，再回 Planner。
- Approval resume 会恢复 checkpoint，并异步继续执行。
- Generate 会消费 bounded Harness `llmContent`，不再只看摘要。
- `terminal_session` 使用 Host Runtime，支持完整 Shell、PTY 和进程树管理。
- `selectedToolId` 只保留兼容语义，不是执行入口。

## 历史价值

本页原始版本仍可通过 Git 历史查看，用于理解：

- Agent Runtime 为什么从普通 chat tool loop 中独立出来
- `AgentRun` 为什么成为产品运行真相
- 为什么 UI 只负责显示、输入和审批，不负责编排
- 为什么 Harness 继续承担工具注册、执行和权限控制

但在评审、施工、架构说明和对外沟通中，不得再引用本页的 LangGraph-first 结构作为当前实现。
