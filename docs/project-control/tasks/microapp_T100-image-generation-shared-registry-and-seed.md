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
task_state: DONE
---

# microapp_T100 Image Generation Shared Registry And Seed

## Target

把 `image_generation` 注册进当前 MicroAPP 共用注册层，让它成为一个被系统认识的微应用类型，但不在本卡里实现实际生图逻辑。

本卡只负责共享注册文件、默认种子定义和运行时识别入口。

## Allowed Changes

- `server/src/db/repositories/micro-apps.repository.ts`
- `server/src/microapps/runtime.ts`
- `server/src/microapps/types.ts`
- `server/src/microapps/apps/image-generation.microapp.ts`
- `server/src/microapps/__tests__/image-generation-registry.test.ts`
- `docs/project-control/tasks/microapp_T100-image-generation-shared-registry-and-seed.md`

## Forbidden Changes

- `server/src/microapps/image-generation/**`
- `server/src/routes/**`
- `desktop/**`
- `electron/**`
- `tauri/**`
- DB schema 文件

## Code Placement

- MicroAPP 类型、supported access point、默认 binding schema 放在 `server/src/db/repositories/micro-apps.repository.ts`
- 运行时注册入口放在 `server/src/microapps/runtime.ts`
- 微应用定义桥接文件放在 `server/src/microapps/apps/image-generation.microapp.ts`

## Acceptance Criteria

1. `MicroAppType` 已包含 `image_generation`。
2. `MicroAppSupportedAccessPoint` 已包含 `desktop.image_generation_studio`。
3. 默认种子定义已包含 `image_generation`，并声明稳定 `runtimeKey`。
4. `server/src/microapps/runtime.ts` 已能识别 `image_generation`，但本卡不引入具体 provider、artifact、route 或 UI 实现。
5. 新增定向测试验证注册层能列出或识别 `image_generation`。
6. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/microapps/__tests__/image-generation-registry.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证共享注册层已经识别 `image_generation`
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence

- Changed files:
  - `server/src/db/repositories/micro-apps.repository.ts`
  - `server/src/microapps/runtime.ts`
  - `server/src/microapps/types.ts`
  - `server/src/microapps/apps/image-generation.microapp.ts`
  - `server/src/microapps/__tests__/image-generation-registry.test.ts`

- Acceptance evidence placeholder:
  - `server/src/db/repositories/micro-apps.repository.ts` 已新增 `image_generation` 类型、`desktop.image_generation_studio` access point，以及稳定 `runtimeKey: "image_generation"` 的默认 seed 定义
  - `server/src/microapps/runtime.ts` 已注册 `imageGenerationMicroApp`，共享运行时可识别 `image_generation`
  - `server/src/microapps/__tests__/image-generation-registry.test.ts` 已验证 seed 与 runtime 注册同时生效

## Isolation Rules

- 本卡是唯一允许修改 `server/src/db/repositories/micro-apps.repository.ts`、`server/src/microapps/runtime.ts` 和 `server/src/microapps/types.ts` 的线程。
- 其它线程如果需要这些类型或 runtime 注册结果，只能 import，不能顺手编辑。

## Unfinished / Risks

- 本卡不负责实际生图 service、adapter、route、desktop 页面。
- 如果实现线程发现需要改 DB schema，必须停下重新开卡，不能在本卡里顺手扩表。
