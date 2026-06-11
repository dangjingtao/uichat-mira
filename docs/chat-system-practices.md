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