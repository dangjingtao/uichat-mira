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
  - docs/project-control/project-control-ledger.md
  - docs/microapp/image-generation-microapp-poc.md
  - docs/microapp/README.md
  - docs/project-control/tasks/microapp_T100-image-generation-shared-registry-and-seed.md
  - docs/project-control/tasks/microapp_T101-image-generation-server-domain-core.md
  - docs/project-control/tasks/microapp_T102-image-generation-server-adapters-and-artifacts.md
  - docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md
  - docs/project-control/tasks/microapp_T104-image-generation-desktop-api-client.md
  - docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md
task_state: READY_FOR_REVIEW
---

# microapp_T010 Image Generation Parallel Code Isolation

## Target

把 `image_generation` 微应用的后续实现切成一组可并行、可验收、互不踩文件的任务卡。

本卡不实现 runtime，只负责把代码放置位置、共享文件归属、并行批次和禁止交叉修改的规则写死。

## Allowed Changes

- `docs/project-control/tasks/microapp_T010-image-generation-parallel-code-isolation.md`
- `docs/project-control/tasks/microapp_T100-image-generation-shared-registry-and-seed.md`
- `docs/project-control/tasks/microapp_T101-image-generation-server-domain-core.md`
- `docs/project-control/tasks/microapp_T102-image-generation-server-adapters-and-artifacts.md`
- `docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md`
- `docs/project-control/tasks/microapp_T104-image-generation-desktop-api-client.md`
- `docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/**`
- `desktop/**`
- `electron/**`
- `tauri/**`
- DB schema
- 打包链

## Isolation Map

| Task | Owned Area | Shared File Ownership |
| --- | --- | --- |
| `T100` | MicroAPP registry / seed / runtime registration | `server/src/db/repositories/micro-apps.repository.ts`, `server/src/microapps/runtime.ts`, `server/src/microapps/types.ts` |
| `T101` | Server domain core | `server/src/microapps/image-generation/core/**`, `server/src/microapps/image-generation/index.ts` |
| `T102` | Server adapters / artifact handling | `server/src/microapps/image-generation/adapters/**`, `server/src/microapps/image-generation/artifacts/**` |
| `T103` | Server HTTP surface | `server/src/routes/microapps/**`, `server/src/index.ts` |
| `T104` | Desktop shared API client | `desktop/src/shared/api/imageGeneration.ts`, `desktop/src/shared/api/index.ts` |
| `T105` | Desktop debug workspace | `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/**`, `desktop/src/app/routes/settingsRoutes.tsx`, `desktop/src/app/routes/settingsRoutes.test.tsx`, `desktop/src/features/Settings/i18n/en-US.ts`, `desktop/src/features/Settings/i18n/zh-CN.ts` |

## Parallel Batches

### Batch A

- `T100`
- `T101`
- `T102`

这三个线程可以同时开工，因为：

- `T100` 只碰现有共享注册文件
- `T101` 只碰新的 `core/**`
- `T102` 只碰新的 `adapters/**` 和 `artifacts/**`

### Batch B

- `T103`
- `T104`
- `T105`

这三个线程应在 `Batch A` 的接口名称稳定后开工，因为：

- `T103` 依赖 server domain 的导出面
- `T104` 依赖 HTTP route 契约
- `T105` 依赖 desktop shared API client

## Hard Rules

1. 不允许两张卡同时声明同一个真实文件为 allowed area。
2. 共享注册文件只能由 `T100`、`T103`、`T104`、`T105` 这些明确持有者修改，其他线程只能 import，不能编辑。
3. `image_generation` 的 server 业务代码统一放到 `server/src/microapps/image-generation/`，不要散落回 `server/src/routes/`、`server/src/services/` 或旧 `server/src/microapps/apps/`。
4. `image_generation` 的 desktop 调试页面统一放到 `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/`，不要直接塞回现有 `MicroApps/index.tsx` 或 `Detail.tsx`。
5. 当前能力只服务微应用界面调试，不允许任何线程顺手接 chat、第三方平台入口或通用 MCP / Tool 暴露面。

## Acceptance Criteria

1. 五张子任务卡全部存在，并且每张卡的 allowed area 互不重叠。
2. 现有共享文件已经明确归属到唯一任务卡，不再出现“谁都可以顺手改”的灰区。
3. 并行批次已经明确，至少能支持两条线程同时施工而不争用文件。
4. 每张子卡都写明了目标、允许改动、禁止改动、验收标准和验证命令。
5. `project-control` 总台账已登记这些任务卡。

## Verification

- `git diff -- docs/project-control/tasks/microapp_T010-image-generation-parallel-code-isolation.md docs/project-control/tasks/microapp_T100-image-generation-shared-registry-and-seed.md docs/project-control/tasks/microapp_T101-image-generation-server-domain-core.md docs/project-control/tasks/microapp_T102-image-generation-server-adapters-and-artifacts.md docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md docs/project-control/tasks/microapp_T104-image-generation-desktop-api-client.md docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md docs/project-control/project-control-ledger.md`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 核对任务卡和台账更新范围
- `git status --short`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查本轮只修改任务卡和台账

本卡是 docs-only，不跑 `pnpm check`：

- 原因：本卡只定义并行施工边界，不修改 runtime、类型、构建或打包代码。

## Evidence

- Changed files:
  - `docs/project-control/tasks/microapp_T010-image-generation-parallel-code-isolation.md`
  - `docs/project-control/tasks/microapp_T100-image-generation-shared-registry-and-seed.md`
  - `docs/project-control/tasks/microapp_T101-image-generation-server-domain-core.md`
  - `docs/project-control/tasks/microapp_T102-image-generation-server-adapters-and-artifacts.md`
  - `docs/project-control/tasks/microapp_T103-image-generation-server-http-surface.md`
  - `docs/project-control/tasks/microapp_T104-image-generation-desktop-api-client.md`
  - `docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md`
  - `docs/project-control/project-control-ledger.md`

- Diff summary:
  - 新增 `image_generation` 并行施工总隔离卡
  - 新增五张互不重叠的实现任务卡
  - 明确共享文件归属、推荐并行批次和禁止交叉修改规则
  - 在唯一总台账登记新的并行施工队列

## Unfinished / Risks

- 当前只完成任务拆分，不代表这些实现任务已经批准直接开工。
- `T100` 到 `T105` 之间的 import 依赖仍然存在，但文件归属已经切开；施工时必须按卡片边界协作，不能用“顺手改一下对方文件”解决问题。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待评审范围：并行施工代码隔离方案

