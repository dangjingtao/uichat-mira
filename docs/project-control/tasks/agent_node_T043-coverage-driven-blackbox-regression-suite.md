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
task_state: DONE
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

## Review Conclusion

通过。

## Implementation Record

### Changed Files

- `server/src/agent/__tests__/graph.test.ts`
- `docs/project-control/tasks/agent_node_T043-coverage-driven-blackbox-regression-suite.md`
- `docs/project-control/project-control-ledger.md`

### What Changed

- 在 `graph.test.ts` 补了三条 T043 缺失的近黑盒回归：
  - 单目标 `read_locate` 路径问题可直接回答
  - `read_locate` 只定位不读内容时，图会继续转到 `read_open`
  - `README.md` / `AGENTS.md` 双文件内容任务必须两个都 `read_open` 完成后才回答
- 保留现有 T040-T042 已有覆盖结论，不额外修改运行时代码
- 回填正式 T043 施工卡和项目总台账登记

### Why It Passed Review

- 现有 `nodes.test.ts`、`next-action-planner.test.ts`、`toolcall-loop-regression.test.ts` 已经固定了 ToolSelect、Generate、mutation verify、recoverable / terminal failure 等合同
- 本次新增的 `graph.test.ts` 补齐了 T043 最容易从主线回归掉的黑盒缺口：single-target locate answer、locate-to-open bridge、multi-target full completion
- 新断言都围绕 `nextAction`、工具执行顺序、`latestSummary`、图状态和调用次数，不依赖脆弱全文快照

## Verification Evidence

### Commands

- `pnpm exec vitest run src/agent/__tests__/graph.test.ts -t "read_locate execution when the user only asked where README.md is|opens README.md after read_locate when the question still asks for file content|only answers after README.md and AGENTS.md are both opened for a multi-file content task"`
- `pnpm check`

### Results

- `graph.test.ts`: 3 passed
- `pnpm check`: passed

## Risks / Deferred

- mutation verify completed 的最终 answer 路径当前主要由 `next-action-planner.test.ts` 固定；如果后续要把这部分也提升到更完整的 graph 黑盒层，可另开专项补充
- 本次不整理其他历史测试的命名或组织，只补 T043 直接需要的行为闸门
