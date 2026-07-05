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
  - docs/architecture/README.md
task_state: TODO
---

# microapp_T103 Image Generation Server HTTP Surface

## Target

实现 `image_generation` 的 backend HTTP 入口，只负责 route、schema、鉴权、OpenAPI 暴露和 server 注册。

本卡不实现 provider 逻辑、不实现领域核心、不改 desktop。

## Allowed Changes

- `server/src/routes/microapps/**`
- `server/src/index.ts`
- `docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md`

## Forbidden Changes

- `server/src/microapps/**`
- `server/src/db/**`
- `desktop/**`
- `electron/**`
- `tauri/**`

## Code Placement

- `image_generation` route 和 schema 统一放到 `server/src/routes/microapps/`
- server 挂载点只允许落在 `server/src/index.ts`

## Acceptance Criteria

1. 新路由保持 prefix-free，不出现 `/api`。
2. 路由层只负责请求校验、鉴权、调用领域 service 和返回响应，不直接写 provider 协议逻辑。
3. `server/src/index.ts` 只新增一次 route 注册，不顺手改别的业务链路。
4. 有定向测试覆盖创建任务、查询任务、鉴权失败和基础错误返回。
5. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/routes/microapps/**/*.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 HTTP 入口和响应契约
- `rg -n "/api|openai|aliyun|tencent|comfyui" server/src/routes/microapps`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查 route 层没有混入开发态前缀或 provider 细节
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence

- Changed files:
  - `server/src/routes/microapps/**`
  - `server/src/index.ts`

- Acceptance evidence placeholder:
  - 等实现线程回填

## Isolation Rules

- 本卡是唯一允许修改 `server/src/index.ts` 的 image generation 线程。
- 本卡绝不回退去改 `server/src/routes/integrations/index.ts`；微应用调试入口必须有自己的 route group。

