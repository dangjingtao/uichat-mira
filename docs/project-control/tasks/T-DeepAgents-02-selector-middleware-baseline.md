---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: DeepAgentsSelectorMiddlewareBaseline
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - packages/deepagents-spike/package.json
  - packages/deepagents-spike/tsconfig.json
  - packages/deepagents-spike/src/selector-fixtures.ts
  - packages/deepagents-spike/src/selector-baseline.ts
  - packages/deepagents-spike/src/selector-evaluator.ts
  - packages/deepagents-spike/src/middleware-inspection.ts
  - packages/deepagents-spike/deepagents-selector-baseline-report.md
  - .test-artifact/deepagents-spike/selector-baseline.json
task_state: READY_FOR_REVIEW
---

# T-DeepAgents-02 Selector / Middleware Extractability Baseline

## Target

把 `T-DeepAgents-02` 改成一个诚实、可复核的 baseline，明确区分下面几件事：

1. `llmToolSelectorMiddleware` 接线是否能跑通
2. fake model 只能证明 wiring，不代表真实 selector 质量
3. 是否存在真实模型 selector baseline；如果没有，必须明确 `SKIPPED / BLOCKED`
4. high-risk 指标是否同时给出 overall 和 within-high-risk 两种口径
5. middleware extractability 是否有运行时导出和 smoke test 证据，而不是只靠类型文件猜测

本任务仍然是独立 spike，不把 `DeepAgents` 接入现有 `Harness`，也不把 selector 结论升级成“已经解决工具误判”。

## Allowed Changes

- `packages/deepagents-spike/src/selector-baseline.ts`
- `packages/deepagents-spike/src/middleware-inspection.ts`
- `packages/deepagents-spike/src/selector-fixtures.ts`
- `packages/deepagents-spike/src/selector-evaluator.ts`
- `packages/deepagents-spike/deepagents-selector-baseline-report.md`
- `.test-artifact/deepagents-spike/selector-baseline.json`
- `packages/deepagents-spike/package.json`
- `packages/deepagents-spike/tsconfig.json`
- `docs/project-control/tasks/T-DeepAgents-02-selector-middleware-baseline.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/agent/**`
- `server/src/harness/**`
- `server/src/mcp/**`
- `desktop/src/**`
- `electron/**`
- `tauri/**`
- 现有 `AgentGraph`
- 现有 `Planner / Policy / ToolNode / Evidence`
- 现有 `Harness registry / approval / trace UI`

## Acceptance Criteria

1. 保留 `T-DeepAgents-02` 为独立 spike，不接入 `AgentGraph / Harness` 主链。
2. FakeSelectorModel 只能作为 `middleware wiring smoke test`，不能再被写成真实 selector quality baseline。
3. 报告必须拆成五组实验：
   - `middleware_wiring_fake_model`
   - `deterministic_domain_gate`
   - `domain_gate_plus_fake_model_wiring`
   - `real_model_selector_baseline`
   - `domain_gate_plus_real_model_selector`
4. 如果未配置真实模型环境变量，D/E 必须标记为 `SKIPPED`，并给出原因。
5. 如果配置了真实模型环境变量但跑不通，D/E 必须标记为 `BLOCKED`，不能回退成 fake 质量结论。
6. selector fixtures 至少 `110` 条，并新增至少 `30` 条 ambiguous / multi-domain / no-tool-hard 样本。
7. 指标必须同时包含：
   - `highRiskFixtureCount`
   - `highRiskWrongToolCount`
   - `highRiskWrongRateOverall`
   - `highRiskWrongRateWithinHighRisk`
   - `noToolFalsePositiveRate`
   - `noToolFalseNegativeRate`
   - `domainAccuracy`
   - `top1ToolAccuracy`
   - `top3ToolRecall`
   - `falsePositiveByDomain`
   - `wrongToolByRiskLevel`
8. middleware inspection 必须有运行时导出和 smoke test 证据。
9. 如果某项只能在类型层发现，报告必须写明 `type-level only / runtime not proven`。
10. 报告必须给出最终状态：
    - `middleware wiring: PASS / FAIL`
    - `real selector baseline: PASS / SKIPPED / BLOCKED`
    - `selector quality: PROVEN / NOT PROVEN`
    - `middleware extractability: PASS / PARTIAL / FAIL`
    - `T-03 recommendation: GO / BLOCKED / CONTROLLED_SPIKE_ONLY`
11. 报告必须明确：
    - 不允许直接暴露 `filesystem / subagent / MCP` 给主模型
    - 不允许把 LangGraph 原始事件直接塞进现有 trace UI
12. 不修改 `AgentGraph / Harness` 现有实现。

## Verification

1. `pnpm --filter @ui-chat-mira/deepagents-spike typecheck`
2. `pnpm --filter @ui-chat-mira/deepagents-spike selector:baseline`
3. 若配置了真实模型环境变量，再执行真实 selector baseline

本轮没有改 workspace 级依赖或公共配置，所以不强制运行 `pnpm check`。

## Risks

- fake wiring 指标只能说明 pipeline 形状，不说明真实 selector 质量。
- 在真实 selector baseline 缺失时，任何 “建议进入 T-03” 的结论都不成立。
- `DeepAgents` 的 `filesystem / todo / subagent / summarization` 默认能力面仍然比现有 `Harness` 更宽，不能直接暴露。

## Implementation Summary

- 扩展 selector fixtures 到 `116` 条，并补充 ambiguous / multi-domain / no-tool-hard 样本组。
- 把实验拆成 A-E 五组，明确 fake wiring 与 real selector baseline 的边界。
- 新增真实模型环境变量配置入口：
  - `DEEPAGENTS_SELECTOR_BASE_URL`
  - `DEEPAGENTS_SELECTOR_API_KEY`
  - `DEEPAGENTS_SELECTOR_MODEL`
- 在未配置真实模型时，把 real selector baseline 诚实标记为 `SKIPPED`。
- 将 high-risk 指标拆成 overall 和 within-high-risk 两种口径。
- 把 middleware inspection 改成运行时导出检查 + smoke test，并保留必要的 type-level 补证。

## Verification Evidence

1. `pnpm --filter @ui-chat-mira/deepagents-spike typecheck`
   - 结果：通过
2. `pnpm --filter @ui-chat-mira/deepagents-spike selector:baseline`
   - 结果：通过
   - 最终状态：
     - `middleware wiring = PASS`
     - `real selector baseline = SKIPPED`
     - `selector quality = NOT PROVEN`
     - `middleware extractability = PARTIAL`
     - `T-03 recommendation = BLOCKED`
   - 真实模型跳过原因：
     - `Missing real selector configuration: DEEPAGENTS_SELECTOR_BASE_URL, DEEPAGENTS_SELECTOR_MODEL.`
   - fake wiring smoke test 关键指标：
     - `total = 116`
     - `highRiskFixtureCount = 36`
     - `highRiskWrongToolCount = 6`
     - `highRiskWrongRateOverall = 0.0517`
     - `highRiskWrongRateWithinHighRisk = 0.1667`
   - domain gate + fake wiring 关键指标：
     - `highRiskWrongToolCount = 1`
     - `highRiskWrongRateOverall = 0.0086`
     - `highRiskWrongRateWithinHighRisk = 0.0278`
   - 说明：
     - 上述 fake 指标只用于 wiring smoke test 和组合管线形状观察，不是 real selector quality 结论。

## Remaining Gaps

- 当前环境未配置真实 selector endpoint，所以真实 selector quality 仍然 `NOT PROVEN`。
- `T-DeepAgents-03` 仍然应视为 `BLOCKED`，直到 real selector baseline 可用。
- 这次没有修改 `AgentGraph / Harness` 主链，因此没有验证审批、evidence 合同或 trace adapter 接入后的运行效果。
