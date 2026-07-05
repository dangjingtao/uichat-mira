---
status: current
priority: P1
owner: microapp
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/microapp/computer-use-microapp-poc.md
  - docs/microapp/computer-use-feature-design.md
  - docs/project-control/tasks/microapp_T110-computer-use-shared-registry-and-seed.md
  - docs/project-control/tasks/microapp_T111-computer-use-server-domain-core.md
  - docs/project-control/tasks/microapp_T112-computer-use-browser-runtime-and-executor.md
  - docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md
  - docs/project-control/tasks/microapp_T114-computer-use-desktop-api-client.md
  - docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md
task_state: READY_FOR_REVIEW
---

# microapp_T020 Computer Use Parallel Code Isolation

## Target

把 `computer_use` 微应用的第一阶段浏览器工作台实现切成一组可并行、可验收、物理隔离的任务卡。

本卡不实现 runtime，只负责把代码放置位置、共享文件归属、并行批次、测试范围和禁止交叉修改的规则写死。

## Allowed Changes

- `docs/project-control/tasks/microapp_T020-computer-use-parallel-code-isolation.md`
- `docs/project-control/tasks/microapp_T110-computer-use-shared-registry-and-seed.md`
- `docs/project-control/tasks/microapp_T111-computer-use-server-domain-core.md`
- `docs/project-control/tasks/microapp_T112-computer-use-browser-runtime-and-executor.md`
- `docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md`
- `docs/project-control/tasks/microapp_T114-computer-use-desktop-api-client.md`
- `docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md`
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
| `T110` | MicroAPP registry / seed / runtime registration | `server/src/db/repositories/micro-apps.repository.ts`, `server/src/microapps/runtime.ts`, `server/src/microapps/types.ts`, `server/src/microapps/apps/computer-use.microapp.ts` |
| `T111` | Server domain core | `server/src/microapps/computer-use/core/**`, `server/src/microapps/computer-use/index.ts` |
| `T112` | Browser runtime manager / Playwright executor | `server/src/microapps/computer-use/runtime/**`, `server/src/microapps/computer-use/executor/**`, `.test-artifact/computer-use/**` |
| `T113` | Server HTTP surface | `server/src/routes/microapps/computer-use/**`, `server/src/routes/microapps/index.ts`, `server/src/index.ts` |
| `T114` | Desktop shared API client | `desktop/src/shared/api/computerUse.ts`, `desktop/src/shared/api/index.ts` |
| `T115` | Desktop studio workspace | `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`, `desktop/src/app/routes/settingsRoutes.tsx`, `desktop/src/app/routes/settingsRoutes.test.tsx`, `desktop/src/features/Settings/i18n/en-US.ts`, `desktop/src/features/Settings/i18n/zh-CN.ts` |

## Parallel Batches

### Batch A

- `T110`
- `T111`
- `T112`

这三条线程可以同时开工，因为：

- `T110` 只碰现有共享注册文件和单独的微应用定义桥接文件
- `T111` 只碰新的 `core/**`
- `T112` 只碰新的 `runtime/**`、`executor/**` 和测试产物目录

### Batch B

- `T113`
- `T114`
- `T115`

这三条线程应在 `Batch A` 的接口名称稳定后开工，因为：

- `T113` 依赖 server domain 和 runtime manager 的导出面
- `T114` 依赖 HTTP route 契约
- `T115` 依赖 desktop shared API client

## Hard Rules

1. 不允许两张卡同时声明同一个真实文件为 allowed area。
2. 共享注册文件和 `server/src/microapps/apps/computer-use.microapp.ts` 只能由 `T110` 修改，其他线程只能 import，不能顺手编辑。
3. `computer_use` 的 server 业务代码统一放到 `server/src/microapps/computer-use/`，不要散回旧 `services/`、`routes/` 或 `apps/` 目录。
4. `computer_use` 的 desktop 工作台统一放到 `desktop/src/features/Settings/pages/MicroApps/ComputerUse/`，不要直接塞回现有 `MicroApps/index.tsx` 或 `Detail.tsx`。
5. 当前能力只服务微应用浏览器工作台，不允许任何线程顺手接 chat、浏览器插件、宿主桌面控制或通用 MCP / Tool 暴露面。
6. 每张卡必须自带定向测试范围，不能把“等总冒烟一起看”当成本卡验证。

## Acceptance Criteria

1. 六张子任务卡全部存在，并且每张卡的 allowed area 互不重叠。
2. 现有共享文件已经明确归属到唯一任务卡，不再出现“谁都可以顺手改”的灰区。
3. 并行批次已经明确，至少能支持两条线程同时施工而不争用文件。
4. 每张子卡都写明了目标、允许改动、禁止改动、验收标准、验证命令和 owned test scope。
5. `project-control` 总台账已登记这些任务卡。

## Verification

- `git diff -- docs/project-control/tasks/microapp_T020-computer-use-parallel-code-isolation.md docs/project-control/tasks/microapp_T110-computer-use-shared-registry-and-seed.md docs/project-control/tasks/microapp_T111-computer-use-server-domain-core.md docs/project-control/tasks/microapp_T112-computer-use-browser-runtime-and-executor.md docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md docs/project-control/tasks/microapp_T114-computer-use-desktop-api-client.md docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md docs/project-control/project-control-ledger.md`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 核对任务卡和台账更新范围
- `git status --short`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查本轮只修改任务卡和台账

本卡是 docs-only，不跑 `pnpm check`：

- 原因：本卡只定义并行施工边界，不修改 runtime、类型、构建或打包代码。

## Evidence

- Changed files:
  - `docs/project-control/tasks/microapp_T020-computer-use-parallel-code-isolation.md`
  - `docs/project-control/tasks/microapp_T110-computer-use-shared-registry-and-seed.md`
  - `docs/project-control/tasks/microapp_T111-computer-use-server-domain-core.md`
  - `docs/project-control/tasks/microapp_T112-computer-use-browser-runtime-and-executor.md`
  - `docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md`
  - `docs/project-control/tasks/microapp_T114-computer-use-desktop-api-client.md`
  - `docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md`
  - `docs/project-control/project-control-ledger.md`

- Diff summary:
  - 新增 `computer_use` 并行施工总隔离卡
  - 新增六张互不重叠的实现任务卡
  - 明确共享文件归属、推荐并行批次、owned test scope 和禁止交叉修改规则
  - 在唯一总台账登记新的并行施工队列

## Unfinished / Risks

- 当前只完成任务拆分，不代表这些实现任务已经批准直接开工。
- 等 `T110` 到 `T115` 都提交并经我审查后，才会单独再开一张系统级冒烟测试卡；冒烟卡不提前和实现卡混写。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待评审范围：并行施工代码隔离方案
