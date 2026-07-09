---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodebaseExploreWrapperRuntime
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/code_T010-codebase-explore-wrapper-runtime-review.md
  - docs/project-control/tasks/code_T007-codegraph-wrapper-contract.md
  - docs/project-control/tasks/code_T008-codegraph-managed-mcp-runtime-implementation-plan.md
  - docs/project-control/tasks/code_T009-codegraph-managed-mcp-runtime-spike.md
task_state: DONE
---

# code_T010 Codebase Explore Wrapper Runtime

## Target

实现受控 `codebase_explore` wrapper runtime 的最小版本，只允许内部测试调用，不默认启用，不暴露给普通 Planner。

本任务承接：

- `code_T007` Wrapper Contract
- `code_T008` Runtime Implementation Plan
- `code_T009` Managed runtime spike

## Allowed Changes

- `docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md`
- `docs/project-control/reviews/code_T010-codebase-explore-wrapper-runtime-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/**`
- `server/src/mcp/managed-codegraph/__tests__/**`

## Forbidden Changes

- Planner 真实暴露面
- Agent Graph routing
- Policy / ToolNode / Evidence 主链
- Evidence 接线
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`
- 默认启用给普通 Agent

## Acceptance Criteria

1. 新增 `CodebaseExploreWrapper` 或等价模块。
2. 输入为内部调用参数，不来自 Planner 直接规划。
3. 实现 scope inference：
   - `agent-runtime`
   - `harness-mcp`
   - `desktop-ui`
   - `microapps`
   - `docs`
   - `workspace-general`
4. 实现 include / exclude path 约束。
5. 内部选择 CodeGraph 命令：
   - `query`
   - `explore`
   - `affected`
   - `mixed`
6. 实现结果裁剪：
   - `maxFiles: 8`
   - `maxSnippets: 12`
   - `maxSnippetLines: 24`
   - `maxTotalLines: 160`
   - `maxRawChars: 16000`
7. 输出标准化 `CodebaseExploreResult`。
8. 输出 `CodebaseCandidate[]`，每个 candidate 包含：
   - `path`
   - `startLine`
   - `endLine`
   - `kind`
   - `summary`
   - `confidence`
   - `source.engine`
   - `source.command`
   - `verification.required`
   - `verification.status`
   - `limitations`
9. 所有 candidate 默认：
   - `verification.required = true`
   - `verification.status = pending`
10. broad explore 噪声明显时：
   - `status = partial` 或 `degraded`
   - `limitations` 标记 `broad_query_noise_detected` / `requires_follow_up_read`
11. Planner 仍然看不到 `codebase_explore`
12. 不接 Evidence
13. 不执行 `read_file_slice` verification
14. 不把 CodeGraph 原始输出裸交给上层
15. CodeGraph 查询失败不得回答“没有”
16. 无 line range 的结果不得成为高置信候选
17. wrapper 支持 fallback signal，但本任务不实现完整 fallback 链执行

## Completion Evidence

### Changed Files

- `docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md`
- `docs/project-control/reviews/code_T010-codebase-explore-wrapper-runtime-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/codebase-explore-wrapper.ts`
- `server/src/mcp/managed-codegraph/index.ts`
- `server/src/mcp/managed-codegraph/managed-codegraph-process-manager.ts`
- `server/src/mcp/managed-codegraph/types.ts`
- `server/src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
- `server/src/mcp/managed-codegraph/__tests__/fixtures/fake-codegraph-provider.mjs`

### Diff Summary

- 新增隔离模块 `CodebaseExploreWrapper`，把内部请求收敛为受控 `scope -> include/exclude -> command -> normalized result` 流程。
- 在 `managed-codegraph` 隔离目录内补充 provider request 能力，供 wrapper 复用受管 JSON-RPC 进程，不改 Planner / Evidence / Agent Graph。
- 扩展 fake provider 与定向测试，覆盖 scope inference、include/exclude 透传、命令选择、裁剪、无 line range 降级、query failed 降级和隔离边界。
- 回填本任务卡、review 和总台账，明确当前只是内部 wrapper runtime，不暴露 Planner，不接 Evidence，不执行原文核验。

### Acceptance Criteria Evidence

- AC1-2：`server/src/mcp/managed-codegraph/codebase-explore-wrapper.ts` 已新增 `CodebaseExploreWrapper`，输入类型为 `CodebaseExploreInternalRequest`，只存在于隔离 runtime 目录内。
- AC3：`pickScope()` 已实现六类 scope inference；测试覆盖 `agent-runtime`、`harness-mcp`、`microapps`、`docs` 和 `workspace-general`。
- AC4：wrapper 统一合并 scope include paths、默认 exclude paths 和请求级 include/exclude；测试覆盖路径透传。
- AC5：`pickCommand()` 已在内部选择 `query / explore / affected / mixed`。
- AC6：wrapper 在标准化阶段执行 `maxFiles / maxSnippets / maxSnippetLines / maxTotalLines / maxRawChars` 裁剪；broad explore 测试覆盖裁剪结果。
- AC7-8：`types.ts` 已新增 `CodebaseExploreResult`、`CodebaseCandidate`、`fallbackSignal` 等标准化合同；wrapper 不向上暴露 raw provider payload。
- AC9：所有 candidate 统一输出 `verification.required = true`、`verification.status = pending`；测试覆盖。
- AC10：broad explore 会返回 `partial`，并补 `broad_query_noise_detected`、`requires_follow_up_read` 和 follow-up hints；测试覆盖。
- AC11：没有修改 Planner 暴露面；测试只审查隔离目录 import，未接入 Planner。
- AC12：没有修改 `server/src/agent/evidence.ts` 或任何 Evidence 接线；隔离测试断言未 import Evidence。
- AC13：wrapper 只输出 follow-up hint / fallback signal，没有执行 `read_file_slice`；隔离测试断言未 import `read/**`。
- AC14：provider 返回先过 wrapper 标准化与裁剪，输出只保留 candidate 合同和 wrapper 限制说明。
- AC15：provider query 失败时返回 `degraded + fallbackSignal`，不会回答“没有”；测试覆盖。
- AC16：无 line range 的 candidate 会被压到低置信度并带 `missing_line_range` / `requires_follow_up_read`；测试覆盖。
- AC17：`fallbackSignal` 已落地为结构化字段，但当前没有实现完整 fallback 链执行。

## Verification Results

- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
  - 结果：通过，1 个测试文件，22 个测试通过
- `pnpm --dir server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过

## Scope Declaration

- 未修改 Planner 暴露面
- 未修改 Agent Graph routing
- 未修改 Policy / ToolNode / Evidence 主链
- 未接 Evidence
- 未执行 `read_file_slice` verification
- 未修改 `desktop/src/**`、`electron/**`、`packages/**`
- 未修改 `package.json`
- 未修改 `pnpm-lock.yaml`
