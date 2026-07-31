---
status: current
owner: knowledge-base / runtime
last_verified: 2026-07-31
layer: raw-source
module: KnowledgeBase
feature: KnowledgeBaseAPI
doc_type: current-contract
canonical: true
related:
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - README.md
  - backend-schema.md
  - rag-runtime.md
---

# Knowledge Base API

## 1. 文档范围

本页定义当前 Knowledge Base HTTP 路由、输入方式、状态语义和兼容路径。

它不定义：

- RAG 节点内部算法；
- Evaluation API；
- 企业集成 AccessPoint；
- PDF / Office 文档解析；
- durable indexing job protocol。

## 2. 路由分组

当前 route plugin 只注册：

```text
registerKnowledgeBaseDocumentRoutes
registerKnowledgeBaseUploadRoutes
```

主要分组：

- Knowledge Base CRUD；
- Document CRUD；
- Document status；
- Chunk preview；
- Multipart upload；
- 默认知识库兼容路由。

## 3. Knowledge Base CRUD

### 列表

```http
GET /knowledge-bases
```

返回每个知识库的：

- id / name / description；
- active / archived；
- isSystem；
- persona / scenario / tags；
- documentCount；
- enabledDocumentCount；
- totalChunkCount；
- timestamps。

### 详情

```http
GET /knowledge-bases/:knowledgeBaseId
```

不存在时返回 404。

### 创建

```http
POST /knowledge-bases
```

可写字段：

```text
name
optional description
optional status
optional embeddingModelConfigId
optional metadata
optional chunkingConfig
```

`name` 不能为空。

### 更新

```http
PATCH /knowledge-bases/:knowledgeBaseId
```

支持修改名称、描述、状态、embeddingModelConfigId、metadata 和 chunkingConfig。

保存字段不代表所有字段都已成为 Runtime 选择源。当前入库和查询仍使用全局默认 Embedding role。

### 删除

```http
DELETE /knowledge-bases/:knowledgeBaseId
```

- 默认知识库禁止删除；
- 不存在返回 404；
- 成功删除会清理其文档、Chunk、向量索引注册和向量表。

## 4. 默认知识库兼容入口

以下路由仍存在：

```http
GET /knowledge-base
GET /knowledge-base/documents
GET /knowledge-base/documents/:id
GET /knowledge-base/documents/:id/status
POST /knowledge-base/documents
PATCH /knowledge-base/documents/:id
DELETE /knowledge-base/documents/:id
POST /knowledge-base/documents/upload
```

它们面向默认知识库或按 document id 操作，主要用于兼容旧桌面和 API 调用。

新代码优先使用带 `knowledgeBaseId` 的复数路由。

## 5. Document API

### 列表

```http
GET /knowledge-bases/:knowledgeBaseId/documents
```

Query：

```text
search
enabled=true|false
indexStatus=processing|ready|failed
sortBy
sortOrder=asc|desc
```

### 详情

```http
GET /knowledge-bases/:knowledgeBaseId/documents/:id
```

详情包含完整 `contentText` 与 Chunk 数组。

### 状态

```http
GET /knowledge-bases/:knowledgeBaseId/documents/:id/status
```

桌面添加向导使用该路由轮询：

```text
processing
ready
failed
```

### 直接文本创建

```http
POST /knowledge-bases/:knowledgeBaseId/documents
Content-Type: application/json
```

用于 API 或直接文本输入，不是桌面大文件上传主路径。

### 更新

```http
PATCH /knowledge-bases/:knowledgeBaseId/documents/:id
```

可更新：

- name；
- sourceLabel；
- enabled；
- contentText；
- chunkingConfig。

更新内容或切分参数会重新进入索引流程。

### 删除

```http
DELETE /knowledge-bases/:knowledgeBaseId/documents/:id
```

成功后删除文档、Chunk 与对应向量数据，并使词法缓存失效。

## 6. Chunk Preview

```http
POST /knowledge-base/chunk-preview
Content-Type: multipart/form-data
```

使用与正式入库相同的文本解码和 splitter。

表单包含：

- 一个文件；
- 可选 `chunkingConfig` JSON 字符串；
- 其他文档字段仅用于保持上传 shape 一致。

成功返回：

```text
totalChunks
stats
effectiveConfig
sampleChunks
```

当前 sampleCount 固定为 10。

Preview 不创建 Knowledge Base、Document、Chunk 或向量索引。

## 7. Multipart Upload

### 默认知识库

```http
POST /knowledge-base/documents/upload
```

### 指定知识库

```http
POST /knowledge-bases/:knowledgeBaseId/documents/upload
```

### 文件合同

- `multipart/form-data`；
- 只接受一个 file part；
- 支持 md / markdown / txt；
- 最大 100 MB；
- 空内容拒绝。

### 编码

可选表单字段：

```text
textEncoding=utf8|gb18030
```

未指定时：

1. 严格 UTF-8；
2. TXT 失败则尝试 GB18030；
3. 其他扩展名按 UTF-8 解码结果处理。

### 可选表单字段

```text
name
fileExt
fileSize
sourceType=upload|sync|api
sourceLabel
enabled=true|false
chunkingConfig=<JSON string>
textEncoding
```

### 返回语义

上传路由返回的是已创建且开始索引的 Document，不代表索引已经 ready。

调用方必须继续读取 status。

## 8. 错误语义

常见错误：

| 场景 | 当前响应 |
| --- | --- |
| 不是 multipart | 400 |
| 缺文件 | 400 |
| 多文件 | 400 |
| 不支持扩展名 | 400 |
| 空文件 | 400 |
| 无效 chunkingConfig JSON | 400 |
| 不支持编码 | 400 |
| 超过上传限制 | 413 |
| KB / Document 不存在 | 404 |
| 删除默认知识库 | 403 |
| Embedding / indexing 失败 | Document status = failed，保存 errorMessage |

Embedding 失败通常发生在异步索引阶段，不一定作为初始 upload 请求的同步错误返回。

## 9. 状态不是同一件事

```text
POST upload 成功
= 文档记录已创建，索引已入队

indexStatus = processing
= 当前正在等待或执行切分 / Embedding / 写索引

indexStatus = ready
= Chunk 和向量写入完成

indexStatus = failed
= 当前索引未完成，文档不进入检索

enabled = false
= 即使 ready，也不会进入检索
```

## 10. 当前缺少的公共 API

当前没有完成的显式公共合同：

- durable indexing job 列表与重启恢复；
- cancel indexing；
- retry / rebuild document index；
- rebuild whole knowledge base；
- upload multiple files in one request；
- PDF / DOCX / PPTX extraction；
- per-KB effective Embedding selection endpoint；
- retrieval-debug endpoint 作为正式产品 API；
- multi-KB query endpoint。

桌面现有“重建索引”确认入口没有对应已完成 API。

## 11. 代码锚点

- `server/src/routes/knowledge-base/index.ts`；
- `server/src/routes/knowledge-base/documents.routes.ts`；
- `server/src/routes/knowledge-base/uploads.routes.ts`；
- `server/src/routes/knowledge-base/multipart.ts`；
- `server/src/routes/knowledge-base/schemas.ts`；
- `server/src/services/knowledge-base.service.ts`；
- `desktop/src/shared/api/knowledgeBase.ts`。