---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphExternalIndexRootRepoPollutionControl
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/code_T015-codegraph-external-index-root-report.md
  - docs/project-control/tasks/code_T014-codegraph-real-provider-smoke.md
  - server/test-report/code_T015-codegraph-external-index-root.md
task_state: READY_FOR_REVIEW
---

# code_T015 CodeGraph External Index Root / Repo Pollution Control

## Target

调查 `CodeGraph 1.3.0` 是否支持 repo 外部 index root，并把结论落实到 managed CodeGraph runtime。

本任务只处理 CodeGraph 线，不混 DeepAgents / MicroApps / Agent Runtime 主链。

如果真实 provider 支持 external index root，就应该强制把 index/cache/state 写到 repo 外部并继续通过 detect/start/health。

如果真实 provider 不支持 external index root，就必须在 repo 被污染之前阻断 ready，不允许把 repo-root `.codegraph/` 当 warning 继续使用。

## Allowed Changes

- `server/src/mcp/managed-codegraph/**`
- `server/src/mcp/managed-codegraph/**tests**/**`
- `docs/project-control/tasks/code_T015-codegraph-external-index-root-repo-pollution-control.md`
- `docs/project-control/reviews/code_T015-codegraph-external-index-root-report.md`
- `docs/project-control/project-control-ledger.md`
- `server/test-report/code_T015-codegraph-external-index-root*`

## Forbidden Changes

- Planner
- Normalize
- Policy
- ToolNode
- Evidence
- Generate
- Agent Runtime 主链
- DeepAgents 相关文件
- MicroApps 相关文件
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`

## Acceptance Criteria

1. 明确给出 `CodeGraph 1.3.0` 对 external index root 的支持性结论。
2. 调查至少覆盖：
   - CLI 参数指定 index root / cache root / data dir
   - 环境变量指定 index root / cache root / data dir
   - 配置文件指定 index root / cache root / data dir
   - cwd 与 project root 分离运行
   - `serve --mcp` 是否允许 project root 与 index root 分离
3. 如果 external index root 不支持：
   - provider 不得进入 ready
   - `codebase_explore` 不得启用
   - blocked reason 必须明确说明 repo pollution risk
4. clean repo root 下的 managed CodeGraph 启动必须在污染前被阻断，或能证明不会留下 `.codegraph/`。
5. 已存在 repo-root `.codegraph/` 时不得误删用户文件。
6. repo pollution detected 后 health 不得 ready。
7. `provider unavailable / blocked` 不得被解释成 “empty result”。
8. 任务卡、review/report、`server/test-report` summary、raw outputs、总台账之间必须可追溯。

## Completion Evidence

### Changed Files

- `server/src/mcp/managed-codegraph/types.ts`
- `server/src/mcp/managed-codegraph/planner-exposure-config.ts`
- `server/src/mcp/managed-codegraph/managed-codegraph-process-manager.ts`
- `server/src/mcp/managed-codegraph/codebase-explore.tool.ts`
- `server/src/mcp/managed-codegraph/codegraph-external-index-root-smoke.ts`
- `server/src/mcp/managed-codegraph/index.ts`
- `server/src/mcp/managed-codegraph/__tests__/planner-exposure-config.test.ts`
- `server/src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
- `server/src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts`
- `docs/project-control/tasks/code_T015-codegraph-external-index-root-repo-pollution-control.md`
- `docs/project-control/reviews/code_T015-codegraph-external-index-root-report.md`
- `docs/project-control/project-control-ledger.md`
- `server/test-report/code_T015-codegraph-external-index-root.md`
- `server/test-report/code_T015-codegraph-external-index-root.json`
- `server/test-report/code_T015-codegraph-external-index-root-*.txt`

### Diff Summary

- `planner-exposure-config` 新增了对真实 `codegraph` 命令的 external index root 调查结论，并把“不支持 repo 外部 index root”固定成 repo pollution guard，而不是继续假设 `indexRoot` 环境变量会被 provider 使用。
- `managed-codegraph-process-manager` 现在会在 detect 阶段、start 前，以及 health 返回 ready 前检查 repo pollution risk；一旦需要 repo-root `.codegraph/` 或已经看到 `.codegraph/`，状态立即保持 `blocked`。
- `codebaseExploreTool` 现在会把这类 blocked 明确返回成 provider unavailable / blocked，而不是伪装成“只是没有结果”。
- 新增真实 smoke 脚本，只在临时 repo 上验证 `CODEGRAPH_DIR=<absolute-path>` 仍然会把 `.codegraph/` 写回 repo root，并保留已有 `.codegraph/` 的 sentinel 文件不被删除。

### Acceptance Criteria Evidence

- AC1-2：`server/test-report/code_T015-codegraph-external-index-root.md` 与 `.json` 已记录：
  - `serve --mcp` 无 external index root CLI 参数
  - `CODEGRAPH_DIR` 只是 repo 内目录名，不接受外部绝对路径
  - 当前 docs/source 未暴露 config-file path override
  - cwd 与 project root 可以分离，但不能把 index root 分离到 repo 外
- AC3：`planner-exposure-config.ts` 与 `managed-codegraph-process-manager.ts` 现在会把真实 `codegraph` 命令固定为 `blocked`，`codebase-explore.tool.test.ts` 证明这类状态不会伪装成空结果。
- AC4：`server/test-report/code_T015-codegraph-external-index-root.json` 里的 `cleanRepoPreflightManager` 显示 clean repo 在任何 `init` 之前就已经 `detect/start/health = blocked`。
- AC5：同一份 smoke JSON 里的 `preexistingRepo.sentinelContent = user-owned`，证明已有 `.codegraph/` 未被删除。
- AC6：`managed-codegraph-process-manager.test.ts` 新增 `never reports ready after repo pollution appears before health`，证明 health 不会继续 ready。
- AC7：`codebase-explore.tool.test.ts` 新增 repo pollution risk 用例，`verifiedEvidenceInput.chunkCount = 0` 的同时保留明确 blocked hint，不把 provider unavailable 解释成“查询为空”。
- AC8：本任务卡、review/report、`server/test-report/code_T015-codegraph-external-index-root.*` 和 `project-control-ledger.md` 已互相链接。

## Verification Results

- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/planner-exposure-config.test.ts`
  - 结果：通过，4/4
- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
  - 结果：通过，43/43
- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts`
  - 结果：通过，4/4
- `pnpm --dir server exec tsx src/mcp/managed-codegraph/codegraph-external-index-root-smoke.ts`
  - 结果：通过，summary 与 raw outputs 已写入 `server/test-report/code_T015-codegraph-external-index-root*`
- `pnpm --dir server typecheck`
  - 结果：见本任务原始输出
- `pnpm check`
  - 结果：见本任务原始输出

## Final Conclusion

- 本任务结论：`PASS`
- 说明：`PASS` 指的是 T015 的控制目标已达成，不是说真实 CodeGraph provider 可以继续 ready。
- 真实 `CodeGraph 1.3.0` 的结论是：**不支持可靠 external index root，因此 managed CodeGraph 必须保持 blocked，直到 provider 本身提供 repo 外部 index root 能力。**

## Scope Declaration

- 未改 Planner / Normalize / Policy / ToolNode / Evidence / Generate
- 未改 Agent Runtime 主链
- 未改 DeepAgents / MicroApps
- 未默认启用 `codebase_explore`
- 未把 CodeGraph 原生命令暴露给 Planner
- 未修改 `desktop/src/**`、`electron/**`、`packages/**`
- 未修改 `package.json`
- 未修改 `pnpm-lock.yaml`
