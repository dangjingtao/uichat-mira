# Role API

> 资源范围：当前登录用户自己的角色原型（role / prompt prototype）

## 1. 概述

Role API 支持设置页角色工作台的真实 CRUD。

这组接口只负责角色素材本身的持久化：

- 名称
- 简介
- 头像 ID
- 状态
- 标签
- prompt 字段集合

它不负责：

- 最终聊天请求里的 prompt 排序
- system prompt / history / knowledge base 的编排
- provider-specific 请求体适配

## 2. 数据模型

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

interface Role {
  id: string;
  name: string;
  summary: string;
  avatarId: string | null;
  status: RoleStatus;
  tags: string[];
  prompt: RolePrompt;
  createdAt: string;
  updatedAt: string;
}
```

## 3. 字段约束

- `name`
  - 可传字符串
  - 空白输入在创建时回落为 `Untitled Role`
- `summary`
  - 可为空字符串
- `avatarId`
  - 可为 `null`
- `status`
  - 仅允许 `active` 或 `draft`
- `tags`
  - 最多保留前 3 个
  - 服务端会 `trim` 并过滤空值
- `prompt`
  - 各字段缺失时补空字符串
  - 更新时按字段合并，而不是整块覆盖丢失

## 4. 鉴权

所有 Role API 要求已登录：

- Bearer Token
- 只能访问当前用户自己的角色

不存在或不属于当前用户：

- `GET /roles/:id`
- `PATCH /roles/:id`
- `DELETE /roles/:id`

都应返回 `404`

## 5. 初始化行为

角色表初始化后，如果表为空，会写入少量示例角色：

- `Formal Reviewer`
- `Pilot Helper`
- `Archive Guide`

该行为只用于冷启动样例，不应覆盖已有数据。

## 6. 接口列表

### 6.1 列表

`GET /roles`

#### Query

```ts
{
  status?: "active" | "draft";
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}
```

### 6.2 详情

`GET /roles/:id`

### 6.3 创建

`POST /roles`

#### Body

```ts
{
  name?: string;
  summary?: string;
  avatarId?: string | null;
  status?: "active" | "draft";
  tags?: string[];
  prompt?: Partial<RolePrompt>;
}
```

### 6.4 更新

`PATCH /roles/:id`

#### Body

与创建结构一致，但所有字段都为增量可选。

### 6.5 删除

`DELETE /roles/:id`

## 7. 前端接入

共享 API 位于：

- `desktop/src/shared/api/roles.ts`

当前使用页面：

- `desktop/src/features/Settings/pages/Personas`

## 8. Swagger

Role API 已接入 Swagger / OpenAPI。

- Tag: `Role`
- Routes: `/roles`, `/roles/:id`

## 9. 非目标

以下内容不属于 Role API：

- 角色与聊天线程的绑定关系
- 角色在 request messages 中的注入顺序
- 角色与知识库的联合编排
- provider adapter 中的消息转换规则
