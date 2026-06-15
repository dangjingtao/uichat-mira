# Documentation Guide

Most project documentation is centralized under `docs/`. The main exceptions are the root `README.md`, `AGENTS.md`, and the source-adjacent UI docs under `desktop/src/shared/ui/`.

## Recommended Reading Order

1. `../README.md`: project overview, quick start, and packaging entry points
2. `architecture/README.md`: architecture, runtime boundaries, and request contract
3. `architecture/ipc-and-preload.md`: preload exposure and IPC rules
4. `assistant-ui.md`: assistant-ui reference index for chat UI work
5. `platform/tauri.md`: Tauri runtime overview
6. `platform/tauri-setup.md`: Tauri setup, build, and troubleshooting

## Topical Index

### Core runtime

- `architecture/README.md`
- `architecture/ipc-and-preload.md`
- `architecture/rag-node-development.md`
- `API-Response-Spec.md`
- `API_MODEL_CONFIG.md`

### Platform and packaging

- `platform/tauri.md`
- `platform/tauri-setup.md`
- `CHANGELOG.md`
- `版本管理.md`

### Product and feature docs

- `assistant-ui.md`
- `chat-system-practices.md`
- `rag-langgraph-flow.md`
- `knowledge-base-mvp.md`
- `knowledge-base-backend-schema.md`
- `provider-proxy-api.md`
- `provider-integration-optimization.md`

### Engineering conventions

- `CODING_STANDARDS.md`
- `前端-axios封装说明.md`

## Source-Adjacent Docs

These stay outside `docs/` on purpose because they should evolve together with the UI component source:

- `../desktop/src/shared/ui/COMPONENTS.md`
- `../desktop/src/shared/ui/ui-design-guidelines-tailwind.md`
