
# API 响应统一规范

本文档描述了本项目所有 API 接口的统一响应格式规范。

## 概述

所有 API 接口的响应都遵循统一的格式，分为**成功响应**和**失败响应**两种类型。

---

## 成功响应

### 格式

```typescript
interface ApiSuccessResponse&lt;T&gt; {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `success` | `boolean` | 是 | 固定为 `true`，表示请求成功 |
| `data` | `T` | 是 | 响应的业务数据，根据不同接口返回不同结构 |
| `message` | `string` | 否 | 可选的成功提示信息 |
| `timestamp` | `string` | 是 | ISO 8601 格式的时间戳 |

### 示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  },
  "message": "获取用户信息成功",
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

---

## 失败响应

### 格式

```typescript
interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string | number;
  errors?: any[];
  timestamp: string;
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `success` | `boolean` | 是 | 固定为 `false`，表示请求失败 |
| `message` | `string` | 是 | 错误信息描述 |
| `code` | `string \| number` | 否 | 错误码，用于前端精确识别错误类型 |
| `errors` | `any[]` | 否 | 详细的错误列表（如表单验证错误） |
| `timestamp` | `string` | 是 | ISO 8601 格式的时间戳 |

### 错误码说明

预定义的错误码如下：

| 错误码 | 说明 |
|--------|------|
| `VALIDATION_ERROR` | 请求参数验证失败 |
| `UNAUTHORIZED` | 未授权（未登录或 Token 无效） |
| `FORBIDDEN` | 禁止访问（权限不足） |
| `NOT_FOUND` | 资源不存在 |
| `INTERNAL_ERROR` | 服务器内部错误 |
| `DATABASE_ERROR` | 数据库错误 |

### 示例

#### 404 资源不存在
```json
{
  "success": false,
  "message": "Config not found",
  "code": "NOT_FOUND",
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

#### 401 未授权
```json
{
  "success": false,
  "message": "Invalid username or password",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

#### 400 参数验证错误
```json
{
  "success": false,
  "message": "Invalid request payload",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "instancePath": "/user",
      "schemaPath": "#/properties/user/minLength",
      "keyword": "minLength",
      "params": { "limit": 1 },
      "message": "must NOT have fewer than 1 characters"
    }
  ],
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

---

## 使用方式

### 后端使用

在路由处理函数中，导入并使用 `success` 和 `error` 辅助函数：

```typescript
import { success, error, ErrorCodes } from "@/utils/index.js";

// 成功响应
fastify.get("/api/users", async (request, reply) => {
  const users = await getUsers();
  return success(users, "获取用户列表成功");
});

// 失败响应
fastify.get("/api/users/:id", async (request, reply) => {
  const user = await getUserById(request.params.id);
  if (!user) {
    return reply
      .code(404)
      .send(error("用户不存在", ErrorCodes.NOT_FOUND));
  }
  return success(user);
});
```

### 前端使用

前端可以统一处理响应：

```typescript
interface ApiResponse&lt;T&gt; {
  success: boolean;
  data?: T;
  message?: string;
  code?: string | number;
  errors?: any[];
  timestamp: string;
}

async function fetchData&lt;T&gt;(url: string): Promise&lt;T&gt; {
  const response = await fetch(url);
  const result: ApiResponse&lt;T&gt; = await response.json();

  if (result.success) {
    return result.data as T;
  } else {
    throw new Error(result.message);
  }
}
```

---

## 旧规范迁移

### 旧格式（已废弃）

```json
{
  "ok": true,
  "data": { ... },
  "now": "..."
}
```

### 新格式

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "..."
}
```

主要变化：
- `ok` → `success`
- `now` → `timestamp`
- 新增可选的 `message` 字段

---

## 相关文件

- `apps/server/src/utils/response.ts` - 响应规范定义和辅助函数
- `apps/server/src/utils/index.ts` - 工具函数导出
