---
status: current
owner: knowledge-base / runtime
last_verified: 2026-07-31
layer: wiki
module: KnowledgeBase
feature: KnowledgeBaseRuntimeTruth
doc_type: current-snapshot
canonical: true
related:
  - knowledge-base/README.md
  - knowledge-base/api.md
  - knowledge-base/backend-schema.md
  - knowledge-base/rag-runtime.md
  - PROVIDER_CURRENT_TRUTH.md
  - CURRENT_PRODUCT_TRUTH.md
  - archive/knowledge-base/README.md
---

# UIChat Mira Knowledge Base 当前真相

> 本页只记录 `dev` 当前可由代码和现有回归核对的知识库、索引与 RAG 事实。评测系统是相邻模块，不由本页重新定义。

## 1. 结论先说

Mira 当前已经具备稳定的多知识库、文本入库、Chunk、向量索引、混合检索、可选 Rerank、RAG Chat、Agent 检索和企业微信知识问答接入。

这套能力没有在最近发生一次“架构换代”。本轮文档更新主要是把已经存在的真实链路从六月的单知识库 MVP 口径中整理出来。

当前核心链路：

```text
KnowledgeBase
→ Document
→ Text Decode / Normalize
→ Chunk Preview
→ Async Indexing
→ Embedding
→ sqlite-vec Vector Index
→ Vector + Lexical Retrieval
→ RRF Fusion
→ Optional Rerank
→ Generate
→ Sources / Observation / Persistence
```

这些层不能互相替代：

```text
文件上传成功
!= 文档索引完成

indexStatus = ready
!= 真实问题一定能命中

检索命中
!= 生成回答一定正确

知识库存在
!= 当前线程已经绑定它

有 Rerank 配置
!= 本次 Rerank 调用成功
```

## 2. 当前核心对象

### 2.1 `KnowledgeBase`

知识库是文档、索引与元信息的归属边界。

当前字段包括：

- id；
- name / description；
- status：`active | archived`；
- `embeddingModelConfigId`；
- chunking config；
- metadata：persona / scenario / tags；
- createdAt / updatedAt。

当前已经支持多个知识库。

系统会确保存在 id 为 `default` 的默认知识库。默认知识库不能删除；其他知识库可以创建、编辑和删除。

### 2.2 `Document`

Document 保存：

- 归属知识库；
- 名称、来源类型和来源标签；
- 文件扩展名、MIME、大小和文本编码；
- 完整 `contentText`；
- `processing | ready | failed` 索引状态；
- enabled 状态；
- Chunk、字符和可选 Token 统计；
- 失败信息。

只有 enabled 且 indexStatus 为 ready 的文档进入当前检索面。

### 2.3 `DocumentChunk`

Chunk 是检索单元，保存：

- knowledgeBaseId；
- documentId；
- chunkIndex；
- content；
- charCount；
- 可选 tokenCount；
- startOffset / endOffset。

Chunk 并不是原始文件副本。原始文本仍保存在 Document 的 `contentText` 中。

### 2.4 `KnowledgeBaseVectorIndex`

向量索引注册项记录：

- knowledgeBaseId；
- vec0 table name；
- 实际 embedding model config id；
- dimensions；
- distance metric；
- active 状态。

向量表名由知识库、模型、配置和维度共同派生。每个知识库当前只能有一个 active vector index，但旧索引注册和表可以保留，供兼容模型重新激活或后续清理。

## 3. 产品入口

桌面设置当前提供：

```text
/settings/knowledge-base
/settings/knowledge-base/add
/settings/knowledge-base/detail
```

工作台当前支持：

- 创建、选择、编辑和删除知识库；
- 查看 persona / scenario / tags 等元信息；
- 搜索、筛选和排序文档；
- 启用或停用文档；
- 单条或批量删除文档；
- 查看文档详情和真实 Chunk；
- 进入三步添加向导。

评测中心是独立入口：

```text
/settings/evaluation/center
/settings/evaluation/center/new
```

它使用知识库和 RAG 结果，但不是 Knowledge Base Runtime 的同一页面或同一状态源。

## 4. 当前导入合同

### 4.1 支持的文件

当前上传只接受：

```text
.md
.markdown
.txt
```

这不是 PDF、DOCX、PPTX、网页或任意二进制文档解析器。

### 4.2 单文件与大小

- 每次只接受一个文件；
- 最大 100 MB；
- 空文件拒绝；
- 预览和正式上传都使用 multipart/form-data。

桌面添加向导也只允许保留一个待上传文件。

### 4.3 文本编码

- 优先严格 UTF-8 解码；
- TXT 在 UTF-8 失败时可回退 GB18030；
- 可以显式指定 `utf8` 或 `gb18030`；
- Markdown 非 UTF-8 内容不会自动尝试广泛编码探测。

### 4.4 三步添加向导

```text
1. 选择文件
2. 配置并预览 Chunk
3. 上传、索引并轮询状态
```

轮询间隔当前是 1.5 秒，桌面等待上限是 10 分钟。

索引完成标准是 Document 进入 `ready`；`failed` 会显示后端保存的错误信息。

## 5. Chunk 与预览

当前 splitter：

```text
character
recursive
markdown
token
```

当前配置支持：

- chunkSize / chunkOverlap；
- keepSeparator；
- 单个或多个 separator；
- Markdown、Python、Java、Rust 等语言预设；
- token encoding 与 special token 规则；
- characters / utf8Bytes 长度计量；
- 空白归一化；
- URL / 邮箱移除；
- Q/A 结构切分。

默认值：

```text
splitterType: recursive
chunkSize: 1024
chunkOverlap: 50
presetLanguage: markdown
replaceWhitespace: true
removeUrls: false
useQaSplit: false
```

预览返回：

- totalChunks；
- min / max / average chunk length；
- normalizedTextLength；
- effective config；
- 最多 10 个抽样 Chunk。

预览样本不是完整规范化文本，也不保证每次抽到完全相同的位置。

## 6. 索引执行

当前索引是后端进程内的串行队列：

```text
create document
→ enqueue document id
→ split / replace chunks
→ status = processing
→ batch embedding
→ create or activate vec0 index
→ write chunk vectors
→ status = ready
```

Embedding batch 上限：

- 最多 32 个输入；
- 最多约 60,000 字符。

失败处理：

- Document 标记 `failed`；
- 保存 `errorMessage`；
- 不把失败文档纳入检索；
- 词法索引缓存失效。

当前队列不是持久任务系统：

- 队列只存在于当前 backend 进程内；
- 没有 checkpoint、重启恢复或跨进程 worker；
- backend 在 processing 中断时，当前代码没有自动恢复队列的合同。

## 7. Embedding 与索引兼容

入库与查询都通过默认 Embedding role 调用 Provider Proxy。

一次向量索引会记录实际使用的：

```text
embeddingModelConfigId
model
dimensions
```

查询时会检查当前查询向量与知识库索引是否兼容。

如果当前默认 Embedding 的模型或维度与索引不匹配，检索会拒绝继续，并要求重建索引或切回兼容模型。

当前 `KnowledgeBase.embeddingModelConfigId` 字段可以持久化，但实际入库和查询仍解析全局默认 Embedding role。它还不是一个完成生效的 per-Knowledge-Base 模型绑定合同。

## 8. 检索

当前检索不是纯向量检索。

### 8.1 向量召回

- 使用 sqlite-vec vec0；
- 默认 cosine distance；
- 只读取当前知识库中 enabled + ready 的 Chunk；
- 返回 document、chunk、score 和来源信息。

### 8.2 词法召回

当前实际词法 Runtime 使用：

- Orama；
- Mandarin tokenizer；
- 按知识库构建的进程内缓存；
- documentName 权重高于 content。

数据库同时维护 `document_chunks_fts` FTS5 表和触发器，但当前主检索链并不通过该 FTS5 表执行词法召回。

### 8.3 混合融合

有查询文本时：

```text
vector candidates
+
lexical candidates
→ normalize
→ Reciprocal Rank Fusion (RRF, k = 60)
→ topK
```

没有查询文本时只走向量召回。

向量为空时，词法结果仍可返回。

## 9. Rerank

Rerank 是可选阶段。

满足以下条件时才真正调用：

```text
rerank role 已配置并启用
+
Provider Template 显式支持 rerank adapter
+
远端 model id 可解析
```

Rerank 可以应用 topN 和 scoreThreshold。

未配置、禁用、缺失模型或 Provider 调用失败时，链路不会整体失败，而是直接使用 retrieve 阶段的顺序继续生成。

这属于显式降级，不代表 Rerank 已成功。

## 10. RAG Runtime

当前 RAG 图：

```text
rewrite
→ embed
→ retrieve
→ rerank or fallbackAnswer
→ generate or END
```

### Query Rewrite

只对短追问或含指代词的追问尝试改写。

- 使用 Task 模型；
- 最多参考最近 6 条历史消息；
- 改写失败或输出不合格时保留原问题。

### Generate

生成使用最终上下文优先级：

```text
rerankedChunks
> retrievedChunks
> empty context
```

没有检索结果时，图会进入 fallback answer 路径；它可能仍调用生成模型，而不是把“无命中”伪装成有来源回答。

### Sources 与 Observation

RAG 可以输出并持久化：

- rewrite / embed / retrieve / rerank / generate 节点；
- Provider、模型、endpoint 与耗时；
- vector / lexical / fused candidate breakdown；
- Rerank applied / degraded / finish reason；
- 最终 sources；
- assistant message 中的 RAG metadata。

## 11. Chat、Agent 与外部接入

### Chat

线程保存 `knowledgeBaseId`。普通 Chat 在绑定知识库后进入 RAG 分支。

- Knowledge Base 不存在：请求失败；
- 知识库没有 enabled 文档：返回固定无上下文回答；
- 有文档：执行完整 RAG 并持久化 sources。

当前一个线程只绑定一个知识库。

### Main Agent

Main Agent 在 Planner 选择 `retrieve` 时读取线程绑定的 knowledgeBaseId，并把 sources 写入 Retrieval Evidence。

未绑定知识库时，Agent 记录 partial observation 并跳过检索。

### 企业集成

strict MicroApp `knowledge_query` 当前支持 `wecom.smart_robot`。

AccessPoint binding 保存 knowledgeBaseId，外部文本问题通过 third-party RAG adapter 执行完整 RAG 并返回文本回复。

缺失或无效 knowledgeBaseId 当前会回退默认知识库。

## 12. 删除与失效

删除 Document：

- 删除 Document 与 Chunk；
- 删除该 Chunk 在所有该知识库向量表中的 embedding；
- 使词法缓存失效。

删除 Knowledge Base：

- 默认知识库禁止删除；
- 删除其他知识库会删除文档、Chunk、向量索引注册和向量表；
- 线程或外部绑定引用是否同步清理，应由调用方和外键合同分别验证，不能只凭页面删除成功推断所有外部引用已修复。

## 13. 已知实现偏差与真相债

### 13.1 Agent retrieve 调用了完整 RAG

目标语义：Agent 的 `retrieve` 节点只做检索和 Evidence 累积。

当前实现：

```text
retrieveNode
→ agentRagRunnable
→ ragRunnableSequence
→ ragGraph.run
→ rewrite + embed + retrieve + rerank + generate
```

节点随后只读取 `sources`，生成的 answer 被丢弃。

代码已经提供 `agentRetrieveRunnable = retrieveOnlyRunnable`，但当前 retrieve node 没有使用它。

影响：

- 可能增加一次无用 LLM 生成；
- 增加延迟和调用成本；
- Observation 语义与节点名称不完全一致。

本轮只记录，不修改 Agent Runtime。

### 13.2 “重建索引”按钮不是完成能力

桌面文档列表当前有重建确认入口，但确认后只显示 pending message，没有调用重建 API。

数据库和服务层具备重新切块、替换 Chunk、生成新向量的内部路径，但当前 UI 没有完成可操作的显式重建闭环。

因此文档不能要求用户点击“重建索引”来解决模型维度不匹配。

### 13.3 添加向导额外要求 LLM

正式索引依赖 Embedding；但添加向导第二步当前同时要求 LLM 和 Embedding role 存在，才允许继续。

这是当前 UI 前置条件，不是索引 Runtime 的最小技术依赖。

### 13.4 索引队列不持久

processing job 没有 durable queue、checkpoint 或 restart recovery。

### 13.5 默认知识库仍保留旧 MVP 描述

默认描述常量仍是“单知识库 MVP 默认实例”，但当前产品和 API 已支持多个知识库。该字符串属于遗留文案，不定义当前能力边界。

### 13.6 FTS5 与实际词法 Runtime 不同

数据库维护 FTS5 表；当前混合检索实际使用 Orama Mandarin cache。不能从“有 FTS 表”推断主链使用 SQLite FTS5。

### 13.7 KB 级 Embedding 绑定尚未生效

KnowledgeBase schema 有 embeddingModelConfigId，但实际索引与查询使用全局默认 Embedding role。

## 14. 当前非目标

Mira 当前没有承诺：

- 任意文档格式自动解析；
- durable distributed indexing worker；
- 自动恢复所有 processing 任务；
- 一个线程同时查询多个知识库；
- 每个知识库独立绑定并实际使用自己的 Embedding 模型；
- 切换 Embedding 后自动重建所有索引；
- Rerank 不可用时阻断回答；
- Knowledge Base 等同于长期记忆；
- Markdown 工作空间等同于正式知识库；
- 评测分数等同于生产正确性；
- 检索命中等同于专业结论正确。

## 15. 代码与验证锚点

主要实现：

- `desktop/src/features/Settings/pages/KnowledgeBase/`；
- `desktop/src/shared/api/knowledgeBase.ts`；
- `server/src/routes/knowledge-base/`；
- `server/src/services/knowledge-base.service.ts`；
- `server/src/services/knowledge-base.splitter.ts`；
- `server/src/services/knowledge-base.vector-store.ts`；
- `server/src/services/rag-graph.ts`；
- `server/src/services/rag-pipeline.ts`；
- `server/src/services/rag-nodes/`；
- `server/src/agent/nodes/retrieve.ts`；
- `server/src/microapps/apps/knowledge-query.microapp.ts`。

主要回归分布在：

- Knowledge Base route / service / preview tests；
- splitter / vector index tests；
- RAG graph / node / stream tests；
- Agent retrieval observation tests；
- Knowledge Base desktop page and add wizard tests。

本轮没有运行完整 server test suite；文档结论来自当前代码、现有测试断言和可回读合同。