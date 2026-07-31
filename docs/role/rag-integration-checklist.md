---
status: historical
owner: role / rag / runtime
last_verified: 2026-08-01
layer: wiki
module: Role
feature: RagIntegrationLegacyEntry
doc_type: compatibility-entry
canonical: false
---

# Role + RAG 接入清单（历史入口）

2026-06-25 的接入与点验原文已归档：

- [[archive/role/rag-integration-checklist-20260625]]

当前事实：

- Role Prompt 只进入 RAG generate；
- 不进入 rewrite / retrieve / rerank；
- Role LLM Profile 当前没有传入独立 RAG route。

详细说明见 [[ROLE_CURRENT_TRUTH]]、[[role/runtime]] 与 [[KNOWLEDGE_BASE_CURRENT_TRUTH]]。
