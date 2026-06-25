# Role Prompt 注入设计

Status: Current
Owner: role / runtime
Last verified: 2026-06-25

## 单点真相范围

这页说明 Role 怎样从“设置页素材 + Chat 选择态”进入真实请求上下文。

它主要覆盖：

- 当前 request-only 注入主链
- `thread-request-context.node` 在哪里起作用
- Role 为什么不进入普通聊天消息
- 长期更完整的 prompt assembly 应该往哪演进

## 适合什么时候读

这些场景建议先看这页：

- 想改 Role 注入顺序或注入边界
- 想确认 Role 是前端编排、后端编排，还是两边各承担一层
- 想接 `memory`、`tool policy`、`user preference` 到同一套上下文层

## 设计目标

把 Role 从“设置页素材”和“Chat UI 选择态”继续推进到“真实请求上下文”。

要求：

- 不污染 `shared/uchat/core`
- 不把角色素材直接写进 provider adapter
- 不把角色提示词混入普通聊天消息存储
- 支持未来扩展字段继续注入

## 当前真实链路

当前 chat 发送主链路：

1. `UChatRuntime` 维护真实线程消息
2. `DesktopChatRunDriver.run(...)`
3. 前端把 `context.history + context.message` 发给后端
4. 后端在默认 chat 路径上补线程级 request-only 上下文
5. 后端做消息标准化和 provider 适配

关键点：

- 当前普通聊天已经有一层后端 request-only 注入
- 注入入口是 `thread-request-context.node`
- 当前已接入的线程上下文包括：
  - `roleId`
  - `contextSummary`
- 所以后端实际发送前拿到的是：
  - 可见历史 + 最新用户消息
  - 再 prepend 线程级 request-only system messages

## 当前可复用基础

项目里已有通用 prompt injection 工具：

```text
desktop/src/shared/utils/prompt-injection/promptInjection.ts
```

它支持：

- `before-history`
- `in-history`
- `depth`
- `order`
- `triggers`
- 模板变量
- extensions
- token budget trimming

这依然是 Role 注入后续应该复用的底座。

## 当前推荐分层

### 1. Thread Request Context Node

当前已落地的第一层不是前端 Role compiler，而是后端线程级 request-only 聚合层：

```text
server/src/services/shared-nodes/thread-request-context.node.ts
```

职责：

- 读取线程级上下文字段
- 跑 resolver chain
- 产出 request-only system messages

当前 resolver：

- `resolveRoleContext`
- `resolveSummaryContext`

这层的意义是先把 request-only 注入边界收拢，避免继续散落在 route 中硬编码。

### 2. 未来增强：Role Compiler

长期更理想的职责是：

- 把 `RoleRecord` 编译成 `PromptInjectionEntry[]`

建议接口：

```ts
compileRoleToPromptEntries(
  role: RoleSummary,
  context: {
    userName?: string;
    assistantName?: string;
    generationType?: string;
  },
): PromptInjectionEntry[]
```

### 3. Request Message Builder

职责：

- 取真实可见消息 history
- 取当前 active role
- 调用统一 prompt injection builder
- 输出 request-only messages

建议接口：

```ts
buildChatRequestMessages(input: {
  history: ChatMessage[];
  latestUserMessage: ChatMessage;
  role?: RoleSummary | null;
  variables?: Record<string, unknown>;
}): PromptInjectionMessage[]
```

### 4. Transport Adapter

职责：

- 把 request messages 转成当前后端协议
- 不再关心 Role 是怎么来的

## Role 如何映射为注入条目

推荐不要把整个 Role 粘成一大段文本，而是拆成多条 entry：

- `role.description`
- `role.worldview`
- `role.persona`
- `role.scenario`
- `role.exampleDialogues`
- `role.style`
- `role.constraints`

默认策略：

- 全部 `position = "before-history"`
- 全部 `role = "system"`
- 空字段不生成 entry

这样做的好处：

- 可扩展
- 可单独调试
- 可按字段独立排序、开关、裁剪

## Role 默认怎么插

Role 默认应使用：

- `before-history`

原因：

- 它是高优先级上下文
- 不属于普通聊天轮次
- 不应混入历史中间

只有将来真的出现“某个角色补充只对某轮附近生效”的场景，才值得考虑 `in-history`。

## 为什么不展示前置提示词

推荐边界应始终分清三类：

### `conversationMessages`

- 存真实聊天消息
- 用于 UI 渲染
- 用于线程持久化

### `requestMessages`

- 每次发送前临时组装
- 包含 role / system / memory / knowledge-base injection
- 只给模型 API 使用

### `persistedMessages`

当前后端只持久化：

- 最新用户消息
- 助手回复

所以只要 Role 注入只进入 `requestMessages`，它天然就不会出现在聊天 UI 里。

## 后端当前承担什么

从长期边界看，后端不应承担完整 Role 编排。

但当前为了快速落地，后端已经承担了一层线程级 request-only 包裹：

- 读取 `thread.roleId`
- 读取 `thread.contextSummary`
- 统一转成 system messages

当前更准确的说法是：

- 前端负责可见历史与线程元数据变更
- 后端负责线程级 request-only 包裹与发送适配
- 完整 Prompt Manager 级编排暂未全部前移

后端继续更适合只做：

- `normalizeProxyChatMessages(...)`
- provider 输入标准化
- 附件转换
- provider adapter 协议映射

## 与当前 provider-proxy 的关系

当前后端链路：

1. `chat.routes.ts`
2. `thread-request-context.node`
3. `normalizeProxyChatMessages(...)`
4. `providerProxyService.streamChat(...)`
5. `chat-adapters.ts`

现在已经有轻量 request-only assembly，但还不是完整 Prompt Manager。

更理想的长期状态是：

1. 前端或独立编排层生成统一 request context
2. 后端继续消费统一 `messages`
3. provider adapter 不感知 Role 领域对象

## 分阶段建议

### 阶段 1

- 已完成第一版线程级 request-only 注入
- 已打通非 RAG 普通聊天
- 已支持 `roleId + contextSummary`

### 阶段 2

- 把 `thread-request-context.node` 继续拆成更细 resolver
- 把 `memory`、`tool policy`、`user preference` 接到同一层

### 阶段 3

- 让前端 request builder 与后端线程上下文层继续对齐
- 逐步形成更完整的统一 prompt assembly 层

## 非目标

当前不建议做：

- 在 provider adapter 中读取 Role 数据库
- 把 Role 作为普通 system message 存进线程消息表
- 直接在后端重建前端角色 prompt 逻辑
- 一次性照搬完整 Prompt Manager 机制

## 相关文档

- `README.md`
- `page.md`
- `chat-integration.md`

