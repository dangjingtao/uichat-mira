---
status: current
priority: P0
owner: forge / server
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: ReviewGuards
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/forge_T006-builder-dispatch-and-process-supervision.md
task_state: TODO
---

# forge_T007 Review Handoff and Runtime State Guards

## Target

迁移 SHA-bound Review contract 与 Builder Result Handoff，并在 Mira 正式产品化时收紧旧 Forge 过宽的 runtime task mutation 面。

本卡不实现自动 Reviewer，只保证 Review / Fix / Stale / Integration 状态不能被普通 UI/API 任意伪造。

## Must Read

- `AGENTS.md`
- `docs/forge/FORGE_CURRENT_CONTRACT.md`
- 源 Forge `server/domain.mjs`
- 源 Forge T007 / T018
- 已迁移的 Forge dispatch / main-thread runtime

## Allowed Changes

- `server/src/forge/review/**`
- `server/src/forge/domain/**`
- `server/src/forge/main-thread/**`（仅 builder_result handoff）
- 直接相关 tests
- `docs/forge/**`（仅 review/runtime contract）
- 本任务卡状态 / 证据

## Forbidden Changes

- 自动 Reviewer 调度循环
- 自动 Merge / Deploy
- 允许 generic `PATCH task.status=review_passed`
- 允许 generic `PATCH task.status=integrated`
- 允许调用方直接伪造 `reviewedSha` / `reviewRound`
- 把 Builder prose 当 authoritative review evidence

## Required Behavior

- Review request 必须绑定 `task.currentSha`。
- reviewedSha 必须与 requestedSha 一致。
- 后续 currentSha 变化会使旧 PASS review `actionable=false`，并产生 stale 语义。
- changes_requested 推进到 `fixing`；passed 只推进到 `review_passed`。
- integration 需要独立、受 guard 的动作，而不是任意 status patch。
- terminal Builder result 只向显式相关 Main Thread 写入一次 durable `builder_result`。
- 下一次 Main Thread turn 只消费自上次用户 turn 后到达的 bounded Builder results，不重复注入。

## Acceptance Criteria

1. SHA anti-forgery / invalidation tests 通过。
2. generic task mutation 无法制造 review_passed / integrated。
3. builder_result 以 dispatch identity 幂等。
4. completed / failed / cancelled / restart-interrupted 都能形成可信 handoff。
5. resultText 与 authoritative dispatch/session/task state 明确分开。

## Validation

- review round / stale / integration guard tests
- builder-result idempotency / cross-project rejection tests
- server typecheck
- `git diff --check`

## Unknown / Human Decision

None.
