# Tauri Desktop App

This document covers the Tauri configuration used to build the desktop application as an alternative to Electron.

Tauri and Electron are expected to share the same staged desktop build inputs from the root `.artifacts/` directory.
That includes the frontend production bundle, backend bundle, icons, runtime config, and bundled Node runtime.

## Project Structure

```
tauri/
├── Cargo.toml          # Rust project configuration
├── build.rs            # Build script
├── tauri.conf.json     # Tauri app configuration
├── src/
│   └── main.rs         # Main Rust application code
└── gen/
    └── icons/
        └── icons.json  # Icon configuration
```

## Prerequisites

1. Install Rust: https://www.rust-lang.org/tools/install
2. Install Tauri CLI: `pnpm add -Dw @tauri-apps/cli@latest`
3. Install frontend dependencies: `pnpm install`
4. Install Tauri API in desktop: `cd desktop && pnpm add @tauri-apps/api`

## Development

```bash
# Start Tauri development mode from the workspace root
pnpm dev:tauri:win
```

The workspace script pins `CARGO_BUILD_JOBS=1` and `CARGO_INCREMENTAL=0` to reduce Windows-side `rustc` crashes during development.
It also starts both the Vite renderer and the Fastify backend before launching the Tauri window.

## Building

```bash
# Build the desktop application from the workspace root
pnpm package:tauri:win

# Run the Rust-side compile check with the same low-concurrency settings
pnpm check:tauri
```

Release output conventions:

- Root `package.json` is the single release version source.
- `pnpm version:sync` syncs the root version into workspace packages, `tauri/tauri.conf.json`, and `tauri/Cargo.toml`.
- Final distributable output: `release/v<version>_<date>_<time>/tauri/`
- Raw Tauri bundle cache: `tauri/target/release/bundle/`
- Default retention: keep the newest `3` timestamped directories under `release/`
- Override retention for one run with `RELEASE_KEEP_COUNT`

During `pnpm package:tauri:win` or `pnpm check:tauri`, the internal Tauri prepare flow refreshes:

- `.artifacts/desktop/dist`
- `.artifacts/server-bundle`
- `.artifacts/icons`
- `.artifacts/runtime.config.cjs`
- `.artifacts/node-runtime`

After a successful `pnpm package:tauri:win`, the workspace automatically clears `.artifacts/`.

## Key Features

- **Shared backend config**: Backend host and port are resolved from the root `runtime.config.cjs`
- **Backend Process Management**: Automatically starts Node.js backend in production
- **Compatible with Existing Code**: Frontend code requires minimal changes
- **Cross-platform**: Supports Windows, macOS, and Linux

## Migration Notes

The Tauri version maintains compatibility with the existing Electron version:
- Same backend server (Node.js/Fastify)
- Same frontend (React/Vite)
- Same API contracts
- Only the desktop framework changes

## IPC Commands

| Command | Description |
|---------|-------------|
| `get_backend_url_command` | Returns the backend server URL |
| `check_backend_health_command` | Checks backend server health |
| `check_database_health_command` | Checks database health status |

## Differences from Electron

1. **Smaller bundle size**: Tauri produces much smaller executables
2. **Better performance**: Rust-based main process
3. **Simpler IPC**: Fewer commands needed
4. **Different build process**: Uses Cargo instead of electron-builder
