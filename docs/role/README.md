# 角色系统总览

Status: Current
Owner: role
Last verified: 2026-06-25

## 单点真相范围

这页文档统一说明：

- 当前项目里 `Role` 的具体含义
- role 文档如何拆分到 page、API、chat integration、prompt injection
- 角色编辑和角色使用分别归哪一层负责

相关概念：

- [[CONCEPT_ROLE_SYSTEM]]
- [[CONCEPT_UCHAT]]
- [[AREA_MAP_ROLE]]

当前项目里的 `Role` 不是聊天消息本身，也不是 provider adapter。它是：

- 一组可编辑、可复用、可持久化的角色提示词素材
- Chat 请求构建前的上游输入
- Chat UI 中可绑定到线程或欢迎态的上下文配置

本目录统一维护角色（Role / Persona / Prompt Prototype）相关设计与接口约定。

## 阅读顺序

1. `page.md`  
   角色工作台的页面职责、字段语义、状态约定
2. `role-api.md`  
   角色 CRUD 接口、数据模型、Swagger 范围
3. `chat-integration.md`  
   角色如何接入聊天界面、哪些状态只存在前端
4. `prompt-injection-design.md`  
   角色如何参与请求编排、为什么不直接进入可见聊天消息
5. `rag-integration-checklist.md`  
   角色接入 RAG 聊天时的执行清单、边界和验收项

## 当前边界

当前角色功能分成三层：

- 设置页角色工作台  
  负责角色素材的创建、编辑、预览、删除
- Chat 界面角色选择  
  负责把某个已配置角色绑定到当前欢迎态或当前线程的前端交互态
- Prompt Injection 设计  
  已通过线程级 request-only 注入层接到 chat 发送主链路第一版

## 相关源码

### 设置页

```text
desktop/src/features/Settings/pages/Personas
desktop/src/shared/api/roles.ts
server/src/routes/role
server/src/services/role.service.ts
server/src/db/role.db.ts
```

### Chat 接入

```text
desktop/src/features/chat/components/UChatThread.tsx
desktop/src/features/chat/components/roleChatState.ts
desktop/src/features/chat/core/runtimePolicies.ts
desktop/src/shared/uchat/ui/UChatThreadView.tsx
```

### Prompt Injection

```text
desktop/src/shared/utils/prompt-injection
desktop/src/features/chat/core/protocol.ts
server/src/routes/proxy-provider/chat.routes.ts
server/src/services/provider-proxy.message-protocol.ts
server/src/services/provider-proxy.service/chat-adapters.ts
```

## 当前状态摘要

- Role CRUD：已接真实后端
- Role API：已接 Swagger
- Chat 角色选择：已接到 UI 交互层
- 聊天头像 / 回复中状态：已支持跟随角色变化
- Role Prompt 注入：第一版已正式接入主链路，但完整编排层还未完全收敛

## 重要原则

- Role 不是线程消息
- Role 不应直接写进 provider adapter
- Role prompt 的长期编排应收敛到统一 request assembly 层
- 当前后端允许承担线程级 request-only 包裹，但不应演化成直接理解 Role 领域对象的 provider adapter
