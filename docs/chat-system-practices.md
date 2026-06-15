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

## 七、Chat-box 与 assistant-ui 调试经验

本节总结本项目在接入 assistant-ui、AI SDK stream、RAG 来源卡片和线程列表时踩过的坑。后续修改 chat-box 交互时，应优先按这些约束排查。

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
- 前端 `ThreadHistoryAdapter.load()` 和 `withFormat().load()` 都要把 metadata 带回 assistant-ui message。
- 前端渲染时不能只依赖流式 part，也要能从持久化 metadata 恢复来源卡片。

### 7.2 来源卡片有三条数据入口

蓝框“参考来源”不要绑定单一来源。当前应兼容：

- 流式返回的 `source` / `source-document` parts。
- AI SDK data stream 中的 `data-rag-sources`。
- 历史消息接口返回的 `message.metadata.rag.sources`。

渲染优先级建议：

1. 当前消息 inline source parts 优先，保证首次流式回复立即显示。
2. 当前 runtime message metadata 次之，适配 assistant-ui 内部 message state。
3. 后端 `/threads/:id/messages` 拉回的 persisted sources 兜底，保证刷新、重新登录、路由切换后仍显示。

### 7.3 RAG 消息持久化应以后端为准

RAG 场景下，用户消息和助手消息都由后端在 provider proxy / RAG pipeline 中持久化。前端 `ThreadHistoryAdapter.append()` 不应再重复保存 RAG user/assistant message。

这样做是为了避免：

- 同一轮对话产生重复 user message。
- assistant-ui 报 `A message with the same id already exists in the parent tree`。
- 历史消息顺序因前后端各自保存而错乱。

推荐规则：

- 非 RAG 对话可以沿用前端 history adapter append 保存。
- RAG 对话由后端保存 user message、assistant message、metadata 和 sources。
- RAG assistant stream 必须使用唯一 `assistantMessageId`，不要复用固定 id。

### 7.4 历史消息顺序必须稳定排序

恢复历史时，不要依赖接口返回偶然顺序。前端恢复前应按：

1. `createdAt` 升序。
2. `id` 作为同时间戳下的稳定兜底。

然后再构造 assistant-ui 的 branchable history，确保 parent-child 链路稳定。

### 7.5 路由切换不要销毁 chat runtime

从 `/chat` 切到 `/settings/*` 再回来时，如果直接 `mode === "chat" ? <ChatLayout /> : <SettingsLayout />`，会导致 chat runtime 被卸载重建，进而出现：

- 来源卡片丢失。
- assistant-ui 内部状态和后端持久化状态不同步。
- 当前线程恢复时选中态、消息态异常。

推荐结构：

- `/chat` 和 `/settings/*` 共用一个 `BaseLayout`。
- `ChatRuntimeShell` 保持挂载。
- 设置页只做显示/隐藏或条件挂载设置面板。

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
3. 如果标题非空且不同于当前标题，调用 `aui.threadListItem().rename(latestTitle)` 更新 assistant-ui 当前列表项。

不要用 `aui.threads().reload()` 作为兜底刷新线程列表。原因：

- reload 可能改变选中态。
- reload 可能触发列表重新排序，影响用户当前上下文。
- reload 会扩大变更面，容易重新引入“刷新后选中历史”或“来源消失”的问题。

### 7.8 不要用资料或 issue 替代本地类型确认

assistant-ui 文档和 issue 能提供方向，但最终应以当前安装版本的本地类型为准。本项目当前需要重点确认：

- `ThreadListRuntime.reload()` 是否存在不代表适合使用。
- `ThreadListItemRuntime.rename(newTitle)` 是当前标题同步的更小范围方案。
- `ThreadListItemState` 中的 `remoteId`、`title` 可用于判断是否需要同步。

### 7.9 调试顺序建议

遇到“界面没有来源/没有助手消息/顺序错乱”时，按以下顺序排查：

1. 网络响应是否有 stream text、`data-rag-sources`、finish 事件。
2. 后端 messages 表是否保存 assistant message 和 `metadata.rag.sources`。
3. `/threads/:id/messages` response 是否保留完整 metadata。
4. `ThreadHistoryAdapter.load()` 是否把 metadata 转成 assistant-ui 可识别 message。
5. 前端 source card 是否同时读取 inline parts 和 persisted metadata。
6. RAG 场景是否跳过前端 append，避免重复保存。
7. 路由切换是否保留 `ChatRuntimeShell` 挂载。

---

## 八、测试用例

以下测试用例用于 chat-box、assistant-ui 线程列表、RAG 来源卡片和历史恢复回归验证。

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
- assistant-ui branchable history parentId 链路正确。
