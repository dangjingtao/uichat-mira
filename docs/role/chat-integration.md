# Role Chat 接入

Status: Current
Owner: role / chat
Last verified: 2026-06-25

## 单点真相范围

这页只说明一件事：

当前项目里，Role 是怎样接进 Chat 界面的。

它主要覆盖：

- 角色在聊天 UI 里的可见表现
- `draftRoleId` 与 `thread.metadata.roleId` 的分工
- 为什么 Role 不直接进入 `uchat core`
- 当前哪些能力已接入，哪些还没接

## 适合什么时候读

这些场景建议先读这页：

- 想改 Chat 里的角色选择体验
- 想确认角色状态到底持久化在哪
- 想判断某个 Role 相关字段该放前端临时态还是线程 metadata
- 想知道聊天界面为什么能展示角色标签，但消息列表里没有角色 prompt

## 当前目标

Role 接入 Chat 的目标不是把角色做成一条聊天消息，而是：

- 在聊天界面中选择角色
- 让线程绑定某个角色
- 让 UI 展示和请求上下文都能读到这个角色
- 同时不破坏 `uchat` 的协议无关边界

当前用户可见能力包括：

- 在 composer 的加号菜单里选择 `Role`
- 打开角色搜索选择弹窗
- 选择后切换助手头像
- typing 文案从默认助手语义切换为角色名语义
- 输入框附近展示角色标签

## 当前实现边界

### 已接入

- Chat 界面可选择角色
- 角色列表来自真实 `/roles` API
- 角色头像来自内置头像包
- 角色标签渲染在 composer 附近
- 线程 `roleId` 已持久化到后端模型
- 刷新后可从线程接口恢复 `roleId`
- 欢迎态下选择的角色会在首次创建线程时一并落库

### 还没接入

- 角色成长态 / `roleState`
- 角色相关上下文调试视图

## 关键源码

```text
desktop/src/features/chat/components/UChatThread.tsx
desktop/src/features/chat/components/roleChatState.ts
desktop/src/features/chat/core/runtimePolicies.ts
desktop/src/features/chat/core/protocol.ts
desktop/src/features/chat/core/runtime.tsx
desktop/src/shared/api/thread.ts
server/src/services/thread.service.ts
server/src/services/shared-nodes/thread-request-context.node.ts
desktop/src/shared/uchat/ui/UChatThreadView.tsx
desktop/src/shared/ui/SearchSelectModal.tsx
```

## 当前状态模型

角色选择分成两层：

- `draftRoleId`
  - 欢迎态下、线程尚未创建时的临时角色选择
- `thread.metadata.roleId`
  - 已创建线程后的真实持久化角色绑定

也就是说：

- 欢迎态使用前端 draft
- 线程态以后端持久化字段为准
- 不再维护本地 `threadRoleIds` 影子状态

## 为什么不把 Role 写进 `uchat core`

原因不是技术做不到，而是边界要稳。

`shared/uchat/core` 应只维护通用聊天运行时，不应逐个吸收业务字段。

像这些都属于 app feature context：

- `roleId`
- `knowledgeBaseId`
- 未来的 persona / profile / thread capability context

如果把它们直接逐个塞进 core，会污染 `uchat` 的协议无关目标。

所以当前 Role 接入只放在：

- `features/chat/components`
- 少量 `shared/uchat/ui` 展示扩展
- 线程 metadata 与 request-only 注入层

## 为什么 Role 不显示在普通消息区

因为当前 Role 不是线程消息，而是上下文标签与请求上下文来源。

聊天 UI 渲染的是：

- `activeThread.messages`

角色相关 UI 渲染的是：

- `threadContextTags`
- `assistantAvatarSrc`
- `assistantTypingLabel`

这两条数据流本来就是分开的。

## 当前真实边界

到现在为止，Role 已经不是“只接到交互层”的状态了。

当前真实边界是：

- 设置页
  - 管理 Role 素材
- 线程
  - 只持久化 `roleId`
- 注入层
  - 在发送请求前把 Role 编译为 request-only system message
- 聊天 UI
  - 只读取线程 metadata 和线程消息
  - 不直接渲染注入 prompt

## 后续演进顺序

### 阶段 1：前端交互态

- 已完成
- 满足基础选择、标签、头像与欢迎态体验

### 阶段 2：请求态 prompt 注入

- 已完成第一版
- Role 已通过统一线程上下文注入层进入 request-only messages
- 不进入普通消息列表

### 阶段 3：线程持久化

- 已完成
- 线程元数据已增加 `roleId`
- 刷新后可恢复角色选择
- 线程切换以后端状态为准

### 阶段 4：线程动态人设

- 未来再接 `roleState` / 成长态
- 不应直接覆盖 Role 本体
- 更适合继续挂在 `thread-request-context.node` 的 resolver chain 下

## 风险提醒

如果把 Role 直接做成线程消息，会带来这些问题：

- UI 会展示不该展示的 system / context 消息
- 普通消息持久化会混入角色素材
- 后续 budget trimming 与 provider 转换更难控制

所以当前应坚持：

- Role 是 request context
- 不是 visible conversation message

## 相关文档

- `README.md`
- `api.md`
- `page.md`
- `prompt-injection-design.md`

