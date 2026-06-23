# 对话系统开发实践

## 概述

本文档总结了在开发对话系统过程中，涉及对话列表管理、消息持久化、用户隔离和 Assistant UI 接入的经验教训和最佳实践。

---

## 一、对话列表管理（Thread List Management）

### 1.1 ThreadHistoryAdapter 实现要点

#### 核心接口设计
```typescript
interface ThreadHistoryAdapter<TMessage> {
  load(): Promise<{ messages: TMessage[] }>;
  append(message: TMessage): Promise<void>;
}
```

#### 常见陷阱

**陷阱 1：消息格式转换错误**

```typescript
// ❌ 错误：错误地访问 encoded.content
const encoded = fmt.encode(item);
const role = encoded.content.role; // TypeError: undefined

// ✅ 正确：encoded 本身就是消息内容
const encoded = fmt.encode(item);
const role = encoded.role;
```

**陷阱 2：缺少错误处理**

```typescript
// ✅ 推荐：添加详细日志和错误处理
async append(item) {
  console.log("[ThreadAdapter] Raw item:", JSON.stringify(item));
  
  const encoded = fmt.encode(item);
  if (!encoded) {
    console.error("[ThreadAdapter] Encoded message is null/undefined");
    return;
  }
  
  if (!encoded.role) {
    console.error("[ThreadAdapter] Invalid message:", encoded);
    return;
  }
  
  // 保存到数据库
  await createMessage(threadId, {
    role: encoded.role,
    content: encoded.content,
  });
}
```

### 1.2 数据加载策略

**分页加载**：对于大量历史消息，实现分页加载避免一次性加载过多数据

```typescript
async load({ limit = 50, offset = 0 }) {
  const messages = await messageRepository.listByThread(threadId, limit, offset);
  return { messages, hasMore: messages.length === limit };
}
```

---

## 二、消息持久化（Message Persistence）

### 2.1 数据库表设计

#### Threads 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID |
| user_id | INTEGER | 用户ID（用户隔离） |
| title | TEXT | 对话标题 |
| model_name | TEXT | 使用的模型名称 |
| status | TEXT | active/archived/deleted |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

#### Messages 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| thread_id | TEXT | 关联的对话ID |
| role | TEXT | user/assistant/system |
| content | TEXT | 消息内容 |
| metadata | TEXT | 元数据（JSON） |
| created_at | TEXT | 创建时间 |

### 2.2 最佳实践

**自动更新时间戳**：

```sql
-- SQLite 自动更新 updated_at
CREATE TABLE threads (
  ...
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 更新时自动刷新
UPDATE threads SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
```

**索引优化**：

```sql
-- 按用户ID查询
CREATE INDEX idx_threads_user_id ON threads(user_id);

-- 按更新时间排序
CREATE INDEX idx_threads_updated_at ON threads(updated_at);

-- 按对话ID查询消息
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
```

---

## 三、用户隔离（User Isolation）

### 3.1 核心原则

**每一层都要验证**：从路由到服务到数据库，都需要验证用户权限

```
请求 → Route → Service → Repository → Database
         ↓         ↓           ↓
      获取用户   验证权限   用户隔离查询
```

### 3.2 实现策略

#### 数据库层

```typescript
// Repository 层：强制用户隔离
findById(id: string, userId: number): Thread | undefined {
  const conditions = [eq(threads.id, id), eq(threads.userId, userId)];
  return db.select().from(threads).where(and(...conditions)).get();
}
```

#### 服务层

```typescript
// Service 层：验证线程归属
createMessage(threadId: string, userId: number, input: CreateMessageInput) {
  // 先验证线程属于当前用户
  const thread = threadRepository.findById(threadId, userId);
  if (!thread) {
    throw new Error("Thread not found or not accessible");
  }
  
  // 创建消息
  return messageRepository.create({ threadId, ...input });
}
```

#### 路由层

```typescript
// Route 层：从认证信息获取用户ID
async (request, reply) => {
  const userId = request.authUser!.id;
  const result = threadService.getThreadById(request.params.id, userId);
  return success(result);
};
```

### 3.3 常见错误

**错误 1：忽略用户隔离**

```typescript
// ❌ 危险：任何人都可以访问任何对话
findById(id: string) {
  return db.select().from(threads).where(eq(threads.id, id)).get();
}
```

**错误 2：只在某一层验证**

```typescript
// ❌ 不完整：服务层验证了，但数据库查询没有过滤
// Service 层
getThread(id: string, userId: number) {
  const thread = threadRepository.findById(id); // 没有传 userId!
  if (thread && thread.userId !== userId) {
    throw new Error("Not authorized");
  }
  return thread;
}
```

**正确做法**：在 **Repository 层**就进行用户隔离，确保数据访问的安全性。

---

## 四、Assistant UI 接入（Assistant UI Integration）

### 4.1 Adapter 模式

#### 线程列表适配器

```typescript
interface RemoteThreadListAdapter {
  async unstable_Provider({ children }): React.ReactElement;
  
  async list(): Promise<Array<{ id: string; title: string; ... }>>;
  async create(): Promise<{ id: string }>;
  async delete(id: string): Promise<void>;
  async update(id: string, updates): Promise<void>;
}
```

#### 历史记录适配器

```typescript
interface ThreadHistoryAdapter {
  async load(): Promise<{ messages: Message[] }>;
  async append(message: Message): Promise<void>;
}
```

### 4.2 消息格式转换

#### Assistant UI 消息格式 vs 后端格式

| Assistant UI | 后端格式 |
|--------------|----------|
| `{ role, content: { parts: [...] } }` | `{ role, content: string }` |
| `{ role, content: { text: "..." } }` | `{ role, content: string }` |

**转换逻辑**：

```typescript
// UI → 后端
const encoded = fmt.encode(message);
const content = {
  role: encoded.role,
  content: encoded.parts?.map(p => p.text).join("\n") || encoded.content || "",
};

// 后端 → UI
const messages = await fetchMessages(threadId);
return {
  messages: messages.map(m => ({
    role: m.role,
    content: { parts: [{ type: "text", text: m.content }] },
  })),
};
```

### 4.3 当前迁移提醒

本项目当前已开始从 `assistantUi` 这种聚合命名迁移到更显式的消息结构。

建议遵循：

- 消息内容以 `parts` 为主
- 分支关系尽量显式化，不继续扩展嵌套命名空间
- 仅供 UI 展示的辅助信息尽量单独命名，不与内容本体混写

历史兼容读取可以保留，但新代码不要继续围绕 `assistantUi` 叠职责。

### 4.3 流式消息处理

#### 处理 AssistantStream

```typescript
async function* processStream(stream: ReadableStream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    // 解析并处理每个消息块
    yield parseChunk(chunk);
  }
}
```

---

## 五、经验教训总结

### 5.1 架构设计

| 原则 | 说明 |
|------|------|
| **分层验证** | 用户隔离需要在路由、服务、数据库层都进行验证 |
| **单一职责** | Adapter 只负责数据格式转换，业务逻辑放在 Service 层 |
| **防御性编程** | 对所有外部输入进行验证，避免 undefined 访问 |

### 5.2 调试技巧

1. **日志记录**：在关键节点记录完整的消息结构
2. **类型检查**：使用 TypeScript 严格模式捕获类型错误
3. **边界测试**：测试空消息、undefined、异常格式等边界情况

### 5.3 性能优化

1. **索引优化**：为常用查询字段创建索引
2. **分页加载**：大量消息使用分页，避免一次性加载
3. **缓存策略**：对不常变化的数据进行缓存

---

## 六、检查清单

在实现对话系统时，使用以下清单确保完整性：

- [ ] 用户隔离：所有数据库查询都包含 userId 过滤
- [ ] 消息格式：正确处理 UI 和后端之间的格式转换
- [ ] 错误处理：添加详细日志和错误捕获
- [ ] 索引优化：为 threads 和 messages 表创建必要索引
- [ ] 类型安全：使用 TypeScript 确保类型正确
- [ ] 权限验证：在服务层验证用户对资源的访问权限

---

## 附录：常见错误信息

| 错误信息 | 可能原因 | 解决方案 |
|----------|----------|----------|
| `TypeError: Cannot read properties of undefined` | 消息格式转换错误 | 检查 encoded 结构，添加空值检查 |
| `Thread not found` | 用户隔离失败 | 确保所有查询都传递 userId |
| `SQLITE_ERROR: no such table` | 数据库初始化失败 | 检查 schema 定义，确保 Drizzle 正确初始化 |
| `Missing auth token` | 认证失败 | 检查请求头中的认证 token |

---

## 七、Chat-box 与旧聊天运行时调试经验

本节总结本项目在旧聊天运行时、AI SDK stream、RAG 来源卡片和线程列表上踩过的坑。后续修改 chat-box 交互时，应优先按这些约束排查。

### 7.0 当前聊天主链路

当前桌面聊天只保留一套真实运行时入口：

- `desktop/src/app/layouts/BaseLayout/chatRuntime.tsx`

当前主链路职责如下：

- `ChatRuntimeProvider`
  - 创建唯一聊天 runtime
  - 挂接 `AssistantChatTransport`
  - 挂接线程列表 adapter 与图片附件 adapter
- `BackendThreadListAdapter`
  - 管理远端线程列表、历史恢复、标题同步、消息持久化
- `CurrentThreadProvider`
  - 同步当前 remote thread、RAG 状态、知识库绑定和标题刷新
- `WebpImageAttachmentAdapter`
  - 负责图片压缩、上传和消息图片 part 生成

已经删除的旧入口：

- 旧的 `ChatProvider`
- 旧的 `features/chat/Providers/index.tsx`
- 旧的本地假模型 `localChatModel`

后续不要再新增第二套 chat runtime / provider 入口，否则很容易再次出现：

- 同一页面有两套消息协议
- provider 调用链和线程持久化链脱钩
- 改一个入口，另一个入口默默失效却无人发现

### 7.0.1 前后端统一消息协议

当前聊天请求只接受一套应用自有协议：

```json
{
  "messages": [
    {
      "id": "optional-message-id",
      "role": "user",
      "parts": [
        { "type": "text", "text": "你好" },
        {
          "type": "image",
          "image": "/attachments/xxx.webp",
          "filename": "image.webp"
        }
      ]
    }
  ]
}
```

关键约束：

- 前端发送前必须把 runtime message 显式投影为 `messages[].parts[]`
- 后端只接受 `text` / `image` 两种 part
- 不再兼容：
  - `message.content`
  - `content.parts`
  - 图片走 `file` part 的历史 shape
- 统一协议文件：
  - 前端：`desktop/src/app/layouts/BaseLayout/chatRuntime.tsx`
  - 后端：`server/src/services/provider-proxy.message-protocol.ts`

这样做的目标是把协议边界固定住，避免旧运行时 / AI SDK 内部 shape 变化再次渗透到业务代码里。

### 7.1 metadata 必须端到端保真

RAG 来源卡片依赖消息 metadata，例如：

```json
{
  "rag": {
    "enabled": true,
    "sources": [
      {
        "chunkId": 355,
        "documentId": "e51d0d9430badc6281fb2102b4d3dd2c",
        "documentName": "aaa.txt",
        "score": 0.435,
        "content": "..."
      }
    ]
  }
}
```

注意事项：

- 后端保存消息时不能只保存文本，必须同时保存 `metadata.rag.sources`。
- Fastify response schema 中 `metadata` 必须允许嵌套字段，例如 `additionalProperties: true`；否则序列化会把 `metadata.rag.sources` 静默剥掉。
- 前端 `ThreadHistoryAdapter.load()` 和 `withFormat().load()` 都要把 metadata 带回运行时消息。
- 前端渲染时不能只依赖流式 part，也要能从持久化 metadata 恢复来源卡片。

### 7.2 来源卡片有三条数据入口

蓝框“参考来源”不要绑定单一来源。当前应兼容：

- 流式返回的 `source` / `source-document` parts。
- AI SDK data stream 中的 `data-rag-sources`。
- 历史消息接口返回的 `message.metadata.rag.sources`。

渲染优先级建议：

1. 当前消息 inline source parts 优先，保证首次流式回复立即显示。
2. 当前 runtime message metadata 次之，适配运行时内部 message state。
3. 后端 `/threads/:id/messages` 拉回的 persisted sources 兜底，保证刷新、重新登录、路由切换后仍显示。

### 7.3 RAG 消息持久化应以后端为准

RAG 场景下，用户消息和助手消息都由后端在 provider proxy / RAG pipeline 中持久化。前端 `ThreadHistoryAdapter.append()` 不应再重复保存 RAG user/assistant message。

这样做是为了避免：

- 同一轮对话产生重复 user message。
- 旧运行时报 `A message with the same id already exists in the parent tree`。
- 历史消息顺序因前后端各自保存而错乱。

推荐规则：

- 非 RAG 对话可以沿用前端 history adapter append 保存。
- RAG 对话由后端保存 user message、assistant message、metadata 和 sources。
- RAG 回复流必须使用唯一消息 id，不要复用固定 id。

### 7.4 本轮不做分支切换时，重新生成 / 编辑必须走线性尾部替换

当前阶段已明确“不做分支切换闭环”，因此消息持久化不能继续累积旧分支结构里的 sibling branch。

- 非 RAG 对话：
  - `ThreadHistoryAdapter.append()` 提交消息时必须带上 `parentId`。
- 服务端收到 `parentId` 或 `metadata.lineage.parentId` 后，应先裁掉该父节点之后的旧尾巴，再写入新消息。
- RAG 对话：
  - 后端进入 `/proxy/chat/default` 的 RAG 分支前，需用当前可见的 latest user message 对齐持久化尾部。
  - RAG assistant 完成时，以 latest user message 作为 parent 追加新 assistant，并替换旧尾巴，而不是继续叠加 sibling answer。
- 历史恢复：
  - 当前不再保留旧 `assistantUi.branch.parentId` 读路径。
- 适用边界：
  - 该策略对应本轮“先完成编辑 / 重新生成闭环，不做 branch switch UI”的范围。
  - 如果后续恢复 branch switch，需要把 parent/head 持久化做实。

### 7.4 历史消息顺序必须稳定排序

恢复历史时，不要依赖接口返回偶然顺序。前端恢复前应按：

1. `createdAt` 升序。
2. `id` 作为同时间戳下的稳定兜底。

然后再构造可分支历史，确保 parent-child 链路稳定。

### 7.5 路由切换不要销毁 chat runtime

从 `/chat` 切到 `/settings/*` 再回来时，如果直接 `mode === "chat" ? <ChatLayout /> : <SettingsLayout />`，会导致 chat runtime 被卸载重建，进而出现：

- 来源卡片丢失。
- 旧运行时内部状态和后端持久化状态不同步。
- 当前线程恢复时选中态、消息态异常。

推荐结构：

- `/chat` 和 `/settings/*` 共用一个 `BaseLayout`。
- `ChatRuntimeShell` 保持挂载。
- 设置页只做显示/隐藏或条件挂载设置面板。

当前实际实现：

- `desktop/src/app/layouts/BaseLayout/index.tsx`
- `desktop/src/app/layouts/BaseLayout/ChatWorkspace.tsx`
- `desktop/src/app/layouts/BaseLayout/SettingsWorkspace.tsx`
- `desktop/src/app/layouts/BaseLayout/chatRuntime.tsx`

### 7.6 刷新页面默认不自动选历史对话

用户明确选择“简单点，啥都不选”。因此不要恢复 last active thread，也不要在刷新后自动选中历史列表第一项或最后一项。

推荐行为：

- 刷新后默认新对话空态。
- 用户点击某条历史后才切换到该线程。
- 新建对话按钮只切到新线程，不应被 last-active restore 拉回旧线程。

### 7.7 标题同步优先使用 rename，不要 reload 线程列表兜底

RAG 标题由后端在 stream 完成后生成并更新 DB。前端 thread list 已经缓存了旧标题，所以需要同步。

推荐流程：

1. RAG 回复完成后，前端确认 sources 已经持久化。
2. 前端按当前 `remoteId` 调 `getThreadById(remoteId)` 获取后端最新标题。
3. 如果标题非空且不同于当前标题，调用当前运行时的重命名能力更新侧边栏列表项。

不要用 `aui.threads().reload()` 作为兜底刷新线程列表。原因：

- reload 可能改变选中态。
- reload 可能触发列表重新排序，影响用户当前上下文。
- reload 会扩大变更面，容易重新引入“刷新后选中历史”或“来源消失”的问题。

### 7.8 不要用资料或 issue 替代本地类型确认

历史运行时文档和 issue 能提供方向，但最终应以当前安装版本的本地类型与本项目实现为准。本项目当前需要重点确认：

- `ThreadListRuntime.reload()` 是否存在不代表适合使用。
- `ThreadListItemRuntime.rename(newTitle)` 是当前标题同步的更小范围方案。
- `ThreadListItemState` 中的 `remoteId`、`title` 可用于判断是否需要同步。

### 7.9 调试顺序建议

遇到“界面没有来源/没有助手消息/顺序错乱”时，按以下顺序排查：

1. 网络响应是否有 stream text、`data-rag-sources`、finish 事件。
2. 前端实际发往 `/proxy/chat/default` 的 body 是否仍是统一 `messages[].parts[]` 协议。
2. 后端 messages 表是否保存 assistant message 和 `metadata.rag.sources`。
3. `/threads/:id/messages` response 是否保留完整 metadata。
4. `ThreadHistoryAdapter.load()` 是否把 metadata 转成运行时可识别 message。
5. 前端 source card 是否同时读取 inline parts 和 persisted metadata。
6. RAG 场景是否跳过前端 append，避免重复保存。
7. 路由切换是否保留 `ChatRuntimeShell` 挂载。

补充说明：

- 如果是视觉模型“看不到图”，优先排查 provider 层和消息协议，不要先怀疑知识库、多线程或侧边栏。
- 如果是 Ollama / OpenAI-compatible 多模态异常，先确认最后一条 user message 是否仍保留 image part，历史图片是否已按策略裁剪。

---

## 九、当前阶段完成度

本节用于记录当前聊天界面功能完善阶段的范围、已完成项和未完成项。后续开发与评审默认以此为准更新，不再口头维护。

当前结论：

- 聊天界面功能完善这一阶段按工程交付口径记为“已完成”。
- 这里的“完成”指主链路和本轮范围内的能力已经落地可用。
- 后续仍保留技术债、专项回归和 UI 评审事项，但不再阻塞本阶段结项。

### 9.1 当前范围确认

- 本阶段主要工作内容：
  - 补齐附件上传与消息渲染链路
  - 梳理消息编辑、重新生成的数据结构
  - 统一消息操作区交互
  - 处理输入态、失败态、加载态、取消态等边角体验
- 当前明确不做：
  - 分支切换
  - 分支切换相关的产品评审与交互细化
- 当前明确要保留：
  - 重新生成

### 9.2 已完成

- 聊天输入区已接入图片附件上传入口，并支持图片粘贴、发送。
- 用户纯附件消息已打通发送链路，不再要求必须输入文本。
- 消息渲染链路已补齐，附件消息、普通文本消息、来源卡片可在同一线程内工作。
- 参考来源面板已恢复可打开状态，并支持从流式 part、runtime metadata、持久化 metadata 三处兜底恢复。
- 非线性历史恢复已补一轮修复：
  - 持久化 assistant 分支消息在 parentId 不是本地 message id 时，会回退挂到最近的 user 消息
  - 刷新后 assistant 历史消息与 `重新生成` 操作入口可再次恢复显示
- 消息操作区已初步统一到同一视觉区域，包含复制、编辑、重新生成的基础入口。
  - 用户消息操作区预留固定高度，并使用 hover / focus 渐显，降低聊天区抖动。
  - 助手消息操作区保持默认可见，避免 `复制` / `重新生成` 被用户消息 hover 策略误隐藏。
- 重新生成入口已保留在消息操作区。
- 输入中、失败、取消等基础状态已有可见反馈：
  - 生成中展示运行提示与取消按钮
  - 不完整消息展示失败/停止状态提示
- 首轮发送场景补了即时持久化兜底：
  - 首轮用户消息在运行开始后会先落库，避免取消或失败时整条消息丢失
  - 线程标题生成已增加 `messageCount === 0` 保护，避免空线程被取消内容误命名
- 路由切换到设置页再返回时，聊天 runtime 保持挂载，避免线程和来源状态丢失。
- 图片多轮对话主链路已修复：
  - 新上传图片会先转 WebP，再上传到项目内部附件目录，消息中仅保存 `/attachments/...` 引用
  - 前端发送协议统一为 `messages[].parts[]`，并兼容旧消息中的 `image` / `file` 图片形态
  - 前端发送前只裁历史附件，不裁最新 user message 的附件内容
  - 后端在调用 Provider 前会把内部附件 URL 解析回模型可用的 data URL / base64
  - 后端放宽请求体上限，避免图片消息在进入业务逻辑前被 `413` 拦截
  - 后端 provider proxy 已移除 legacy `content` / `content.parts` / image-as-`file` 兼容归一化入口
  - 当前方案已从 base64 入库收敛到引用式存储，但旧消息中的 base64 附件仍未迁移
- Provider 多模态支持已补齐到当前可用范围：
  - `openai-compatible` 支持图片消息转发
  - `ollama` 支持图片消息转发
  - `cloudflare` 已做账号级 base URL 到 `.../ai/v1` 的兼容归一
  - 设置默认角色模型时，会同时保存当前 provider 的 `baseUrl` 与 `apiKey`，避免默认模型已切换但连接信息未落库
  - 已按 Cloudflare 官方文档核对到的确定项：
    - OpenAI 兼容 base URL 为 `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1`
    - OpenAI 兼容接口包含 `/v1/chat/completions` 与 `/v1/embeddings`
    - Cloudflare 可调用模型 ID 使用 `@cf/...`
  - 已通过 Codex 内置浏览器完成一轮真实默认对话回归：
    - 登录账号 `Tomz`
    - 在新对话发送 `你好，请只回复 ok`
    - 默认聊天成功返回 `ok`
    - 刷新后维持“新对话空态 + 历史列表保留新线程”的既定行为

### 9.3 已完成但仍需后续跟进

- 消息编辑：
  - UI 和基础编辑提交流程已接上
  - 但编辑后的历史恢复、与重新生成联动的一致性仍需专项回归
- 重新生成：
  - 入口已保留，基础链路可用
  - 已确认历史恢复正常后，assistant 消息可再次显示 `重新生成`
  - 2026-06-19 发现重新生成完成后可能触发 React `removeChild` ErrorBoundary，已通过复用 React root 修复重复 `createRoot()` 风险
  - 在当前默认 provider 返回 `401` 时，重新生成会进入失败态但不会污染原有持久化历史
  - 仍需补做页面级重新生成回归、跨 provider、带附件上下文、成功重试场景的稳定性验证
- 消息操作区统一：
  - 已合并主要入口
  - 2026-06-19 回归发现助手消息 `复制` / `重新生成` 被共用 hover 策略误隐藏，已拆分显隐策略并修复
  - 修复后已通过 typecheck / workspace check，最终真实浏览器点击确认仍待补跑
  - 不同消息状态下的显隐、禁用和 hover 细节尚未统一评审

### 9.4 不阻塞本阶段完成的后续事项

- 分支切换暂不做，相关数据结构不作为本阶段交付目标。
- 消息编辑与重新生成的持久化一致性回归还未系统完成。
- 图片链路相关技术债尚未回收：
  - 两轮及以上对话后的历史图片丢弃策略目前是请求前裁剪，不是最终形态
  - 请求体过大问题已通过内部附件 URL 缓解，但 body limit 仍保留为兜底
  - 旧线程消息里的 base64 附件仍可能造成 DB 膨胀，后续可考虑迁移
- 输入态、失败态、加载态、取消态的边角体验还缺专项回归清单执行：
  - 模型报错后的恢复
  - 取消后再次发送
  - 附件消息失败后的重试
  - 多 provider 下状态文案和交互一致性
  - 首轮取消态已补持久化兜底，但仍需在真实 UI 手工回归一次，确认不会再出现“消息消失但线程残留”的旧问题
- Cloudflare 当前属于工程兼容可用状态，尚未逐项按官方文档核验聊天与多模态细节。
- Cloudflare 文档核对仍有未闭环项：
  - 官方 OpenAI 兼容页面已确认 chat / embeddings / `@cf/...` 模型 ID 约束
  - 但官方页面未直接给出 vision 场景下 `image_url` 请求示例
  - 当前图片消息兼容仍基于 OpenAI 兼容推断与实测可用，不应视为已完成文档级闭环
- Cloudflare 默认对话配置故障已不再是当前阻塞项：
  - 默认模型与连接信息已可在同一交互中落库
  - 默认文本对话已完成一轮真实 UI 回归
  - 2026-06-19 发现后端启动 seed 会覆盖已保存的 provider 连接配置，导致重启后 Cloudflare 回显退回 `<ACCOUNT_ID>` 占位 URL 且 `hasApiKey=false`
  - 已修复为“默认 provider seed 仅插入缺失记录”，但当前已被覆盖的本地 Cloudflare 密钥无法自动恢复，需要重新保存真实配置后再重启复测
- UI 细节评审暂未开始，留待后续统一 review。
- 版本号更新、`CHANGELOG.md` 更新、提交远程尚未执行，不属于本节功能完成度判断范围。

### 9.5 当前建议的后续顺序

1. 先补“编辑 + 重新生成”链路的一致性回归，不扩展分支切换。
2. 再补输入态、失败态、取消态、附件失败等边角体验回归。
3. 然后按 Cloudflare 官方文档核对聊天/多模态兼容细节。
4. 最后再做 UI 评审、版本号、`CHANGELOG.md` 和代码提交。

---

## 八、测试用例

以下测试用例用于 chat-box、线程列表、RAG 来源卡片和历史恢复回归验证。

### 8.1 首次 RAG 对话显示来源

前置条件：

- 用户已登录。
- 至少有一个已入库文档。
- 当前对话开启“启用知识库”。

步骤：

1. 新建对话。
2. 开启知识库。
3. 输入一个能命中文档的问题并发送。
4. 等待助手回复完成。

预期结果：

- 页面出现用户消息和助手消息。
- 助手消息下方显示蓝框“参考来源”。
- 来源数量与 stream 中 `data-rag-sources` 一致。
- 每个来源显示文档名、分数和内容摘要。

### 8.2 连续 RAG 对话不崩溃且每轮都有来源

步骤：

1. 在同一个 RAG 对话中连续提问两轮。
2. 等待每轮助手回复完成。

预期结果：

- 页面不出现 `same id already exists in the parent tree`。
- 用户/助手消息顺序为 user -> assistant -> user -> assistant。
- 每轮助手回复下方都有对应蓝框来源。
- 后端 messages 中每轮 assistant message id 不重复。

### 8.3 刷新后不自动选中历史对话

步骤：

1. 进入 `/chat`。
2. 刷新页面。

预期结果：

- 默认显示新对话空态。
- 历史列表不应自动高亮最后一条或第一条历史。
- 用户点击某条历史后，才加载该历史消息。

### 8.4 重新登录后历史来源仍存在

步骤：

1. 完成一轮带来源的 RAG 对话。
2. 退出登录。
3. 使用同一账号重新登录。
4. 手动点击刚才的历史对话。

预期结果：

- 用户/助手消息顺序正确。
- 助手消息下方仍显示蓝框来源。
- `/threads/:id/messages` response 中 assistant message 的 `metadata.rag.sources` 非空。

### 8.5 切换设置路由后来源仍存在

步骤：

1. 打开一个已有来源卡片的 RAG 对话。
2. 切换到 `/settings/knowledge-base` 或其他设置页。
3. 返回 `/chat`。

预期结果：

- 当前对话仍在。
- 消息顺序不变。
- 来源卡片不消失。
- chat runtime 没有因路由切换被销毁重建。

### 8.6 新建对话不被历史恢复覆盖

步骤：

1. 点击“新建对话”。
2. 保持空态或发送一条新消息。

预期结果：

- 页面停留在新对话。
- 不会自动跳回刷新前或上一次活跃历史对话。
- 新建对话的 `remoteId` 初始化后与历史线程不同。

### 8.7 RAG 标题生成后侧边栏即时更新

步骤：

1. 新建对话。
2. 开启知识库。
3. 发送一条可生成标题的问题。
4. 等待 RAG 回复和后端标题生成完成。

预期结果：

- 后端 thread title 从“新对话”变成生成标题。
- 前端通过 `getThreadById(remoteId)` 获取最新标题。
- 当前侧边栏项通过 `aui.threadListItem().rename(latestTitle)` 更新标题。
- 不调用 `aui.threads().reload()`。

### 8.8 非 RAG 对话仍可正常保存

步骤：

1. 新建对话。
2. 不开启知识库。
3. 发送普通聊天消息。
4. 刷新页面后手动打开该历史。

预期结果：

- 非 RAG 消息通过前端 history adapter append 保存。
- 历史中用户/助手消息正常恢复。
- 没有空 metadata 导致渲染异常。

### 8.9 metadata schema 回归测试

步骤：

1. 构造一条 assistant message，metadata 中包含 `rag.sources` 嵌套数组。
2. 调用 `/threads/:id/messages` 获取该线程消息。

预期结果：

- response 中 `metadata.rag.sources` 完整存在。
- `sources[0].documentName`、`sources[0].score`、`sources[0].content` 未被 Fastify schema 剥离。

### 8.10 消息顺序稳定性测试

步骤：

1. 构造同一线程下多条 createdAt 接近或相同的消息。
2. 调用历史恢复逻辑。

预期结果：

- 前端按 `createdAt` 升序恢复。
- 同时间戳消息按 `id` 稳定排序。
- 可分支历史的 parentId 链路正确。
