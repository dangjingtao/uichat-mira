# Role API

Status: Current  
Owner: role  
Last verified: 2026-06-25

## 概述

Role API 负责“角色原型”的真实 CRUD。

它管理的是可持久化的角色素材：

- `name`
- `summary`
- `avatarId`
- `status`
- `tags`
- `prompt`
- `llmProfile`

它不负责：

- 聊天线程上的 `roleId` 绑定
- request-only prompt 注入顺序
- provider-specific 请求体转换
- RAG 编排

## 路由位置

后端真实实现：

- [server/src/routes/role/roles.routes.ts](/D:/workspace/rag-demo/server/src/routes/role/roles.routes.ts)
- [server/src/routes/role/schemas.ts](/D:/workspace/rag-demo/server/src/routes/role/schemas.ts)
- [server/src/services/role.service.ts](/D:/workspace/rag-demo/server/src/services/role.service.ts)

前端调用封装：

- [desktop/src/shared/api/roles.ts](/D:/workspace/rag-demo/desktop/src/shared/api/roles.ts)

## 数据模型

```ts
type RoleStatus = "active" | "draft";

interface RolePrompt {
  description: string;
  worldview: string;
  persona: string;
  scenario: string;
  exampleDialogues: string;
  style: string;
  constraints: string;
}

interface RoleLlmProfile {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

interface Role {
  id: string;
  name: string;
  summary: string;
  avatarId: string | null;
  status: RoleStatus;
  tags: string[];
  prompt: RolePrompt;
  llmProfile: RoleLlmProfile;
  createdAt: string;
  updatedAt: string;
}
```

## 字段约束

- `name`
  - 创建时可省略
  - 空白值会回落为 `Untitled Role`
- `summary`
  - 可为空字符串
- `avatarId`
  - 可为 `null`
- `status`
  - 仅允许 `active | draft`
- `tags`
  - 最多保留前 `3` 个
  - 服务端会 `trim` 并过滤空值
- `prompt`
  - 缺失字段自动补空字符串
  - 更新时按字段 merge，不会把未传字段清空
- `llmProfile`
  - 仅保留 number 类型字段
  - 未传字段沿用原值

## 鉴权

所有 Role API 都要求已登录用户。

- 使用 Bearer Token
- 只能访问当前用户自己的角色

对于不存在或不属于当前用户的角色：

- `GET /roles/:id`
- `PATCH /roles/:id`
- `DELETE /roles/:id`

返回 `404 Role not found`

## 初始化行为

角色表冷启动时会补少量示例角色，便于前端直接可见：

- `Formal Reviewer`
- `Pilot Helper`
- `Archive Guide`

该行为只在角色表为空时触发，不覆盖已有数据。

## 接口列表

### 1. 列表

`GET /roles`

Query:

```ts
{
  status?: "active" | "draft";
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}
```

Response:

```ts
{
  success: true;
  data: Role[];
}
```

### 2. 详情

`GET /roles/:id`

Response:

```ts
{
  success: true;
  data: Role;
}
```

### 3. 创建

`POST /roles`

Body:

```ts
{
  name?: string;
  summary?: string;
  avatarId?: string | null;
  status?: "active" | "draft";
  tags?: string[];
  prompt?: Partial<RolePrompt>;
  llmProfile?: Partial<RoleLlmProfile>;
}
```

Response:

```ts
{
  success: true;
  message: "Role created";
  data: Role;
}
```

### 4. 更新

`PATCH /roles/:id`

Body:

与创建结构一致，全部字段都是可选增量字段。

Response:

```ts
{
  success: true;
  message: "Role updated";
  data: Role;
}
```

### 5. 删除

`DELETE /roles/:id`

Response:

```ts
{
  success: true;
  message: "Role deleted";
  data: {
    deleted: true;
  };
}
```

## 当前前端使用方

- 设置页角色工作台：
  - [desktop/src/features/Settings/pages/Personas/index.tsx](/D:/workspace/rag-demo/desktop/src/features/Settings/pages/Personas/index.tsx)
- Chat 角色选择：
  - [desktop/src/features/chat/components/UChatThread.tsx](/D:/workspace/rag-demo/desktop/src/features/chat/components/UChatThread.tsx)

## Swagger / OpenAPI

Role API 已接入 Swagger。

- Tag: `Role`
- Routes:
  - `/roles`
  - `/roles/:id`

## 验证参考

真实路由测试：

- [server/src/routes/role/roles.routes.test.ts](/D:/workspace/rag-demo/server/src/routes/role/roles.routes.test.ts)

已覆盖：

- create
- list
- update
- delete
- `llmProfile` 合并更新
