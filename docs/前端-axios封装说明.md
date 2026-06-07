
# 前端 Axios 封装说明

本文档说明了基于统一 API 响应规范的前端 axios 请求封装的设计和使用方法。

## 文件结构

```
apps/desktop/src/shared/
├── lib/
│   ├── request.ts              # 核心 axios 封装
│   └── request-examples.ts     # 使用示例（可删除）
├── api/
│   ├── index.ts                # API 模块统一导出
│   └── auth.ts                 # 认证相关 API（示例）
├── types/
│   └── auth.ts                 # 类型定义
└── sessionStorage.ts           # 会话存储工具
```

## 核心功能

### 1. 类型安全
- 完整定义了 `ApiSuccessResponse` 和 `ApiErrorResponse` 接口
- 提供 `ErrorCodes` 枚举，包含所有预定义错误码
- 自定义 `ApiError` 类，包含完整错误信息

### 2. 自动 Token 管理
- 请求拦截器自动添加 `Authorization: Bearer ${token}` 头
- 从 `sessionStorage` 获取 token
- 401/UNAUTHORIZED 错误时自动清除 session 并跳转登录页

### 3. 统一响应处理
- 成功响应自动解包，直接返回 `data` 字段
- 失败响应统一抛出 `ApiError` 异常
- 网络错误自动转换为 `ApiError`

### 4. 便捷的请求方法
- `get<T>()` - GET 请求
- `post<T>()` - POST 请求
- `put<T>()` - PUT 请求
- `patch<T>()` - PATCH 请求
- `del<T>()` - DELETE 请求

## 使用示例

### 基础请求

```typescript
import { get, post, ApiError, ErrorCodes } from "@/shared/lib/request";

// GET 请求
async function fetchUser() {
  try {
    const user = await get&lt;{ id: number; name: string }&gt;("/users/1");
    console.log(user); // 直接返回 data 字段
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(error.message);
    }
  }
}

// POST 请求
async function createUser() {
  const result = await post&lt;{ id: number }&gt;("/users", {
    name: "John",
    email: "john@example.com",
  });
  console.log(result.id);
}
```

### 错误处理

```typescript
import { get, ApiError, ErrorCodes } from "@/shared/lib/request";

async function loadData() {
  try {
    const data = await get("/some-endpoint");
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      switch (error.code) {
        case ErrorCodes.UNAUTHORIZED:
          console.log("请重新登录");
          break;
        case ErrorCodes.NOT_FOUND:
          console.log("资源不存在");
          break;
        case ErrorCodes.VALIDATION_ERROR:
          console.log("验证失败:", error.errors);
          break;
        default:
          console.error(error.message);
      }
    }
  }
}
```

### 在 React 组件中使用

```tsx
import { useState, useEffect } from "react";
import { get, ApiError } from "@/shared/lib/request";

function UserProfile() {
  const [user, setUser] = useState&lt;any&gt;(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() =&gt; {
    async function loadUser() {
      try {
        const data = await get("/me");
        setUser(data.user);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("加载失败");
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  if (loading) return &lt;div&gt;加载中...&lt;/div&gt;;
  if (error) return &lt;div&gt;错误: {error}&lt;/div&gt;;
  return &lt;div&gt;用户: {user?.username}&lt;/div&gt;;
}
```

### API 模块组织

建议按业务模块组织 API 调用：

```typescript
// src/shared/api/auth.ts
import { get, post } from "@/shared/lib/request";
import type { SessionUser } from "@/shared/types/auth";

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise&lt;LoginResponse&gt; {
  return post&lt;LoginResponse&gt;("/login", credentials);
}

export async function getCurrentUser(): Promise&lt;{ user: SessionUser }&gt; {
  return get&lt;{ user: SessionUser }&gt;("/me");
}
```

然后在组件中使用：

```tsx
import { login, getCurrentUser } from "@/shared/api/auth";

// 使用
const result = await login({ username: "admin", password: "pass" });
```

## 配置

### 环境变量

通过环境变量配置 API 基础 URL：

```bash
# .env
VITE_API_URL=http://localhost:8787
```

如果未设置，默认使用 `/api`（配合 Vite 代理）。

### Vite 代理配置

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) =&gt; path.replace(/^\/api/, ""),
      },
    },
  },
});
```

## 类型导出

```typescript
// 常用类型
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  ErrorCodes,
} from "@/shared/lib/request";

// 错误类
import { ApiError } from "@/shared/lib/request";

// 请求方法
import { get, post, put, patch, del } from "@/shared/lib/request";

// 原始 axios 实例（特殊需求）
import { apiClient } from "@/shared/lib/request";
```

## 相关文档

- [API 响应统一规范](./API-Response-Spec.md)
- 后端响应工具: `apps/server/src/utils/response.ts`
