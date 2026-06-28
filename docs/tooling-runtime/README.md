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
  - read-skill-design.md
  - tools-protocol.md
  - tools-ecosystem-research.md
  - tool-runtime-retrospective-2026-06-27.md

## 单点真相范围

这页是当前 `Tool` 模块的总入口。

它主要回答：

- 当前项目里的 `Tool` 到底指什么
- `Harness Runtime`、`Read`、工具协议、工具调研各自承担什么角色
- 读工具运行时相关文档时，先从哪几篇开始最省脑子

它不替代细页本身，而是负责把当前有效阅读路径收口。

## 推荐入口

1. `tools-protocol.md`
2. `harness-runtime-design.md`
3. `read-skill-design.md`
4. `terminal-capability-checklist.md`
5. `tools-ecosystem-research.md`

## 当前结构

### 总协议

- `tools-protocol.md`

这页负责定义当前有效的工具协议总览。

### 运行时控制平面

- `harness-runtime-design.md`

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

前者回答外部成熟方案与行业风向，后者回答这一轮工具运行时改造里踩过的坑与已经收回的边界。

## 当前结论

当前 `Tool` 模块已经有一条清晰主线：

- `tools-protocol.md` 是协议总纲
- `harness-runtime-design.md` 是运行时中枢
- `read-skill-design.md` 是第一批稳定落地能力
- 其他工具域继续围绕这条主线扩展

## 可维护性判断

当前工具层已经进入**可维护但未完全收口**的状态。

这意味着：

- 协议边界已经比早期清晰很多，`source`、`domain`、`McpExecutionEnvironment`、`McpStreamEvent` 都已经成为稳定约束
- 注册、执行、环境、UI surface 基本分层，新增能力不再需要从零拼一套链路
- 但仍有少量历史术语、文档口径和个别决策逻辑分散在不同层，后续还需要继续收口

现在可以继续稳定加能力，但前提是：

- 新工具必须先走协议和测试
- 不再把能力域、产品归属、审批策略混成一个字段
- 文档和实现必须同步收口，否则维护成本会再次回升

## 相关文档

- `../architecture/external-mcp-marketplace.md`
- `../prompt-manager-rules/README.md`
- `../role/tool-integration-checklist.md`
