---
status: current
owner: knowledge-base / runtime
last_verified: 2026-07-31
layer: raw-source
module: KnowledgeBase
feature: RagRuntime
doc_type: current-contract
canonical: true
related:
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - README.md
  - api.md
  - backend-schema.md
  - ../PROVIDER_CURRENT_TRUTH.md
  - ../AGENT_CURRENT_TRUTH.md
---

# RAG Runtime

## 1. 文档范围

本页定义当前 RAG 查询链、降级、来源、Observation，以及 Chat、Agent 和外部接入的使用方式。

它不定义：

- 文档上传 API；
- Evaluation 指标；
- 长期记忆；
- Harness Tool Exposure；
- 通用 workflow engine。

## 2. 当前图

```text
START
→ rewrite
→ embed
→ retrieve
→ rerank | fallbackAnswer
→ generate | END
```

外部输入：

```text
question
optional userId
knowledgeBaseId
optional topK
optional topN
optional systemPrompt
optional conversationHistory
optional requestContextMessages
```

完整输出：

```text
answer
sources
retrievedChunks
rerankedChunks
```

## 3. Rewrite

Rewrite 只在以下场景尝试：

- 有历史消息；
- 当前问题较短；
- 当前问题包含“这个、它、前面、刚才”等指代表达。

执行方式：

- 最多取最近 6 条历史消息；
- 使用 Task role；
- 要求只返回一句检索问题；
- 清理代码块、前缀和多余空白；
- 过滤过长、多句或像回答而不像查询的输出。

失败语义：

- Task 模型调用失败：保留原问题；
- 输出不合格：保留原问题；
- 问题本来清晰：不调用改写模型。

Rewrite 失败不会阻断 RAG。

## 4. Embed

查询向量通过：

```text
providerProxyService.createEmbeddings("default")
```

解析全局默认 Embedding role，并记录：

- providerCode；
- providerLabel；
- protocol；
- endpoint；
- model；
- modelConfigId；
- dimensions；
- duration。

查询 Embedding 与入库 Embedding 必须在维度和索引身份上兼容。

## 5. Retrieve

### 5.1 Vector

当前 vector retrieval：

- 使用知识库 active vec0 index；
- 通过 `embedding MATCH ?` 查询；
- 默认 topK 由 RAG Graph 设为 10；
- 只保留当前知识库 enabled + ready 文档；
- cosine 距离转为 `1 - distance` score。

### 5.2 Lexical

有非空查询文本时，同时执行：

- Orama index；
- Mandarin tokenizer；
- documentName 与 content 搜索；
- documentName boost=2；
- 每知识库进程内缓存。

文档变更、启停、删除或重新索引会使对应缓存失效。

### 5.3 Fusion

Vector 和 Lexical 各自归一化后使用 RRF：

```text
score = 1 / (60 + rank)
```

同一 Chunk 同时命中两路时，hitModes 为：

```text
[vector, lexical]
```

matchType 为 `hybrid`。

返回结果再次归一化，并截断到 topK。

### 5.4 Retrieval Observation

当前可以记录：

- strategy：vector-only / hybrid；
- vectorCount；
- lexicalCount；
- fusedCount；
- vector / lexical / fused candidate；
- document、chunk、score、matchType、hitModes；
- content snippet；
- knowledgeBaseId；
- duration。

## 6. Rerank

Rerank 读取全局默认 rerank role。

### 6.1 正常调用

前提：

- config 存在；
- enabled 不为 false；
- providerCode 和 remoteModelId 存在；
- Provider 可以解析 Rerank endpoint。

当前 Provider 路径按 OpenAI-compatible rerank 请求调用。

### 6.2 参数

- topN；
- scoreThreshold。

先按远端 score 过滤和排序，再截断 topN，最后把 score 归一化。

### 6.3 降级

finishReason：

```text
reranked
fallback-no-config
fallback-disabled
fallback-missing-provider-or-model
fallback-provider-call-failed
```

所有 fallback 都直接使用 retrieve 输入顺序，不再做本地假重排。

Provider 调用失败时：

- `degraded=true`；
- 保存错误；
- RAG 继续执行。

## 7. Generate 与无上下文路径

### 有上下文

```text
rerankedChunks
→ if absent use retrievedChunks
→ generate model
→ answer + sources
```

### Retrieve 无命中

进入 `fallbackAnswer`：

- chunks 为空；
- 仍可以调用生成模型；
- 不生成伪 sources；
- 模型没有输出时使用固定 fallback 文本。

### 知识库没有 enabled 文档

Chat route 会在进入 RAG Graph 前检查：

```text
enabledDocumentCount === 0
```

此时返回固定 `NO_CONTEXT_ANSWER`，并记录 routeReason=`knowledge-base-empty`，不会执行完整 RAG。

## 8. Stream 与持久化

`ragPipeline` 提供：

- `run`：非流式 answer + sources；
- `stream`：节点和文本事件；
- `assistantStream`：兼容桌面 Chat 的标准 SSE；
- `retrieveOnly`：只返回检索来源。

Assistant stream 可发出：

- `data-rag-node`；
- 文本 start / delta / end；
- `data-rag-sources`；
- finish / error / done。

Chat 完成后持久化：

```text
metadata.rag.enabled
question
topK
topN
sources
optional routeReason
```

Sources 包括：

- chunkId；
- documentId；
- documentName；
- score；
- content；
- matchType / hitModes；
- 可选 citation。

## 9. Chat 接入

Chat route 只有在以下条件成立时进入线程 RAG：

```text
thread has knowledgeBaseId
+
request has RAG input
+
threadId exists
+
authenticated user exists
```

当前一个 thread 持有一个 knowledgeBaseId。

线程知识库被删除或不存在时，请求报错，不静默切换默认知识库。

## 10. Agent 接入

Main Agent 的 `retrieve` action：

- 使用最新用户问题或 Planner 提供的 query；
- 读取 state.knowledgeBaseId；
- 无知识库时记录 partial observation；
- 有知识库时把 sources 转成 Retrieval Evidence。

### 当前实现漂移

`retrieveNode` 当前调用：

```text
agentRagRunnable = ragRunnableSequence
```

而不是代码已经导出的：

```text
agentRetrieveRunnable = retrieveOnlyRunnable
```

这会执行完整 RAG，包括 Generate，然后丢弃 answer，只保留 sources。

影响属于延迟、成本与观测语义，不会直接改变最终 sources 的读取方式。本轮文档不修 Runtime。

## 11. External MicroApp 接入

`knowledge_query` MicroApp：

- supportedAccessPoints：`wecom.smart_robot`；
- binding 必须选择 knowledgeBaseId；
- 空问题返回 no_reply；
- 通过 `thirdPartyRagAdapter.answer` 调用非流式完整 RAG；
- 返回单条文本。

External adapter 对无效或缺失 knowledgeBaseId 的行为与 Chat 不同：它会回退默认知识库。

因此：

```text
Chat thread RAG missing KB
!= External knowledge_query missing KB
```

## 12. Provider 依赖

RAG 当前最多涉及三种模型角色：

| 阶段 | role | 失败语义 |
| --- | --- | --- |
| Rewrite | task | 回退原问题 |
| Embed | embedding | 阻断当前检索 |
| Rerank | rerank | 降级透传检索顺序 |
| Generate | llm | 当前回答失败 |

添加向导 UI 当前要求 LLM + Embedding 才进入正式上传，但索引后端的技术必需模型是 Embedding。

## 13. 索引匹配

查询向量提供：

- dimensions；
- embeddingModel；
- embeddingModelConfigId。

检索尝试：

1. 找到按当前模型、配置和维度派生的精确向量表；
2. 若存在则激活；
3. 否则在 active index 维度相同时继续；
4. 否则抛出不匹配错误。

当前没有自动重建索引。

## 14. 当前非目标

RAG Runtime 当前不是：

- multi-KB query planner；
- agentic RAG tool swarm；
- GraphRAG；
- SQL / Web / File 联合检索；
- durable workflow；
- automatic citation verifier；
- professional correctness guarantee；
- long-term memory engine。

## 15. 代码锚点

- `server/src/services/rag-graph.ts`；
- `server/src/services/rag-pipeline.ts`；
- `server/src/services/rag-runables.ts`；
- `server/src/services/rag-nodes/rewrite.service.ts`；
- `server/src/services/rag-nodes/embed.service.ts`；
- `server/src/services/rag-nodes/retrieve.service.ts`；
- `server/src/services/rag-nodes/lexical-retrieve.service.ts`；
- `server/src/services/rag-nodes/rerank.service.ts`；
- `server/src/services/rag-nodes/generate.service.ts`；
- `server/src/routes/proxy-provider/rag-thread.ts`；
- `server/src/agent/nodes/retrieve.ts`；
- `server/src/services/third-party-rag-adapter.service.ts`。