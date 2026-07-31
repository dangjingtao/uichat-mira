---
status: superseded
owner: knowledge-base / docs
last_verified: 2026-07-31
layer: historical
module: KnowledgeBase
feature: MarkdownWorkspace
doc_type: historical
canonical: false
related:
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - README.md
  - ../archive/knowledge-base/README.md
---

# Markdown 工作空间能力评估（已退役）

这份页面原本是一项设计评估，讨论“不入库的 Markdown 文件工作模式”。它不是当前 Knowledge Base Runtime，也没有因为文档位于 `knowledge-base/` 目录就自动成为已实现能力。

当前知识库、索引与 RAG 真相见：

- [[KNOWLEDGE_BASE_CURRENT_TRUTH]]；
- [[knowledge-base/README]]；
- [[knowledge-base/rag-runtime]]。

原始设计全文保存在：

- [[archive/knowledge-base/README]]。

当前需要区分：

```text
正式 Knowledge Base
!= Workspace-bound Markdown 文件操作
!= Tool Read / Search
!= 长期记忆
```

后续若实现 Markdown Workspace，应建立独立 current contract 和产品入口，不能复用这份历史评估冒充现状。