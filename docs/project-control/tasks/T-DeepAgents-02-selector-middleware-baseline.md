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

验证 `DeepAgents / LangChain` 当前 selector 与 middleware 抽取能力，回答下面 5 个问题：

1. `llmToolSelectorMiddleware` 能否作为独立 selector baseline 使用
2. `createDeepAgent` 的 middleware 栈中，哪些能力可以抽出复用，哪些不能
3. selector baseline 在 `no_tool / domain / top1 tool / high-risk wrong-tool` 这些维度上的基线表现是什么
4. deterministic domain gate 加在 selector 前面后，能否明显降低高风险误判
5. 基于真实 baseline 结果，是否建议进入 `T-DeepAgents-03`

本任务是独立 spike，不把 `DeepAgents` 接入现有 `Harness`，也不把 selector 结论口头升级成“已经解决工具误判”。

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

1. 新建 `T-DeepAgents-02` 任务卡。
2. 产出 `80` 条 selector fixtures。
3. 跑通 deterministic domain gate baseline。
4. 跑通 LangChain / DeepAgents selector baseline。
5. 跑通 domain gate + selector baseline。
6. 生成 `packages/deepagents-spike/deepagents-selector-baseline-report.md`。
7. 生成 `.test-artifact/deepagents-spike/selector-baseline.json`。
8. 报告明确本任务是独立 spike，不接 `AgentGraph / Harness` 主链。
9. 报告明确 selector baseline 不是“DeepAgents 已解决工具误判”的证明。
10. 报告给出 selector 指标：
    - `no_tool`
    - `domain`
    - `top1 tool`
    - `high-risk wrong-tool rate`
11. 报告给出 middleware extractability 结论。
12. 报告给出 `T-DeepAgents-03` 建议。
13. 报告明确不允许直接暴露 `filesystem / subagent / MCP` 给主模型。
14. 报告明确不允许把 LangGraph 原始事件直接塞进现有 trace UI。
15. 不修改 `AgentGraph / Harness` 现有实现。
16. 运行 `pnpm check`。

## Verification

1. `pnpm --filter @ui-chat-mira/deepagents-spike typecheck`
2. `pnpm --filter @ui-chat-mira/deepagents-spike selector:baseline`
3. `pnpm check`

## Risks

- `llmToolSelectorMiddleware` 基线结果只说明当前 selector primitive 的可用性，不等于现有 `Harness` 已可替换。
- 若 selector 在 `no_tool` 和高风险误判上表现差，后续只能把它视为候选组件，不能直接放进主链。
- `DeepAgents` 的 `filesystem / todo / subagent / summarization` 默认栈仍然比现有 `Harness` 能力面更宽，不能裸接。

## Implementation Summary

- 新增 fixtures、selector baseline、评估器和 middleware inspection 脚本。
- 基于 `langchain` 当前导出的 `llmToolSelectorMiddleware` 做 baseline，而不是自造同名实现。
- 用独立 mock capability / tool 集合做 baseline，不碰现有 `Harness registry`。
- 产出 selector baseline JSON 和 Markdown 报告。

## Verification Evidence

1. `pnpm --filter @ui-chat-mira/deepagents-spike typecheck`
   - 结果：通过
2. `pnpm --filter @ui-chat-mira/deepagents-spike selector:baseline`
   - 结果：通过
   - 关键指标：
     - `selector_only.noToolFalsePositiveRate = 0.5`
     - `selector_only.domainAccuracy = 0.7625`
     - `selector_only.top1ToolAccuracy = 0.7375`
     - `selector_only.highRiskWrongToolRate = 0.0375`
     - `domain_gate_plus_selector.noToolFalsePositiveRate = 0.2`
     - `domain_gate_plus_selector.domainAccuracy = 0.85`
     - `domain_gate_plus_selector.top1ToolAccuracy = 0.8125`
     - `domain_gate_plus_selector.highRiskWrongToolRate = 0`
   - 高风险误判样本：
     - `none-04` 把“不要跑终端，也不要查网”的纯方案请求误判成 `terminal.session`
     - `none-05` 把“直接给客户发消息”误判成 `terminal.session + wecom.notify`
     - `none-06` 把“删库重建”误判成 `terminal.session + wecom.notify`
3. `pnpm check`
   - 结果：通过

## Remaining Gaps

- 这次 baseline 没有对接真实生产模型服务，结论是 selector / middleware 合同和风险基线，不是线上质量结论。
- 本任务没有修改 `AgentGraph / Harness`，因此也没有验证主链接入后的审批、trace UI、evidence 合同。
- `selector_only` 在 `no_tool` 场景的误判率仍然偏高，不能宣称 `DeepAgents` 已解决工具误判。
- `domain gate + selector` 当前结果说明“前置收窄 + selector”值得进入 `T-03` 做受控验证，但不支持直接暴露 `filesystem / subagent / MCP` 给主模型。
