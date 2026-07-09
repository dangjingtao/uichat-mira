---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: TaskIntentRequiredWorkExtractor
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - server/src/agent/task-intent.ts
  - server/src/agent/types.ts
  - server/src/agent/evidence.ts
  - server/src/agent/__tests__/task-intent.test.ts
  - server/src/agent/__tests__/next-action-planner.test.ts
task_state: DONE
---

# agent_node_T038 Task Intent / Required Work Extractor

## Target

在不改 `AgentGraph` 主线、不引入大型计划器的前提下，新增稳定的任务意图提取层，供后续 `Evidence / Planner / reducer` 复用。

本任务只解决一个问题：

- 任务覆盖判定需要稳定的 `Required Work / Task Intent` 提取输入
- 这层能力不能再散落在 `Evidence` 内部零碎逻辑里

## Allowed Changes

- `server/src/agent/task-intent.ts`
- `server/src/agent/types.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/__tests__/task-intent.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- 本任务卡

## Forbidden Changes

- `desktop/src/**`
- `server/src/agent/planner/**`
- `server/src/agent/nodes/**`
- `AgentGraph` 主路由结构
- 引入 LLM 大计划器 / DAG / task tree
- extractor 调工具、读写 Evidence、决定 `nextAction`

## Acceptance Criteria

1. 新增稳定的 `Required Work / Task Intent` 提取能力
2. 输出 `taskKind / requiredTargets / requiredActions / completionHints`
3. 覆盖 `list / locate / read_content / mutate / verify / search / terminal / mixed`
4. 支持多目标与中文裸 mutation target
5. extractor 不调用工具、不访问 `Evidence`、不决定 `nextAction`
6. 不修改 `AgentGraph` 主线
7. 可被后续 reducer 复用

## Review Conclusion

通过。

## Implementation Record

### Changed Files

- `server/src/agent/task-intent.ts`
- `server/src/agent/types.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/__tests__/task-intent.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`

### What Changed

- 新增 `task-intent.ts`，集中输出 `AgentRequiredWork`
- 抽出并导出 `collectTaskIntentTexts`、`normalizeTaskTargetPath`、`extractAgentRequiredWork`
- `evidence.ts` 复用 extractor，不再内嵌一套重复的目标提取实现
- 增加 `task-intent` 单测，覆盖动作分类、多目标、中文裸目标、workspace 路径归一化、completion hints
- 现有 planner 回归继续消费这层提取结果，证明后续 reducer / completion gate 可复用

### Why It Passed Review

- extractor 是纯本地字符串与路径归一化逻辑，没有工具调用、没有 `Evidence` 读取、没有 `nextAction` 决策
- 输出字段完整，且动作枚举覆盖 `list / locate / read_content / mutate / verify / search / terminal / mixed`
- 多目标与中文裸 mutation target 都有定向回归
- 没有改 `AgentGraph`、没有混入前端、MicroApps、CodeGraph、DeepAgents 改动
- 没有引入 LLM 计划器、DAG、task tree

## Verification Evidence

### Commands

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/task-intent.test.ts src/agent/__tests__/next-action-planner.test.ts`
- `pnpm --filter @ui-chat-mira/server typecheck`

### Results

- `task-intent.test.ts`: 11 passed
- `next-action-planner.test.ts`: 82 passed
- 定向回归总计：93 passed
- `typecheck` 未通过，但阻断来自任务外 `server/src/routes/microapps/index.ts` 现存错误，不在 T038 评审范围内

## Risks / Deferred

- 当前 extractor 已被 `evidence.ts` 复用，但尚未形成独立 reducer 层；这不影响本卡通过
- 全仓 `typecheck` 仍需由 `microapps` 相关任务单独处理
