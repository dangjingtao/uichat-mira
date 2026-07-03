# Harness 模块

Status: Current
Owner: runtime
Last verified: 2026-07-03
Layer: wiki
Module: Harness
Feature: Overview
Doc Type: overview
Canonical: true
Related:
  - harness-assessment-2026-06-28.md
  - harness-phase-1-implementation-checklist.md
  - harness-gap-review-checklist.md
  - sandbox-module.md
  - agentgraph-harness-protocol.md

## 单点真相范围

这页是当前 `Harness` 模块的入口。

它主要回答：

- Harness 负责什么
- 风控边界怎么理解
- 为什么沙箱比单纯加严审批更合适

## 推荐入口

1. `harness-assessment-2026-06-28.md`
2. `harness-phase-1-implementation-checklist.md`
3. `harness-gap-review-checklist.md`
4. `sandbox-module.md`
5. `agentgraph-harness-protocol.md`

## 当前结论

当前 Harness 的定位不是“全局审批机”，也不是“全局编排层”，而是：

- 候选工具暴露治理层
- 语义能力匹配层
- 风险与边界判定层
- invocation 执行与审计主链

当前明确不上收给 Harness 的职责：

- 多步工具编排
- 最终选择哪一个 toolId 作为本轮执行
- args 生成
- 对话推进与结果叙述

这些职责应继续上抛给编排层或 Agent 层。

## 当前契约分层

当前文档与代码统一按三层理解：

- `CapabilityMatch`
  - Harness 内部语义匹配结果
  - 例如：`workspace_lookup`
- `ToolExposure`
  - 当前轮真正暴露给 LLM 的候选工具面
  - 例如：`read_list`、`read_locate`
- `Invocation`
  - 真正执行的具体工具调用
  - 例如：`executeHarnessInvocation({ toolId: "read_list", ... })`

这三层不能混。

尤其要注意：

- `preferredToolId` 只是 hint
- 它可以参与排序、展示顺序、trace 解释
- 它不能直接等于 executed tool
- capability id 不能直接传给 invocation 层
- Agent 内部如果要从能力走到执行，必须先显式产出 `invocationCandidateToolIds`
- `pendingToolCall` 只能从明确的 `toolId` 候选生成，不能从 capability match 直接生成

## 当前代码真相

截至当前版本，Harness 已新增一条更明确的候选解析入口：

- `resolveHarnessToolCandidatesForTurn(...)`

其输出语义是：

- `toolCandidates`
- `toolExposure.exposedToolIds`
- `toolExposure.exposedDefinitions`

这里要明确一条边界：

- Harness 可以继续在内部使用 capability profile / capability match 做筛选、解释和风控
- 但对 Agent 编排层上抛的，不再是 `selectedCapabilityIds`、`capabilityId`、`capabilityMatch`
- Agent 只消费：
  - `toolCandidates`
  - `toolExposure`
  - `selectedToolIds`
  - `candidateToolIds`

当前 Agent 侧也已按同一边界调整：

- `toolSelectNode` 只产出工具级候选和 `selectedToolIds`
- `toolGuardNode` 只保留通过本地守卫后的 `candidateToolIds`
- `policyNode` 只能基于明确 `toolId` 的 `pendingToolCall` 进入审批和执行

这意味着：

- AgentGraph 不再维护伪造的 capability 选择状态
- `pendingToolCall` 只能从明确 `toolId` 候选生成，不能从 capability match 直接生成
- trace 与运行态状态机现在也统一按 tool 语义表达

同时，外层越界的 `web_search` 预取已删除。

也就是说：

- 外层 route 不再在进入主回答前自行执行 `web_search`
- `web_search` 是否可见，应该由 Harness 工具暴露治理决定
- 真正执行工具时，仍必须走 `executeHarnessInvocation({ toolId })`

## 本轮结论

这次改动不是字段重命名，而是职责边界重定：

- Harness 负责根据语境筛选能力，再投影成当前轮的工具候选面
- Agent 负责编排、守卫、审批和执行，但它的状态模型只保留 tool 语义
- capability 现在是 Harness 内部治理模型，不再是 Agent 运行态协议的一部分

当前剩余风险：

- 文档与代码已经去掉 `selectedCapabilityId`，但已有本地数据库如果保留历史列，只是结构遗留，不影响当前运行
- `CapabilityMatch` 仍然是 Harness 内部实现概念，后续如果要继续对外暴露诊断信息，需要单独定义只读诊断协议，不能再混回 Agent 主状态
