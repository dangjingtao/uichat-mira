# UI Chat RAG Tester

Electron + React + Fastify desktop app for local RAG testing and model configuration.

## Documentation

Primary project docs now live under `docs/`.

- `docs/README.md`: documentation index and recommended reading order
- `docs/architecture/README.md`: architecture, runtime boundaries, and networking contract
- `docs/architecture/ipc-and-preload.md`: preload and IPC guidance
- `docs/architecture/rag-node-development.md`: RAG node standard IO and observability development guide
- `docs/platform/tauri.md`: Tauri desktop runtime overview
- `docs/platform/tauri-setup.md`: Tauri setup and troubleshooting
- `docs/assistant-ui.md`: assistant-ui reference entry
- `docs/evaluation-workbench.md`: 评测工作台技术方案、调用链路与联调说明
- `desktop/src/shared/ui/COMPONENTS.md`: source-adjacent shared UI component documentation
- `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`: source-adjacent UI design guidelines

## Workspace Layout

```text
root/
  desktop/          # React renderer
  electron/         # Electron main/preload and shell package
  server/           # Fastify backend source and build script
  packages/         # Shared workspace packages
  scripts/          # Build and packaging helpers
  docs/             # Central project documentation
  tauri/            # Tauri app sources and config
  .artifacts/       # Temporary shared build artifacts (ignored)
  release/          # packaged desktop release outputs
  runtime.config.cjs
```

## Runtime Model

- Renderer: React + Vite, loaded by Electron.
- Backend: Fastify server bundled as `server.cjs`.
- Production startup: Electron main process starts the bundled Node runtime from `resources/node-runtime/node.exe`, then runs `resources/server/server.cjs`.
- Backend binding: local only, using the host and port from `runtime.config.cjs`.
- Renderer access: production resolves the backend origin through the shared desktop runtime adapter; development uses Vite proxy.

## Request Rules

- Development renderer requests use `/api/xxx`.
- `/api` exists only as the Vite proxy prefix.
- Backend routes never include `/api`, in either development or production.
- Production renderer requests use the backend origin directly, for example `${backendUrl}/login` or `${backendUrl}/models`.
- Backend host and port are configured in `runtime.config.cjs`; do not hardcode them elsewhere.

## Important Files

- `runtime.config.cjs`: single source for backend host, backend port, and dev proxy prefix.
- `desktop/vite.config.ts`: reads runtime config and proxies `/api` to the backend without the prefix.
- `desktop/src/shared/lib/request.ts`: selects `/api` in development and the desktop runtime backend origin in packaged desktop shells.
- `desktop/src/shared/platform/desktopRuntime.ts`: central desktop host abstraction used by renderer code to resolve runtime kind and backend base URL.
- `electron/main.cjs`: starts the bundled backend process in production.
- `electron/preload.cjs`: exposes `desktopApi.backendUrl` and runtime metadata.
- `server/build.js`: outputs the shared desktop backend bundle to `.artifacts/server-bundle`.
- `server/src/config/index.ts`: reads host and port from env or `runtime.config.cjs`.
- `scripts/build-dist.js`: builds renderer/server, copies shared backend assets into Electron packaging inputs, copies the Node runtime and runtime config, runs electron-builder, then prunes old release outputs.
- Production packaging cleans `.artifacts/` after a successful build so intermediate desktop inputs do not accumulate in the repository root.

## Development

Install dependencies:

```bash
pnpm install
```

Start all development services:

```bash
pnpm dev:electron:win
```

Start Tauri development services:

```bash
pnpm dev:tauri:win
```

Useful shared commands:

```bash
pnpm check
pnpm clean:artifacts
```

In development, frontend code should request `/api/...`; Vite rewrites it to the backend route without `/api`.
By default, the backend development database is created at `server/data/uichat-rag-test.db` because the dev server runs with `server/` as its working directory.

## Packaging

Build a Windows package:

```bash
pnpm package:electron:win
```

The output is written to `release/v<version>_<date>_<time>/electron/`.

Release retention:

- By default, only the most recent `3` release directories are kept.
- Override this with `RELEASE_KEEP_COUNT`.
- Example: `RELEASE_KEEP_COUNT=5 pnpm package:electron:win`

Build a Tauri Windows package:

```bash
pnpm package:tauri:win
```

The distributable output is written to `release/v<version>_<date>_<time>/tauri/`.
The raw Tauri bundle still exists under `tauri/target/release/bundle/`, but that path is treated as an internal build directory rather than the final release handoff location.

Versioning notes:

- Root `package.json` is the single release version source.
- `pnpm version:sync` syncs that version into workspace package manifests, `tauri/tauri.conf.json`, and `tauri/Cargo.toml`.
- Both packaging scripts run `pnpm version:sync` before building, so release directory names and Tauri installer filenames stay aligned.

Locked directories are skipped and cleaned on a later run when Windows releases the file handle.

The packaged app includes:

- `resources/app.asar`: Electron main/preload and renderer assets.
- `resources/server`: Fastify backend bundle, database seed/data, and native Node dependencies.
- `resources/node-runtime/node.exe`: Node runtime used to start the backend.
- `resources/runtime.config.cjs`: runtime backend host/port configuration.

Packaged desktop startup notes:

- Electron and Tauri now both wait briefly for the bundled backend `GET /health` check before finishing startup.
- Electron and Tauri both persist `JWT_SECRET` and `SETTINGS_SECRET` under the app-local data directory so packaged logins can issue stable tokens.
- Electron and Tauri both set `UI_CHAT_ALLOW_DEFAULT_BOOTSTRAP=1` in packaged mode, so the built-in seed users (`Tomz / 123456`, `Dang / 123456`) are created automatically when the auth database is empty.

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

## todo

- [x] 支持 Cloudflare 模型
- [ ] 给 updateDocument 做真正的回滚策略：
  先保留旧 chunk 和旧向量引用, 新 embedding 成功后再切换, 失败则恢复旧内容和旧向量状态
- [ ] 支持tauri打包
