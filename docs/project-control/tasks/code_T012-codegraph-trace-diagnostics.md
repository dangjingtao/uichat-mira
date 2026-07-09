---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphTraceDiagnostics
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/code_T012-codegraph-trace-diagnostics-review.md
  - docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md
  - docs/project-control/tasks/code_T011-codegraph-verification-bridge.md
task_state: DONE
---

# code_T012 CodeGraph Trace / Diagnostics

## Target

补齐 CodeGraph Managed MCP / Wrapper / Verification 的 Trace 与 Diagnostics 字段，让后续调试能看清：

- provider 状态
- scope / query
- 裁剪与降级
- 核验计划与核验次数

本任务只补诊断与可观测性：

- 不改变 Planner 暴露面
- 不改变 Evidence gate
- 不改变 Generate 行为

## Allowed Changes

- `docs/project-control/tasks/code_T012-codegraph-trace-diagnostics.md`
- `docs/project-control/reviews/code_T012-codegraph-trace-diagnostics-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/**`
- 现有 trace / diagnostics 类型的最小扩展文件
- 相关测试文件

## Forbidden Changes

- Planner 默认暴露面
- Agent Graph routing
- Evidence gate 放宽
- Generate 行为
- `desktop/src/**` 大范围 UI 改造
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`

## Acceptance Criteria

1. 记录最小 `CodebaseExploreTrace` 诊断合同。
2. 至少包含：
   - `capabilityId = codebase_explore`
   - `provider = codegraph`
   - `providerVersion`
   - `runtimeShape = managed_mcp`
   - `workspaceHash`
   - `selectedScope`
   - `includePaths`
   - `excludePaths`
   - `originalQuery`
   - `normalizedQuery`
   - `internalCommand`
   - `resultCount`
   - `truncated`
   - `limitations`
   - `fallbackUsed`
   - `fallbackReason`
   - `verificationRequired`
   - `verificationReadCount`
   - `status`
   - `durationMs`
   - `indexStatus`
   - `telemetryStatus`
3. Wrapper 结果输出 trace。
4. Verification 结果输出 trace。
5. Trace 只保留诊断摘要，不重复塞 snippet / 原文摘录 / raw output。
6. degraded / failed trace 带明确 reason。
7. `fallbackUsed = true` 时必须有 `fallbackReason`。
8. `verificationReadCount` 反映 planned read count 或实际核验次数。
9. telemetry status 可见，但不暴露 workspace 原始绝对路径。
10. 不改变 Planner 暴露面。
11. 不放宽 Evidence gate。

## Completion Evidence

### Changed Files

- `docs/project-control/tasks/code_T012-codegraph-trace-diagnostics.md`
- `docs/project-control/reviews/code_T012-codegraph-trace-diagnostics-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/codegraph-trace-diagnostics.ts`
- `server/src/mcp/managed-codegraph/codebase-explore-wrapper.ts`
- `server/src/mcp/managed-codegraph/codegraph-verification-bridge.ts`
- `server/src/mcp/managed-codegraph/index.ts`
- `server/src/mcp/managed-codegraph/types.ts`
- `server/src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`

### Diff Summary

- 新增 `codegraph-trace-diagnostics.ts`，把 explore / verification 统一压成紧凑 `CodebaseExploreTrace` 摘要。
- wrapper 结果现在会输出 ready / partial / degraded / failed trace，覆盖 scope、query、裁剪、fallback、verification plan count、telemetry 和 provider 状态。
- verification bridge 结果现在也会输出 trace，覆盖实际核验次数、verified 子集数量、部分失败和 mismatch 场景。
- 回归测试新增 trace 完整性、partial/truncated、fallback reason、telemetry blocked、verification count，以及“不把 snippet / excerpt / raw output 塞进 trace”的断言。

### Acceptance Criteria Evidence

- AC1-2：`server/src/mcp/managed-codegraph/types.ts` 已新增 `CodebaseExploreTrace` 和 `CodebaseTraceStatus`，字段覆盖任务要求。
- AC3：`server/src/mcp/managed-codegraph/codebase-explore-wrapper.ts` 在所有返回路径补 `trace`。
- AC4：`server/src/mcp/managed-codegraph/codegraph-verification-bridge.ts` 为 verification 结果补 `trace`。
- AC5：trace 只记录摘要字段，不包含 snippet/minimalExcerpt/raw provider payload；测试覆盖。
- AC6-7：query failed、telemetry blocked、broad scope partial 等场景都会留下 `status + fallbackReason`；测试覆盖。
- AC8：wrapper trace 的 `verificationReadCount` 记录 planned read count，verification trace 记录实际 follow-up read count；测试覆盖。
- AC9：trace 只记录 `workspaceHash`，不输出 workspace 原始绝对路径。
- AC10：未修改 Planner 暴露面；隔离测试继续断言不 import planner。
- AC11：未放宽 Evidence gate；verified input 规则保持不变，未核验 candidate 仍然不能进入后续输入。

## Verification Results

- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
  - 结果：通过，1 个测试文件，37 个测试通过
- `pnpm --dir server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过

## Scope Declaration

- 未改变 Planner 暴露面
- 未改变 Agent Graph routing
- 未放宽 Evidence gate
- 未改变 Generate 行为
- 未修改 `desktop/src/**`、`electron/**`、`packages/**`
- 未修改 `package.json`
- 未修改 `pnpm-lock.yaml`
