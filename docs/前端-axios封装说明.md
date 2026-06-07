# Frontend Request Wrapper

`desktop/src/shared/lib/request.ts` provides the shared Axios client used by renderer code.

## Request Rules

- Feature code uses backend route paths such as `/login`, `/me`, `/models`.
- Development base URL is `/api`.
- Production base URL is `window.desktopApi.backendUrl`.
- The backend never exposes `/api` routes.
- Do not hardcode backend host or port in renderer code.

## Development Flow

```text
feature code -> /api/models -> Vite proxy -> backend /models
```

`desktop/vite.config.ts` reads `runtime.config.cjs` and configures the proxy prefix from `runtimeConfig.dev.apiProxyPrefix`.

## Production Flow

```text
feature code -> ${window.desktopApi.backendUrl}/models -> backend /models
```

`electron/preload.cjs` exposes `desktopApi.backendUrl` based on runtime configuration.

## Environment Override

`VITE_API_URL` can override the base URL when intentionally testing against another backend.

If `VITE_API_URL` is set, it is used as-is. Make sure it does not include `/api` unless the target backend actually exposes that prefix.

## Example API Module

```typescript
import { get, post } from "@/shared/lib/request";

export function getModels() {
  return get("/models");
}

export function login(username: string, password: string) {
  return post("/login", { username, password });
}
```

## Checklist

- Do not write backend host/port in renderer code.
- Do not write `/api` in backend route definitions.
- Do not call `/api/...` from production-only code.
- Keep `/api` limited to development proxy configuration and development-time browser requests.
