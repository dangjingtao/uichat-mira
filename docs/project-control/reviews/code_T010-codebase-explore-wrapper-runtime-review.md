---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodebaseExploreWrapperRuntimeReview
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md
  - docs/project-control/tasks/code_T007-codegraph-wrapper-contract.md
  - docs/project-control/tasks/code_T008-codegraph-managed-mcp-runtime-implementation-plan.md
  - docs/project-control/tasks/code_T009-codegraph-managed-mcp-runtime-spike.md
  - docs/project-control/project-control-ledger.md
---

# code_T010 Codebase Explore Wrapper Runtime Review

## Scope

本 review 只审查 `server/src/mcp/managed-codegraph/**` 内的最小 wrapper runtime：

- scope inference
- include / exclude path 约束
- internal command selection
- result trimming
- candidate normalization
- fallback signal

不在本 review 范围内：

- Planner 暴露
- Agent Graph routing
- Evidence 接线
- `read_file_slice` verification bridge
- Trace / telemetry 扩展
- 普通 Agent 默认启用

## What This Runtime Proves

1. `codebase_explore` 的 wrapper 逻辑可以继续留在 `managed-codegraph` 隔离目录内落地，而不碰 Planner / Evidence / Agent Graph。
2. 我们已经把 `scope -> include/exclude -> command -> normalized candidates` 这一层从 docs 合同变成了可测 runtime 代码。
3. broad explore 噪声、无 line range、provider query failed 这三类不稳定结果，已经能在 wrapper 层被显式降级，而不是被当成结论向上冒充事实。

## What This Runtime Does Not Prove

1. Planner 已经可以调用 `codebase_explore`。
2. candidate 已经可以进入 Evidence。
3. follow-up `read_file_slice` verification 已经接好。
4. 完整 fallback 链已经自动执行。
5. 真实 CodeGraph binary 的结果质量已经足够稳定。

所以，T010 的结论仍然是“内部 wrapper runtime 成立”，不是“主链接入已经完成”。

## Review Findings

### 1. Scope inference 已经可测，不再只是文档约束

- `agent-runtime`
- `harness-mcp`
- `microapps`
- `docs`
- `workspace-general`

这些 scope 都有定向测试，不再只停留在合同文本里。

### 2. Wrapper 没有把 provider 原始输出直接抛给上层

- provider payload 先过 `CodebaseCandidate` 归一化
- 统一补 `verification.required = true`
- 统一补 `verification.status = pending`
- broad explore / missing line range / query failed 都会留下明确 limitation

这保证上层拿到的是“候选事实入口”，不是 raw dump。

### 3. 降级语义现在是人话的，不是假装仓库没有

- query failed -> `degraded`
- broad explore 噪声高 -> `partial`
- 无 line range -> 低置信候选 + `requires_follow_up_read`

这满足了“查不稳时直接暴露不确定性”，而不是假装“没实现”。

### 4. 隔离边界仍然守住了

- 没有改 Planner 暴露面
- 没有改 Agent Graph routing
- 没有接 Evidence
- 没有执行 `read_file_slice` verification
- 没有把 fallback 链偷偷补成主流程自动执行

## Remaining Gaps

1. 当前 wrapper 还是内部 runtime，尚未挂到 Planner capability exposure。
2. fallback signal 只是结构化输出，还没有真正驱动 `search_text / workspace_inventory / read_file_slice`。
3. 真实 CodeGraph binary 的结果噪声和 `.codegraph/` repo 污染风险，仍然要沿用 `code_T009` 的 Phase 1 风险记录。

## Recommended Next Steps

1. `code_T011` 再做 verification bridge，把候选原文核验独立接上。
2. `code_T012` 再做 Trace / Evidence 粒度控制，不要在 T010 提前混进主链。
3. `code_T013` 之前不要让普通 Agent 默认启用这个能力。

## Review Conclusion

结论：`通过`

理由：

- wrapper runtime 最小能力已经成立
- scope、裁剪、降级和候选合同都已从文档落到测试
- 隔离边界仍然成立，没有越界接 Planner 或 Evidence
