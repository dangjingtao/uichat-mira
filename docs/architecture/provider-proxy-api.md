---
status: current
owner: runtime
last_verified: 2026-07-31
layer: schema
module: ModelSetting
feature: ProviderProxy
doc_type: current-contract
canonical: true
related:
  - ../PROVIDER_CURRENT_TRUTH.md
  - ../provider/FIRST_MODEL_SETUP.md
  - provider-api-standards.md
  - ../archive/provider/README.md
---

# Provider Resolution 与 Proxy Runtime

## 1. 文档范围

本页定义模型角色如何解析为具体 Provider Connection、模型和 adapter，以及 Chat、Embedding、Rerank 调用如何形成 Invocation 与 Observation。

本页不再承载：

- Thread / Message 完整协议；
- 附件上传生命周期；
- RAG 文档导入；
- regenerate / edit-message 规划；
- Provider 设置 UI 操作；
- Image Generation / TTS Studio Runtime。

首次配置见 [[provider/FIRST_MODEL_SETUP]]；协议族见 [[architecture/provider-api-standards]]。

## 2. 当前 Runtime 入口

Provider Proxy 当前公开注册：

```text
POST /proxy/chat/:provider
POST /proxy/embeddings/:provider
```

`:provider` 使用：

```text
default
ollama
lmstudio
openai
google
cloudflare
volcengine
```

`default` 表示按角色默认绑定解析。

显式 provider 不是任意连接选择器。当前 Runtime 会验证显式值是否与角色配置最终解析出的 runtime provider code 一致；不一致时拒绝调用。

Rerank 当前主要由内部 Provider Proxy service 解析，不是这个公开 route plugin 的独立公共路由。

## 3. 角色与调用入口

| 调用 | role | 解析方式 |
| --- | --- | --- |
| 普通 Chat | `llm` | `resolveProviderForRole("llm")` |
| Agent / Task Text | `agentTask`，未配置时回退 `task` | `resolveAgentTaskProvider()` |
| 评测或其他角色生成 | 传入具体 role | `generateTextForRole()` |
| 远程 Embedding | `embedding` | `resolveProviderForRole("embedding")` |
| 远程 Rerank | `rerank` | `resolveProviderForRole("rerank")` + adapter 检查 |
| 评测显式模型 | 显式 provider + model | `resolveExplicitProviderSelection()` |

## 4. `resolveProviderForRole`

角色解析顺序：

```text
读取默认 ModelRoleConfig
→ 检查 remoteModelId
→ 优先使用 providerConnectionId
→ 兼容回退 providerCode
→ 加载 ProviderConnection
→ 检查 connection 存在且 enabled
→ 解密 API Key
→ 解析 runtime provider code
→ 校验 Base URL / 必需凭据
→ 解析可调用 model id
→ 读取并标准化角色参数
→ 应用 Provider / role 特判
→ 返回 ProviderResolution
```

输出：

```ts
{
  providerCode,
  providerConnectionId,
  providerTemplateCode,
  baseUrl,
  apiKey,
  model,
  modelConfigId,
  params,
}
```

调用层必须使用该结果，不应继续从显示名称或 UI 状态猜测 Provider。

## 5. Connection 校验

运行时会拒绝：

- Connection 不存在；
- Connection 被禁用；
- Base URL 为空；
- OpenAI / Cloudflare 缺少 API Key；
- Cloudflare URL 仍包含 Account ID 占位符；
- Cloudflare URL 格式不符合当前约束；
- 角色没有 Provider 或 remote model 绑定；
- 显式 provider 与默认角色解析结果不一致。

其他 Provider 是否要求 API Key，由上游服务真实响应决定；当前统一预校验只对 OpenAI 和 Cloudflare强制非空。

## 6. Model ID 解析

普通 Provider 直接使用 `ModelRoleConfig.remoteModelId`。

需要 callable model id 前缀的 Provider，例如 Cloudflare，按以下顺序解析：

```text
remoteModelId
→ ModelRoleConfig.name
→ ProviderModel.modelName
→ error
```

当前 Cloudflare callable id 必须以 `@cf/` 开头。

Ollama 在真实 Chat / Embedding 执行前额外查询模型目录，确认模型已经下载。

## 7. AgentTask 回退

当前兼容逻辑：

```text
agentTask 已显式绑定
→ 使用 agentTask

agentTask 未绑定
→ 使用 task
```

该回退保证旧安装在新增 AgentTask role 后仍可运行。

它不表示 Task 与 AgentTask 是同一职责，也不表示后续可以永久只配置一个角色。

## 8. 角色参数

Provider Resolution 从角色配置读取参数，并在调用前标准化。

### 文本角色

可能包含：

```text
temperature
topP
topK
maxTokens
frequencyPenalty
presencePenalty
```

本次调用传入的 params 可以覆盖角色长期参数。

### 角色特判

`task / agentTask`：

- Ollama 注入 `think: false`；
- Volcengine 注入 `thinking: false`。

### Embedding

可能包含：

```text
dimensions
batchSize
normalize
chunkSize
chunkOverlap
```

只有 adapter 实际需要的参数进入上游请求。

### Rerank

```text
topN
scoreThreshold
```

## 9. Chat Adapter

### Ollama

调用：

```text
<baseUrl>/api/chat
```

消息投影：

- Text part 合并为 content；
- Image part 解析为 Ollama image payload；
- 使用 Ollama 原生流式响应；
- API Key 非空时作为 Bearer Header。

### OpenAI-compatible

调用：

```text
<resolvedBaseUrl>/chat/completions
```

消息投影：

- Text → text content；
- Image → `image_url`；
- File → 带文件标记的文本内容；
- Ark Plan 根据 Template 重写实际 Base URL；
- 使用流式文本 delta。

### 历史附件收缩

Provider 调用会保留最新用户消息中的附件；较早历史消息中的非文本附件会被移除，只保留仍有意义的文本部分。

这是当前 Provider payload 预算策略，不改变数据库中的原消息。

## 10. Chat Invocation Metadata

调用前可以生成：

```ts
{
  providerCode,
  providerLabel,
  protocol,
  operation,
  endpoint,
  model,
  modelConfigId,
  params,
  request: {
    method,
    url,
    body,
  },
}
```

Request body 是安全摘要，例如 message count、model 和标准参数，不应包含解密后的 API Key。

当前 operation：

```text
chat
task-chat
```

## 11. Chat 执行

普通文本调用：

```text
ProviderResolution
→ Chat Adapter
→ Stream upstream response
→ normalize text delta
→ require non-empty answer
→ complete / error stream
```

持久化 Chat 还会处理：

- User / Assistant message persistence；
- Agent 或默认 Tool Loop；
- Event stream；
- title generation；
- completion callback。

这些属于 Chat Runtime，不改变 Provider Resolution 合同。

## 12. Embedding Runtime

### 解析

```text
embedding role
→ ProviderResolution
→ adapter family
→ invocation endpoint
```

Endpoint：

| adapter | endpoint |
| --- | --- |
| Ollama | `<baseUrl>/api/embed` |
| OpenAI-compatible | `<baseUrl>/embeddings` |
| Cloudflare | Account AI run URL |

### 执行后验证

Provider Proxy 会检查：

- 输入去空后非空；
- 向量数量与输入数量一致；
- 第一条向量 dimensions > 0。

成功后，若 dimensions 与当前 role 参数不同，会回写实际 dimensions。

## 13. Rerank Runtime

Rerank 解析必须满足：

```text
ModelRoleConfig.type = rerank
Provider Template rerankAdapter = openai-compatible
```

否则立即失败。

当前 endpoint 由 OpenAI-compatible Rerank URL helper 生成。

Chat adapter 可用不能替代 Rerank adapter 声明。

## 14. 内置本地模型例外

Local Embedding / Rerank 不经过 Provider Connection Resolution。

```text
Local Model Resource
→ ONNX / WASM Runtime
→ local model result
→ Model Call Observation
```

它使用：

```text
providerCode = local
endpoint = local:model-runtime
```

因此 Provider Proxy 文档中的 Connection、API Key、模型目录同步不适用于该路径。

## 15. Observation

Shared Model Node 可以把 Invocation 和结果写为 Observation。

当前 environment 可包含：

```text
model.role
model.providerCode
model.providerLabel
model.protocol
model.operation
model.endpoint
model.model
model.modelConfigId
model.params
model.request
timing.startedAt
timing.finishedAt
timing.durationMs
result
retrieval
context
```

这提供了 Provider 身份、实际 endpoint、参数与耗时的可观测基础。

## 16. Token 与成本边界

当前 `ProviderInvocationMetadata` 不包含统一的：

```text
inputTokens
outputTokens
reasoningTokens
cachedTokens
cost
currency
```

部分上游响应可能带 usage，但 Provider Proxy 尚未形成跨 adapter 的统一归一化合同。

因此：

- 不能把所有调用都宣传为可准确统计成本；
- Observation 有 duration 不等于有 Token；
- 没有 usage 不应被估算后冒充供应商真实账单；
- 后续统一需要单独的 usage / pricing contract。

## 17. 当前已知漂移

### Custom OpenAI-compatible runtime provider code

`openai-compatible-custom` 当前在 Resolution 中映射为：

```text
providerCode = volcengine
```

这会复用 Volcengine adapter family 和角色特判，但会损失自定义连接的供应商中立身份。

目标上，Template/Connection 身份与协议 adapter 应能够独立表达；当前实现尚未完全收口。

### Image / Voice 不走统一 Proxy

全局角色 schema 中存在 `imageGeneration / voice`，但 Image Generation Studio 与 TTS Studio 当前主要使用独立 MicroApp provider config。

不能从 `resolveProviderForRole` 推断对应 Studio 的实际调用来源。

## 18. 错误语义

常见错误应保持具体：

- `No <ROLE> model configured`；
- role 没有 Provider 或 remote model；
- Provider 不存在或 disabled；
- Base URL / API Key 未配置；
- Cloudflare URL 无效；
- callable model id 无效；
- Ollama 模型未下载；
- Embedding 数量不匹配；
- Embedding 返回空向量；
- Provider 不支持 Rerank adapter；
- Model 返回空 assistant response。

调用方不应把这些错误全部折叠成“模型连接失败”。

## 19. 代码锚点

- `server/src/services/provider-proxy.service/resolution.ts`；
- `server/src/services/provider-proxy.service/chat-adapters.ts`；
- `server/src/services/provider-proxy.service/index.ts`；
- `server/src/services/provider-proxy.service/types.ts`；
- `server/src/routes/proxy-provider/`；
- `server/src/services/shared-nodes/llm.node.ts`；
- `server/src/services/rag-node-observation.ts`；
- `server/src/services/local-model-runtime/`。
