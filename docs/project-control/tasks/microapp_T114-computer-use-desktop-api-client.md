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
  - docs/project-control/tasks/microapp_T020-computer-use-parallel-code-isolation.md
  - docs/microapp/computer-use-feature-design.md
task_state: DONE
---

# microapp_T114 Computer Use Desktop API Client

## Target

实现 `computer_use` 的 desktop shared API client，让页面只通过共享 API 访问 backend，不直接拼 URL 或读运行时细节。

本卡不做页面、不做后端实现、不做 route 挂载。

## Allowed Changes

- `desktop/src/shared/api/computerUse.ts`
- `desktop/src/shared/api/index.ts`
- `desktop/src/shared/api/__tests__/computerUse.test.ts`
- `docs/project-control/tasks/microapp_T114-computer-use-desktop-api-client.md`

## Forbidden Changes

- `desktop/src/features/Settings/pages/MicroApps/**`
- `desktop/src/app/routes/**`
- `server/**`
- `electron/**`
- `tauri/**`

## Code Placement

- `computer_use` shared API client 统一放在 `desktop/src/shared/api/computerUse.ts`
- 共享导出面放在 `desktop/src/shared/api/index.ts`

## Acceptance Criteria

1. shared API client 已覆盖运行时状态查询、安装触发、任务创建、任务启动、任务查询、审批提交和取消调用。
2. API client 继续走现有 request wrapper，不在本卡里绕开 `shared/lib/request`。
3. API client 不直接读取 `window.desktopApi`、不直接拼 host / port。
4. 定向测试覆盖关键方法的请求路径和请求体映射。
5. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/shared/api/__tests__/computerUse.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 API client 请求映射
- `rg -n "window\\.desktopApi|backendUrl|fetch\\(" desktop/src/shared/api/computerUse.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查 API client 没有越界直读 runtime 细节
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Owned Test Scope

- `desktop/src/shared/api/__tests__/computerUse.test.ts`
- 请求路径、方法、请求体和参数映射
- 计划创建后独立启动调用
- 不覆盖 settings route、页面状态切换或 server route 语义本身

## Isolation Rules

- 本卡是唯一允许修改 `desktop/src/shared/api/computerUse.ts` 和 `desktop/src/shared/api/index.ts` 的线程。
- 如果页面线程发现字段不够，只能通过共享 API 契约协作，不能绕过到页面里直接发请求。

## Evidence

- Changed files:
  - `desktop/src/shared/api/computerUse.ts`
  - `desktop/src/shared/api/index.ts`
  - `desktop/src/shared/api/__tests__/computerUse.test.ts`

## Unfinished / Risks

- 本卡不负责页面状态机，也不负责 route 或后端错误语义本身。
- 如果后端接口名未稳定，允许本卡等待 `T113` 明确契约后再落实现，不允许通过猜字段名硬接。
