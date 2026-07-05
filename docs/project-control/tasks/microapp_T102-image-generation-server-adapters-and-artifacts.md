---
status: current
priority: P1
owner: microapp
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ImageGeneration
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T010-image-generation-parallel-code-isolation.md
  - docs/microapp/image-generation-microapp-poc.md
task_state: TODO
---

# microapp_T102 Image Generation Server Adapters And Artifacts

## Target

实现 `image_generation` 的 provider adapter 和产物处理层，包括云 provider 协议差异、本地 `ComfyUI` runner、远端 URL 回收和本地 artifact 落盘。

本卡不改领域核心、不改 Fastify route、不改 desktop。

## Allowed Changes

- `server/src/microapps/image-generation/adapters/**`
- `server/src/microapps/image-generation/artifacts/**`
- `server/src/microapps/image-generation/__tests__/adapters*.test.ts`
- `server/src/microapps/image-generation/__tests__/artifacts*.test.ts`
- `.test-artifact/image-generation/**`
- `docs/project-control/tasks/microapp_T102-image-generation-server-adapters-and-artifacts.md`

## Forbidden Changes

- `server/src/microapps/image-generation/core/**`
- `server/src/microapps/image-generation/index.ts`
- `server/src/routes/**`
- `server/src/db/**`
- `desktop/**`

## Code Placement

- 云 provider 和 `ComfyUI` adapter 放在 `server/src/microapps/image-generation/adapters/`
- 远端 URL 下载、本地文件接管、artifact 元数据辅助工具放在 `server/src/microapps/image-generation/artifacts/`

## Acceptance Criteria

1. `OpenAI Images`、`阿里云万相`、`腾讯云混元`、`ComfyUI Local` 的协议实现都只放在 `adapters/**`。
2. `ComfyUI` adapter 只接受 workflow API JSON，不在本卡里重新抽象局部重绘等业务语义。
3. 远端 URL 型结果不会直接当最终业务真相，必须通过 `artifacts/**` 拉回本地。
4. adapter 层不 import `fastify`、React、Electron 或页面代码。
5. 产物层的测试临时文件只允许写到 `.test-artifact/image-generation/**`。
6. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/microapps/image-generation/__tests__/adapters*.test.ts src/microapps/image-generation/__tests__/artifacts*.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 adapter 协议处理和 artifact 回收
- `rg -n "from \\\"fastify\\\"|from \\\"react\\\"|window\\.desktopApi" server/src/microapps/image-generation/adapters server/src/microapps/image-generation/artifacts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查 adapter 和 artifact 层没有越界依赖
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence

- Changed files:
  - `server/src/microapps/image-generation/adapters/**`
  - `server/src/microapps/image-generation/artifacts/**`
  - `server/src/microapps/image-generation/__tests__/adapters*.test.ts`
  - `server/src/microapps/image-generation/__tests__/artifacts*.test.ts`
  - `.test-artifact/image-generation/**`

- Acceptance evidence placeholder:
  - 等实现线程回填

## Isolation Rules

- 本卡不能修改 `core/**`，即使发现接口不顺手，也只能通过明确的接口契约协作。
- 本卡是唯一允许新增 `.test-artifact/image-generation/**` 产物的线程。

