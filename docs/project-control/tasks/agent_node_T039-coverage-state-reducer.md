---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: CoverageStateReducer
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - server/src/agent/coverage-state.ts
  - server/src/agent/evidence.ts
  - server/src/agent/types.ts
  - server/src/agent/task-intent.ts
  - server/src/agent/__tests__/coverage-state.test.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
task_state: DONE
---

# agent_node_T039 Coverage State Reducer

## Target

在不改 `AgentGraph` 主线、不新增 action type 的前提下，新增 coverage reducer，基于 `Required Work + 完整 Evidence` 计算任务覆盖状态，并继续兼容现有 `AgentTaskCoverageView`。

本任务只解决一个问题：

- Planner completion gate 需要稳定、可复用、按 target × action 计算的 coverage state
- 这层状态不能再退回成只看 `latestSummary`

## Allowed Changes

- `server/src/agent/coverage-state.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- `server/src/agent/__tests__/coverage-state.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- 本任务卡

## Forbidden Changes

- `desktop/src/**`
- `server/src/agent/nodes/**`
- `server/src/agent/planner/**` 主合同
- `AgentGraph` 主路由结构
- 新增外部 action type
- 把 `latestSummary` 重新做成唯一事实来源

## Acceptance Criteria

1. reducer 基于完整 evidence，而不是只看 `latestSummary`
2. 形成 target × action 的覆盖状态
3. 区分 `pending / located / opened / mutated / verified / blocked`
4. 兼容现有 `AgentTaskCoverageView`
5. `locate-only` 不满足 `read_content`
6. mutation `locate-only` 不满足 mutation
7. mutation + verify 需要验证 evidence
8. recoverable failure 不算完成
9. terminal failure 不伪装成功

## Review Conclusion

通过。

## Implementation Record

### Changed Files

- `server/src/agent/coverage-state.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/__tests__/coverage-state.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`

### What Changed

- 新增 `coverage-state.ts`，集中把 `Required Work + 完整 Evidence` 归约成 `AgentCoverageState`
- reducer 按目标维度输出 `requiredActions / completedActions / pendingActions / status / blocker`
- `evidence.ts` 的 `getTaskCoverageView` 改为复用 reducer 结果，保留现有 `AgentTaskCoverageView` 对外形状
- 新增回归，锁住 locate-only、multi-target、mutation、mutation+verify、recoverable failure、terminal failure 的关键状态

### Why It Passed Review

- reducer 先遍历 `evidence.toolExecutions`，再补 `latestSummary`，没有把 `latestSummary` 退回为唯一事实来源
- 多目标按 target 独立建状态，形成 `target × action` 视图
- `read_locate` 只记 `located`，不会冒充 `opened`
- `read_list` 只满足 list 全局动作，不会冒充 `read_content`
- dry-run mutation 只有 `changed === true && dryRun !== true` 才计入 mutation 完成
- recoverable failure 只会挂出 `recoverable_execution`，不会算完成
- terminal mutation failure 会把目标标成 `blocked`，`coveredTargets` 仍为空，不会伪装成功
- 没改 `AgentGraph` 主线，也没新增 action type

## Verification Evidence

### Commands

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/coverage-state.test.ts src/agent/__tests__/next-action-planner.test.ts`
- `pnpm --filter @ui-chat-mira/server typecheck`

### Results

- `coverage-state.test.ts`: 10 passed
- `next-action-planner.test.ts`: 82 passed
- 定向回归总计：92 passed
- `typecheck` 未通过，但阻断来自任务外 `server/src/routes/microapps/index.ts` 的现存类型错误，不在 T039 评审范围内

## Risks / Deferred

- 当前 reducer 已兼容 `AgentTaskCoverageView`，但 `AgentTaskCoverageView` 仍是简化视图；更细粒度状态如需外露，应另开任务
- 全仓 `typecheck` 仍需由 `microapps` 相关任务单独处理
