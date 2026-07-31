---
status: current
owner: knowledge-base / docs
last_verified: 2026-07-31
layer: wiki
module: KnowledgeBase
feature: Overview
doc_type: overview
canonical: true
related:
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - api.md
  - backend-schema.md
  - rag-runtime.md
  - ../PROVIDER_CURRENT_TRUTH.md
  - ../evaluation/README.md
  - ../archive/knowledge-base/README.md
---

# Knowledge Base 模块入口

> 这页是 Knowledge Base、索引和 RAG 的阅读入口。当前总真相以 [[KNOWLEDGE_BASE_CURRENT_TRUTH]] 为准。

## 先读这里

1. [[KNOWLEDGE_BASE_CURRENT_TRUTH]]：产品入口、入库、索引、检索、RAG、接入和已知偏差；
2. [[knowledge-base/api]]：当前 HTTP 路由与状态语义；
3. [[knowledge-base/backend-schema]]：SQLite、Chunk、FTS 与 vec0 数据边界；
4. [[knowledge-base/rag-runtime]]：rewrite、Embedding、混合检索、Rerank、Generate 与 Observation；
5. [[PROVIDER_CURRENT_TRUTH]]：Embedding / Rerank / LLM 的 Provider 解析；
6. [[evaluation/README]]：独立评测模块入口。

## 当前模块边界

```text
Knowledge Base
!= RAG Graph
!= Evaluation
!= Markdown Workspace
!= Long-term Memory
!= Integration knowledge_query
```

- Knowledge Base 持有知识库、文档、Chunk 与索引；
- RAG Graph 消费知识库索引并组织查询链；
- Evaluation 使用知识库和 RAG 结果做验证；
- Markdown Workspace 是历史设计方向，不是当前正式知识库 Runtime；
- `knowledge_query` 是企业集成 MicroApp 对 RAG 的调用入口；
- Agent retrieve 是 Agent Runtime 对 RAG 的接入路径。

## 当前产品入口

```text
/settings/knowledge-base
/settings/knowledge-base/add
/settings/knowledge-base/detail
```

当前工作台支持多知识库、单文件 Markdown/TXT 上传、Chunk 预览、异步索引、文档启停、详情查看和删除。

## 当前运行链

```text
Upload / API Text
→ Normalize and Split
→ Document processing
→ Default Embedding role
→ sqlite-vec index
→ Vector + Orama lexical retrieval
→ RRF fusion
→ Optional Rerank
→ Generate and Sources
```

## 当前必须知道的限制

- 每次只上传一个 Markdown 或 TXT；
- 100 MB 上限；
- 索引队列只存在于 backend 进程内；
- 更换 Embedding 模型或维度后，现有索引不会自动重建；
- 桌面“重建索引”目前不是完成闭环；
- Rerank 失败会降级为检索顺序；
- 当前一个线程只绑定一个知识库；
- KB schema 的 embeddingModelConfigId 尚未成为真实 per-KB 模型选择；
- Agent retrieve 当前误用完整 RAG runnable，可能产生无用生成调用。

## 历史资料

六月旧总纲、API shell、单知识库 MVP Schema 和 Markdown Workspace 设计保存在：

- [[archive/knowledge-base/README]]。

历史资料用于理解演进，不回答当前运行时。