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

## Construction Evidence

- Base: `dev@21bd2e5f5cfe466169835146b81a0afdfd913dbc`.
- 新增 `server/src/forge/adapters/builder/**`：
  - provider-neutral Builder runner / process-handle contract；
  - OpenCode Builder；
  - PiAgent Builder；
  - Codex Desktop-bundled Builder；
  - default runner registry。
- OpenCode 保持真实 `opencode run --format json --dir <projectRoot>` 路径，不注入权限绕过参数。
- PiAgent 保持 `--mode json -p --no-session` 非交互 JSON 运行路径，不做 provider fallback。
- Codex Builder 保持固定源已验证的 `--ask-for-approval never exec --json --sandbox workspace-write --cd <projectRoot>`；未加入 danger/bypass flag，默认复用 macOS ChatGPT/Codex Desktop bundled backend，可显式配置 binary override。
- 三种 adapter 均规范化 provider/session/tool/artifact evidence；malformed JSONL 忽略而不击穿 control plane；terminal assistant output / provider error 均 bounded capture（8192 code units）。
- 新增 `server/src/forge/dispatch/**`：
  - 显式 dispatch manager；
  - ForgeRuntime lifecycle attach；
  - 全局单 active Builder lane；
  - live process handle ownership；
  - explicit cancel / shutdown / restart supervision。
- Dispatch 前先检查全局 active lane；占用时立即拒绝，不在 Builder 正写工作树时额外读取 Task Source；随后通过 T004 `resolveProjectTask` 解析 exact Repository Task Card，并在事务中二次检查 lane。
- `taskRef` 始终绑定 T004 解析出的 canonical Task Card ref；调用方提供不一致 ref 时明确失败。runtime Batch 不成为第二 Requirements DB。
- source Main Thread 可选；存在时必须与 dispatch project 相同。
- success：dispatch `completed` + session `completed` + runtime task `reviewing`；Repository Task Card 不被写成 PASS。
- provider-reported error 即使 process exit code = 0 仍按 failure 处理；failure / spawn error -> dispatch `failed` + session `failed` + runtime task `interrupted`。
- explicit cancel：必须存在 Forge-owned live handle；只有 `kill(SIGTERM)` 成功发送后才持久化 `cancelled`。kill 失败会写 `dispatch.warning(cancel_signal_failed)` 并明确失败，不伪造 cancelled 终态。
- late provider callback 在 cancel/restart 后不得覆盖 terminal dispatch。
- shutdown 将 owned live dispatch 持久化为 `interrupted` 并终止 handle；kill 失败写 durable warning 并使 shutdown resource 报错，不静默吞掉。
- startup/restart durable reconcile 继续复用 T003 `runtime/reconcile.ts`：lost supervision -> session disconnected / task interrupted / dispatch interrupted / adapter offline。
- 未迁移固定源后来的 T018 `Builder Result -> Main Thread` 回注；该 seam 保持 T007 后续范围。
- 未接 route / Desktop / Reviewer；未加入 parallel builder/worktree scheduler、auto push/merge/deploy、generic sub-agent rewrite。
- 新增定向回归：
  - 三 Builder choice 同一 dispatch contract；
  - cross-provider global serial guard；
  - readiness status / active-session / dependency reason；
  - taskRef / sourceThread identity；
  - provider error with exit 0；
  - spawn error；
  - explicit cancel + late exit；
  - kill-failure honesty；
  - restart late callback；
  - shutdown owned-handle cleanup；
  - 三 provider fake-process / malformed JSONL / args / evidence normalization。

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
