---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: RecoveryReplanCoverageContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - server/src/agent/coverage-state.ts
  - server/src/agent/planner/coverage-transition.ts
  - server/src/agent/planner/node.ts
  - server/src/agent/node-runtime.ts
  - server/src/agent/__tests__/coverage-state.test.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
  - server/src/agent/__tests__/graph.test.ts
  - server/src/agent/__tests__/execution-observation.test.ts
  - server/src/agent/__tests__/toolcall-loop-regression.test.ts
task_state: DONE
---

# agent_node_T042 Recovery / Replan Coverage Contract

## Target

把 recoverable failure / terminal failure / repeated guard / recovery exhausted 纳入 Coverage-driven Planner Loop，同时保持既有 C 合同不变。

本任务只解决一个问题：

- 失败不能作为主链外的额外通道，失败事实也必须进入 coverage / evidence / replan 递推
- recoverable exhausted 必须走 guarded answer，terminal failure 必须走 error path
- repeated guard 只有在 `coverageState.taskCompletable=true` 时才允许 answer

## Allowed Changes

- `server/src/agent/coverage-state.ts`
- `server/src/agent/planner/node.ts`
- `server/src/agent/planner/coverage-transition.ts`
- `server/src/agent/node-runtime.ts`
- `server/src/agent/__tests__/coverage-state.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/graph.test.ts`
- `server/src/agent/__tests__/execution-observation.test.ts`
- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
- `docs/project-control/project-control-ledger.md`
- 本任务卡

## Forbidden Changes

- `desktop/src/**`
- `AgentGraph` 主线结构
- `Policy / ToolNode` 合同
- 新增 failure kind
- 让失败绕过 Evidence
- 在 `ToolNode` 内做 Planner 决策
- 重构 Graph 路由

## Acceptance Criteria

1. recoverable failure 不会把 target 标记完成
2. recoverable failure 会进入 pending recovery
3. repeated guard 不会让 partial multi-target task 直接 answer
4. recovery exhausted 后不继续工具执行
5. terminal failure 不 Generate
6. terminal mutation failure 可以形成终局 outcome，但不能说“删除成功”

## Review Conclusion

通过。

## Implementation Record

### Changed Files

- `server/src/agent/__tests__/graph.test.ts`
- `docs/project-control/tasks/agent_node_T042-recovery-replan-coverage-contract.md`
- `docs/project-control/project-control-ledger.md`

### What Changed

- 覆盖原先误建的“评审卡”，改回正式的 `T042 Recovery / Replan Coverage Contract` 施工卡口径
- 保留现有运行时代码结论：recoverable failure、terminal failure、repeated guard、recovery exhausted 已进入 coverage / observation / replan 递推
- 修正 T042 直接相关的 recoverable failure 图测试断言，不再把 “task model 调用次数” 当作合同本身，而是直接验证：
  - recoverable failure 后 target 仍未完成
  - recoverable exhausted 后进入 guarded answer，图状态是 `completed`
  - terminal failure 不会进入 Generate
  - evidence 仍明确记录失败事实

### Why It Passed Review

- 当前主链已经满足 T042 要求的 C 合同：recoverable exhausted 走 guarded answer，terminal failure 走 error path
- repeated guard 最终仍受 `getTaskCompletionDecision` 约束，不会让 partial coverage 提前 answer
- 失败事实持续进入 `coverageState`、`latestSummary`、`execution observation`，没有绕过 Evidence

## Verification Evidence

### Commands

- `pnpm exec vitest run src/agent/__tests__/coverage-state.test.ts -t "recoverable read failure incomplete|terminal failed edit_file"`
- `pnpm exec vitest run src/agent/__tests__/next-action-planner.test.ts -t "keeps terminal tool failure as failed_terminal|keeps recoverable tool failure as failed_recoverable|recovery budget is exhausted|does not let repeated read_open evidence close a multi-file content task early"`
- `pnpm exec vitest run src/agent/__tests__/graph.test.ts -t "routes recoverable tool failure back to the planner chain for replanning|stops retrying after two recoverable tool failures and does not re-enter planner or tool again"`
- `pnpm exec vitest run src/agent/__tests__/toolcall-loop-regression.test.ts -t "terminal failed tool still fails the graph and does not generate a guarded answer"`
- `pnpm check`

### Results

- `coverage-state.test.ts`: 1 passed, 9 skipped
- `next-action-planner.test.ts`: 4 passed, 78 skipped
- `graph.test.ts`: 2 passed, 31 skipped
- `toolcall-loop-regression.test.ts`: 1 passed, 10 skipped
- `pnpm check`: passed

## Risks / Deferred

- `graph.test.ts` 和 `toolcall-loop-regression.test.ts` 里仍有其他旧断言在验证 task-model 调用次数，这些更像 T040 之后的测试口径整理工作，不应继续混入 T042 合同结论
- 当前 terminal mutation failure 作为终局 outcome 的语义依赖 evidence / blocker 明确表达失败事实；如果后续产品层需要更细的用户可见文案，应另开卡处理
