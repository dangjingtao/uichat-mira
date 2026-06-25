# Concept MCP

Status: Current
Owner: docs
Last verified: 2026-06-25

## 含义

在这套文档里，`MCP` 指的是基于 Model Context Protocol 的能力接入面。

这里有意把几个产品层概念拆开：

- `Tool`
  - 指应用内部的一等执行能力
  - 即使底层实现使用了 MCP 风格 schema、invocation event 或 harness，也仍然是产品层概念
- `MCP`
  - 指非核心能力集成域
  - 包括外部 marketplace MCP server，以及未来可能存在的内置非核心 MCP package
- 协议层的 “MCP tools”
  - 不自动等于 UI 产品层里的 `Tools`

当前与 `MCP` 相关的方向有三条：

- 把本应用自己的知识系统暴露给 AI 客户端
- 在本应用内部消费第三方 marketplace MCP server
- 在 MCP 产品域下管理未来的内置非核心 MCP package，而不是把它们直接并入内部 Tools 页

其中第二条是运行时侧问题，边界见：

- `architecture/external-mcp-marketplace.md`

## 关键文档

- [[knowledge-system/FULL_MCP_AND_INDEX_ARCHITECTURE]]
- [[knowledge-system/MCP_RESOURCE_AND_TOOL_SCHEMA]]
- [[knowledge-system/VISUALIZATION_AND_AI_ACCESS]]
- [[architecture/external-mcp-marketplace]]
- [[maps/AREA_MAP_RUNTIME]]
- [[maps/AREA_MAP_KNOWLEDGE_BASE]]
