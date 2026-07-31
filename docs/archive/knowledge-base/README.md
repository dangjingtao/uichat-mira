---
status: archived
owner: docs / knowledge-base
last_verified: 2026-07-31
layer: historical
module: KnowledgeBase
feature: KnowledgeBaseArchive
doc_type: archive
canonical: true
related:
  - ../../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - ../../knowledge-base/README.md
  - ../README.md
---

# Knowledge Base 历史归档

> 这里保存 Knowledge Base 从单知识库 MVP、薄 API 索引和 Markdown Workspace 设计，演进到当前多知识库与混合 RAG Runtime 的历史资料。它们解释过去，不定义当前代码。

## 当前真相入口

1. [[KNOWLEDGE_BASE_CURRENT_TRUTH]]：Knowledge Base 当前总真相；
2. [[knowledge-base/README]]：模块入口；
3. [[knowledge-base/api]]：当前 HTTP 合同；
4. [[knowledge-base/backend-schema]]：当前数据合同；
5. [[knowledge-base/rag-runtime]]：当前 RAG Runtime。

## 本次保存的历史快照

### `knowledge-base-overview-20260626.md`

原 `docs/knowledge-base/README.md`。

它只提供 API、Schema、Markdown Workspace 三个链接，没有描述当前多知识库、入库队列、混合检索、Rerank、Chat / Agent / Integration 接入和实现偏差。

### `knowledge-base-api-20260626.md`

原 `docs/knowledge-base/api.md`。

它是一份早期 API shell，只声明路由分组和页面状态归属，无法作为当前 CRUD、Multipart、Preview 和 status 合同。

### `knowledge-base-backend-schema-20260626.md`

原 `docs/knowledge-base/backend-schema.md`。

它仍把当前 Schema 描述为“单知识库 MVP”，并把混合检索和多 Embedding 模型写成扩展空间。当前代码已经支持多知识库、动态 vec0 表和混合召回，但 per-KB Embedding 绑定仍未真正生效。

### `markdown-workspace-mode-20260626.md`

原 `docs/knowledge-base/markdown-workspace-mode.md`。

它是一项值得保留的产品设计判断，但没有真实 Runtime、产品入口或 current contract。原路径现在只保留兼容退役页。

## 为什么保留原路径

API、Schema 和总入口继续承担当前文档职责，因此原路径已被重写为现行合同。

Markdown Workspace 被历史任务和搜索结果引用，因此原路径保留一个：

```text
status: superseded
layer: historical
canonical: false
```

的兼容入口。

## 本次没有归档

- 当前 Knowledge Base 产品页面；
- 当前 Add Wizard 和 Detail 页面；
- 当前 route / service / splitter / vector store；
- 当前 RAG Graph 和 node；
- Evaluation 当前文档；
- Agent 与 Integration 当前接入；
- 活跃测试、缺陷和施工记录。

## 阅读规则

历史资料可以回答：

- 为什么早期称为单知识库 MVP；
- Markdown Workspace 为什么曾被考虑；
- 多知识库和混合检索是怎样演进的。

历史资料不能回答：

- 当前上传支持什么格式；
- 当前索引是否持久；
- 当前主词法 Runtime 是 FTS5 还是 Orama；
- Rerank 失败怎样降级；
- Agent retrieve 当前实际调用哪条 runnable；
- 当前用户如何修复 Embedding 维度不匹配。