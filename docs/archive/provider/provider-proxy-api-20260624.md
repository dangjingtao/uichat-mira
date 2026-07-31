# Provider Proxy API

Layer: raw-source
Module: ModelSetting
Feature: ProviderProxy
Doc Type: current-contract

Status: Current
Owner: runtime
Last verified: 2026-06-24

## 单点真相范围

这页文档统一说明：

- provider 无关的 chat / embeddings 代理层公开协议
- 当前桌面聊天对消息、线程、附件协议的依赖
- knowledge-base 导入流程与 provider proxy 的边界

相关概念：

- [[CONCEPT_RUNTIME]]
- [[CONCEPT_MCP]]
- [[CONCEPT_UCHAT]]
- [[maps/AREA_MAP_RUNTIME]]

## 概览

后端暴露了一层 provider-agnostic proxy，用来承接 chat 和 embeddings。公开代理路由元数据集中维护在 `server/src/config/public-api.ts`，再通过 Fastify route schema 挂到 Swagger。

非生产环境下，Swagger UI 挂在 `/docs`，可在不带 bearer token 的情况下访问。

- Chat stream endpoint: `POST /proxy/chat/:provider`
- Embeddings endpoint: `POST /proxy/embeddings/:provider`

支持的 `:provider`：

- `default`
- `ollama`
- `lmstudio`
- `openai`

`default` 会按当前角色对应的默认模型配置解析：

- chat 用 `llm`
- embeddings 用 `embedding`

## Chat

`POST /proxy/chat/:provider`

桌面聊天当前只允许一套请求协议。前端会在发送前把运行时消息显式投影为应用自有协议，然后后端再把这套协议归一化成 provider 可消费的 `NormalizedChatMessage[]`。

相关实现：

- 前端发送侧：`desktop/src/app/layouts/BaseLayout/chatRuntime.tsx`
- 前端图片附件：`desktop/src/features/chat/core/protocol.ts`
- 后端协议层：`server/src/services/provider-proxy.message-protocol.ts`
- 后端路由 schema：`server/src/routes/proxy-provider/schemas.ts`

Request body:

```json
{
  "messages": [
    {
      "id": "optional-client-message-id",
      "role": "user",
      "parts": [
        { "type": "text", "text": "请描述这张图片" },
        {
          "type": "image",
          "image": "/attachments/7df1....webp",
          "filename": "image.webp"
        }
      ]
    }
  ]
}
```

规则：

- 只接受 `messages[].parts[]`
- part 类型只接受 `text`、`image`、`file`
- `image` 和 `file` part 会在到达后端前由桌面运行时先做归一化
- 不支持顶层 `content` 或 `content.parts` 之类 legacy mixed shape
- renderer 负责始终发送 canonical shape
- 后端 route schema 会拒绝每个 part item 中的额外字段

附件说明：

- 桌面 renderer 会先把上传图片转换成 WebP
- 上传通过 `POST /attachments`
- 聊天消息只持久化内部 attachment URL，不落 inline base64
- 调 provider 前，后端会把内部 attachment URL 解析成 provider 可消费的图片载荷

当前协议边界：

- 当前 chat send path 只会在 `send()` 开始时上传附件
- 在 composer 里选择文件，不会立刻创建持久化的服务端 attachment 记录
- 删除未发送附件因此仍是纯前端动作，不需要附件删除 API
- `POST /attachments` 当前只接受图片上传，桌面 UI 的 file picker 与 paste handling 也应保持同一限制

响应：

- `text/event-stream`
- 使用当前桌面 chat runtime 消费的 SSE 格式
- 当 `provider=default` 且当前线程绑定了 `knowledgeBaseId` 时，可能分流到 RAG pipeline

线程元数据：

- 请求体里的 `id` 表示当前远端 thread id
- 请求体里的 `messageId` 表示最新 user message id
- 这两个字段由前端 transport layer 注入，供后端对齐 RAG 持久化、重新生成和标题生成逻辑

## Thread 与 message 协议

当前桌面 chat 依赖下面这些 thread-side contract：

- `GET /threads` 只返回轻量 thread summaries
- `GET /threads/:id` 返回带 canonical `messages[]` 的完整 thread detail
- `messages[].parts[]` 是唯一接受的消息回放 shape
- 桌面 renderer 不再从 legacy metadata 在前端重建消息附件
- `PATCH /threads/:id` 当前用于 `title`、`knowledgeBaseId` 这类可变线程字段
- `DELETE /messages/:id` 已存在，可删除一条已持久化消息，但桌面 `uchat` runtime 还没在 UI 层暴露这项能力

### Legacy compatibility 状态

当前后端写入和 runtime 语义都收口到 canonical message shape：

- `parts` 是主消息内容源
- `assistantUi` 只作为兼容 / 展示辅助
- 新的 assistant / user message 写入不应再引入对 `assistantUi` 的新语义依赖

### 当前限制

当前公开 thread / message 协议足以支撑：

- 首发发送时建线程
- 普通非 RAG 消息持久化
- 按 `knowledgeBaseId` 进行 RAG / 非 RAG 分流
- thread 标题回刷和消息回放
- 通过 canonical `parts` 回放图片附件

但它还不足以成为 `uchat` 全量分支能力的显式公开契约，例如 regenerate、edit-message、branch navigation。

### 已确认的后续协议工作

下面这些协议变化已明确属于 `uchat` 核心能力扩展的后续工作：

1. 暴露稳定的 message lineage  
   `GET /threads/:id` 后续应显式返回稳定的 `messages[].parentId`，而不是让前端从线性顺序里反推父子关系。

2. 增加明确的 message edit 契约  
   当前只有 `createMessage` 和 `deleteMessage`，还没有清晰的公共 message edit route。后续应增加 `PATCH /messages/:id` 或等价的消息变更契约。

3. 增加明确的 regenerate 契约  
   regenerate 不应长期停留在“客户端在 generic send 上自己叠一层隐式行为”的状态。后续要明确从哪个 message id 开始、替换旧 assistant 还是新建分支、返回 lineage 怎么表达。

4. 明确 cancellation 语义  
   当前桌面 runtime 可以在 UI 接通后取消本地 request transport，但 cancellation 还不是已文档化的持久化消息状态。如果后续需要 durable `cancelled` 状态或后端任务中断协议，就要单独设计 cancel contract。

5. 区分 attachment response 里的展示文件名和存储文件名  
   后续公共 attachment response shape 应显式区分：
   - original display filename
   - stored server filename / path key
   - public attachment URL

## Embeddings

`POST /proxy/embeddings/:provider`

Request body:

```json
{
  "input": ["第一段文本", "第二段文本"]
}
```

Success response payload:

```json
{
  "success": true,
  "data": {
    "providerCode": "ollama",
    "model": "nomic-embed-text",
    "modelConfigId": "xxx",
    "dimensions": 768,
    "embeddings": [[0.1, 0.2], [0.3, 0.4]]
  },
  "timestamp": "2026-06-09T00:00:00.000Z"
}
```

## Knowledge Base 导入边界

knowledge-base 文档导入不要求前端直接调用 embeddings endpoint。

当前桌面上传流程会把 `multipart/form-data` 发到 `POST /knowledge-base/documents/upload`。后端先存储抽取后的文本，再异步做索引。

导入流水线包括：

1. 上传文件并提取 UTF-8 文本
2. 创建 `indexStatus = processing` 的 document 记录
3. 后台执行文本归一化与 chunking
4. 通过 provider proxy service 批量生成内部 embedding
5. 把向量写入 SQLite vector table
6. 把 document 状态更新为 `ready` 或 `failed`

旧的 JSON 路由 `POST /knowledge-base/documents` 仍保留给直接文本导入，但桌面 UI 已不再通过这条路径发送大段正文。

这样可以把 provider-specific 行为继续封装在后端 service layer 内部。

## Provider 设置流程边界

模型设置页里的“服务商已链接”只表示某个角色已经分配了 `providerCode` 与 `remoteModelId`，不等同于一次实时 provider 健康检查。

当前连接流程仍分三步：

1. 保存 provider 连接配置。
2. 同步 provider 模型列表到本地缓存。
3. 从本地缓存中选择默认角色模型。

选择默认模型依赖最近一次同步后的本地模型缓存。修改 `baseUrl` 或 `apiKey` 后，应重新同步模型列表，再选择角色模型；当前后端不在选择阶段隐式重试同步，也不添加旧缓存兼容兜底。

Rerank 是独立能力，不从 Chat 兼容性推断。只有 catalog 中显式声明 `rerankAdapter: "openai-compatible"` 的 provider 会调用 `/v1/rerank`。
