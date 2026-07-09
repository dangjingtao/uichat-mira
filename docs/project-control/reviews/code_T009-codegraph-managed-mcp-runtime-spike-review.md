---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphManagedMcpRuntimeSpikeReview
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T009-codegraph-managed-mcp-runtime-spike.md
  - docs/project-control/tasks/code_T008-codegraph-managed-mcp-runtime-implementation-plan.md
  - docs/project-control/project-control-ledger.md
---

# code_T009 CodeGraph Managed MCP Runtime Spike Review

## Scope

本 review 只审查最小 `ManagedCodeGraphProcessManager` runtime spike：

- `detect`
- `start`
- `health`
- MCP handshake
- `stop`
- `status`
- duplicate start guard
- crash handling

不在 scope 内：

- Planner 暴露
- `codebase_explore` wrapper
- Evidence 接线
- `read_file_slice` verification
- Trace 集成
- Agent Graph routing
- 真实 CodeGraph 生产接入

## What The Spike Proves

这次 spike 已证明：

1. 我们可以在 `server/src/mcp/managed-codegraph/**` 隔离目录内，把最小 managed process lifecycle 做成可测单元，而不碰 Planner / Evidence / Agent Graph。
2. 受管进程可以在启动前执行 launcher/version/telemetry/root 检测，并在启动后走 MCP initialize + health probe。
3. runtime status、duplicate start guard、workspace mismatch、crash handling、graceful stop / forced stop 都可以在 manager 层成立。
4. CodeGraph provider 不可用时，manager 只会返回 `unavailable / blocked / degraded / failed` 之类的 provider 状态，不会把失败向上扩散成 Agent 主链改造。

## What The Spike Does Not Prove

这次 spike 没有证明：

1. 真实 CodeGraph binary 在当前仓库里能按同样 contract 工作。
2. 真实 CodeGraph 一定支持把索引完全绑定到外部 `indexRoot`。
3. 真实 CodeGraph 一定不会把索引或中间状态写进仓库 `.codegraph/`。
4. Planner、wrapper、verification、Evidence、Trace 的后续任务已经可以跳过。

因此，本卡结论只能是“最小 lifecycle spike 成立”，不是“真实 CodeGraph runtime 已可直接接入”。

## Review Findings

### 1. Scope isolation is preserved

- 新代码全部落在 `server/src/mcp/managed-codegraph/**`
- 没有修改 Planner / Normalize / Policy / ToolNode / Evidence / Agent Graph
- 没有新增 `codebase_explore` 暴露
- 没有接 `read_file_slice` verification
- 没有把 raw output 写入 Trace / Evidence

### 2. Telemetry gate is enforced early

- detect 阶段无法验证 telemetry 关闭时，状态只会是 `blocked` 或 `unavailable`
- start 阶段不会绕过 detect gate 强行进入 `ready`
- 这满足 T008 对 telemetry policy 的最小 runtime 要求

### 3. Duplicate start guard is real, not文档口头约束

- lease key 基于 `workspaceHash + providerVersion + indexRoot`
- 重复 start 会复用已有健康进程并返回 `reused_existing`
- 没有并发抢主权的第二个同 key 进程

### 4. Crash handling stays local

- crash 后状态降为 `degraded` 或 `failed`
- manager 只更新自己的状态快照和退出信息
- 没有新增任何 Agent 主链 fallback/shim/compatibility 逻辑

## Phase 1 Risk Record

### Repo pollution risk is still open

如果真实 CodeGraph 当前只能写仓库 `.codegraph/`，那“不污染 repo”这一条目前并没有被 T009 证明。

这必须继续记为 Phase 1 风险，不能写成“已满足”：

- 当前 spike 只证明 manager 可以把 `indexRoot` 作为受管配置传给 provider
- 当前 spike 没有在真实 CodeGraph binary 上验证 provider 是否真的遵守这个 `indexRoot`
- 当前 spike 也没有证明真实 provider 不会额外写 `.codegraph/`

后续至少需要在真实 provider 验证任务里把这条补齐；在那之前，review 结论只能保持风险开放。

## Recommended Next Steps

1. `code_T010` 只在保留当前隔离边界的前提下实现 wrapper runtime，不让 Planner 直接看到 provider 原生命令。
2. `code_T011` 才能去做 `followUpReads` / `read_file_slice` verification bridge。
3. 在真实 CodeGraph binary 验证前，不要把 “repo 不污染” 写进已满足条目。

## Review Conclusion

结论：`通过`

理由：

- 最小 managed runtime spike 已成立
- 隔离边界符合 T009 范围
- 真实 CodeGraph provider 行为，尤其 `.codegraph/` repo 污染风险，仍需后续任务验证

是否允许进入 `code_T010`：允许
