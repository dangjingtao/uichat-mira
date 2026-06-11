# Tauri Setup Instructions

## Quick Start

### 1. Install Rust (if not already installed)

**Windows:**
```powershell
# Download and run rustup-init.exe from https://rustup.rs/
# Or use winget:
winget install Rustlang.Rustup
```

**macOS/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Install Tauri CLI

```bash
pnpm add -Dw @tauri-apps/cli@latest
```

### 3. Install Frontend Dependencies

```bash
# From project root
pnpm install

# Install Tauri API in desktop package
cd desktop
pnpm add @tauri-apps/api
cd ..
```

### 4. Development Mode

```bash
# From project root
pnpm dev:tauri:win
```

This will:
- Start the Vite development server on http://localhost:5173
- Start the Fastify backend on the host and port from `runtime.config.cjs`
- Launch the Tauri window
- Connect to the backend started by the shared workspace script
- Use `CARGO_BUILD_JOBS=1` and `CARGO_INCREMENTAL=0` to reduce Windows `rustc` crashes during dev builds

### 5. Build for Production

```bash
# From project root
pnpm package:tauri:win

# Optional: validate the Rust side with the same low-concurrency settings
pnpm check:tauri
```

The built application will be in `tauri/target/release/bundle/`

## Platform-Specific Builds

### Windows
```bash
pnpm tauri build --config tauri/tauri.conf.json --target x86_64-pc-windows-msvc
```

### macOS
```bash
pnpm tauri build --config tauri/tauri.conf.json --target x86_64-apple-darwin
pnpm tauri build --config tauri/tauri.conf.json --target aarch64-apple-darwin  # Apple Silicon
```

### Linux
```bash
pnpm tauri build --config tauri/tauri.conf.json --target x86_64-unknown-linux-gnu
```

## Troubleshooting

### Rust not found
Make sure you've added Cargo to your PATH:
```bash
# Windows: Add %USERPROFILE%\.cargo\bin to PATH
# macOS/Linux: Add $HOME/.cargo/bin to PATH in ~/.bashrc or ~/.zshrc
```

### Node.js backend not starting
In production mode, Tauri will try to start the backend automatically. Make sure:
- The backend files are in `resources/server/`
- Node.js is bundled in `resources/node-runtime/`
- The backend server path is correct
- the internal Tauri prepare flow has refreshed the shared staged inputs under `.artifacts/`

### Shared artifact staging
Before Tauri packaging, the workspace stages all required inputs into `.artifacts/`:
- `.artifacts/desktop/dist`
- `.artifacts/server-bundle`
- `.artifacts/server-data`
- `.artifacts/icons`
- `.artifacts/runtime.config.cjs`
- `.artifacts/node-runtime`

`tauri.conf.json` then consumes these staged inputs for `frontendDist`, app icons, and packaged runtime resources.

### Packaged login behavior
- Packaged Tauri builds now persist `JWT_SECRET` and `SETTINGS_SECRET` under the app local data directory so login tokens remain valid across restarts.
- Packaged Tauri builds also set `UI_CHAT_ALLOW_DEFAULT_BOOTSTRAP=1`, which allows the built-in seed users (`Tomz / 123456`, `Dang / 123456`) to be created automatically when the auth database is empty.
- If you want different initial credentials, set `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` and optional `SEED_USER_USERNAME` / `SEED_USER_PASSWORD` before starting the bundled backend.

### Frontend not connecting
- Ensure the backend is running on the host and port defined in the root `runtime.config.cjs`
- Check the console for any connection errors
- Verify the API proxy configuration in Vite

## Next Steps

1. Test the development build: `pnpm dev:tauri:win`
2. Build a production release: `pnpm package:tauri:win`
3. Compare bundle size with Electron version
4. Test all features to ensure compatibility

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Tauri API Reference](https://tauri.app/v1/api/js/)
- [Rust Book](https://doc.rust-lang.org/book/)
