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
  docs/             # Central project documentation
  tauri/            # Tauri app sources and config
  .artifacts/       # Temporary shared build artifacts (ignored)
  release/          # electron-builder output
  runtime.config.cjs
```

## Reading Guide

- Start with `README.md` for project overview, development entry points, and packaging commands.
- Use `docs/README.md` as the central documentation index.
- Read `docs/architecture/README.md` before changing runtime boundaries, networking, or packaging flow.
- Read `docs/architecture/ipc-and-preload.md` before changing preload exposure, renderer/native boundaries, or IPC design.
- For Tauri-related work, read `docs/platform/tauri.md` first and `docs/platform/tauri-setup.md` for setup and troubleshooting.
- For chat UI work, read `docs/assistant-ui.md` first.
- Shared UI component docs remain source-adjacent in `desktop/src/shared/ui/COMPONENTS.md` and `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`.

## Networking Rules

1. Development renderer requests must use `/api/xxx`.
2. `/api` is only the Vite proxy prefix.
3. Backend routes never include `/api`, in development or production.
4. Production renderer requests use `window.desktopApi.backendUrl` directly.
5. Backend host and port come from `runtime.config.cjs`; do not duplicate numeric ports in code.
6. Backend should bind to a local host only, not a public network interface.

## Backend Startup

- Development: start desktop workflows through the root `pnpm dev:electron:win` or `pnpm dev:tauri:win` commands.
- Do not refactor or replace the existing desktop dev startup chains unless you verify the full flow end-to-end. In particular, avoid changing the backend launch path, watch mode, or workspace invocation style without confirming that the relevant dev command still brings up Vite, backend health (`/health`), and the desktop shell together on Windows.
- Production: Electron main starts `resources/node-runtime/node.exe` with `resources/server/server.cjs`.
- Native dependencies for the backend are copied into `resources/server/node_modules` during packaging.

## Editing Rules

- Do not manually edit `pnpm-lock.yaml`.
- Keep renderer code free of direct Node APIs.
- Expose native and runtime details through preload.
- Keep backend route paths prefix-free unless the server itself explicitly registers a route prefix.
- Update docs when changing runtime networking, packaging, or backend route contracts.
- Keep release retention behavior centralized in `scripts/build-dist.js`; do not hardcode release cleanup in unrelated scripts.

## UI

- The frontend UI interface design specifications and component documentation are located at `./desktop/src/shared/ui`. 
- When I ask you to implement an interface, you should prioritize using existing pure UI components. Only if they do not exist should you consider abstracting frequently used UI components (excluding business logic).
- You can modify or add components within, but their functionality must be backward compatible. Any modification to the component library requires updating both the design specifications and the component documentation.
- The chat interface for this project was created by assistant-ui. For any related questions, please first refer to the `docs/assistant-ui.md` documentation.

## Verification

Run these before considering packaging/runtime changes complete:

```bash
pnpm check
pnpm package:electron:win
```

Packaging notes:

- `pnpm package:electron:win` keeps the most recent `3` release directories by default.
- Use `RELEASE_KEEP_COUNT` to change the retention count for a run.
- If an old release directory is locked by Windows, cleanup is skipped instead of failing the build.

For a packaged build, verify:

```bash
curl http://<backend-host>:<backend-port>/health
```

Use host and port from `runtime.config.cjs`.
