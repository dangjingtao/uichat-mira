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

# microapp_T101 Image Generation Server Domain Core

## Target

实现 `image_generation` 的 server 领域核心，只负责统一任务生命周期、领域对象、服务编排和依赖注入接口。

本卡不直接实现 provider 协议、不写 Fastify route、不改 desktop。

## Allowed Changes

- `server/src/microapps/image-generation/core/**`
- `server/src/microapps/image-generation/index.ts`
- `server/src/microapps/image-generation/__tests__/core*.test.ts`
- `docs/project-control/tasks/microapp_T101-image-generation-server-domain-core.md`

## Forbidden Changes

- `server/src/microapps/image-generation/adapters/**`
- `server/src/microapps/image-generation/artifacts/**`
- `server/src/routes/**`
- `server/src/db/**`
- `desktop/**`

## Code Placement

- 统一领域类型放在 `server/src/microapps/image-generation/core/types.ts`
- 统一状态机放在 `server/src/microapps/image-generation/core/job-lifecycle.ts`
- 领域服务放在 `server/src/microapps/image-generation/core/service.ts`
- 对外导出面放在 `server/src/microapps/image-generation/index.ts`

## Acceptance Criteria

1. 领域核心已定义统一执行类型、任务状态、请求摘要和产物摘要。
2. 核心 service 通过接口依赖 adapter registry 和 artifact store，不直接持有某个 provider 协议实现。
3. 核心层不直接 import `fastify`、`fs`、`node:path`、`electron` 或 renderer 代码。
4. 核心层不写死 `openai`、`aliyun`、`tencent`、`comfyui` 的协议字段名。
5. 定向测试覆盖任务状态流转和 service 编排。
6. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/microapps/image-generation/__tests__/core*.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证领域核心状态机和 service 编排
- `rg -n "from \\\"fastify\\\"|from \\\"node:fs\\\"|from \\\"node:path\\\"" server/src/microapps/image-generation/core server/src/microapps/image-generation/index.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查核心层没有越界依赖
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence

- Changed files:
  - `server/src/microapps/image-generation/core/**`
  - `server/src/microapps/image-generation/index.ts`
  - `server/src/microapps/image-generation/__tests__/core*.test.ts`

- Acceptance evidence placeholder:
  - 等实现线程回填

## Isolation Rules

- 本卡只拥有 `core/**` 和根导出文件，不能顺手改 `adapters/**`、`artifacts/**` 或 route。
- 如果需要 provider 特有字段，必须通过接口或 `providerParams` 透传，不允许把某个 provider 协议塞进核心层。

