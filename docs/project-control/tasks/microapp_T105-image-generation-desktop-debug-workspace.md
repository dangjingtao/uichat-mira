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
  - docs/uchat.md
task_state: TODO
---

# microapp_T105 Image Generation Desktop Debug Workspace

## Target

实现只服务微应用界面调试的 desktop 页面工作区。

本卡只负责 `Settings -> MicroApps` 下的独立调试页、页面内状态和 settings route 挂载，不做 shared API client、不做 backend。

## Allowed Changes

- `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/**`
- `desktop/src/app/routes/settingsRoutes.tsx`
- `desktop/src/app/routes/settingsRoutes.test.tsx`
- `desktop/src/features/Settings/i18n/en-US.ts`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md`

## Forbidden Changes

- `desktop/src/shared/api/**`
- `desktop/src/features/Settings/pages/MicroApps/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/Detail.tsx`
- `server/**`
- `electron/**`
- `tauri/**`

## Code Placement

- 调试页、局部 hook、局部组件统一放到 `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/`
- route 挂载只放到 `desktop/src/app/routes/settingsRoutes.tsx`
- 文案只放到 `desktop/src/features/Settings/i18n/*.ts`

## Acceptance Criteria

1. 新页面只服务微应用界面调试，不顺手接 chat、第三方平台入口或通用工具面板。
2. 页面内所有 backend 调用都通过 `desktop/src/shared/api/imageGeneration.ts`，不直接请求 URL。
3. 页面不直接访问 Node API、`window.desktopApi` 或 preload 细节。
4. route 变更只落在 `settingsRoutes.tsx` 和对应测试，不修改现有 `MicroApps/index.tsx`、`Detail.tsx`。
5. 有定向页面测试覆盖基本渲染、任务提交入口和状态切换占位。
6. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/app/routes/settingsRoutes.test.tsx src/features/Settings/pages/MicroApps/ImageGeneration/**/*.test.tsx`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 route 挂载和页面基础行为
- `rg -n "window\\.desktopApi|from \\\"node:|from \\\"electron\\\"" desktop/src/features/Settings/pages/MicroApps/ImageGeneration`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查页面没有越界触碰 native 能力
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence

- Changed files:
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/**`
  - `desktop/src/app/routes/settingsRoutes.tsx`
  - `desktop/src/app/routes/settingsRoutes.test.tsx`
  - `desktop/src/features/Settings/i18n/en-US.ts`
  - `desktop/src/features/Settings/i18n/zh-CN.ts`

- Acceptance evidence placeholder:
  - 等实现线程回填

## Isolation Rules

- 本卡是唯一允许修改 `desktop/src/app/routes/settingsRoutes.tsx` 的 image generation 线程。
- 本卡禁止触碰现有 `MicroApps/index.tsx` 和 `Detail.tsx`，避免和当前微应用设置页维护线程互相影响。

