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
task_state: TODO
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
