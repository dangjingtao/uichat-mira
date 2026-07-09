---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphControlledPlannerExposure
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/code_T013-codegraph-controlled-planner-exposure-review.md
  - docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md
  - docs/project-control/tasks/code_T011-codegraph-verification-bridge.md
  - docs/project-control/tasks/code_T012-codegraph-trace-diagnostics.md
task_state: DONE
---

# code_T013 CodeGraph Controlled Planner Exposure

## Target

把 `managed-codegraph` 的隔离能力最小接入到 Planner，但只允许通过受控 `codebase_explore` 工具暴露，且默认关闭。

本任务要证明的是：

- Planner 可以在 flag 打开时看到受控 `codebase_explore`
- `use_tool` 仍然必须经过 `normalize -> policy -> toolNode -> harness`
- 只有 verification bridge 产出的 verified chunk 能进入 Evidence

本任务不允许做的是：

- 暴露 CodeGraph 原生命令
- 绕过既有 Agent Graph 主链
- 放宽未核验候选进入 Evidence 的边界

## Allowed Changes

- `docs/project-control/tasks/code_T013-codegraph-controlled-planner-exposure.md`
- `docs/project-control/reviews/code_T013-codegraph-controlled-planner-exposure-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/**`
- `server/src/harness/**`
- `server/src/agent/**`
- 相关测试文件

## Forbidden Changes

- Planner 大提示词重写
- Agent Graph 主路由重写
- CodeGraph 原生命令直接暴露
- 未核验 candidate 直接进入 Evidence
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`

## Acceptance Criteria

1. `code_T009`、`code_T010`、`code_T011`、`code_T012` 已完成并可作为前置。
2. 只暴露 `codebase_explore`，不暴露 `codegraph/query`、`codegraph/explore`、`codegraph/affected` 等原生命令。
3. Planner 暴露默认关闭，必须经过 feature flag 控制。
4. flag 关闭时，Planner 看不到 `codebase_explore`。
5. flag 打开时，Planner 只能看到受控 `codebase_explore` schema。
6. `use_tool` 仍然必须经过 Normalize。
7. Policy 仍然可以 allow / deny / require_approval。
8. ToolNode 仍然只执行 frozen `pendingToolCall`。
9. `selectedToolIds` 仍然不能直接触发 CodeGraph。
10. unverified candidate 不得进入 Evidence。
11. verified candidate 必须经过 verification bridge。
12. provider unavailable / telemetry blocked 时必须回退，不得伪装成“没结果”。
13. broad explore 噪声场景只能是 partial / degraded，不能直接装成 answer-ready。
14. trace 必须能看出 exposure / provider / verification / fallback。
15. 不大改 Planner prompt 和 Agent Graph routing。
16. 不修改 `package.json` 和 `pnpm-lock.yaml`。

## Completion Evidence

### Changed Files

- `docs/project-control/tasks/code_T013-codegraph-controlled-planner-exposure.md`
- `docs/project-control/reviews/code_T013-codegraph-controlled-planner-exposure-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/agent/nodes/tool-node.ts`
- `server/src/agent/__tests__/codebase-explore-tool-node.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/harness/runtime.ts`
- `server/src/harness/runtime.test.ts`
- `server/src/harness/profiles/resolver.ts`
- `server/src/mcp/managed-codegraph/codebase-explore.tool.ts`
- `server/src/mcp/managed-codegraph/planner-exposure-config.ts`
- `server/src/mcp/managed-codegraph/codegraph-trace-diagnostics.ts`
- `server/src/mcp/managed-codegraph/index.ts`
- `server/src/mcp/managed-codegraph/types.ts`
- `server/src/mcp/managed-codegraph/__tests__/planner-exposure-config.test.ts`
- `server/src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts`

### Diff Summary

- 新增 `codebase_explore` 受控工具定义和 `UI_CHAT_CODEGRAPH_PLANNER_ENABLED` 开关，默认不注册、不暴露。
- Harness runtime 只在 flag 打开时注册 `codebase_explore`，且 schema 只保留 `query`，不把 CodeGraph 原生命令暴露给 Planner。
- `managed-codegraph` 正式 runtime 不再默认写 repo `.artifacts`；现在优先解析 `UI_CHAT_CODEGRAPH_APP_DATA_ROOT`，其次复用现有 `UI_CHAT_LOG_DIR / UI_CHAT_DATABASE_DIR` 的 app-data 父目录；如果解析不到 app-data root，就明确返回 blocked provider 状态，不再静默回退到 repo。
- `toolNode` 现在会识别 `codebase_explore` 结果，只把 verification bridge 已核验通过的 chunk 写入 Retrieval Evidence；verified 为空时不写入 Retrieval Evidence。
- `codebase_explore` 产出的 retrieval summary 现在固定 `answerReadiness.canAnswer = false`，只说明“verified chunks are available for planner review”，由 Planner 后续结合 task coverage 决定是否完成。
- `CodebaseExploreTrace` 补了 `exposureMode`，让 trace 能直接看出这是 feature-flag 控制下的受控 Planner 暴露。
- 新增定向测试，覆盖 flag off / on、受控 schema、app-data root 解析、default no-repo-fallback、verified-only Evidence、Planner 不会因为 verified explore chunk 自动 answer，以及 provider blocked fallback。

### Acceptance Criteria Evidence

- AC1：`code_T009`~`code_T012` 任务卡均已是 `task_state: DONE`，总台账中已有完成索引。
- AC2-5：`server/src/mcp/managed-codegraph/codebase-explore.tool.ts` 只定义 `codebase_explore`；`server/src/harness/runtime.ts` 只在 flag 打开时注册；`server/src/harness/runtime.test.ts` 覆盖 flag off / on 和 schema 断言。
- AC6：Planner 产出的 `use_tool` 仍由既有 `toolCallNormalizeNode` 处理，本任务没有改 Normalize 路由；相关主链测试继续适用。
- AC7-8：本任务没有改 `policy-node.ts` 的 allow / deny / require_approval 逻辑，也没有改 ToolNode 的 frozen `pendingToolCall` 入口条件；`tool-node.ts` 仍然先校验 frozen call 再执行。
- AC9：本任务没有改 `selectedToolIds` 到执行链的关系；既有 `toolcall-loop-regression` 与 `tool-node` 测试合同继续适用。
- AC10-11：`server/src/agent/nodes/tool-node.ts` 只在 `verifiedEvidenceInput.chunkCount > 0` 时 append Retrieval Evidence；`codebase-explore-tool-node.test.ts` 覆盖 verified-only 与 zero-verified 两条路径。
- AC12-13：`codebase-explore.tool.ts` 仍复用 wrapper + verification bridge；`planner-exposure-config.test.ts` 覆盖 default no-repo-fallback、显式 app-data root、复用现有 log dir 父目录三条路径；`codebase-explore.tool.test.ts` 覆盖 app-data root 缺失时 `indexStatus = blocked`、telemetry blocked / provider unavailable 时 `degraded + fallback` 且 `chunkCount = 0`。
- AC14：`codegraph-trace-diagnostics.ts` 和 `codebase-explore.tool.ts` 产出 `exposureMode + explore trace + verification trace`；测试断言 trace 中能看到 controlled exposure 与 fallback。
- AC15：未修改 `server/src/agent/planner/prompt.ts` 和 `server/src/agent/graph/routes.ts`。
- AC16：未修改 `package.json`；`pnpm-lock.yaml` 未被本任务改动。
- 阻断问题 A：已整改，正式 runtime 默认不再写 repo `.artifacts`，app-data root 缺失时 provider 明确 blocked。
- 阻断问题 B：已整改，`codebase_explore` verified chunk 只作为 planner review evidence，不能单独触发 answer-ready。

## Verification Results

- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/planner-exposure-config.test.ts src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts src/agent/__tests__/codebase-explore-tool-node.test.ts src/agent/__tests__/next-action-planner.test.ts`
  - 结果：通过，4 个测试文件，91 个测试通过
- `pnpm --dir server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过

## Scope Declaration

- 未大改 Planner prompt
- 未大改 Agent Graph routing
- 未暴露 CodeGraph 原生命令
- 未放宽未核验 candidate 进入 Evidence 的边界
- 未修改 `desktop/src/**`、`electron/**`、`packages/**`
- 未修改 `package.json`
- 未修改 `pnpm-lock.yaml`
