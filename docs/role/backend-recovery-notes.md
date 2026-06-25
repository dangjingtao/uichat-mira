# Role / Summary Backend Recovery Notes

本文件记录当前后端对 `Role` 与线程 `contextSummary` 的正确接入边界，避免后续回退时再次把“可见消息”和“请求态上下文”混在一起。

## Thread Persistence

- `threads` 表必须持久化以下字段：
  - `knowledge_base_id`
  - `role_id`
  - `context_summary`
  - `context_summary_updated_at`
- `thread` 路由的 `create / update / get / list` 返回结构必须透出：
  - `roleId`
  - `contextSummary`
  - `contextSummaryUpdatedAt`

## Request-Only Context Boundary

- 线程绑定的 `Role` 和 `contextSummary` 都属于 request-only context。
- 它们不能被写入普通 `messages` 历史，也不能作为可见聊天消息返回前端。
- 统一由 [server/src/services/shared-nodes/thread-request-context.node.ts](/D:/workspace/rag-demo/server/src/services/shared-nodes/thread-request-context.node.ts) 解析。

当前 resolver 顺序：

1. `Role`
2. `contextSummary`

这样可以保证“稳定角色骨架”在前，“线程动态摘要”在后。

## Default Chat Path

默认聊天路径在 [server/src/routes/proxy-provider/chat.routes.ts](/D:/workspace/rag-demo/server/src/routes/proxy-provider/chat.routes.ts)。

正确行为：

- 读取线程元数据
- 通过 `threadRequestContextNode.createRequestMessages()` 生成 request-only system messages
- 将这些消息 prepend 到默认聊天请求 `messages`
- 如果线程绑定了 `Role`，同步读取 `role.llmProfile`
- 将 `llmProfile` 作为 provider params 传入默认聊天调用

## RAG Path

RAG 路径的边界更严格：

- `Role` / `contextSummary` 不能进入 `rewrite`
- 不能进入 `retrieve`
- 不能进入 `rerank`
- 只能进入 `generate`

因此：

- `toRagInput()` 只从可见消息里提取：
  - `question`
  - `conversationHistory`
- `requestContextMessages` 单独透传给 `ragPipeline.assistantStream()`
- `generateService.buildMessages()` 负责把：
  - `requestContextMessages`
  - RAG system prompt
  - visible conversation history
  - latest user query
  组织成最终生成请求

## Stream Protocol

- 默认聊天与 RAG 聊天都应该继续返回 `text/event-stream`
- 如果错误地切回 `prepareDataStreamReply()`，前端可能出现：
  - 消息被吞
  - loading 无法正确结束
  - SSE 事件无法按预期消费

## Minimal Recovery Checks

回归时至少验证以下事实：

1. 创建线程时 `roleId` 能持久化并读回
2. 默认聊天分支能注入 `role + summary`
3. 默认聊天分支能附带 `role.llmProfile`
4. RAG 分支 `conversationHistory` 不包含 role prompt
5. RAG 分支 `requestContextMessages` 包含 `role + summary`
