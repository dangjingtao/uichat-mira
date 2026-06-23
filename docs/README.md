# Documentation Guide

Most project documentation is centralized under `docs/`. The main exceptions are the root `README.md`, `AGENTS.md`, and the source-adjacent UI docs under `desktop/src/shared/ui/`.

## Recommended Reading Order

1. `../README.md`: project overview, quick start, and packaging entry points
2. `architecture/README.md`: architecture, runtime boundaries, and request contract
3. `CODING_STANDARDS.md`: TypeScript, Fastify route, and documentation conventions
4. `architecture/ipc-and-preload.md`: preload exposure and IPC rules
5. `uchat.md`: current app-owned chat runtime architecture and boundaries
6. `platform/tauri.md`: Tauri runtime overview
7. `platform/tauri-setup.md`: Tauri setup, build, and troubleshooting

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

- `uchat.md`
- `uchat-internal-maintenance.md`
- `chat-system-practices.md`
- `defect-log.md`
- `evaluation-workbench.md`
- `product-roadmap-priorities.md`
- `rag-langgraph-flow.md`
- `knowledge-base-backend-schema.md`
- `knowledge-base-api.md`
- `markdown-workspace-mode.md`
- `provider-proxy-api.md`
- `provider-integration-optimization.md`
- `provider-api-standards.md`
- `tools-protocol.md`

### Archived docs

- `archive/knowledge-base-mvp.md`

### Engineering conventions

- `CODING_STANDARDS.md`
- `前端-axios封装说明.md`

## Source-Adjacent Docs

These stay outside `docs/` on purpose because they should evolve together with the UI component source:

- `../desktop/src/shared/ui/COMPONENTS.md`
- `../desktop/src/shared/ui/ui-design-guidelines-tailwind.md`
