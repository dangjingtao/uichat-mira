# 概念：MCP

Status: Current
Owner: docs
Last verified: 2026-06-25
Layer: wiki
Module: MCP
Feature: ExternalMarketplace
Doc Type: overview

## 含义

在这套文档里，`MCP` 指的是基于 Model Context Protocol 的能力接入面。

## 这页和 Tool 文档的关系

`MCP` 负责讲产品边界，`Tool` 负责讲运行时真相。

建议这样分工：

- `docs/architecture/external-mcp-marketplace.md` 讲第三方 MCP 的市场、安装、连接、投影与产品 surface
- `docs/tooling-runtime/README.md` 讲工具运行时总入口
- `docs/tooling-runtime/tools-protocol.md` 讲统一协议
- `docs/tooling-runtime/harness-runtime-design.md` 讲 harness 控制平面

也就是说：

- `MCP` 文档不要重复维护执行协议细节
- `Tool` 文档不要去写 marketplace 的产品策略
- 公共规则只在一处维护，另一处只引用
