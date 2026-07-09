---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: PlannerTransitionPolicy
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - server/src/agent/coverage-state.ts
  - server/src/agent/planner/coverage-transition.ts
  - server/src/agent/planner/node.ts
  - server/src/agent/planner/__tests__/coverage-transition.test.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
task_state: DONE
---

# agent_node_T040 Planner Transition Policy

## Target

在不改 `AgentGraph` 主线、不新增 action type 的前提下，新增 `coverageState -> nextAction` 的确定性 transition policy，让 Planner 先按覆盖状态推进，再在不确定时回退到 task model。

本任务只解决一个问题：

- Planner 下一步动作需要优先依据 `coverageState` 稳定推进
- 这层转移规则不能绕过现有 `Normalize / Policy / ToolNode` 主合同

## Allowed Changes

- `server/src/agent/planner/coverage-transition.ts`
- `server/src/agent/planner/node.ts`
- `server/src/agent/planner/__tests__/coverage-transition.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- 本任务卡

## Forbidden Changes

- `desktop/src/**`
- `server/src/agent/nodes/**`
- `AgentGraph` 主路由结构
- 新增外部 action type
- 绕过 `Normalize / Policy / ToolNode`
- 让 prompt 自由决定覆盖状态
- 把 `selectedToolIds` 直接接执行

## Acceptance Criteria

1. `read_content` 场景稳定按 `locate -> open -> answer` 推进
2. 多目标任务逐个补齐，不提前 answer
3. mutation 场景稳定按 `locate -> mutate -> verify -> answer` 推进
4. `pendingApproval` 时不继续工具
5. recovery exhausted 时不继续 deterministic tool path
6. transition 不能破坏现有 prompt fallback

## Review Conclusion

通过。

## Implementation Record

### Changed Files

- `server/src/agent/planner/coverage-transition.ts`
- `server/src/agent/planner/node.ts`
- `server/src/agent/planner/__tests__/coverage-transition.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`

### What Changed

- 新增 `coverage-transition.ts`，集中实现 coverage state 到 `nextAction` 的确定性转移规则
- `nextActionPlannerNode` 先计算 `coverageState`，优先消费 transition policy，再回退到已有 bridge / task model
- 为 `read_content`、`locate`、`list`、`mutate`、`search`、`terminal` 增加确定性推进规则
- `Planner` trace 里新增 `coverageTransitionReason`，方便区分 deterministic path 和 fallback path
- 增加外部搜索 query 归一化，能把“请联网搜索今天最新的 release notes”稳定收敛成 `latest release notes`
- 更新 `next-action-planner` 回归断言，让 deterministic policy 命中后的 reason 和 task model 调用次数与真实执行路径一致

### Why It Passed Review

- transition policy 只输出 `nextAction`，没有直接执行工具，也没有绕过 `Normalize / Policy / ToolNode`
- `pendingApproval`、recovery exhausted、coverage complete 都有硬门控，不会继续盲目出工具动作
- `nextActionPlannerNode` 仍保留 list/locate bridge 和 task model fallback，不会把原有 prompt 路径砍掉
- 多目标读文件、mutation 执行与验证、外部搜索、workspace 本地读取等关键路径都有定向回归覆盖

## Verification Evidence

### Commands

- `pnpm exec vitest run src/agent/planner/__tests__/coverage-transition.test.ts src/agent/__tests__/next-action-planner.test.ts`
- `pnpm check`
- `pnpm --filter @ui-chat-mira/server exec node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`

### Results

- `coverage-transition.test.ts`: 7 passed
- `next-action-planner.test.ts`: 82 passed
- 定向回归总计：89 passed
- `pnpm check`: passed

## Risks / Deferred

- 当前 deterministic transition 只在 `coverageState` 存在稳定 required work 时接管；模糊问题仍按原有 task model fallback 处理
- 若后续再出现递归 `typecheck` 环境波动，应单独开卡处理，不应回写成这张卡的实现缺陷
