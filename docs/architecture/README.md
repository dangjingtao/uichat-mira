# Architecture

## Stack

| Layer | Tech |
| --- | --- |
| Renderer | React, Vite, TypeScript |
| Desktop shell | Electron main + preload |
| Backend | Fastify bundled as a Node service |
| Database | SQLite via `better-sqlite3` |
| Build | pnpm workspace + electron-builder |

## Process Model

```text
Development

React renderer  -- /api proxy -->  Fastify backend
localhost:5173                     <backend-host>:<backend-port>

Production

UIChat.exe
  ├─ Electron main process
  ├─ Renderer loaded from app.asar
  └─ Bundled node.exe runs resources/server/server.cjs

Renderer  -- direct HTTP -->  Fastify backend
file:// app                  http://<backend-host>:<backend-port>
```

## Request Contract

- Development frontend requests use `/api/xxx`.
- Vite owns the `/api` prefix and strips it before forwarding.
- Backend routes never include `/api`.
- Production frontend requests use `window.desktopApi.backendUrl` with no prefix.
- Backend host and port come from `runtime.config.cjs` or environment variables set by Electron main.
- App metadata such as the current version is served by the backend through `GET /app/meta`.

## Runtime Configuration

`runtime.config.cjs` is the single project-level configuration source for local backend networking.

Consumers:

- `desktop/vite.config.ts` reads it for proxy target and prefix.
- `electron/main.cjs` reads it before starting the backend process.
- `electron/preload.cjs` reads it to expose `desktopApi.backendUrl`.
- `server/src/config/index.ts` reads it as the default server host/port.
- `scripts/build-dist.js` copies it into the packaged app and prunes old release directories after a successful package build.
- `server/build.js` writes the shared backend bundle into `.artifacts/server-bundle` for desktop packagers to consume.

## Package Layout

```text
release/.../win-unpacked/resources/
  app.asar
  runtime.config.cjs
  node-runtime/node.exe
  server/server.cjs
  server/node_modules/
  server/data/
```

## Release Retention

- Packaged outputs are written into timestamped directories under `release/`.
- After a successful `pnpm package:electron:win`, the build script keeps the newest `3` release directories by default.
- Override the retention count with `RELEASE_KEEP_COUNT`.
- If Windows still holds a lock on an old release directory, the cleanup step skips it and continues.

## Boundaries

- `desktop/`: renderer-only code. Do not use Node APIs directly.
- `electron/`: main process and preload bridge. Node APIs allowed.
- `server/`: Fastify backend. No Electron APIs.
- `packages/`: shared package workspace.
- `scripts/`: build and packaging helpers.

## Key Decisions

1. Local HTTP backend is acceptable for this desktop app because it binds to the configured local host only.
2. `/api` is a development-only proxy prefix, not a backend route namespace.
3. Production uses direct backend origin from preload instead of Vite proxy.
4. The backend is run with the bundled Node runtime to avoid Electron/Node native module ABI mismatch.
5. Port values should not be repeated in code; update `runtime.config.cjs` instead.

## Model Settings Contract

- The backend persists provider connection settings for `ollama`, `lmstudio`, and `openai`.
- Provider model discovery is always server-side. The renderer never calls provider APIs directly.
- The main settings page reads active role configs from `GET /models`.
- Saving role parameters uses `PUT /models/:type/config`.
- Provider modal workflows use:
  - `GET /providers`
  - `GET /providers/:providerCode`
  - `PUT /providers/:providerCode`
  - `POST /providers/:providerCode/sync-models`
  - `PUT /providers/:providerCode/select-model/:role`
- Selecting a new default model for a role replaces the previous role config and resets that role's params to backend defaults.
