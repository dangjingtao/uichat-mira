# API 响应契约

Layer: raw-source
Module: runtime
Doc Type: reference

Status: Current
Owner: runtime
Last verified: 2026-06-25

## 单点真相范围

这页文档统一说明 backend API 的公共响应 envelope。

这里只描述响应形状，不描述具体业务路由。文中出现的路径都是 backend route path，不包含开发态 `/api` 代理前缀。

相关文档：

- [[README]]
- [[model-config-api]]
- [[maps/AREA_MAP_RUNTIME]]

## 成功响应

```ts
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}
```

示例：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  },
  "message": "User loaded",
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

## 错误响应

```ts
interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string | number;
  errors?: unknown[];
  timestamp: string;
}
```

常见错误码：

| Code | Meaning |
| --- | --- |
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Authenticated but not allowed |
| `NOT_FOUND` | Resource was not found |
| `INTERNAL_ERROR` | Unexpected server error |
| `DATABASE_ERROR` | Database operation failed |

示例：

```json
{
  "success": false,
  "message": "Config not found",
  "code": "NOT_FOUND",
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

## 后端使用方式

统一使用 `server/src/utils/response.ts` 里的 response helper。

```ts
import { success, error, ErrorCodes } from "@/utils/index.js";

fastify.get("/users", async () => {
  const users = await getUsers();
  return success(users, "Users loaded");
});

fastify.get("/users/:id", async (request, reply) => {
  const user = await getUserById(request.params.id);

  if (!user) {
    return reply
      .code(404)
      .send(error("User not found", ErrorCodes.NOT_FOUND));
  }

  return success(user);
});
```

## 前端使用方式

前端统一通过 `desktop/src/shared/lib/request.ts` 的共享请求封装访问 backend。业务代码不应自己拼环境相关 host、port 或代理细节。

```ts
import { get } from "@/shared/lib/request";

export function getUsers() {
  return get("/users");
}
```

开发态会在 Axios `baseURL` 层自动加 `/api`。生产态会直接使用 `window.desktopApi.backendUrl`。
