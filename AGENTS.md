# AGENTS.md

## Project Identity

UI Chat RAG Tester is an Electron desktop app with a React renderer and a bundled Fastify backend.

The app is a pnpm workspace using React, Vite, Electron, Fastify, TypeScript, and SQLite.

## Workspace Layout

```text
root/
  desktop/          # React renderer
  electron/         # Electron main/preload and shell package
  server/           # Fastify backend source and build script
  packages/         # Shared workspace packages
  scripts/          # Build and packaging helpers
  docs/             # Project documentation
  release/          # electron-builder output
  runtime.config.cjs
```

## Networking Rules

1. Development renderer requests must use `/api/xxx`.
2. `/api` is only the Vite proxy prefix.
3. Backend routes never include `/api`, in development or production.
4. Production renderer requests use `window.desktopApi.backendUrl` directly.
5. Backend host and port come from `runtime.config.cjs`; do not duplicate numeric ports in code.
6. Backend should bind to a local host only, not a public network interface.

## Backend Startup

- Development: start the backend with `pnpm dev:server` or through the root `pnpm dev` workflow.
- Production: Electron main starts `resources/node-runtime/node.exe` with `resources/server/server.cjs`.
- Native dependencies for the backend are copied into `resources/server/node_modules` during packaging.

## Editing Rules

- Do not manually edit `pnpm-lock.yaml`.
- Keep renderer code free of direct Node APIs.
- Expose native and runtime details through preload.
- Keep backend route paths prefix-free unless the server itself explicitly registers a route prefix.
- Update docs when changing runtime networking, packaging, or backend route contracts.
- Keep release retention behavior centralized in `scripts/build-dist.js`; do not hardcode release cleanup in unrelated scripts.

## Verification

Run these before considering packaging/runtime changes complete:

```bash
pnpm check
pnpm build
pnpm dist:win
```

Packaging notes:

- `pnpm dist:win` keeps the most recent `3` release directories by default.
- Use `RELEASE_KEEP_COUNT` to change the retention count for a run.
- If an old release directory is locked by Windows, cleanup is skipped instead of failing the build.

For a packaged build, verify:

```bash
curl http://<backend-host>:<backend-port>/health
```

Use host and port from `runtime.config.cjs`.
