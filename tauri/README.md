# Tauri Desktop App

This folder contains the Tauri configuration for building the desktop application as an alternative to Electron.

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
2. Install Tauri CLI: `cargo install tauri-cli --version "^2.0.0"`
3. Install frontend dependencies: `pnpm install`
4. Install Tauri API in desktop: `cd desktop && pnpm add @tauri-apps/api`

## Development

```bash
# Start Tauri development mode (automatically starts Vite dev server)
cd tauri
cargo tauri dev
```

## Building

```bash
# Build the desktop application
cd tauri
cargo tauri build

# Output location: tauri/target/release/bundle/
```

## Key Features

- **Minimal IPC**: Only 3 commands exposed (backend URL, health checks)
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