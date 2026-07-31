---
status: current
owner: role
last_verified: 2026-08-01
layer: wiki
module: Role
feature: Overview
doc_type: overview
canonical: true
related:
  - ../ROLE_CURRENT_TRUTH.md
  - page.md
  - role-api.md
  - runtime.md
  - preview-and-media.md
  - ../CHAT_CURRENT_TRUTH.md
  - ../archive/role/README.md
---

# Role 模块总览

> 本目录说明 Role 的数据、工作台、Thread 绑定、请求注入和媒体联动。当前单点真相以 [[ROLE_CURRENT_TRUTH]] 为准。

## 推荐阅读顺序

1. [[ROLE_CURRENT_TRUTH]]：Role 当前总真相与已知偏差；
2. [[role/page]]：工作台字段与保存语义；
3. [[role/role-api]]：CRUD、状态、归属和字段约束；
4. [[role/runtime]]：Thread 绑定、Request Context 与三条 Chat 路径；
5. [[role/preview-and-media]]：Preview、头像、TTS 与 Image 联动；
6. [[archive/role/README]]：六月迁移、设计与恢复记录。

## 当前定义

Role 是一份用户级可复用配置：

```text
Role Prompt Fields
+ Optional Sampling Params
+ UI Metadata
```

Thread 只保存 `roleId`。发送时后端读取最新 Role，并生成 request-only system message。

Role 不是：

- 可见聊天消息；
- 专业事实库；
- 长期记忆；
- Skill 或 Tool Policy；
- Provider / Model 绑定；
- 动态关系成长状态。

## 当前对象链

```text
Role Workbench
→ Role API / SQLite
→ Welcome draftRoleId 或 Thread.roleId
→ thread-request-context Role resolver
→ Normal Chat | RAG Generate | Agent Runtime
→ Optional post-answer TTS / Image
```

## 当前成立的能力

- 用户级 Role CRUD；
- active / draft 状态；
- 七个 Prompt 字段；
- 六个可选 LLM Profile 数值参数；
- 内置头像与最多三个 Tags；
- Welcome 状态选择和首次 Thread 持久化；
- 已有 Thread 切换与解绑；
- Role Prompt request-only 注入；
- Normal、RAG Generate 与 Agent 输入使用 Role Prompt；
- 删除 Role 后 Thread 解除绑定并保留对话；
- Role 头像、标签与 replying label；
- 回答成功后的 TTS / Image 产品联动。

## 必须分开的事实

```text
summary / tags / avatar
!= Role Prompt

Role LLM Profile
!= Role 专属模型

active
!= 已经行为验收

Preview
!= 真实 Request
!= 真实模型回复

Role Prompt 在 RAG 生效
!= Role LLM Profile 在 RAG 生效
```

## 当前高价值边界

- Chat picker 只列 active Role，但后端注入不检查 status；
- 主保存把 Role 设为 active，UI 没有完整下架流程；
- Prompt Drawer 保存到本地 draft，LLM Profile Drawer 独立写后端；
- `{{user}} / {{char}}` 不做模板变量替换；
- LLM Profile 没有统一范围校验；
- 选择 Role 且未绑定知识库时会自动打开 Image 开关；
- Starter Role 只在整张表为空时初始化，不是 per-user seed；
- 当前没有 Copy、Import、Export、Version 或 Role snapshot。

详细原因、范围和严重度见 [[ROLE_CURRENT_TRUTH]]。

## 源码入口

### Backend

```text
server/src/db/role.db.ts
server/src/db/repositories/role.repository.ts
server/src/services/role.service.ts
server/src/routes/role/
server/src/services/shared-nodes/thread-request-context-role.resolver.ts
server/src/routes/proxy-provider/chat.routes.ts
```

### Desktop

```text
desktop/src/features/Settings/pages/Personas/
desktop/src/shared/api/roles.ts
desktop/src/features/chat/components/UChatThread.tsx
desktop/src/features/chat/components/roleChatState.ts
desktop/src/features/chat/adapters/chatMediaOrchestration.ts
```

## 历史资料

以下内容已退出当前解释权：

- 2026-06-25 Prompt Injection 设计；
- Role 主链迁移清单；
- Role + RAG 接入清单；
- 蓝屏恢复回归清单；
- 旧 Role 总览、页面和 API 说明。

原文见 [[archive/role/README]]。
