# API Response Spec

All backend routes should return a consistent response envelope.

This document describes response shape only. Route paths shown here are backend route paths and do not include the development `/api` proxy prefix.

## Success Response

```typescript
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}
```

Example:

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

## Error Response

```typescript
interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string | number;
  errors?: unknown[];
  timestamp: string;
}
```

Common error codes:

| Code | Meaning |
| --- | --- |
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Authenticated but not allowed |
| `NOT_FOUND` | Resource was not found |
| `INTERNAL_ERROR` | Unexpected server error |
| `DATABASE_ERROR` | Database operation failed |

Example:

```json
{
  "success": false,
  "message": "Config not found",
  "code": "NOT_FOUND",
  "timestamp": "2026-06-07T12:00:00.000Z"
}
```

## Backend Usage

Use response helpers from `server/src/utils/response.ts`.

```typescript
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

## Frontend Usage

Use the shared request wrapper in `desktop/src/shared/lib/request.ts`. Feature code should call backend paths without environment-specific host, port, or proxy details.

```typescript
import { get } from "@/shared/lib/request";

export function getUsers() {
  return get("/users");
}
```

Development adds the `/api` proxy prefix at the Axios base URL level. Production uses `window.desktopApi.backendUrl` directly.
