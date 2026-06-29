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

## Local Model Packs

本地构建默认不联网拉 Hugging Face。

开发时请在自己的 `.env` 里配置：

```text
LOCAL_MODEL_RAW_ROOT=<你的本地模型目录>
LOCAL_ONNX_WASM_ROOT=<onnxruntime-web/dist 目录>
```

`.env.example` 里有一组可直接参考的路径示例。

模型文件下载来源：

- `Xenova/multilingual-e5-small`
- `Xenova/ms-marco-MiniLM-L-6-v2`（可选）

你把下载好的文件放到 `LOCAL_MODEL_RAW_ROOT` 指向的目录下，再运行：

```bash
pnpm prepare:local-model-packs
```

如果本地目录已存在，它只会校验并生成 `manifest.json`。
本地没有这两个环境变量就直接报错，不会回退到 `.artifacts/`。
CI 构建阶段才允许设置 `LOCAL_MODEL_ALLOW_NETWORK=1` 自动下载。

## Health Checks

```bash
curl http://<backend-host>:<backend-port>/health
curl http://<backend-host>:<backend-port>/db/health
```
