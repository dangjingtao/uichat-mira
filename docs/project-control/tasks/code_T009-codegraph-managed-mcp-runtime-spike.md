---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphManagedMcpRuntimeSpike
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/code_T009-codegraph-managed-mcp-runtime-spike-review.md
  - docs/project-control/tasks/code_T008-codegraph-managed-mcp-runtime-implementation-plan.md
task_state: DONE
---

# code_T009 CodeGraph Managed MCP Runtime Spike

## Target

实现最小 `CodeGraph Managed MCP Runtime Spike`，只验证 CodeGraph process manager 的：

- `detect`
- `start`
- `stop`
- `health`
- MCP handshake
- `status`

本卡不是 wrapper 实现，不是 Planner 接入，不是 Evidence 接入。

## Allowed Changes

- `docs/project-control/tasks/code_T009-codegraph-managed-mcp-runtime-spike.md`
- `docs/project-control/reviews/code_T009-codegraph-managed-mcp-runtime-spike-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/**`
- `server/src/mcp/managed-codegraph/**tests**/**`

## Forbidden Changes

- Planner / Normalize / Policy / ToolNode / Evidence 主链
- Agent Graph routing
- `codebase_explore` wrapper runtime
- Evidence 接线
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`
- 任何非 CodeGraph runtime spike 相关文件

## Acceptance Criteria

1. 新增最小 `ManagedCodeGraphProcessManager`
2. `detect` 支持：
   - binary / package 是否存在
   - version 是否可读
   - telemetry 是否已关闭或可验证关闭
   - `workspaceRoot` / `logRoot` / `indexRoot` 是否可用
3. `start` 支持：
   - 只允许当前 workspace
   - 启动前校验 telemetry
   - 启动前生成 `workspaceHash`
   - 启动时绑定 `logRoot` / `indexRoot`
4. `health` 支持：
   - process alive
   - MCP handshake 或等价 health probe
   - `providerVersion` 可读
   - `telemetryStatus` 可读
   - `workspaceHash` 匹配
5. `stop` 支持：
   - 正常退出
   - 超时后强制终止
   - 记录 `exitCode` / `duration` / `lastStatus`
6. 支持 duplicate start guard：
   - 同一 `workspaceHash + providerVersion + indexRoot` 不允许重复启动
7. 支持 crash handling：
   - crash 后状态进入 `degraded` 或 `failed`
   - 不影响 Agent 主链
8. 支持 `status`：
   - `unavailable`
   - `blocked`
   - `starting`
   - `ready`
   - `degraded`
   - `failed`
   - `stopped`
9. 不让 Planner 看到 CodeGraph
10. 不暴露 `codebase_explore`
11. 不进入 Evidence
12. 不执行 `read_file_slice` verification
13. 不把 CodeGraph raw output 塞进 Trace / Evidence
14. telemetry 无法验证关闭时，状态只能是 `blocked` 或 `unavailable`
15. CodeGraph 不可用时不影响 Agent Runtime 主链
16. 如果当前 CodeGraph 只能写 `.codegraph/`，必须在 review 里记录为 Phase 1 风险，不得假装已满足“不污染 repo”

## Verification

- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
  - purpose: 验证 detect/start/stop/health/duplicate/crash/workspace mismatch/no exposure/no evidence integration
- `pnpm --dir server typecheck`
  - purpose: 验证 `server/src/mcp/managed-codegraph/**` 类型通过
- `pnpm check`
  - purpose: 满足仓库对 runtime 变更的统一检查要求
- `git diff --name-only`
  - purpose: 核对改动范围没有越界
- `git status --short`
  - purpose: 区分本卡改动和任务外既有脏文件

## Evidence

### Changed Files

- `docs/project-control/tasks/code_T009-codegraph-managed-mcp-runtime-spike.md`
- `docs/project-control/reviews/code_T009-codegraph-managed-mcp-runtime-spike-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/index.ts`
- `server/src/mcp/managed-codegraph/types.ts`
- `server/src/mcp/managed-codegraph/managed-jsonrpc-session.ts`
- `server/src/mcp/managed-codegraph/managed-codegraph-process-manager.ts`
- `server/src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
- `server/src/mcp/managed-codegraph/__tests__/fixtures/fake-codegraph-provider.mjs`

### Diff Summary

- 新增隔离目录 `server/src/mcp/managed-codegraph/**`，实现最小 `ManagedCodeGraphProcessManager` 和本地 JSON-RPC session，不接现有 Planner、Evidence、Agent Graph。
- `ManagedCodeGraphProcessManager` 覆盖 `detect/start/health/stop/status`、`workspaceHash`、telemetry gate、duplicate start guard、crash handling 和 workspace mismatch 阻断。
- 新增 fake MCP provider 测试夹具，用真实子进程 + JSON-RPC 行级协议验证 handshake、health、stop、crash 和 duplicate start。
- 新增隔离性测试，明确本 spike 代码不 import Agent / Planner / Evidence / read runtime，也不暴露 `codebase_explore`。
- 新增本任务卡、review 和 ledger 登记。

### Acceptance Criteria Evidence

- AC1：`server/src/mcp/managed-codegraph/managed-codegraph-process-manager.ts` 已新增 `ManagedCodeGraphProcessManager`。
- AC2：`detect()` 会检查 launcher 是否存在、版本 probe 是否可读、telemetry probe 是否验证关闭，以及 `logRoot` / `indexRoot` 可写；测试覆盖 missing provider 和 telemetry blocked。
- AC3：`start()` 只允许 `workspaceRoot === allowedWorkspaceRoot`，启动前走 detect / telemetry gate，预先生成 `workspaceHash`，并把 `CODEGRAPH_LOG_ROOT` / `CODEGRAPH_INDEX_ROOT` 传给受管进程。
- AC4：`health()` 检查子进程是否存活，并通过 `codegraph/health` probe 读取 `providerVersion`、`telemetryStatus` 和 `workspaceHash`。
- AC5：`stop()` 先发 `shutdown`，超时后 `forceKill()`，并记录 `exitCode`、`durationMs`、`lastStatus`。
- AC6：module-level lease registry 以 `workspaceHash + providerVersion + indexRoot` 建 key，重复启动会复用已有健康进程并返回 `startDisposition: reused_existing`。
- AC7：进程异常退出会进入 `degraded` 或 `failed`，并只留在隔离 manager 状态里，不改 Agent 主链。
- AC8：`ManagedCodeGraphRuntimeStatus` 只暴露 `unavailable / blocked / starting / ready / degraded / failed / stopped`。
- AC9-10：隔离性测试断言 runtime source 不出现 `planner`、`codebase_explore`、`agent/` import。
- AC11-13：隔离性测试断言 runtime source 不出现 `evidence`、`read_file_slice`、`read/` import；本卡没有新增 Trace / Evidence 写入代码。
- AC14：telemetry probe 失败时 detect/start 只会落到 `blocked` 或 `unavailable`。
- AC15：health failure / crash 只触发 manager 内部降级，测试标题和实现都不接入 Agent Runtime 主链。
- AC16：`docs/project-control/reviews/code_T009-codegraph-managed-mcp-runtime-spike-review.md` 已明确记录 `.codegraph/` repo 污染仍是 Phase 1 风险，当前 spike 没有把它写成已解决。

## Verification Results

- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
  - 结果：通过，1 个测试文件，10 个测试通过
- `pnpm --dir server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过
- `git diff --name-only`
  - 结果：
    - `docs/project-control/project-control-ledger.md`
    - `server/src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
- `git status --short`
  - 结果：
    - `M docs/project-control/project-control-ledger.md`
    - `M server/src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
    - `?? docs/project-control/reviews/code_T009-codegraph-managed-mcp-runtime-spike-review.md`
    - `?? docs/project-control/tasks/code_T009-codegraph-managed-mcp-runtime-spike.md`

## Unfinished / Risks

- 当前 spike 用 fake provider 验证受管进程生命周期，没有接真实 CodeGraph binary，也没有验证真实 provider 是否会强制写 repo `.codegraph/`。
- 因此“可自定义 `indexRoot` 且不污染 repo”在真实 CodeGraph 上仍未被本卡证明；该风险已要求在 review 中按 Phase 1 风险保留。
- `git ls-files server/src/mcp/managed-codegraph` 显示 `index.ts`、`types.ts`、`managed-jsonrpc-session.ts`、`managed-codegraph-process-manager.ts`、fixture 和 test 路径当前都已被仓库跟踪；本轮 `git diff` 只显示实际与 HEAD 不同的文档和测试文件。
- 当前工作区存在任务外既有脏文件：
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/__tests__/studio-state.test.tsx`
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/hooks/useImageGenerationStudioState.ts`
  - `desktop/src/shared/api/imageGeneration.ts`
  本卡未修改这些文件。

## Scope Declaration

- 未修改 Planner / Normalize / Policy / ToolNode / Evidence 主链
- 未修改 Agent Graph routing
- 未修改 `codebase_explore` wrapper runtime
- 未修改 `desktop/src/**`、`electron/**`、`packages/**`
