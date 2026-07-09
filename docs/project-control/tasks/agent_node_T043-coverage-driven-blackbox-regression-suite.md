---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: CoverageDrivenBlackboxRegressionSuite
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - server/src/agent/__tests__/graph.test.ts
  - server/src/agent/__tests__/nodes.test.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
  - server/src/agent/__tests__/toolcall-loop-regression.test.ts
  - server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts
task_state: CURRENT
---

# agent_node_T043 Coverage-driven Blackbox Regression Suite

## Target

建立 Coverage-driven Planner Loop 的黑盒回归总闸，防止后续改动把主线 answer stop、multi-target coverage、mutation verify、recovery / terminal 合同重新打坏。

本任务只补行为级测试，不改产品运行时行为。

## Allowed Changes

- `server/src/agent/__tests__/graph.test.ts`
- `server/src/agent/__tests__/nodes.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
- `server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts`
- `docs/project-control/project-control-ledger.md`
- 本任务卡

## Forbidden Changes

- `desktop/src/**`
- `server/src/microapps/**`
- `server/src/mcp/managed-codegraph/**`
- `server/src/deepagents/**`
- 为适配测试修改产品运行时逻辑
- 引入 brittle 全文 snapshot
- 绕过 Planner / Graph / ToolNode 主线闭环

## Acceptance Criteria

1. 单目标 `read_list` / `read_locate` 内容在可回答时可直接形成 grounded answer
2. `read_locate` 后如果任务仍然要求内容，必须继续到 `read_open`
3. 多目标内容任务在 partial completion 时不得 answer，全部完成后才 answer
4. mutation locate-only、verify pending、recoverable failure、terminal failure 等路径已有近黑盒回归，不得退化回 `latestEvidenceSummary.canAnswer` 单点收口
5. ToolSelect coverage-aware query 与 Generate grounding 合同仍由现有回归固定

## Implementation Record

### Changed Files

- `server/src/agent/__tests__/graph.test.ts`
- `docs/project-control/tasks/agent_node_T043-coverage-driven-blackbox-regression-suite.md`
- `docs/project-control/project-control-ledger.md`

### What Changed

- 把 `graph.test.ts` 里仍按旧语义断言 task model 调用次数的黑盒用例，改成 coverage-aware 断言：
  - deterministic coverage transition 命中时，断言 planner task model 不再被调用，或断言 `coverageTransitionReason` 存在
  - 只有 coverage transition 回退到 task model 的场景，才继续断言 planner task model 被调用
- 补齐 T042/T043 交叉回归：
  - recoverable failure 后不得重复同一失败调用，并回退到 task model / `ask_user`
  - recoverable exhausted 后直接走 guarded answer 终局
  - mutation verify pending 时，mutation 完成后必须继续 `read_open` 验证，不能提前 answer
  - terminal mutation failure 作为失败终局暴露，不能伪装成成功结果
- 统一了这批 graph 黑盒测试里的 spy 生命周期，避免 `mockImplementationOnce` 在跨测试场景里串用例

### Why It Passed Review

- 新断言围绕 `nextAction`、`coverageTransitionReason`、工具执行顺序、`latestSummary`、图状态与调用次数，不依赖脆弱全文快照
- 关键主线合同仍被保留：
  - `use_tool` 必须经过 `Normalize → Policy → ToolNode`
  - `selectedToolIds` 不得直接执行
  - `pendingApproval` 不得继续工具执行

## Verification Evidence

### Commands

- `pnpm exec vitest run src/agent/__tests__/graph.test.ts -t "agentGraph routes recoverable tool failure back to the planner chain for replanning|agentGraph stops retrying after two recoverable tool failures and does not re-enter planner or tool again"`
- `pnpm exec vitest run src/agent/__tests__/graph.test.ts -t "agentGraph does not answer immediately after mutation execution when verification is still required"`
- `pnpm exec vitest run src/agent/__tests__/graph.test.ts -t "agentGraph treats terminal mutation failure as a terminal outcome without pretending the deletion succeeded"`
- `pnpm exec vitest run src/agent/__tests__/graph.test.ts -t "agentGraph answers after a single terminal_session execution when command output is sufficient"`
- `pnpm exec vitest run src/agent/__tests__/graph.test.ts -t "agentGraph answers after a single read_list execution when the user asked for a workspace listing|agentGraph answers after a single read_locate execution when the user only asked where README.md is|agentGraph opens README.md after read_locate when the question still asks for file content|agentGraph only answers after README.md and AGENTS.md are both opened for a multi-file content task|agentGraph does not let selectedToolIds bypass planner and normalize|agentGraph stops the current loop when policy requires approval and never enters tool execution|agentGraph keeps pendingApproval and frozen pendingToolCall when Harness pauses for approval"`
- `pnpm check`

### Results

- targeted `graph.test.ts` runs: passed for the above targeted scenarios after updating blackbox assertions
- `pnpm check`: failed in `packages/docs-site` with `@ui-chat-mira/docs-site@0.7.1 typecheck` exiting `3221225477`; this failure was pre-existing to the T043 test-file scope and was not changed here

## Risks / Deferred

- `pnpm check` 当前被 `packages/docs-site` 的 typecheck 崩溃阻断，未在本任务内处理
- mutation locate-only 这条 graph 黑盒仍依赖当前 deterministic coverage 对中文目标表达的解析稳定性；后续如果 coverage 规则继续收紧，建议再单开更强的专门用例固化
