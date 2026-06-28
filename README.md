# UIChat Mira

UIChat Mira is a local-first desktop workspace for chat, knowledge, tools, and docs.

It is built to help you:

- work with models, roles, knowledge, MCP, and tools inside one desktop app
- keep the project docs readable for both humans and AI
- keep the whole project aligned around one local runtime

## Entry Points

- `docs/README.md`
- `docs/VAULT_HOME.md`
- `docs/WIKI_SYSTEM_SCHEMA.md`
- `docs/architecture/README.md`
- `docs/uchat.md`

## Project Layout

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

## Runtime

- React + Vite renderer
- Electron / Tauri shell
- Fastify backend
- Host and port come from `runtime.config.cjs`

## Development

```bash
pnpm install
pnpm dev:electron:win
pnpm dev:tauri:win
pnpm check
pnpm check:no-db-in-index
pnpm clean:artifacts
```

## Packaging

- `docs/build/README.md`

```bash
pnpm package:electron:win
pnpm package:tauri:win
```

## Health Checks

```bash
curl http://<backend-host>:<backend-port>/health
curl http://<backend-host>:<backend-port>/db/health
```
