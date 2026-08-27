# 资讯与邮件 MCP 能力设计

Status: Planned
Owner: runtime / microapp
Last verified: 2026-07-14
Layer: design
Module: MCP
Feature: MicroAppSearchAndMail
Doc Type: planned-design
Canonical: false
Related:
  - ../concepts/CONCEPT_MCP.md
  - ../tooling-runtime/tools-protocol.md
  - ../tooling-runtime/harness-runtime-design.md
  - ../architecture/external-mcp-marketplace.md
  - README.md
  - ../microapp/README.md

## Purpose

本文设计把现有资讯中心和邮件中心接入项目内置 MCP / Harness 能力面。

目标不是把两个微应用直接改造成 external MCP server，也不是把每一个 HTTP 路由都暴露成一个 tool，而是：

- 资讯中心作为 `web_search` 的内部搜索来源；
- 邮件中心提供一个受控的 `mail_query` 能力；
- 统一使用 Harness 的 schema、权限、审批、trace 和结果结构；
- 保留微应用作为业务真相源，MCP 只负责受控能力暴露。

本文是规划设计，不代表相关能力已经实现。

## When To Read

以下工作开始前应先阅读本文：

- 将 NewsHub 或 MailCenter 接入 agent / chat tool calling；
- 为资讯或邮件增加 MCP tool；
- 修改资讯或邮件的查询、同步、embedding、审批或隐私边界；
- 设计邮件搜索、邮件理解或资讯检索的测试契约。

## Current Truth

### 1. MCP 与 MicroAPP 的边界

项目当前把三层概念分开：

- `MicroAPP`：可注册、可复用的业务工作流；
- `Capability`：agent 或 runtime 能够完成的责任；
- `Tool`：执行 capability 的具体调用面；
- `MCP`：能力对外暴露和调用的协议语义。

因此：

- NewsHub 仍负责资讯源配置、抓取、归一化和 `news_items` 持久化；
- MailCenter 仍负责邮箱账号、IMAP 同步、SMTP 诊断和邮件缓存；
- MCP tool 不通过 HTTP 调用自身的 `/microapps/...` 路由；
- MCP tool 应直接调用 backend domain service，并沿用当前用户上下文和数据库边界。

### 2. 当前资讯中心

当前 NewsHub 已有：

- Hacker News；
- GitHub Changelog；
- NewsData.io；
- Currents API；
- Reddit；
- 来源状态、TTL、去重、本地持久化；
- 来源筛选和关键词查询。

实现锚点：

- `server/src/microapps/news-hub/index.ts`
- `server/src/db/repositories/news-items.repository.ts`
- `server/src/db/repositories/news-hub-settings.repository.ts`
- `desktop/src/features/Settings/pages/MicroApps/NewsHub/index.tsx`

当前 `news_items` 表有标题、摘要、正文、来源、标签、发布时间等字段，但没有资讯专用 embedding 索引。当前关键词查询通过标题、摘要和正文的 `LIKE` 条件完成。

当前 `getOverview()` 会先执行一次非强制刷新，再读取列表。这一行为适合页面展示的当前实现，但不适合作为纯读取的 Search tool 语义。

### 3. 当前邮件中心

当前 MailCenter 已有：

- 多账号 SMTP / IMAP 配置；
- 账号新增、修改、删除和默认账号；
- 邮箱密码加密存储；
- SMTP 测试发送；
- IMAP 收件箱同步；
- 最近邮件摘要和邮件详情；
- HTML / text 正文解析；
- 附件存在标记。

实现锚点：

- `server/src/microapps/mail-center/index.ts`
- `server/src/db/repositories/mail-accounts.repository.ts`
- `server/src/db/repositories/mail-folders.repository.ts`
- `server/src/db/repositories/mail-messages.repository.ts`
- `server/src/routes/microapps/mail-center/index.ts`
- `desktop/src/features/Settings/pages/MicroApps/MailCenter/index.tsx`

当前邮件同步以只读 IMAP 锁拉取最近一批邮件并写入本地缓存。当前还没有完整的邮件搜索、历史分页、附件下载、远程已读变更、普通写信和回复发送能力。

## Design Decisions

### Decision 1: 资讯中心不新增独立 MCP tool

资讯中心作为 `web_search` 的内部 strategy：

```text
web_search
  +-- public_web
  +-- local_news_hub
```

模型对外看到的 Search 输入仍保持项目统一约束：

```ts
{
  query: string;
  maxResults?: number;
}
```

模型不能指定：

- provider；
- API Key；
- Base URL；
- Reddit client secret；
- 任意来源 URL。

来源选择由 agent intent、Harness capability profile 和可信 runtime 配置决定。

### Decision 2: 邮件中心使用一个丰富查询 tool

邮件中心第一阶段只对模型暴露：

```text
mail_query
```

它同时支持：

- 本地缓存搜索；
- 结构化过滤；
- 通过 message ID 读取详情；
- 显式拉取最新邮件；
- 返回摘要或正文。

不新增以下独立 tool：

- `mail_search`；
- `mail_read`；
- `mail_summarize`；
- `mail_extract_tasks`；
- `mail_draft_reply`。

邮件总结、待办提取和回复草稿属于模型基于邮件内容完成的推理或输出，不应在第一阶段拆成后端工具。

### Decision 3: 查询默认不联网

`web_search` 的资讯来源和 `mail_query` 默认查询本地数据。

同步或刷新必须显式表达：

- 不能因为查询缓存而隐式触发网络请求；
- 不能在读取 tool 内静默写数据库；
- 需要同步时，结果必须返回同步状态；
- 外部网络访问和本地持久化必须进入 invocation trace。

### Decision 4: 复用 Harness 的向量化基础能力，不复用 Harness 工具选择器

Harness 当前已经有一条能力匹配链路：

```text
query
  -> capability profile documents
  -> embedding
  -> cosine similarity
  -> score threshold
  -> local rerank
  -> final score
  -> tool candidates
```

这条链路适合从几十个 capability profile 中选择工具，不适合直接检索资讯文章或邮件记录。

因此本设计复用以下基础能力：

- `executeLocalEmbedding`；
- cosine similarity；
- `executeLocalRerank`；
- embedding / rerank 模型配置；
- 模型不可用时的降级策略；
- embedding、rerank 和候选结果的 trace 元数据。

不直接复用以下 Harness 业务流程：

- `resolveHarnessToolExposure`；
- `resolveHarnessToolCandidatesForTurn`；
- capability profile 生成；
- external MCP allowlist；
- tool exposure fallback。

这些模块的候选对象是 capability 或 tool，不是 `news_items` 或 `mail_messages`。

## Capability Model

### 1. News Research profile

资讯检索作为 `web_search` 的业务 capability profile：

```ts
{
  id: "news_research",
  title: "News Research",
  description: "Search configured local news sources and public web results.",
  domain: "web_search",
  source: "internal",
  preferredToolId: "web_search",
  supportingToolIds: ["web_search"],
  tags: ["news", "资讯", "新闻", "latest", "recent"]
}
```

普通公开信息查询仍然使用 `web_research` profile；明确的新闻、资讯、订阅源问题优先匹配 `news_research`。

### 2. Mail Reading profile

邮件中心使用一个 capability profile 和一个 tool：

```ts
{
  id: "mail_reading",
  title: "Mail Reading",
  description: "Search and inspect the current user's locally cached mail.",
  domain: "mail",
  source: "internal",
  preferredToolId: "mail_query",
  supportingToolIds: ["mail_query"],
  tags: ["mail", "email", "inbox", "邮件", "收件箱", "未读", "附件"]
}
```

邮件不是普通 `web_search` 的默认数据源。只有在用户明确提出邮件相关意图，或当前 capability profile 已明确选择邮件时，才允许查询邮件。

## Retrieval Core Reuse

### 1. 现有 Harness 向量化行为

当前 Harness 在候选数量较少时会直接暴露全部符合条件的工具；当候选数量超过阈值并且 query 可用时，才执行 capability embedding recall。当前阈值是 20 个可见工具。

实现锚点：

- `server/src/harness/candidates-core/resolver.ts`
- `server/src/harness/candidates-core/scoring.ts`
- `server/src/harness/candidates-core/rerank.ts`
- `server/src/agent/intent/capability-documents.ts`
- `server/src/services/internal-capabilities/local-embedding.ts`
- `server/src/services/internal-capabilities/local-rerank.ts`

当前 Harness 的 embedding 检索是每轮把 query 和 capability profile 文本一起生成 embedding，再在内存中计算 cosine similarity。它没有为 capability profile 建立长期的 sqlite-vec 文档索引。

因此它解决的是：

```text
从候选能力中选择合适的工具
```

不是：

```text
从大量业务记录中检索相关资讯或邮件
```

### 2. 统一检索基础层

资讯和邮件应使用一个通用检索基础层，复用 Harness 的 embedding / rerank 原语，并保留各自的数据适配器：

```text
Generic Retrieval Core
  +-- query embedding
  +-- keyword / FTS recall
  +-- vector recall
  +-- RRF fusion
  +-- rerank
  +-- score normalization
  +-- retrieval trace

NewsAdapter
  -> news_items
  -> news vector index
  -> Generic Retrieval Core

MailAdapter
  -> mail_messages
  -> mail vector index
  -> Generic Retrieval Core

Harness Adapter
  -> capability profiles
  -> existing Harness exposure flow
```

通用候选结构不应继续使用知识库专属的 `chunkId`、`documentId` 和 `documentName`：

```ts
type RetrievalCandidate = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  rawScore?: number;
  hitModes?: Array<"keyword" | "vector" | "rerank">;
};
```

映射关系：

- 资讯 metadata：`sourceKey`、`sourceName`、`url`、`publishedAt`、`tags`；
- 邮件 metadata：`accountId`、`subject`、`from`、`receivedAt`、`hasAttachments`；
- Harness metadata：`capabilityId`、`domain`、`source`、`supportingToolIds`。

### 3. 复用边界

可以复用：

- 本地 embedding 执行入口；
- cosine similarity 实现；
- local rerank 执行入口；
- rerank 模型配置和 provider 解析；
- `embeddingScore`、`rerankScore`、`finalScore` 的记录方式；
- embedding / rerank 失败后的可观测降级。

需要重新适配：

- 资讯和邮件的数据库关键词查询；
- 资讯和邮件的向量索引表；
- 业务记录的 metadata 映射；
- 用户、账号和来源过滤；
- 结果转成 `SearchResult` 或 `MailQueryItem`；
- 大量记录的候选分页和 topK 限制。

不能直接复用：

- `resolveHarnessToolCandidatesForTurn()` 作为资讯或邮件查询入口；
- `resolveHarnessToolExposure()` 作为业务数据过滤器；
- capability profile 文本作为资讯或邮件正文；
- 知识库专属的 `knowledgeBaseVectorStore` 和 `RetrievedChunk` 结构。

## News Search Design

### 1. 查询流程

```text
用户问题
  -> web_search
  -> 判断 news_research strategy
  -> 查询 news_items 关键词候选
  -> 查询 news_items embedding 候选
  -> 混合排序、去重、时间衰减
  -> 转为统一 SearchResult
```

### 2. 查询文本

资讯 embedding 的输入建议由以下字段拼接：

```text
title
summary
contentText
sourceName
topic
tags
```

embedding 应在资讯入库或内容更新时生成。查询时只为用户 query 生成向量，不应每次检索时重新处理所有资讯。

### 3. 混合排序

建议排序优先级：

1. 标题精确命中；
2. 标题关键词命中；
3. 摘要或正文关键词命中；
4. embedding 相似度；
5. 发布时间新鲜度；
6. 来源过滤条件。

关键词命中负责保护项目名、版本号、人名和专有名词；embedding 负责处理语义相近但字面不同的查询。

相同文章以 `news_items.id` 去重。

### 4. SearchResult 映射

Search 上层不应直接依赖 `NewsItemRecord`。统一结果建议为：

```ts
{
  title: string;
  link: string;
  snippet: string;
}
```

来源信息放入 artifact metadata：

```ts
{
  provider: "local_news_hub",
  sourceKey: "github-changelog",
  sourceName: "GitHub Changelog",
  publishedAt: "2026-07-14T00:00:00.000Z",
  tags: ["github", "changelog"]
}
```

### 5. 刷新边界

NewsHub service 应拆成两个语义明确的方法：

```ts
getCachedOverview(filters)
refresh()
```

`web_search` 默认只执行 `getCachedOverview` 对应的本地查询。

资讯刷新是独立的内部执行步骤：

```text
web_search
  +-- local_news_hub cache lookup
  +-- optional source refresh
  +-- normalized result
```

若启用自动刷新，必须在 runtime 策略中明确允许，且不能让模型传入任意来源配置。

## Mail Query Design

### 1. Tool definition

```ts
{
  id: "mail_query",
  title: "Mail Query",
  description: "Search and inspect the current user's locally cached email.",
  domain: "mail",
  source: "internal",
  mode: "sync",
  tags: ["mail", "email", "private", "inbox", "search"],
  capabilities: {
    sideEffect: "network",
    requiresApproval: false,
    networkAccess: true
  }
}
```

`sideEffect` 和 `requiresApproval` 的最终值需要根据实际同步策略确定。只查询本地缓存时应视为无外部副作用；允许 IMAP 同步时必须体现网络访问、持久化写入和 trace。

### 2. Input schema

建议输入如下：

```ts
type MailQueryInput = {
  accountId?: string;
  messageIds?: string[];

  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  since?: string;
  until?: string;

  unreadOnly?: boolean;
  flaggedOnly?: boolean;
  hasAttachments?: boolean;

  includeBody?: boolean;
  sync?: "none" | "if-stale" | "force";
  limit?: number;
  cursor?: string;
};
```

约束：

- `messageIds` 用于精确读取邮件；
- 没有 `messageIds` 时执行条件查询；
- `limit` 必须限幅；
- `cursor` 用于后续分页；
- `sync` 默认是 `none`；
- `force` 只能由用户明确要求；
- `accountId` 必须属于当前用户；
- `userId` 不属于模型输入，由 invocation context 提供。

### 3. Query examples

查询未读客户邮件：

```json
{
  "query": "报价",
  "unreadOnly": true,
  "since": "2026-07-01",
  "limit": 20
}
```

同步后查询：

```json
{
  "accountId": "account-1",
  "query": "项目周报",
  "sync": "if-stale",
  "includeBody": false,
  "limit": 20
}
```

读取正文：

```json
{
  "messageIds": ["message-123"],
  "includeBody": true
}
```

### 4. Output schema

```ts
type MailQueryResult = {
  sync: {
    requested: "none" | "if-stale" | "force";
    performed: boolean;
    syncedCount: number;
    lastSyncedAt: string | null;
  };
  items: MailQueryItem[];
  total: number;
  nextCursor: string | null;
};

type MailQueryItem = {
  id: string;
  accountId: string;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  to: Array<{
    name?: string;
    address?: string;
  }>;
  previewText: string;
  textContent?: string;
  sentAt: string | null;
  receivedAt: string | null;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  attachments?: Array<{
    filename: string;
    mimeType?: string;
    size?: number;
    available: boolean;
  }>;
};
```

默认不返回正文。只有用户明确需要查看邮件内容，或传入 `messageIds` 并指定 `includeBody` 时，才返回正文。

### 5. Mail sync flow

```text
mail_query
  -> 校验 userId / accountId
  -> 检查 sync 参数
  -> 必要时使用 IMAP 读取最近邮件
  -> 写入 mail_messages 本地缓存
  -> 执行本地条件查询
  -> 返回同步状态和查询结果
```

第一阶段可沿用当前最近 20 封的同步边界。后续再增加：

- UID 增量同步；
- 分页同步；
- 历史邮件拉取；
- 多文件夹同步；
- 后台定时同步。

### 6. Mail search index

邮件的第一阶段检索可以采用：

```text
SQLite 条件查询 / FTS
  +-- from / to / subject / date / flags 过滤
  +-- embedding 语义召回
  +-- 混合排序
```

embedding 文本建议包括：

```text
subject
fromDisplay
fromAddress
previewText
textContent
```

邮件 embedding 应放在独立索引表中，不把高维向量直接塞入 `mail_messages` 主记录。账号 ID 和用户 ID 必须参与查询过滤，不能先全库召回再在应用层过滤。

## Model Responsibilities

`mail_query` 只负责可靠地返回邮件事实。以下工作由模型基于返回内容完成：

- 总结邮件；
- 提取关键结论；
- 提取待办和截止时间；
- 判断是否需要回复；
- 生成回复草稿；
- 比较多封邮件的变化。

模型必须区分：

- 邮件原文明确写出的事实；
- 从上下文推断出的信息；
- 用户要求模型补充的内容。

推断的截止时间、负责人和优先级不能伪装成邮件原文。

## Security And Approval

### 1. User isolation

邮件工具必须从 invocation context 获取当前用户：

```text
context.userId -> mailAccountsRepository.getByIdForUser -> mail query
```

模型不得传入或覆盖 `userId`。

### 2. Secret protection

以下字段永远不能进入 MCP input schema、result、artifact 或 error：

- SMTP password；
- IMAP password；
- API Key；
- 原始认证 header；
- 完整连接配置中的 secret 字段。

当前邮箱密码在 repository 层使用加密字段保存，MCP 层不能改变这一边界。

### 3. Search privacy boundary

普通 `web_search` 不得默认读取邮箱。

只有以下条件之一成立时才能调用 `mail_query`：

- 用户明确提到邮件或收件箱；
- agent intent 选中 `mail_reading`；
- 当前任务上下文明确声明邮件范围。

### 4. Sync approval

同步属于外部网络访问和本地数据库写入。

建议策略：

| sync | 行为 | 策略 |
|---|---|---|
| `none` | 只查缓存 | 无审批 |
| `if-stale` | 过期时同步 | 记录 trace；是否免审批由可信 runtime 策略决定 |
| `force` | 明确强制同步 | 用户明确请求；按审批策略执行 |

同步不能修改远程邮件状态。当前 IMAP 同步使用只读锁，第一阶段继续保持这一点。

### 5. External text safety

邮件和资讯正文都是不可信外部文本。标题、正文、HTML、附件内容不得覆盖系统指令、审批状态或工具策略。

返回给模型前应：

- 限制正文长度；
- 去除或标记不可信 HTML；
- 不执行邮件正文中的链接或指令；
- 不把邮件中的“请调用某工具”当作用户授权。

## Non-Goals

第一阶段不包含：

- 邮件账号配置 MCP；
- 读取邮箱密码；
- 自动发送邮件；
- 回复或转发的远程提交；
- 自动删除、归档、移动或标记远程邮件；
- 附件自动下载；
- 全量历史邮件同步；
- 后台多账号并发同步；
- 将资讯刷新和邮件同步隐藏在普通读取请求中。

未来若增加真实发信能力，必须单独设计：

- `mail_send` 的输入和收件人确认；
- 用户审批；
- 发送结果和拒收结果；
- 附件文件授权；
- 防重复发送；
- 审计和回放。

## Runtime And Trace

资讯和邮件能力都必须复用统一 invocation 生命周期：

```text
invocation:start
invocation:progress
invocation:artifact
invocation:result
invocation:error
invocation:finish
```

资讯刷新可产生如下 trace span：

```text
Resolve news search strategy
Read news cache
Create query embedding
Run keyword retrieval
Run vector retrieval
Fuse news results
```

邮件查询可产生如下 trace span：

```text
Validate mail account ownership
Check sync policy
Connect IMAP
Fetch recent messages
Persist mail cache
Run mail query
Normalize mail result
```

trace 和 artifact 不得包含密码、密钥、认证 header 或完整原始邮件附件内容。

## Error Contract

错误必须说明可行动原因，不应返回底层敏感信息。

建议错误分类：

```text
mail_account_not_found
mail_account_access_denied
mail_query_invalid
mail_sync_not_allowed
mail_sync_failed
news_query_invalid
news_source_failed
embedding_unavailable
search_index_unavailable
```

示例：

```text
邮件账号不存在或不属于当前用户。
邮件同步失败：IMAP 服务暂时不可用。
资讯语义索引不可用，已使用关键词结果继续查询。
```

错误中不能出现：

- IMAP / SMTP 密码；
- 完整连接 URL；
- 第三方 API 原始响应；
- 环境变量内容。

## Implementation Plan

### Phase 1: Local query surface

目标：先让模型安全读取已有本地数据。

- 拆分 NewsHub 的缓存读取和刷新语义；
- 增加资讯关键词查询适配；
- 增加 `mail_query` 的本地缓存查询；
- 支持邮件摘要、详情和结构化过滤；
- 不自动同步、不发送邮件；
- 完成 user isolation 和 secret redaction 测试。

### Phase 2: Hybrid retrieval

- 抽取通用 `RetrievalCandidate` 和检索基础接口；
- 复用 Harness 的 `executeLocalEmbedding`、cosine 和 `executeLocalRerank`；
- 为资讯生成 embedding；
- 为邮件生成 embedding；
- 建立资讯和邮件各自的独立 vector index；
- 实现关键词和向量结果融合；
- 处理模型、维度和索引版本不一致；
- 保留 Harness capability retrieval 的现有行为不变。

### Phase 3: Explicit sync

- `mail_query.sync` 支持 `if-stale` 和 `force`；
- 资讯 Search 支持显式刷新策略；
- 增加同步 progress、失败恢复和 trace；
- 限制每次同步数量；
- 保证同步只更新本地缓存，不改变远程邮件状态。

### Phase 4: Draft workflow

- 模型读取邮件后生成回复草稿；
- UI 展示草稿、收件人和引用邮件；
- 草稿保存仍由显式用户操作完成；
- 暂不执行真实发送。

### Phase 5: External mutation

只有在写信、回复、转发、附件发送等业务边界被单独确认后，才设计 `mail_send` 或其他写操作。

## Acceptance Criteria

### News

- `web_search` 能在明确新闻意图下查询本地 `news_items`；
- 普通 Search 不会默认读取邮件或资讯私有配置；
- 关键词和 embedding 结果能去重并按统一 SearchResult 返回；
- API Key 不进入 tool schema、result、artifact 和 error；
- 普通读取不会隐式触发资讯刷新；
- 资讯刷新有独立 trace 和失败结果。

### Mail

- 只有一个 `mail_query` model-facing tool；
- `mail_query` 支持摘要查询和 message ID 详情查询；
- 支持发件人、收件人、主题、日期、未读、星标和附件过滤；
- 默认只查本地缓存；
- `sync` 参数显式控制 IMAP 拉取；
- 邮件账号按当前用户隔离；
- 邮箱密码不会回流到 renderer、tool result、artifact 或 error；
- 邮件正文不会覆盖系统指令或审批策略；
- 同步只写本地缓存，不修改远程邮件状态。

### Runtime

- 所有调用进入 Harness invocation lifecycle；
- capability definition 显式声明 `source`、`domain`、schema 和风险元数据；
- agent exposure 能正确匹配 `news_research` 和 `mail_reading`；
- 结果有稳定 output schema；
- 失败可区分账号、权限、同步、检索和 embedding 问题。

## Code Anchors

- `server/src/harness/candidates-core/resolver.ts`
- `server/src/harness/candidates-core/scoring.ts`
- `server/src/harness/candidates-core/rerank.ts`
- `server/src/agent/intent/capability-documents.ts`
- `server/src/services/internal-capabilities/local-embedding.ts`
- `server/src/services/internal-capabilities/local-rerank.ts`
- `server/src/harness/runtime.ts`
- `server/src/harness/profiles/resolver.ts`
- `server/src/harness/exposure-core/`
- `server/src/mcp/core/definitions.ts`
- `server/src/mcp/tools/web-search.tool.ts`
- `server/src/microapps/news-hub/index.ts`
- `server/src/db/repositories/news-items.repository.ts`
- `server/src/microapps/mail-center/index.ts`
- `server/src/db/repositories/mail-accounts.repository.ts`
- `server/src/db/repositories/mail-folders.repository.ts`
- `server/src/db/repositories/mail-messages.repository.ts`
- `server/src/services/rag-nodes/retrieve.service.ts`
- `server/src/services/knowledge-base.vector-store.ts`

## Related Docs

- `../concepts/CONCEPT_MCP.md`
- `../tooling-runtime/tools-protocol.md`
- `../tooling-runtime/harness-runtime-design.md`
- `../architecture/external-mcp-marketplace.md`
- `../microapp/README.md`
- `../architecture/README.md`
