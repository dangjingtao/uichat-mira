---
status: current
priority: P0
owner: forge / server
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: BuilderDispatch
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/forge_T005-main-thread-runtime-and-provider-adapters.md
task_state: DOING
---

# forge_T006 Builder Dispatch and Process Supervision

## Target

迁移 Forge Builder contract、Dispatch、Session、Readiness 和 process supervision，恢复 OpenCode / PiAgent / Codex 三种 Builder 的真实施工闭环。

## Must Read

- `AGENTS.md`
- `docs/forge/FORGE_CURRENT_CONTRACT.md`
- 源 Forge T016
- 源 Forge `server/builder-contract.mjs`
- `dispatch-manager.mjs`
- `dispatch-domain.mjs`
- `readiness.mjs`
- OpenCode / PiAgent / Codex Builder adapters

## Allowed Changes

- `server/src/forge/dispatch/**`
- `server/src/forge/adapters/builder/**`
- `server/src/forge/runtime/**`
- 直接相关 Forge tests
- 本任务卡状态 / 证据

## Forbidden Changes

- 自动 Dispatch
- 自动 Push / Merge / Deploy
- 把 Forge Builder 改造成 Mira Generic SubAgent
- 绕过 provider / workspace 自身权限
- 并行 Builder / worktree scheduler
- 用 Builder resultText 推断 PASS
- 失败时静默 fallback 到另一个 Builder

## Required Behavior

- 只有 `waiting` / `fixing` 且依赖已 integrated 的 runtime task 才可 dispatch。
- 当前阶段保持**全局单 active Builder dispatch**，不是按 provider 各开一条。
- Dispatch 必须绑定 project / batch / task / adapter / session；来源 Main Thread 可选且必须同 project。
- 启动、provider event、external session、terminal result、cancel、restart interruption 都有 durable evidence。
- success: dispatch completed + session completed + runtime task `reviewing`。
- failure/cancel/restart: runtime task `interrupted`。
- cancel 必须显式并终止 Forge 自己持有的 live handle。

## Acceptance Criteria

1. OpenCode / PiAgent / Codex 均通过同一 Builder contract。
2. 同时第二个 Builder dispatch 被拒绝。
3. dependency / active-session / status readiness gate 有明确 reason。
4. provider process exit 是 execution terminal evidence，但不会更新 repository task 为 PASS。
5. refresh / restart 后 durable dispatch/session/event 可重建。
6. cancel / spawn error / provider error 都有结构化终态。

## Validation

- dispatch / serial / cancellation / restart tests
- 三种 builder adapter fake-process tests
- server typecheck
- `git diff --check`

## Unknown / Human Decision

None.
