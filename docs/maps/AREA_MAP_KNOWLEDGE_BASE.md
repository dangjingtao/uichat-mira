# 区域图：Knowledge Base

Layer: wiki
Module: knowledge-base
Doc Type: overview

Status: Current
Owner: docs
Last verified: 2026-06-24

## 入口文档

- [[knowledge-base-api]]
- [[knowledge-base-backend-schema]]
- [[markdown-workspace-mode]]
- [[knowledge-system/KNOWLEDGE_SYSTEM_FULL_PLAN]]
- [[knowledge-system/INDEX_SCHEMA]]

## 单点真相页

- [[knowledge-base-api]]：知识库接口分组、Swagger 暴露面和 Settings 页面边界
- [[knowledge-base-backend-schema]]：知识库后端实体、表结构和索引生命周期
- [[markdown-workspace-mode]]：Markdown 工作空间模式的产品边界与 MVP 收敛

## 相关概念

- [[CONCEPT_KNOWLEDGE_BASE]]
- [[CONCEPT_MCP]]
- [[CONCEPT_RUNTIME]]

## 先分清两条线

这个区域最容易混淆的是两条不同主线：

1. 正式知识库功能  
   上传、文档管理、分块、索引、检索、RAG 相关接口与数据结构。
2. Markdown 工作空间模式  
   不入库、不做 embedding，直接对一组 Markdown 文档做轻量检索、整理和验证。

这两条线相关，但不是同一个系统。

## 建议阅读路径

1. [[knowledge-base-api]]
2. [[knowledge-base-backend-schema]]
3. [[markdown-workspace-mode]]
4. [[knowledge-system/KNOWLEDGE_SYSTEM_FULL_PLAN]]
5. [[knowledge-system/INDEX_SCHEMA]]
