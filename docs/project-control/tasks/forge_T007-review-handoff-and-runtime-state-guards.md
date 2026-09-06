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
task_state: DOING
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

## Construction Evidence

- Base: `dev@cdd515f8be2c33bb8b631adcb67fb24498dbebf4`.
- Review / integration：
  - 复用已迁移的 SHA-bound `createReviewHandoff / resolveReviewHandoff`；
  - 新增 `server/src/forge/review/**` provider-neutral Review manager，仅提供 explicit request / resolve / integrate action，不调度 Reviewer；
  - generic `updateTask(status=review_passed)` 继续拒绝；
  - generic `updateTask(status=integrated)` 现明确拒绝；
  - generic `reviewedSha / reviewRound` 继续拒绝；
  - 新增 `integrateReviewedTask(expectedSha)`：仅 `review_passed` 可进入 `integrated`，且要求 `currentSha == reviewedSha == expectedSha`，同时存在同 SHA 的 actionable PASS review。
- SHA stale semantics：
  - review request 必须等于当前 `task.currentSha`；
  - 非 cancelled resolve 必须 `reviewedSha == requestedSha`；
  - 已 PASS 后 currentSha 改变会清空 task.reviewedSha、task -> `stale`、旧 PASS review `actionable=false` 且保留历史；
  - late old-SHA PASS 可留在 review history，但不能把当前 task 推进为 `review_passed`。
- Builder Result Handoff：
  - 新增 `appendBuilderResultHandoff`，按 related Main Thread + dispatch identity 幂等；
  - cross-project result 明确拒绝；
  - handoff identity 持久化 project / batch / task / taskRef / dispatch / session / adapter / provider session；
  - authoritative `dispatchStatus / sessionStatus / taskStatus` 与 prose `resultText / error` 分开；
  - 保持 T001 固定源可验证大小语义：`resultText.trim().slice(0, 16_384)`、`error.trim().slice(0, 4_096)`，JS UTF-16 code unit。
- Main Thread continuation：
  - 下一次用户 turn 只选取“上一次 user message 之后、当前 user message 之前”到达的 builder_result；
  - 同一 result 不在后续每个 turn 重复注入；
  - 结果在 Main Thread active turn 中途到达时，保留独立 durable handoff，并在下一用户 turn 注入；
  - provider prompt 明确声明 runtime dispatch/session/task state authoritative，result prose 仅 explanatory evidence；
  - 最多注入最近 4 条 Builder result，单条 result/error 再做 6000/2000 展示裁剪，不改变 durable handoff。
- T006 terminal seam：
  - completed / failed / cancelled / shutdown-interrupted 在 terminal state 写完后立即追加 builder_result；
  - restart 场景兼容 T003 先 reconcile：T006 manager reconcile 会对已 terminal 且显式绑定 Main Thread 的 dispatch 做幂等补投；
  - late callback 不会覆盖 terminal state，也不会重复 handoff。
- 未实现 automatic Reviewer、auto merge/deploy、generic sub-agent、API route、Desktop UI。
- 路径说明：任务卡 Required Behavior 的真实现有实现点位于 `server/src/forge/domain.ts` 与 T006 `server/src/forge/dispatch/manager.ts`，而 Allowed Changes 写成 `domain/**` 且未列 dispatch；本卡仅对这两个必要现有接缝做最小修改，没有扩展其余 Domain/Dispatch 行为。
- 回归覆盖：
  - review SHA anti-forgery / round / changes_requested / stale / late old-SHA / guarded integration；
  - builder_result UTF-16 bounds / idempotency / cross-project / once-only next-turn / late-result delivery；
  - completed / failed / cancelled / restart-interrupted dispatch handoff authoritative state。
- 当前 PR workflow 不执行 Forge Vitest，因此不伪造“上述定向 Vitest 已运行”；合并后以 `dev -> pnpm check` 与 Windows staged-server smoke 作为整仓门禁。

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
