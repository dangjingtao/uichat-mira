# UI Chat RAG Tester

Electron + React + Fastify desktop app for local RAG testing and model configuration.

## Runtime Model

- Renderer: React + Vite, loaded by Electron.
- Backend: Fastify server bundled as `server.cjs`.
- Production startup: Electron main process starts the bundled Node runtime from `resources/node-runtime/node.exe`, then runs `resources/server/server.cjs`.
- Backend binding: local only, using the host and port from `runtime.config.cjs`.
- Renderer access: production reads `window.desktopApi.backendUrl`; development uses Vite proxy.

## Request Rules

- Development renderer requests use `/api/xxx`.
- `/api` exists only as the Vite proxy prefix.
- Backend routes never include `/api`, in either development or production.
- Production renderer requests use the backend origin directly, for example `${backendUrl}/login` or `${backendUrl}/models`.
- Backend host and port are configured in `runtime.config.cjs`; do not hardcode them elsewhere.

## Important Files

- `runtime.config.cjs`: single source for backend host, backend port, and dev proxy prefix.
- `desktop/vite.config.ts`: reads runtime config and proxies `/api` to the backend without the prefix.
- `desktop/src/shared/lib/request.ts`: selects `/api` in development and `window.desktopApi.backendUrl` in production.
- `electron/main.cjs`: starts the bundled backend process in production.
- `electron/preload.cjs`: exposes `desktopApi.backendUrl` and health check helpers.
- `server/src/config/index.ts`: reads host and port from env or `runtime.config.cjs`.
- `scripts/build-dist.js`: builds renderer/server, copies backend assets, Node runtime, and runtime config, runs electron-builder, then prunes old release outputs.

## Development

Install dependencies:

```bash
pnpm install
```

Start all development services:

```bash
pnpm dev
```

Useful individual commands:

```bash
pnpm dev:desktop
pnpm dev:server
pnpm build
pnpm check
```

In development, frontend code should request `/api/...`; Vite rewrites it to the backend route without `/api`.

## Packaging

Build a Windows package:

```bash
pnpm dist:win
```

The output is written to `release/v<version>_<date>_<time>/`.

Release retention:

- By default, only the most recent `3` release directories are kept.
- Override this with `RELEASE_KEEP_COUNT`.
- Example: `RELEASE_KEEP_COUNT=5 pnpm dist:win`
- Locked directories are skipped and cleaned on a later run when Windows releases the file handle.

The packaged app includes:

- `resources/app.asar`: Electron main/preload and renderer assets.
- `resources/server`: Fastify backend bundle, database seed/data, and native Node dependencies.
- `resources/node-runtime/node.exe`: Node runtime used to start the backend.
- `resources/runtime.config.cjs`: runtime backend host/port configuration.

Vector extension packaging:

- The backend loads `sqlite-vec` on startup.
- Windows packaging includes both `sqlite-vec` and `sqlite-vec-windows-x64` under `resources/server/node_modules`.
- `Settings -> General` and `/db/health` expose the current `sqlite-vec` load status.

## Health Checks

Backend health:

```bash
curl http://<backend-host>:<backend-port>/health
```

Database health:

```bash
curl http://<backend-host>:<backend-port>/db/health
```

Use the actual values from `runtime.config.cjs`.
