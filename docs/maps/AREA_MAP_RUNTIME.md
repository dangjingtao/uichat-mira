# 区域图：Runtime

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: wiki
Module: Develoments
Feature: RuntimeArchitecture
Doc Type: overview

## 入口文档

- [[architecture/README]]
- [[architecture/ipc-and-preload]]
- [[architecture/rag-node-development]]
- [[architecture/external-mcp-marketplace]]
- [[tooling-runtime/README]]
- [[architecture/api-response-spec]]
- [[architecture/model-config-api]]
- [[architecture/provider-proxy-api]]
- [[architecture/provider-api-standards]]

## 单点真相页

- [[architecture/README]]：运行时边界、请求契约、打包与运行时进程模型
- [[architecture/ipc-and-preload]]：renderer 和 native 的边界规则
- [[architecture/external-mcp-marketplace]]：外接 MCP 市场、外部 server 连接、权限与 harness 接入边界
- [[tooling-runtime/README]]：工具运行时总入口与协议分层
- [[architecture/api-response-spec]]：统一 API 响应 envelope
- [[architecture/model-config-api]]：模型配置相关接口契约
- [[architecture/provider-proxy-api]]：chat / embeddings 代理层公开协议

## 推荐先抓的主线

如果你是第一次读运行时这部分，建议先抓下面这条线：

1. 应用整体运行边界
2. renderer / preload / native 边界
3. API 返回契约
4. 工具运行时总入口
5. 外接 MCP 与扩展运行边界

## 相关概念

- [[CONCEPT_RUNTIME]]
- [[CONCEPT_MCP]]
- [[CONCEPT_PLATFORM]]

## 建议阅读路径

1. [[architecture/README]]
2. [[architecture/ipc-and-preload]]
3. [[architecture/api-response-spec]]
4. [[architecture/model-config-api]]
5. [[tooling-runtime/README]]
6. [[knowledge-system/FULL_MCP_AND_INDEX_ARCHITECTURE]]
7. [[architecture/external-mcp-marketplace]]
