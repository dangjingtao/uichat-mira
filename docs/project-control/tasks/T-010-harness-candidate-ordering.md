---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-05
layer: project-control
module: Harness
feature: CandidateOrdering
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - server/src/harness/candidates-core/resolver.ts
  - server/src/harness/tool-candidates.test.ts
  - server/src/harness/capability-diagnostics.test.ts
task_state: READY_FOR_REVIEW
---

# T-010 Harness Candidate Ordering

## Target

修复 Harness 工具候选在评分前按 `maxTools` 提前截断的缺陷。

问题本体：

- 当前实现先对 `exposedDefinitions` 做 `slice(0, maxTools)`
- 后注册、但更相关的工具会在 embedding / 规则分数 / rerank 之前被排除
- 这会让 registry 顺序直接污染最终暴露结果

## Allowed Changes

- `server/src/harness/candidates-core/resolver.ts`
- `server/src/harness/candidates-core/types.ts`
- `server/src/harness/exposure-core/resolver.ts`
- `server/src/harness/tool-candidates.test.ts`
- `server/src/harness/capability-diagnostics.test.ts`
- 与本任务直接相关的当前台账文档更新

## Forbidden Changes

- `AgentGraph`
- Planner prompt
- Sandbox
- 让 `selectedToolIds` 进入执行链
- 让 `preferredToolId` 变成执行决策

## Acceptance Criteria

1. 构造 `10+` 个工具，相关工具排在 registry 后面时，仍会进入评分链路
2. `maxTools=3` 时，相关工具仍可参与评分与最终排序
3. 最终暴露结果不是 registry 前 `3` 个工具按自然顺序直接胜出
4. workspace local 查询不暴露 `web_search`
5. 明确联网查询仍可暴露 `web_search`
6. diagnostics 继续保留 reasons / blocked ids / scores

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/harness/tool-candidates.test.ts src/harness/capability-diagnostics.test.ts src/harness/exposure.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`3` files, `15` tests)
- `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: failed outside this task's modified scope
  - failure:
    - `server typecheck` crashed with `RangeError: Maximum call stack size exceeded`
- `pnpm package:electron:win`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
- `curl http://127.0.0.1:8787/health`
  - verification method:
    - started packaged backend with `release/v0.7.1_20260705_204516/electron/win-unpacked/resources/node-runtime/node.exe`
    - target server bundle: `release/v0.7.1_20260705_204516/electron/win-unpacked/resources/server/server.cjs`
  - result: passed
  - response:
    - `{"success":true,"data":{"service":"ui-chat-rag-tester-server"},"timestamp":"2026-07-05T12:54:14.039Z","message":"Service is healthy"}`

## Evidence

- Changed files:
  - `server/src/harness/candidates-core/resolver.ts`
  - `server/src/harness/tool-candidates.test.ts`
  - `server/src/harness/capability-diagnostics.test.ts`
  - `docs/project-control/tasks/T-010-harness-candidate-ordering.md`
  - `docs/project-control/agent-workboard.md`
- Diff summary:
  - Moved `maxTools` from pre-scoring exposure truncation to the final ranked tool-candidate cutoff.
  - Delayed `topK` trimming until rerank completes, so capability recall is not cut before final scoring.
  - Rebuilt `toolExposure.exposedDefinitions` from the final ranked tool candidates, so Planner sees the scored result rather than registry order.
  - Added a regression test with `10+` tools proving a tail-registered relevant tool survives `maxTools=3`.
  - Added diagnostics coverage for workspace-local exposure reasons, blocked ids, and preserved candidate scores.
- Acceptance criteria evidence:
  - AC1: new regression in `server/src/harness/tool-candidates.test.ts` registers `10` noise tools plus one tail tool and verifies the tail tool still enters final ranked results.
  - AC2: the same regression runs with `maxTools: 3` and still returns `tail_target_tool` in `toolCandidates` and `toolExposure.exposedToolIds`.
  - AC3: the regression explicitly asserts the final exposed ids are not the registry front `3` tools.
  - AC4: existing `server/src/harness/exposure.test.ts` keeps workspace-local `web_search` hiding coverage; diagnostics coverage now also checks the same behavior.
  - AC5: existing `server/src/harness/exposure.test.ts` keeps explicit联网查询暴露 `web_search` 的回归。
  - AC6: new diagnostics regression asserts `exposureReasons`、`blockedCapabilityIds` 和 `toolCandidates[0].finalScore` 仍然存在。

## Unfinished / Risks

- `pnpm check` 当前仍被仓内既有 `server typecheck` 崩溃阻断；这次任务没有改动该故障点。
- `pnpm package:electron:win` 过程里还带出若干既有测试失败与依赖缺失：
  - `desktop/src/shared/uchat/ui/UChatSidebarView.test.tsx`
  - 多个 `server` 测试缺少 `xlsx`
  - `server/src/services/shared-nodes/thread-request-context-web-search.resolver.test.ts` 缺少目标模块
  - 若要把整仓质量恢复到全绿，需要单独开任务处理这些既有问题。
- 本任务只修 Harness 候选排序缺陷，不调整 Agent 选择、审批或执行链语义。

## Review Outcome

- 评审结论：待复评
- 当前状态：`READY_FOR_REVIEW`
- Review 01 跟进：
  - 打回意见指向的阻断点是“`maxTools` 仍在评分前截断 `exposedDefinitions`”
  - 当前本地源码 `D:/workspace/rag-demo/server/src/harness/candidates-core/resolver.ts` 已不再执行：
    - `const exposedDefinitions = exposureDecision.exposedDefinitions.slice(0, maxTools);`
    - `const profiles = resolveHarnessCapabilityProfiles(exposedDefinitions);`
  - 当前实际实现是：
    - 先取全量允许集合：`const visibleDefinitions = exposureDecision.exposedDefinitions;`
    - 再基于全量允许集合建立 profile、embedding、rule score、rerank
    - 最后才执行：
      - `const rankedMatches = matches.slice(0, topK);`
      - `const toolCandidates = rankedToolCandidates.slice(0, maxTools);`
  - 结论：
    - Review 01 提到的阻断缺陷，在当前工作区实现中已被消除
    - 当前需要的是基于最新源码重做复评，而不是继续沿用旧快照结论
