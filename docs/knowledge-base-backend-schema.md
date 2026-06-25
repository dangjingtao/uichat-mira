# 知识库后端 Schema

Status: Current
Owner: knowledge-base
Last verified: 2026-06-25
Layer: raw-source
Module: knowledge-base
Doc Type: reference

## 范围

这份 schema 面向当前单知识库 MVP，同时给后续扩展留出空间，主要覆盖：

- 多知识库
- 多 embedding 模型
- embedding 维度变化后的向量索引重建
- 混合检索策略（FTS + vector）

相关文档：

- [[knowledge-base-api]]
- [[CONCEPT_KNOWLEDGE_BASE]]
- [[AREA_MAP_KNOWLEDGE_BASE]]

## 核心表

### `knowledge_bases`

知识库实体的单点真相表。

关键字段：

- `id`
- `name`
- `description`
- `status`
- `embedding_model_config_id`
- `chunking_config_json`
- `created_at`
- `updated_at`

## 当前原则

- schema 先保证当前本地 MVP 可运行
- 但不要把未来扩展空间直接焊死
- 表结构变化要和接口与导入流程一起看

## 相关文档

- `knowledge-base-api.md`
- `markdown-workspace-mode.md`
