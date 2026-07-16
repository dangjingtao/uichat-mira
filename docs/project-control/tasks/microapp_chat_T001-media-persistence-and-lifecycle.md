---
status: current
priority: P1
owner: chat / microapp
last_verified: 2026-07-15
layer: project-control
module: Chat
feature: ChatMediaIntegration
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/chat/uchat-governance/boundary-contract.md
  - server/src/services/thread.service.ts
  - server/src/microapps/tts/index.ts
  - server/src/microapps/image-generation/core/service.ts
task_state: DONE
---

# microapp_chat_T001 Media Persistence And Lifecycle

## Target

建立聊天 TTS/生图媒体的持久化和文件生命周期基础。媒体必须绑定现有助手消息，数据库保存绝对路径，且能在消息或线程生命周期结束时清理产物。

## Prerequisite

- 聊天媒体接入设计已由 `docs/chat/uchat-governance/boundary-contract.md` 明确。
- 不改 AgentGraph、RAG、Chat、Role 核心逻辑。

## Core Principles

- 不得为了通过测试、冒烟或类型检查而修改已有业务核心逻辑。
- 不得绕过、削弱或重新解释既定的 AgentGraph、RAG、Chat、Role 业务边界。
- 如果测试暴露的是既有核心逻辑问题，必须记录为任务外缺陷并停止扩大本卡范围，不得在本卡中加入 workaround、fallback 或兼容分支。
- 所有新增行为只能建立在现有消息结果、线程状态和微应用配置之上。

## Allowed Changes

- `server/src/db/schema.ts` 中与聊天媒体、TTS 消息关联、生图任务持久化相关的新增结构
- `server/src/db/repositories/**` 中对应 repository
- `server/src/services/**` 中媒体关联、绝对路径校验、文件读取和清理服务
- `server/src/routes/thread/**` 和 `server/src/routes/microapps/**` 中媒体读取、关联和清理接口
- `server/src/microapps/image-generation/**` 中把当前内存 job store 替换为持久化 store 所需的适配代码
- 直接相关的 server tests 和本任务卡

## Forbidden Changes

- `server/src/agent/**` 及 AgentGraph 编排、节点、工具循环、审批逻辑
- RAG rewrite/retrieve/rerank/generate 核心逻辑
- Chat 文本请求、流式协议、消息历史组装核心逻辑
- Role 数据模型、prompt 注入和请求编排
- TTS Studio 或 Image Generation Studio 的详细配置界面和 provider 参数协议
- 修改 `ChatMessagePart` 增加 `audio` 或生图专用 part

## Acceptance Criteria

1. TTS 和图片媒体都能关联 `threadId`、`messageId`、任务 ID 和媒体类型。
2. 数据库存储绝对文件路径；相对路径、越出媒体根目录的路径不能写入或读取。
3. backend 提供受控媒体读取接口，renderer 不直接读取本地路径。
4. 生图任务不再只存在进程内存中，服务重启后可查询已持久化任务和产物。
5. 重新生成、消息分支清理、删除消息和删除线程时，媒体记录与文件都能清理。
6. 清理失败有明确错误记录，不删除仍被其他消息引用的媒体。
7. 不修改现有 `ChatMessagePart`、provider 请求历史和 RAG/Role 数据语义。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/services/chat-media.service.test.ts src/db/repositories/image-generation-jobs.repository.test.ts src/routes/thread/threads.routes.test.ts src/services/thread.service.test.ts src/routes/microapps/index.test.ts`
- `pnpm --filter @ui-chat-mira/server typecheck`
- `git diff --name-only` 检查没有触碰 forbidden area

## Verification Evidence

- 2026-07-15: `pnpm --filter @ui-chat-mira/server exec vitest run src/services/chat-media.service.test.ts src/db/repositories/image-generation-jobs.repository.test.ts src/routes/thread/threads.routes.test.ts src/services/thread.service.test.ts src/routes/microapps/index.test.ts` passed: 5 files, 44 tests.
- 2026-07-15: `pnpm --filter @ui-chat-mira/server typecheck` passed.
- 2026-07-15: `$env:NODE_OPTIONS='--max-old-space-size=4096'; pnpm check` passed. The default Windows Node heap limit previously caused exit code `3221225477` without type diagnostics.
- 2026-07-15: attach now requires the referenced TTS/image task to be `succeeded`; the media service regression test rejects a `running` image task before any association is created.
- 2026-07-15: boundary audit used an explicit T001 file manifest and checked only those paths; the manifest contains no `server/src/agent`, RAG, provider proxy, or Role path. The concurrently modified `server/src/agent/computer-use/model-loop.ts` is explicitly excluded as T122/T123 work and is not attributed to T001.
- 2026-07-15: attach and cleanup database updates use a single SQLite transaction; cleanup has compensation for file deletion failure and returns structured failure records.
- 2026-07-15: lifecycle tests directly cover regenerate, branch pruning, message deletion, and thread deletion, including file, `chat_media`, and `metadata.media` assertions.
- 2026-07-15: image-generation service restart tests cover a real materialized artifact, database client restart, service recreation, HTTP job query, and HTTP artifact content read.
- 2026-07-15: closed the evidence gap in the HTTP restart test by resetting database clients before recreating the HTTP service; lifecycle assertions now also verify regenerated assistant metadata loses `media` and deleted/pruned messages no longer remain.

## Risks

- 绝对路径属于本机部署数据，读取接口必须校验路径范围。
- 重新生成会触发既有消息分支清理，媒体清理必须与该生命周期协调，不能只清前端状态。
