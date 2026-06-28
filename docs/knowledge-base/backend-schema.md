# 知识库后端 Schema

Status: Current
Owner: knowledge-base
Last verified: 2026-06-26
Layer: raw-source
Module: KnowledgeBase
Feature: BackendSchema
Doc Type: reference

## 范围

这份 schema 面向当前单知识库 MVP，同时给后续扩展留出空间，主要覆盖：

- 多知识库
- 多 embedding 模型
- embedding 维度变化后的向量索引重建
- 混合检索策略（FTS + vector）

相关文档：

- [[knowledge-base-api]]
