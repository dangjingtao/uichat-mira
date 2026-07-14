---
status: current
priority: P1
owner: microapp / runtime
last_verified: 2026-07-14
layer: project-control
module: MCP
feature: MicroAppInfoSearch
doc_type: task-card
canonical: true
related:
  - docs/microapp/news-and-mail-mcp-design.md
  - docs/tooling-runtime/tools-protocol.md
  - docs/project-control/project-control-ledger.md
task_state: DONE
---

# microapp_info_mcp_001 News Search Integration

## Target

把现有资讯中心接入 `web_search` 的内部搜索来源。

本卡同时负责资讯侧的通用检索适配：复用现有 embedding、cosine similarity、rerank 和模型配置能力，支持资讯关键词与向量候选的混合排序。

本卡不把资讯中心注册成独立 MCP tool，不接入邮件，不实现 OpenAI tunnel 或倾城时光。

## Allowed Changes

- `server/src/microapps/news-hub/**`
- `server/src/db/repositories/news-items.repository.ts`
- 资讯 embedding 索引所需的明确新文件，限于 `server/src/db/repositories/` 或 `server/src/services/retrieval/`
- 通用检索适配所需的新文件，限于 `server/src/services/retrieval/**`
- `server/src/mcp/tools/web-search.tool.ts` 及其定向测试
- `server/src/services/internal-capabilities/` 现有 embedding / rerank 能力只能通过调用复用；除非发现明确接口缺口，不得修改现有模型能力实现
- 本卡直接相关的 server tests
- 本任务卡自身

## Forbidden Changes

- `server/src/microapps/mail-center/**`
- `server/src/db/repositories/mail-*.ts`
- `server/src/mcp/tools/mail-query.tool.ts`
- `server/src/harness/**`
- `desktop/**`
- `electron/**`
- `tauri/**`
- OpenAI tunnel、Cloudflare Worker、倾城时光或外部资料投送链路
- NewsHub 页面配置和 API Key 展示语义

## Implementation Constraints

- `web_search` 的模型可见输入仍只允许 `query` 和 `maxResults`。
- provider、API Key、Base URL 和来源选择不能由模型输入决定。
- 资讯读取必须区分缓存读取和刷新，禁止普通 Search 查询隐式触发网络请求和数据库写入。
- 资讯候选不得伪装成知识库 `RetrievedChunk`；使用通用候选结构并保留 `sourceKey`、`url`、`publishedAt` 和 tags。
- 必须复用现有 embedding / rerank 执行入口，不重复实现模型调用。
- 现有 Hacker News、GitHub Changelog、NewsData、Currents、Reddit 的行为不得被无关改写。

## Acceptance Criteria

1. 明确拆分资讯缓存查询和资讯刷新语义。
2. `web_search` 在明确资讯意图下可以查询本地 `news_items`。
3. 关键词召回和 embedding 召回可以合并、去重并排序。
4. 可选 rerank 使用现有 rerank 能力，未配置或失败时有明确降级结果。
5. Search 输出转换为统一 SearchResult，不泄露 NewsHub 配置密钥。
6. 结果保留资讯来源、文章 URL 和发布时间等可追溯信息。
7. 普通读取不会隐式刷新资讯来源。
8. 定向测试覆盖关键词命中、向量候选融合、rerank 降级、缓存读取和来源元数据。
9. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/mcp/tools/web-search.tool.test.ts src/services/retrieval/hybrid-retrieval.test.ts src/microapps/news-hub/news-search.adapter.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证资讯 adapter、混合检索和 Search strategy
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 server / workspace 类型检查
- `rg -n "apiKey|clientSecret|smtpPassword|imapPassword" server/src/mcp/tools/web-search.tool.ts server/src/services/retrieval`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查资讯 Search 结果和检索层没有回传敏感配置
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence Requirements

- 列出新增或修改的资讯检索文件。
- 记录 embedding、keyword、rerank 三阶段的候选数量和降级状态。
- 记录定向测试和 `pnpm check` 的实际结果。
- 明确列出未实现的 Atom、分页、自动刷新或来源扩展边界。

## Isolation Rules

- 本卡拥有资讯检索 adapter 和 `web_search` 内部资讯 strategy 的实现范围。
- 邮件卡只能复用本卡提供的通用检索接口，不得修改资讯文件。
- MCP 治理卡只能注册和暴露已完成的 strategy，不得在本卡之后重新定义资讯业务查询语义。

## Unfinished / Risks

- 当前 RSS 解析实现只覆盖 `<item>`；Atom `<entry>` 未纳入本卡。
- 未实现 Atom、分页、自动刷新、外部来源扩展；刷新仍需通过既有 NewsHub refresh 语义显式触发。
- 资讯配置当前是全局设置，本卡未扩展为用户级配置。

## Implementation Evidence

- 新增 `server/src/services/retrieval/types.ts`、`hybrid-retrieval.ts`：通用候选结构、RRF 融合、去重和现有 local rerank 调用，记录 keyword/vector/fused/reranked 数量及 embedding/rerank 降级状态。
- 新增 `server/src/db/repositories/news-items-vector.repository.ts`：独立 `news_item_embeddings` 索引表；由 NewsHub service 创建阶段初始化，显式 refresh 阶段生成并写入资讯 embedding，Search 阶段只读且按当前 model/modelConfigId 过滤。
- 启动顺序修正：索引表初始化已移至 `newsItemsRepository.initialize()`，该方法由 `setupDatabase()` 在 `DATABASE_URL` 设置后调用；NewsHub service 构造阶段不再访问数据库。
- 新增 `server/src/microapps/news-hub/news-search.adapter.ts`：明确资讯意图查询本地缓存，合并关键词和向量候选，转换为统一 SearchResult 并保留 `sourceKey`、`sourceName`、`url`、`publishedAt`、`tags`。
- `server/src/microapps/news-hub/index.ts` 新增 `getCachedOverview()`；普通缓存读取不刷新网络、不写数据库，既有页面 `getOverview()` 的刷新行为保持不变。
- `server/src/mcp/tools/web-search.tool.ts` 保持模型输入仅为 `query` 和 `maxResults`；明确资讯意图走 `local_news_hub` strategy，公共 provider 配置不进入 Search 结果。
- 定向验证：`pnpm --filter @ui-chat-mira/server exec vitest run src/mcp/tools/web-search.tool.test.ts src/services/retrieval/hybrid-retrieval.test.ts src/microapps/news-hub/news-search.adapter.test.ts`，3 个测试文件、21 个测试通过。
- 服务端类型验证：`pnpm --filter @ui-chat-mira/server typecheck` 通过；当前重跑 `pnpm check` 被 `packages/deepagents-spike` 的 Node/V8 原生 OOM（退出码 `3221225477`）中断，未产生 TypeScript 诊断。
- 复核修正：向量索引与资讯映射使用全量缓存，刷新按 32 条批次生成 embedding；rerank 空返回按不可用降级处理，不伪报 `used`。
- 新增缓存隔离测试：直接调用 `getCachedOverview()`，确认不执行来源清理写入且不触发 fetch。
