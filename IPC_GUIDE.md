# IPC and Preload Guide

## Philosophy

Renderer code is untrusted. Native capabilities and runtime configuration should be exposed through preload, not by enabling Node APIs in the renderer.

This project currently uses HTTP for backend API calls. IPC is reserved for desktop/native capabilities and for exposing runtime information.

## Current Preload Contract

`electron/preload.cjs` exposes `window.desktopApi`:

```typescript
interface DesktopApi {
  platform: string;
  isPackaged: boolean;
  backendUrl: string;
  checkBackendHealth: () => Promise<{
    success: boolean;
    statusCode: number;
    error?: string;
  }>;
  checkDatabaseHealth: () => Promise<{
    success: boolean;
    configured: boolean;
    detail: string;
  }>;
}
```

Renderer request code should use `desktopApi.backendUrl` in production and `/api` in development.

## Request Routing

Development:

```text
renderer -> /api/models -> Vite proxy -> backend /models
```

Production:

```text
renderer -> ${window.desktopApi.backendUrl}/models -> backend /models
```

The backend does not expose `/api` routes.

## Adding IPC

Use IPC when the renderer needs desktop capabilities, not for ordinary backend HTTP routes.

Example preload shape:

```typescript
contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
});
```

Rules:

- Keep `contextIsolation: true`.
- Keep `nodeIntegration: false`.
- Validate IPC input in the main process.
- Pass serializable data only.
- Remove long-lived listeners on unmount.
- Do not use IPC channel names as a substitute for backend route names.

## Backend Routes

Backend route examples:

```text
GET /health
GET /db/health
POST /login
GET /me
GET /models
GET /models/:type/config
PUT /models/:type/config
```
