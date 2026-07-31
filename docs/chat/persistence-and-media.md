---
status: current
owner: chat / runtime
last_verified: 2026-08-01
layer: raw-source
module: Chat
feature: PersistenceAndMedia
doc_type: current-reference
canonical: true
related:
  - ../CHAT_CURRENT_TRUTH.md
  - README.md
  - ../uchat.md
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - ../MICROAPP_CURRENT_TRUTH.md
---

# Chat 持久化、附件与媒体

> 本页集中说明 Thread / Message 如何落库，失败和取消留下什么，编辑与重新生成怎样改写历史，以及附件、TTS、图片和删除清理的当前边界。

## 1. SQLite 对象

### Chat Workspace

```text
chat_workspaces
├─ id
├─ user_id
├─ name
├─ root_path
├─ status
├─ created_at
└─ updated_at
```

### Thread

```text
threads
├─ id
├─ user_id
├─ title
├─ model_name
├─ workspace_id
├─ knowledge_base_id
├─ role_id
├─ agent_enabled
├─ context_summary
├─ status
├─ created_at
└─ updated_at
```

`tts_enabled`、`image_enabled` 等字段由后续 migration 补入，Thread service 已作为当前字段读取和更新。

### Message

```text
messages
├─ id
├─ thread_id
├─ role
├─ content
├─ parts_json
├─ metadata
└─ created_at
```

Message 没有：

- parent_id；
- status；
- updated_at；
- error column；
- version / branch table。

流式状态、错误和 lineage 主要存在于 UChat runtime 或 metadata 中。

## 2. User Message 落库

Backend 在三条 Chat 路径开始执行前都会调用 `persistVisibleUserMessage`。

它会：

1. 找到请求中最新 User Message；
2. 使用 message.id、request messageId 或新 UUID；
3. 计算前一条可见 Message id；
4. 保存 content、parts 和 lineage metadata；
5. 必要时裁掉旧 tail。

因此模型、RAG 或 Agent 后续失败时，User Message 通常已经存在。

## 3. Assistant Message 落库

### Normal / Agent persisted stream

只有：

```text
finishReason = stop
+ answer is non-empty
```

才写 Assistant Message。

Assistant id 在请求开始前生成，并与 AgentRun 可共享，用于把最终 Agent delivery 绑定到同一消息身份。

### RAG

RAG Assistant 成功后额外写 metadata：

```text
rag.enabled
rag.question
rag.topK
rag.topN
rag.sources[]
rag.routeReason?
```

Knowledge Base 为空时固定拒答也会被持久化，并标记 `knowledge-base-empty`。

### Title

首轮成功回答后，若 Thread title 为空或“新对话”：

1. 使用 Task model 根据 question + answer 生成标题；
2. 最长 50 字符；
3. 失败则从 User 内容生成本地 fallback；
4. 标题生成在 Assistant 持久化之后异步执行。

## 4. 错误

### SSE error

Backend 可能发送：

```text
error
finishReason = error
```

此时 Assistant 不满足持久化条件。

Desktop UChat 会显示当前 error Message，但 reconcile 或应用刷新后，backend Thread 里可能没有这条 Assistant，只剩 User Message。

### Route / transport error

若请求在正常 SSE 前直接失败：

- UChat 移除乐观 Assistant；
- User Message 是否已落库取决于失败发生点；
- 对于已进入 persistent route 的多数执行失败，User 已先保存；
- runtime 尝试重新读取 Thread。

### Agent error

AgentRun 可以保存 terminalReason / errorMessage / observations。Assistant Message 是否存在取决于 Agent 输出如何最终投影。

因此调试 Agent 失败时应同时查看：

```text
Thread Messages
+ AgentRun
+ execution trace
```

## 5. Cancel

Desktop 当前 Stop：

```text
Abort frontend Fetch
→ remove local Assistant placeholder
→ set cancelled
→ refresh persisted Thread
```

Server route 没有从该 AbortSignal 获得结构化 cancellation token，也没有统一调用 Provider abort、RAG abort、AgentRun cancel 或 Tool process cancel。

正确口径：

```text
Stop = stop current desktop stream consumption
```

不能写成：

```text
Stop = all backend work terminated
```

## 6. Edit / Regenerate

### Backend prune

Message create / update 接收到 parentId 或 lineage parent 时，会：

1. 找到 anchor；
2. 取得其后的全部 Message；
3. 删除 trailing Message；
4. 清理其 File attachment 与 ChatMedia；
5. 更新原 Message 或写新 Message。

### Regenerate

Regenerate 重用原 User id，旧 Assistant 及其后续历史被删除。

### Edit User

Edit 更新原 User id 和 parts，再删除其后的全部历史并重新生成。

由于数据库没有 parent_id / version table，旧 tail 不可恢复。

## 7. Canonical Parts

### Text

Text part 是模型和 UI 正文。

### Image

保存：

- attachment URL；
- filename；
- fileId；
- mediaType。

图片是否能进入模型取决于 concrete Provider / model 的图片输入支持。

### File

保存：

- attachment URL；
- filename；
- fileId；
- mimeType。

生成请求前，本地 Reader 把最新 User Message 的 File parts 解析为文本。

### Data

用于 execution node 等运行时结构化展示。部分 data part 可能只存在于前端 runtime，并在发送后 merge 时保留。

## 8. Attachment 上传

当前 endpoint：

```text
POST /attachments
```

限制：

- 一次一个文件；
- 最大 8 MB；
- 需要认证；
- 保存到本地 attachment storage。

图片白名单：

```text
webp png jpg jpeg gif
```

文件白名单包括：

- txt / md / markdown；
- csv / tsv；
- json / jsonl / yaml / xml；
- 常见代码、配置与日志；
- pdf / docx / pptx / xlsx。

非图片在上传成功前先调用 Structured Document Reader 验证可解析性。解析失败会删除刚保存的文件并返回 400。

## 9. File Context

生成前只处理最新 User Message 里的 File parts：

```text
[文件: filename]
[类型: mimeType]
parsed text
[文件结束: filename]
```

历史 File attachment 不会在每次请求重新注入全文。历史 Message 仍可保留文件卡片，但模型上下文主要依赖当时已产生的对话内容或 Summary。

## 10. Attachment 清理

### 已覆盖

- 删除含 File part 的 Message；
- Thread 删除；
- Edit / Regenerate 裁尾；
- 修改 Message 时移除不再引用的 File part。

### 未覆盖

#### 上传后未发送

Composer 上传完成后若用户移除附件或放弃发送，当前没有 attachment delete endpoint，远端文件仍在 storage。

#### 普通 Image part

清理 helper 只处理 `type = file`。由 `/attachments` 上传的 Image part 在 Message / Thread 删除时没有走同一文件删除逻辑。

#### 引用计数

当前没有统一 asset reference table、引用计数或周期 GC。

## 11. ChatMedia

ChatMedia 用于系统生成的媒体 Artifact，不等同于用户上传 Attachment。

当前类型：

```text
audio
image
```

保存 Message、task id、absolute path、mime type 和 preview access information。

Thread / Message 删除会调用 ChatMedia service 清理这些记录和文件。

## 12. TTS

条件：

```text
ttsEnabled = true
+ Assistant text succeeded
+ TTS capability enabled
```

流程：

```text
Message metadata: running
→ call Windows / Piper / GPT-SoVITS / API provider
→ attach audio ChatMedia
→ success preview
```

失败写到：

```text
message.metadata.media.tts
```

文本 Assistant 不会因为 TTS 失败回滚。

## 13. Image 后处理

自动图片生成条件：

```text
imageEnabled = true
+ roleId is bound
+ knowledgeBaseId is empty
+ Assistant text succeeded
+ Image capability enabled
```

Assistant text 直接作为 prompt。

流程：

```text
Message metadata: running
→ Image Generation Runtime / ComfyUI
→ wait for succeeded Artifact
→ attach image ChatMedia
```

知识库 Thread 当前禁用这条自动图片路径，避免 RAG 回答文本自动变成图片 prompt。

## 14. 删除行为

### Delete Message

- 验证所属 Thread 和 user；
- 删除生成 ChatMedia；
- 删除 File attachments；
- 删除 Message；
- touch Thread updatedAt。

### Delete Thread

- 删除全部 ChatMedia；
- 遍历 Message 清理 File attachments；
- 删除 Thread；
- Messages 通过 cascade 删除。

### Delete Chat Workspace

- 默认 Workspace 不允许删除；
- 当前 service 先硬删除所有绑定该 Workspace 的 active Threads；
- 再删除 Workspace；
- archived Thread 的 workspace_id 由外键 SET NULL。

### Delete Knowledge Base

当前是已确认的高严重度缺陷：

```text
knowledge_bases delete
→ threads.knowledge_base_id ON DELETE CASCADE
→ bound Threads delete
→ Messages delete
```

删除 Knowledge Base 前没有显式 Thread detach 或历史保护。

## 15. 修复优先级

### High

修复 Knowledge Base 外键和删除流程：

- migration 改 `ON DELETE SET NULL`；
- 删除前显式解绑 Thread；
- 加回归证明 Thread / Message 保留；
- UI 删除确认说明影响。

### Medium

- 后端结构化 cancellation；
- 错误 Assistant 持久化；
- Attachment delete endpoint 与 orphan GC；
- Image attachment 清理；
- Workspace 删除对 Thread 的明确策略。

### Product decision

- 是否恢复真正 branch / message version；
- 是否启用 Normal Chat Tool Loop；
- 是否实现 per-thread model binding；
- Summary 是否自动滚动；
- Memory slot 接入何种长期记忆来源。

## 16. 代码锚点

- `server/src/db/thread.db.ts`；
- `server/src/services/thread.service.ts`；
- `server/src/routes/proxy-provider/message-persistence.ts`；
- `server/src/routes/proxy-provider/chat.routes.ts`；
- `server/src/routes/proxy-provider/rag-thread.ts`；
- `server/src/routes/attachments.ts`；
- `server/src/services/chat-file-context.service.ts`；
- `server/src/services/chat-media.service.ts`；
- `desktop/src/shared/uchat/core/runtime.ts`；
- `desktop/src/features/chat/core/protocol.ts`；
- `desktop/src/features/chat/adapters/chatMediaOrchestration.ts`。
