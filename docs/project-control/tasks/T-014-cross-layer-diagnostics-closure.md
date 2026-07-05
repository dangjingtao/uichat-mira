---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-05
layer: project-control
module: AgentRuntime
feature: CrossLayerDiagnosticsClosure
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/tasks/T-010-harness-candidate-ordering.md
  - docs/project-control/tasks/T-011-sandbox-contract-direct-bench.md
  - docs/project-control/tasks/agent_node_T016-local-tool-routing-and-schema-guard.md
  - docs/project-control/tasks/agent_node_T017-toolcall-loop-regression-matrix.md
  - server/src/harness/capability-diagnostics.test.ts
  - server/src/harness/exposure.test.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
  - server/src/agent/__tests__/tool-call-normalize.test.ts
  - server/src/agent/__tests__/toolcall-loop-regression.test.ts
  - server/src/agent/__tests__/nodes.test.ts
task_state: DONE
---

# T-014 Cross-Layer Diagnostics Closure

## Target

把 `04-diagnostics-closure` 任务包要求的跨层 diagnostics 闭环正式回填进当前台账，确认现有实现已经能在失败时回答下面 9 个问题，而不是只留下“Agent 不行”：

1. 为什么暴露这些工具
2. 为什么隐藏那些工具
3. 候选分数是多少
4. Planner 选了什么 `nextAction`
5. Normalize 是否 schema valid
6. Policy 是 `allow / ask / deny`
7. Sandbox/runtime 是否 `completed / blocked / timed_out`
8. Evidence 是否 answer-ready
9. Generate 是否只基于 evidence

本任务要把 `04-diagnostics-closure` 从“分散存在的能力”收成“有统一回归证据的闭环”。

允许做最小代码修正，但边界只限：

- diagnostics 回归测试
- `evidence / generate` 层和 diagnostics 验收直接相关的缺陷

不新增 observability 平台，不改主执行语义，不把 diagnostics 接回执行链。

## Allowed Changes

- `docs/project-control/tasks/T-014-cross-layer-diagnostics-closure.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/agent/__tests__/diagnostics-closure.test.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/nodes/generate.ts`

## Forbidden Changes

- `desktop/src/**`
- Planner / Normalize / Policy / Sandbox / Tool execution 运行语义
- Phoenix / LangSmith / 全量 observability 平台
- 让 diagnostics 进入执行链

## Acceptance Criteria

1. `web_search` 被隐藏时，trace / diagnostics 能说明这是 workspace-local 请求
2. 工具未暴露但 Planner 仍选择时，Planner / Normalize 能给出明确阻断原因
3. invalid args 时，Normalize 能给出 schema 诊断，并最多触发一次 bounded replan
4. sandbox / runtime blocked 或 `timed_out` 时，状态和 answer-readiness 不假成功
5. evidence 失败或不足时，Generate 不会伪装成已基于文件 / 工具结果完成回答
6. 当前台账明确记录这 5 类失败场景的证据来源和验证结果

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/diagnostics-closure.test.ts src/agent/__tests__/toolcall-loop-regression.test.ts src/agent/__tests__/nodes.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`3` files, `30` tests)
- `pnpm --filter @ui-chat-mira/server exec vitest run src/harness/capability-diagnostics.test.ts src/harness/exposure.test.ts src/agent/__tests__/tool-call-normalize.test.ts src/agent/__tests__/next-action-planner.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`4` files, `126` tests)
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: passed

## Evidence

- Changed files:
  - `docs/project-control/tasks/T-014-cross-layer-diagnostics-closure.md`
  - `docs/project-control/project-control-ledger.md`
  - `server/src/agent/__tests__/diagnostics-closure.test.ts`
  - `server/src/agent/evidence.ts`
  - `server/src/agent/nodes/generate.ts`

- Diff summary:
  - 新增正式任务卡，承接外部 `04-diagnostics-closure` 任务包
  - 新增 `server/src/agent/__tests__/diagnostics-closure.test.ts`，把 5 个失败场景收成一组专门的跨层闭环回归
  - 修正 terminal timeout evidence 的可解释性判断：纯 ASCII timeout / stderr 文本不再因为 encoding unknown 被误判成不可解读
  - 修正 generate 对不可可靠 terminal evidence 的防护：当 evidence 已声明终端输出不可可靠解读时，generate 不再强行把它解释成 grounded 结论
  - 在唯一总台账登记该任务，并把旧的 docs-only 口径升级为代码+验证口径

- Acceptance criteria evidence:
  - AC1 `web_search` 被隐藏：
    - [server/src/harness/exposure.test.ts](D:/workspace/rag-demo/server/src/harness/exposure.test.ts:288) 证明 workspace-local 文件请求不会暴露 `web_search`
    - [server/src/harness/capability-diagnostics.test.ts](D:/workspace/rag-demo/server/src/harness/capability-diagnostics.test.ts:306) 证明 diagnostics 保留 `exposureReasons`、`blockedCapabilityIds`、候选分数，并明确原因是 `Workspace-local query hides web_search...`
  - AC2 工具未暴露但 Planner 仍选择：
    - [server/src/agent/__tests__/next-action-planner.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/next-action-planner.test.ts:1970) 证明 Planner 选择未暴露工具时会回退为 `error`，原因是 `Planner selected a tool that was not exposed for this turn; planner must stop.`
    - [server/src/agent/__tests__/tool-call-normalize.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/tool-call-normalize.test.ts:463) 证明 Normalize 层也会对未暴露 `toolId` 明确失败，而不是静默放行
  - AC3 invalid args / bounded replan：
    - [server/src/agent/__tests__/toolcall-loop-regression.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/toolcall-loop-regression.test.ts:368) 证明 schema invalid 不执行工具，只允许一次 bounded replan
    - [server/src/agent/__tests__/nodes.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/nodes.test.ts:547) 证明 bounded replan 用尽后，Generate 返回 schema-safe fallback，不会伪装成工具已执行
  - AC4 sandbox / runtime blocked / `timed_out`：
    - [server/src/harness/exposure.test.ts](D:/workspace/rag-demo/server/src/harness/exposure.test.ts:116) 与 [server/src/harness/capability-diagnostics.test.ts](D:/workspace/rag-demo/server/src/harness/capability-diagnostics.test.ts:444) 证明 sandbox profile 不可用时，terminal 会在暴露层被隐藏，并留下明确原因
    - [server/src/agent/__tests__/toolcall-loop-regression.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/toolcall-loop-regression.test.ts:624) 证明 `timedOut` 工具结果不会被标记为 answer-ready
    - [server/src/agent/__tests__/diagnostics-closure.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/diagnostics-closure.test.ts:411) 进一步证明 runtime `timedOut` 会在 `agent-evidence-update-tool` trace 中带出 `latestEvidenceSummary.data.timedOut=true`
  - AC5 evidence / generate 不假成功：
    - [server/src/agent/nodes/generate.ts](D:/workspace/rag-demo/server/src/agent/nodes/generate.ts:699) 证明 generate 会拦截“没有 completed evidence 却声称已观察到结果”的回答
    - [server/src/agent/nodes/generate.ts](D:/workspace/rag-demo/server/src/agent/nodes/generate.ts:703) 与 [server/src/agent/nodes/generate.ts](D:/workspace/rag-demo/server/src/agent/nodes/generate.ts:432) 证明 generate guard 命中后只会回退到 evidence-grounded fallback
    - [server/src/agent/__tests__/toolcall-loop-regression.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/toolcall-loop-regression.test.ts:624) 证明 failed / timed out evidence 不会误触发 answer-ready
    - [server/src/agent/__tests__/diagnostics-closure.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/diagnostics-closure.test.ts:485) 证明模型编造 workspace 结果时，generate 会触发 output guard 并回退到 evidence-grounded answer
    - [server/src/agent/__tests__/nodes.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/nodes.test.ts:520) 证明 evidence 已声明 terminal 输出乱码 / 不可靠时，generate 不会继续把它编造成“README 主要在介绍什么”

- Cross-layer closure mapping:
  - exposure / candidate：
    - `server/src/harness/exposure.test.ts`
    - `server/src/harness/capability-diagnostics.test.ts`
  - planner / normalize：
    - `server/src/agent/__tests__/next-action-planner.test.ts`
    - `server/src/agent/__tests__/tool-call-normalize.test.ts`
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
  - policy / sandbox/runtime：
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
    - `server/src/harness/exposure.test.ts`
  - evidence / generate：
    - `server/src/agent/__tests__/nodes.test.ts`
    - `server/src/agent/nodes/generate.ts`

## Unfinished / Risks

- 本任务没有新增 trace UI，也没有新增统一 diagnostics viewer；当前证据来自自动化测试与已有 node details / structured log。
- 这次只完成“正式台账收口”，没有修改任何执行链实现；若后续还要新增失败场景展示 UI，需要单开任务。

## Review Outcome

- 评审结论：通过
- 当前状态：`DONE`
- 通过依据：
  - 外部 `04-diagnostics-closure` 要求的 5 类失败场景都已收成专门的跨层闭环回归，不再只是分散落在旧任务卡
  - 2026-07-05 已完成两轮验证：`30` 条 diagnostics / evidence 定向回归通过，`126` 条相关基础回归通过，`pnpm check` 通过
  - 本次没有触碰 forbidden area，也没有把 diagnostics 混回执行链
