---
status: current
priority: P0
owner: forge / server / desktop
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: ApiClientContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/forge_T004-project-registry-and-repository-task-source.md
  - docs/project-control/tasks/forge_T005-main-thread-runtime-and-provider-adapters.md
  - docs/project-control/tasks/forge_T006-builder-dispatch-and-process-supervision.md
  - docs/project-control/tasks/forge_T007-review-handoff-and-runtime-state-guards.md
task_state: DOING
---

# forge_T008 Mira Server API and Desktop Client Contract

## Target

在 Mira Backend 内为 Forge 建立正式 API namespace 和 Desktop typed client，使 UI 只消费稳定的 Forge product contract，不直接依赖旧 `:47831`、内部 store 或 provider-specific process 结构。

## Must Read

- `AGENTS.md`
- `docs/architecture/README.md`
- `docs/architecture/ipc-and-preload.md`
- `server/src/index.ts`
- Mira 现有 Desktop shared API 调用模式
- 已迁移的 Forge domain contracts

## Allowed Changes

- `server/src/forge/routes/**`
- `server/src/index.ts`（仅 Forge route 注册）
- `desktop/src/shared/api/forge/**`
- 对应 server / desktop API tests
- `docs/forge/**`（仅 API current contract）
- 本任务卡状态 / 证据

## Forbidden Changes

- 后端 route 自带 `/api` 前缀
- renderer hardcode backend port
- renderer 直接访问 Node / child_process / filesystem
- renderer 直接访问 Forge persistence
- 把 provider raw event schema 当公共 UI contract
- 暴露 generic runtime task status patch 以绕过 T007 guard

## Required API Surface

至少覆盖：

- projects / task-source / repository tasks
- batches / runtime tasks / readiness
- main threads / messages / task actions / handoffs
- dispatch / cancel
- reviews（只暴露受 guard 的 review actions）
- runtime summary / inspector data / events

Desktop 开发环境走 `/api/forge/...`；生产使用现有 backendUrl 机制。

## Construction Evidence

- Base: `dev@adc39ef20e15135d1986608f03f393a41acc384c`.
- Mira Server：
  - 新增 `server/src/forge/routes/**`，正式 backend namespace 为 `/forge/**`；未在 backend route 写 `/api`。
  - `server/src/index.ts` 仅新增 Forge route import + `app.register(forgeRoutes)`；未改 host / port / startup chain。
  - Forge route 不启动第二 HTTP server，不读取旧 `:47831`，不创建第二 persistence。
  - default route service 通过 T003 `initializeForgeRuntime()` 幂等入口取得同一 Forge singleton；首次需要时一次性 attach T005 Main Thread + T006 Builder Dispatch，并创建 T007 Review manager。
  - lazy service 不在 route registration 阶段抓未初始化 runtime，因此不破坏现有 `setupRoutes -> listen -> setupForgeRuntime` 顺序。
- API product contract 覆盖：
  - metadata：`GET /forge/meta`；
  - projects / task-source / repository tasks；
  - batches / runtime tasks / readiness；
  - Main Threads / messages / repository task actions / explicit handoffs；
  - dispatch list / explicit dispatch / cancel；
  - guarded reviews / review result / guarded integration；
  - runtime summary / inspector / bounded events。
- Guardrail：
  - 不提供 generic runtime Task PATCH；
  - 不提供 generic `review_passed` / `integrated` 写入口；
  - Repository Task update 继续经过 T004 repository task capability；
  - Review / integration 只调用 T007 guarded manager；
  - dispatch / cancel 只调用 T006 manager。
- Public projection：
  - runtime summary 直接由 authoritative Forge state 投影，不要求 UI 自己拼状态机；
  - inspector 按 project / batch / task / dispatch / session / review / thread identity 投影；
  - runtime event data 做 depth / array / object-entry / string bounding；
  - Main Thread provider fields 仅暴露 normalized optional `adapter / eventType / itemType / status`，不暴露 stdout / raw provider process schema。
  - inspector 对不存在的 query identity 仍按原始 query 过滤，不会退化成返回无关 events。
- Auth / networking：
  - `/forge/**` 不在 `AUTH_EXEMPT_ROUTES`，继续继承 Mira Server 全局 auth preHandler；
  - Desktop client 复用 `desktop/src/shared/lib/request.ts`，开发态由现有 Vite proxy 形成 `/api/forge/**`，生产态由 `getApiBaseUrl() -> window.desktopApi.backendUrl` 机制处理；
  - Desktop Forge client 内无固定 port / `127.0.0.1` / Node / filesystem / child_process。
- Desktop：
  - 新增 `desktop/src/shared/api/forge/types.ts` + `client.ts` + local barrel；
  - typed mapping 覆盖全部上述 product surface；
  - 不修改 T009 UI，不把 Forge client 接进任何页面。
- Current contract 文档：`docs/forge/FORGE_API_CONTRACT.md`。
- 回归：
  - Server route mapping：prefix-free backend path、dispatch、guarded review/integration、inspector、无 generic runtime task PATCH；
  - public projection：missing identity 不泄漏 events、provider/runtime metadata bounded、summary authoritative；
  - Desktop mapping：无 `/api`/port hardcode、URL encode、explicit repository task / dispatch / guarded review/integration。
- 当前 PR workflow 只执行 Branch Policy；新增 Vitest 不伪造为已运行。合并后以 `dev -> pnpm check` 与 Windows staged-server smoke 作为最终整仓门禁。

## Acceptance Criteria

1. Forge 作为 Mira Server route group 工作，不启动第二 HTTP server。
2. UI client 有 typed request/response 与统一错误处理。
3. runtime summary 与 inspector 所需数据可以直接从 authoritative state 投影，不要求 UI 自己拼状态机。
4. provider-specific metadata 保持 optional / bounded。
5. 不破坏现有 auth / public API 规则。

## Validation

- server route tests
- desktop API mapping tests
- server + desktop typecheck
- `pnpm check`
- `git diff --check`

## Unknown / Human Decision

None.
