---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-09
layer: project-control
module: AgentRuntime
feature: ToolSelectCoverageAwareRouting
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - server/src/agent/intent/node.ts
  - server/src/agent/__tests__/nodes.test.ts
task_state: DONE
---

# agent_node_T041 ToolSelect Coverage-Aware Routing

## Target

在不改 `ToolSelect` 外部合同、不改 `Policy / ToolNode` 主线的前提下，加固 `ToolSelect / Harness candidate selection`，让候选工具围绕“剩余任务缺口”而不是原始 query 漂移。

本任务只解决一个问题：

- `effectiveQuery` 必须稳定表达当前剩余缺口和下一步应做的覆盖动作
- matcher / task selector 必须共同消费增强后的 `effectiveQuery`
- `resolvedToolIntent.query` 必须继续保留原始用户 query，不能污染外部语义

## Allowed Changes

- `server/src/agent/intent/node.ts`
- `server/src/agent/__tests__/nodes.test.ts`
- 本任务卡
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `desktop/src/**`
- `server/src/agent/nodes/**`
- `Policy / ToolNode` 对外合同
- `Harness` 执行流
- 让 `ToolSelect` 直接执行工具
- 让 `selectedToolIds` 直接进入 execution
- provider-specific 逻辑

## Acceptance Criteria

1. `effectiveQuery` 包含 `Original user query`、`Review context`、`Remaining task coverage`、`Preferred next coverage action`
2. matcher 和 task selector 都使用增强后的 `effectiveQuery`
3. `resolvedToolIntent.query` 仍保留原始 query
4. trace details 能看到 `taskCoverageView / effectiveQuery`
5. `read_open` pending target 不会被已完成 target 覆盖
6. mutation pending 时候选不会漂向纯 read / answer
7. recoverable failure 时 `effectiveQuery` 能暴露失败摘要和“下一次尝试必须不同于上一次”的恢复要求

## Review Conclusion

通过。

## Implementation Record

### Changed Files

- `server/src/agent/intent/node.ts`
- `server/src/agent/__tests__/nodes.test.ts`
- `docs/project-control/tasks/agent_node_T041-toolselect-coverage-aware-routing.md`
- `docs/project-control/project-control-ledger.md`

### What Changed

- `toolSelectNode` 统一基于 `buildPlannerObservationContext(state)` 构建 `observationContext`，让 `taskCoverageView` 与 recoverable failure 上下文都来自同一份观察数据
- 重构 `effectiveQuery` 的结构，固定为 `Original user query`、`Review context`、`Remaining task coverage`、`Preferred next coverage action` 四段
- `Review context` 增补当前 subtask、blocker 和 recoverable failure 摘要，避免 ToolSelect 只看到原始 query
- 增加“下一步覆盖动作”推导逻辑，能针对 `read_open`、`read_locate`、`mutation_execution`、`mutation_verification`、`recoverable_execution` 生成明确指引
- 当 `taskCoverageView` 没有给出足够 target 时，增加从原始 query 提取候选 target 的兜底解析，覆盖引号内容、文件名样式目标和常见中文动作短语
- 保持 `resolvedToolIntent.query` 不变，只把增强后的 `effectiveQuery` 交给 matcher / selector
- 扩展 `nodes.test.ts`，覆盖 `read_open`、`mutation_execution`、`mutation_verification`、`recoverable_execution` 等路由场景以及 trace details 断言

### Why It Passed Review

- 加固点限定在 `toolSelectNode` 内部，没有改 `ToolSelect` 外部合同，也没有让它越权执行工具
- `effectiveQuery` 只影响候选理解层，不会污染 `resolvedToolIntent.query` 对外语义
- `pendingTargets / pendingActions / recovery` 现在能共同约束候选选择，降低多目标读取、mutation、恢复重试场景里的工具漂移
- 回归测试覆盖了多种剩余缺口类型，并验证 trace details 仍能看到 `taskCoverageView / effectiveQuery`

## Verification Evidence

### Commands

- `pnpm exec vitest run src/agent/__tests__/nodes.test.ts`
- `pnpm check`

### Results

- `nodes.test.ts`: 27 passed
- `pnpm check`: passed

## Risks / Deferred

- 当前 query target 兜底提取仍是轻量启发式，只用于在 `taskCoverageView` 信息不完整时辅助候选排序，不应替代上游 coverage state 的明确输出
- 如果后续需要扩更多 coverage action 类型，应优先保持 `effectiveQuery` 结构稳定，再单独开卡扩动作映射规则
