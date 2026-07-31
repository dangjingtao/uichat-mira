---
status: current
owner: knowledge-base / runtime
last_verified: 2026-07-31
layer: raw-source
module: KnowledgeBase
feature: BackendSchema
doc_type: current-contract
canonical: true
related:
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - README.md
  - api.md
  - rag-runtime.md
---

# Knowledge Base 后端 Schema

## 1. 文档范围

本页定义当前 SQLite 中 Knowledge Base、Document、Chunk、向量索引和词法索引的实际持久化边界。

当前实现已经是多知识库，不再是“单知识库 MVP Schema”。

## 2. 关系概览

```text
knowledge_bases
  ├─< documents
  │    └─< document_chunks
  └─< knowledge_base_vector_indexes
          └─ points to dynamic vec0 table

document_chunks
  └─ mirrored into document_chunks_fts by triggers
```

## 3. `knowledge_bases`

主要字段：

```text
id TEXT PRIMARY KEY
name TEXT NOT NULL
description TEXT
status active|archived
embedding_model_config_id TEXT NULL
chunking_config_json TEXT
metadata_json TEXT
created_at
updated_at
```

### 当前语义

- id=`default` 的系统知识库由初始化流程确保存在；
- 默认知识库不能通过 service 删除；
- status 只表示 active / archived 元状态，不自动控制所有调用方行为；
- metadata_json 当前规范化为 persona / scenario / tags；
- chunking_config_json 保存知识库级默认切分配置；
- embedding_model_config_id 已持久化，但当前索引和查询仍使用全局默认 Embedding role。

因此 `embedding_model_config_id` 当前不能被解释为已完成的 per-KB 模型路由。

## 4. `documents`

主要字段：

```text
id TEXT PRIMARY KEY
knowledge_base_id TEXT NOT NULL
name TEXT NOT NULL
source_type upload|sync|api
source_label TEXT
file_ext TEXT
mime_type TEXT
file_size INTEGER
content_text TEXT
index_status processing|ready|failed
enabled INTEGER
chunk_count INTEGER
char_count INTEGER
token_count INTEGER NULL
error_message TEXT
created_at
updated_at
```

### 当前语义

- `content_text` 是规范化后持久化的全文；
- `processing` 表示异步索引尚未完成；
- `ready` 表示当前 Chunk 与向量已完成；
- `failed` 保存错误信息并排除在检索外；
- `enabled=false` 会排除在检索外；
- token_count 当前允许为空，不能假设每份文档都有精确 Token 统计。

## 5. `document_chunks`

主要字段：

```text
id INTEGER PRIMARY KEY AUTOINCREMENT
knowledge_base_id TEXT NOT NULL
document_id TEXT NOT NULL
chunk_index INTEGER NOT NULL
content TEXT NOT NULL
char_count INTEGER
 token_count INTEGER NULL
start_offset INTEGER NULL
end_offset INTEGER NULL
created_at
UNIQUE(document_id, chunk_index)
```

Chunk 同时保存 knowledgeBaseId 与 documentId，用于约束查询范围和减少跨库误读。

startOffset / endOffset 来自规范化文本上的位置，不等于原始二进制文件、PDF 页码或 Office 段落定位。

## 6. `knowledge_base_vector_indexes`

主要字段：

```text
id TEXT PRIMARY KEY
knowledge_base_id TEXT NOT NULL
table_name TEXT UNIQUE
embedding_model_config_id TEXT NULL
dimensions INTEGER NOT NULL
distance_metric cosine|l2|inner_product
is_active INTEGER
created_at
updated_at
```

### 当前语义

- 这是向量表注册表，不直接保存 embedding；
- 同一知识库可保留多条历史索引注册；
- ensureDefaultVectorIndex 会把其他索引设为 inactive；
- 查询时会按当前 Embedding 模型、配置与维度尝试定位精确表；
- 若精确表存在，可以重新激活；
- 若只有 active 表且维度匹配，可以继续使用；
- 维度不匹配会拒绝查询。

## 7. 动态 vec0 表

每个实际向量表使用 SQLite vec0：

```sql
CREATE VIRTUAL TABLE <table_name>
USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding FLOAT[dimensions]
)
```

表名包含知识库、模型、配置和维度的规范化片段。

向量存储为 Float32Array。

### 当前操作

- upsert Chunk embedding；
- 按 chunk id 删除 embedding；
- 删除知识库时 drop 相关表；
- cosine / l2 / inner_product 字段存在，当前默认创建 cosine。

## 8. `document_chunks_fts`

数据库初始化会创建 FTS5：

```text
document_chunks_fts
```

并维护 insert / update / delete triggers，使其镜像 `document_chunks.content`。

还提供全量 rebuild 和 optimize 方法。

### 重要边界

当前主 RAG 词法检索并不查询该 FTS5 表。

当前实际 lexical runtime 是：

```text
load enabled + ready chunks
→ build Orama index
→ Mandarin tokenizer
→ cache by knowledgeBaseId
```

FTS5 当前是数据库能力和潜在备用基础设施，不能写成主检索算法的现状。

## 9. 索引生命周期

### Document create / update

```text
persist document
→ replace chunks
→ remove previous vectors
→ embed batches
→ ensure vector index
→ upsert vectors
→ ready or failed
```

### Document delete

```text
load current chunks
→ delete vectors from every registered table for the KB
→ delete document and cascaded chunks
→ invalidate lexical cache
```

### Knowledge Base delete

```text
collect vector table names
→ delete KB and cascaded rows
→ delete vector index registry
→ drop vec0 tables
→ invalidate lexical cache
```

系统默认知识库在 service 层禁止删除。

## 10. Foreign Key 与修复

数据库初始化包含旧 `model_configs_legacy` 外键修复：

- 必要时重建 knowledge_bases；
- 必要时重建 knowledge_base_vector_indexes；
- 保留数据并重新建立索引。

这属于数据库兼容迁移，不代表 Knowledge Base Runtime 支持任意旧 schema。

## 11. 当前真相债

### 11.1 默认描述仍写“单知识库 MVP”

默认知识库描述常量仍保留旧阶段文案，但数据模型、API 和 UI 已支持多知识库。

### 11.2 KB 级 Embedding 字段尚未驱动 Runtime

字段和外键已经存在，实际索引和查询仍解析全局默认 Embedding role。

### 11.3 Token 统计不是完整合同

Document / Chunk 都有 token_count 字段，但当前切分和索引主链经常写 null。

### 11.4 FTS 表不是当前词法真相

不能因为 FTS5 表存在，就把当前 lexical retrieval 写成 SQLite FTS5。

### 11.5 没有 durable job schema

当前没有：

- indexing_jobs；
- attempts；
- lease / worker；
- checkpoint；
- resume cursor；
- cancelled 状态。

processing 只是 Document 状态，不是完整任务记录。

## 12. 当前非目标

Schema 当前不表达：

- PDF 页码和版面坐标；
- Office 结构节点；
- Web crawl snapshot；
- durable ingestion workflow；
- multi-tenant ACL；
- per-document embedding model；
- multi-vector field；
- knowledge graph；
- long-term episodic memory；
- Evaluation result schema。

## 13. 代码锚点

- `server/src/db/knowledge-base.db.ts`；
- `server/src/db/schema.ts`；
- `server/src/db/repositories/knowledge-base.repository.ts`；
- `server/src/services/knowledge-base.service.ts`；
- `server/src/services/knowledge-base.vector-store.ts`；
- `server/src/services/rag-nodes/lexical-retrieve.service.ts`。