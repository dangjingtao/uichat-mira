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
cargo install tauri-cli --version "^2.0.0"
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
cd tauri
cargo tauri dev
```

This will:
- Start the Vite development server on http://localhost:5173
- Launch the Tauri window
- Connect to your existing backend (start it separately with `pnpm dev:server`)

### 5. Build for Production

```bash
# From project root
cd tauri
cargo tauri build
```

The built application will be in `tauri/target/release/bundle/`

## Platform-Specific Builds

### Windows
```bash
cargo tauri build --target x86_64-pc-windows-msvc
```

### macOS
```bash
cargo tauri build --target x86_64-apple-darwin
cargo tauri build --target aarch64-apple-darwin  # Apple Silicon
```

### Linux
```bash
cargo tauri build --target x86_64-unknown-linux-gnu
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

### Frontend not connecting
- Ensure the backend is running on `http://127.0.0.1:8787`
- Check the console for any connection errors
- Verify the API proxy configuration in Vite

## Next Steps

1. Test the development build: `cargo tauri dev`
2. Build a production release: `cargo tauri build`
3. Compare bundle size with Electron version
4. Test all features to ensure compatibility

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Tauri API Reference](https://tauri.app/v1/api/js/)
- [Rust Book](https://doc.rust-lang.org/book/)