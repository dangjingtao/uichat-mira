# Tool 运行时总览

Status: Current
Owner: runtime
Last verified: 2026-06-27
Layer: wiki
Module: Tool
Feature: Overview
Doc Type: overview
Canonical: true
Related:
  - harness-runtime-design.md
  - harness-assessment-2026-06-28.md
  - core-tool-matrix-review.md
  - core-tool-rectification-ledger.md
  - agent-runtime-t29-t33-ledger.md
  - project-map-design.md
  - context-builder-design.md
  - ../chat/agent-workspace-context-system.md
  - read-skill-design.md
  - tools-protocol.md
  - tools-ecosystem-research.md
  - tool-runtime-retrospective-2026-06-27.md
  - codegraph-managed-mcp-spike.md
  - codebase-understanding-consensus.md
  - codebase-engine-benchmark.md
  - codebase-engine-abstraction.md

## 单点真相范围

这页是当前 `Tool` 模块的总入口。

它主要回答：

- 当前项目里的 `Tool` 到底指什么
- `Harness Runtime`、`Read`、工具协议、工具调研各自承担什么角色
- 读工具运行时相关文档时，先从哪几篇开始最省脑子

它不替代细页本身，而是负责把当前有效阅读路径讲清楚。

## 推荐入口

1. `tools-protocol.md`
2. `harness-runtime-design.md`
3. `read-skill-design.md`
4. `terminal-capability-checklist.md`
5. `tools-ecosystem-research.md`
6. `codebase-understanding-consensus.md`
7. `codebase-engine-benchmark.md`
8. `codegraph-managed-mcp-spike.md`
9. `codebase-engine-abstraction.md`
10. `core-tool-matrix-review.md`
11. `core-tool-rectification-ledger.md`
12. `agent-runtime-t29-t33-ledger.md`
13. `project-map-design.md`
14. `context-builder-design.md`
15. `../chat/agent-workspace-context-system.md`

## 当前结构

### 总协议

- `tools-protocol.md`

这页负责定义当前有效的工具协议总览。

### 运行时控制平面

- `harness-runtime-design.md`
- `harness-assessment-2026-06-28.md`
- `project-map-design.md`
- `context-builder-design.md`
- `../chat/agent-workspace-context-system.md`

这页负责定义工具运行时的中心控制平面。

### 已落地的一等能力

- `read-skill-design.md`

当前最明确落地的一等能力是 `Read`。

### 工作中清单

- `terminal-capability-checklist.md`

这页承接当前仍在推进中的工具能力实施清单。

### 研究与复盘

- `tools-ecosystem-research.md`
- `tool-runtime-retrospective-2026-06-27.md`
- `core-tool-matrix-review.md`
- `core-tool-rectification-ledger.md`
- `agent-runtime-t29-t33-ledger.md`
- `codebase-understanding-consensus.md`
- `codebase-engine-benchmark.md`
- `codegraph-managed-mcp-spike.md`
- `codebase-engine-abstraction.md`

前者回答外部成熟方案与行业风向，后者回答这一轮工具运行时改造里踩过的坑与已经确认的边界，`core-tool-matrix-review.md` 负责从矩阵视角统一 `Read / Edit / Web Search / Terminal` 的语义、治理和 action profile 颗粒度，`core-tool-rectification-ledger.md` 负责按整改优先级推进执行项，`agent-runtime-t29-t33-ledger.md` 负责登记新一轮 `T29-T33` 任务包的标准命名、依赖和状态，`codebase-understanding-consensus.md` 负责记录代码库理解能力的阶段性共识和暂不实现边界，`codebase-engine-benchmark.md` 负责定义 CodeGraph、`codebase-memory-mcp`、Serena 进入实现前的真实仓库评测问题集和评分规则，`codegraph-managed-mcp-spike.md` 负责定义 CodeGraph 第一阶段推荐的 Managed MCP server 形态、Windows 部署边界、生命周期、telemetry 关闭和原文核验约束，`codebase-engine-abstraction.md` 负责收敛 provider 抽象、统一结果合同、第一阶段暴露面与降级策略。

## 当前结论

当前 `Tool` 模块已经有一条清晰主线：

- `tools-protocol.md` 是协议总纲
- `harness-runtime-design.md` 是运行时中枢
- `read-skill-design.md` 是第一批稳定落地能力
- `codebase-understanding-consensus.md` 是代码库理解能力进入实现前的共识边界
- `codebase-engine-benchmark.md` 是代码库理解候选引擎进入实现前的评测方案
- `codegraph-managed-mcp-spike.md` 是 CodeGraph 第一阶段接入前的托管形态与运行边界设计
- `codebase-engine-abstraction.md` 是多 provider 代码库理解层进入实现前的统一抽象与结果合同设计
- 其他工具域继续围绕这条主线扩展

## 可维护性判断

当前工具层已经进入**可维护但仍有少量遗留问题**的状态。

这意味着：

- 协议边界已经比早期清晰很多，`source`、`domain`、`McpExecutionEnvironment`、`McpStreamEvent` 都已经成为稳定约束
- 注册、执行、环境、UI surface 基本分层，新增能力不再需要从零拼一套链路
- 但仍有少量历史术语、文档口径和个别决策逻辑分散在不同层，后续还需要继续清理

现在可以继续稳定加能力，但前提是：

- 新工具必须先走协议和测试
- 不再把能力域、产品归属、审批策略混成一个字段
- 文档和实现必须同步更新，否则维护成本会再次回升

## 相关文档

- `../architecture/external-mcp-marketplace.md`
- `../prompt-manager-rules/README.md`
- `../role/tool-integration-checklist.md`
- `codebase-understanding-consensus.md`
- `codebase-engine-benchmark.md`
- `codebase-engine-abstraction.md`
