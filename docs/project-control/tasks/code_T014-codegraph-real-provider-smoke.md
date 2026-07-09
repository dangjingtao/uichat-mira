---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphRealProviderSmoke
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-review.md
  - docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-report.md
  - docs/project-control/tasks/code_T009-codegraph-managed-mcp-runtime-spike.md
  - docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md
  - docs/project-control/tasks/code_T011-codegraph-verification-bridge.md
  - docs/project-control/tasks/code_T012-codegraph-trace-diagnostics.md
  - docs/project-control/tasks/code_T013-codegraph-controlled-planner-exposure.md
  - server/test-report/code_T014-codegraph-real-provider-smoke.md
task_state: BLOCKED
---

# code_T014 CodeGraph Real Provider Smoke

## Target

在不扩大 Agent Runtime 暴露面的前提下，用真实 CodeGraph provider 对 `managed-codegraph` 的受控链路做最小 smoke。

本任务要证明的是：

- 真实 provider 在当前 Windows 环境可 detect、可启动、可 health
- `codebase_explore` 仍然只作为受控工具存在，不暴露 CodeGraph 原生命令给普通 Agent
- wrapper、verification bridge、trace、fallback 在真实 provider 下能继续成立

本任务不允许做的是：

- 默认开启 `UI_CHAT_CODEGRAPH_PLANNER_ENABLED`
- 改 Planner / Normalize / Policy / ToolNode / Evidence 主链
- 把 provider raw output 塞进 Trace / Evidence
- 把 repo 根目录污染风险说成“已满足”

## Allowed Changes

- `docs/project-control/tasks/code_T014-codegraph-real-provider-smoke.md`
- `docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/**` 最小必要修正
- `server/src/mcp/managed-codegraph/**tests**/**` 或 smoke 测试文件
- `server/test-report/**` 中本任务专属报告文件

## Forbidden Changes

- Planner prompt 大改
- Agent Graph routing
- Normalize / Policy / ToolNode / Evidence 主链改造
- Generate 行为
- 默认开启 `codebase_explore`
- 暴露 CodeGraph 原生命令
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`

## Acceptance Criteria

1. smoke 使用真实 CodeGraph provider，而不是 fake provider。
2. 记录 CodeGraph 版本、启动命令、环境变量、app-data root。
3. 记录 telemetry status。
4. 记录每个 smoke query 的 `status / candidate count / verified count / rejected count / unverifiable count / fallbackReason`。
5. 记录是否污染 repo。
6. 记录测试命令和原始输出文件。
7. `pnpm --dir server typecheck` 通过，或明确只被任务外错误阻断。
8. 本任务专属测试通过。
9. 不默认启用 Planner 暴露。
10. 不改主链。

## Completion Evidence

### Changed Files

- `docs/project-control/tasks/code_T014-codegraph-real-provider-smoke.md`
- `docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/managed-jsonrpc-session.ts`
- `server/src/mcp/managed-codegraph/managed-codegraph-process-manager.ts`
- `server/src/mcp/managed-codegraph/codebase-explore-wrapper.ts`
- `server/src/mcp/managed-codegraph/planner-exposure-config.ts`
- `server/src/mcp/managed-codegraph/codegraph-real-provider-smoke.ts`
- `server/src/mcp/managed-codegraph/__tests__/planner-exposure-config.test.ts`
- `server/src/mcp/managed-codegraph/__tests__/real-provider-compat.test.ts`
- `server/test-report/code_T014-codegraph-real-provider-smoke.md`
- `server/test-report/code_T014-codegraph-real-provider-smoke.json`
- `server/test-report/code_T014-codegraph-real-provider-smoke-vitest.txt`
- `server/test-report/code_T014-codegraph-real-provider-smoke-typecheck.txt`
- `server/test-report/code_T014-codegraph-real-provider-smoke-pnpm-check.txt`

### Diff Summary

- `managed-jsonrpc-session` 现在会把 Windows 全局 npm 的 `codegraph` shim 解析成 `node.exe + npm-shim.js`，避免 `.cmd` 启动链在 Node `spawn` 下失效。
- `managed-codegraph-process-manager` 兼容了真实 CodeGraph 的标准 MCP 面：`serve --mcp`、`initialized`、`tools/list`、`tools/call`，并在保留 legacy `codegraph/*` 回退的前提下继续通过既有 fake-provider 回归。
- `codebase-explore-wrapper` 现在能把真实 `codegraph_explore` 的文本输出规整成受控 `CodebaseExploreResult`，从真实 file block 中提取 `path / startLine / endLine / snippet`，并继续走 verification bridge。
- 新增真实 provider smoke 脚本与兼容回归，专门记录 detect/start/query/raw output/repo pollution。

### Acceptance Criteria Evidence

- AC1-3：`docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-report.md` 与 `server/test-report/code_T014-codegraph-real-provider-smoke.json` 记录了真实 provider `1.3.0`、`serve --mcp`、telemetry `verified_off`、app-data root、logRoot、indexRoot。
- AC4-6：四条 smoke query 的状态、计数、fallback 和 raw output 文件都已记录在 `docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-report.md` 与 `server/test-report/code_T014-codegraph-real-provider-smoke.*`。
- AC7：`pnpm --dir server typecheck` 通过。
- AC8：`pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/real-provider-compat.test.ts src/mcp/managed-codegraph/__tests__/planner-exposure-config.test.ts src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts` 通过，49/49 通过。
- AC9：本任务没有改 `UI_CHAT_CODEGRAPH_PLANNER_ENABLED` 默认值；`codebase_explore` 仍只在显式环境变量下暴露。
- AC10：未修改 Planner / Normalize / Policy / ToolNode / Evidence 主链文件。

## Verification Results

- `pnpm --dir server typecheck`
  - 结果：通过
  - 原始输出：`server/test-report/code_T014-codegraph-real-provider-smoke-typecheck.txt`
- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/real-provider-compat.test.ts src/mcp/managed-codegraph/__tests__/planner-exposure-config.test.ts src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts`
  - 结果：通过，49/49 通过
  - 原始输出：`server/test-report/code_T014-codegraph-real-provider-smoke-vitest.txt`
- `pnpm check`
  - 结果：通过
  - 原始输出：`server/test-report/code_T014-codegraph-real-provider-smoke-pnpm-check.txt`
- `pnpm --dir server exec tsx src/mcp/managed-codegraph/codegraph-real-provider-smoke.ts`
  - 结果：真实 provider smoke 已完成并落盘到 `server/test-report/code_T014-codegraph-real-provider-smoke.*`

## Blocking Risk

本任务结论是 `BLOCKED`，原因不是“真实 provider 完全不可用”，而是：

1. 在当前 UIChat Mira 仓库做第一次真实 smoke 时，CodeGraph 在 repo 根目录新建了 `.codegraph/`。
2. 这违反了本任务的核心边界：`如真实 CodeGraph 无法避免默认写 repo .codegraph，必须记录为风险并阻断 ready`。
3. 后续再次重跑 smoke 时，baseline 已不再是“未污染”，因此不能把后续 ready/query 成功写成通过结论。

## Scope Declaration

- 未改 Planner prompt
- 未改 Agent Graph routing
- 未改 Normalize / Policy / ToolNode / Evidence 主链
- 未改 Generate
- 未默认开启 `codebase_explore`
- 未暴露 CodeGraph 原生命令给普通 Agent
- 未修改 `desktop/src/**`、`electron/**`、`packages/**`
- 未修改 `package.json`
- 未修改 `pnpm-lock.yaml`
