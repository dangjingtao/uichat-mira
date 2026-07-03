---
status: current
priority: P3
owner: runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: CoreToolsObservabilityTraceDebugPanelContract
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/harness-runtime-design.md
task_state: DONE
---

# core_tools_T018 Observability Trace Debug Panel Contract

## Target

保持 trace span 查询链可用，并明确其可供 Debug Panel 观察工具调用链。

## Allowed Changes

- trace span 查询与 Debug Panel 契约直接相关实现
- 与 invocation trace 查询直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成全量 observability 平台改造
- 顺手修改工具执行语义
- 顺手改 approval / routing 主流程

## Acceptance Criteria

1. Trace 查询链继续可用
2. invocation trace 查询有自动化验证
3. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P3 / Observability 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/core/*.test.ts src/mcp/harness/*.test.ts`

## Notes

- 这张卡不新增新的 trace 后端

## Implementation Evidence

- `server/src/mcp/core/definitions.ts`
  - `McpInvocationTrace` 新增 `debugView` 合同字段
- `server/src/mcp/core/traces.ts`
  - trace 现在会维护 `debugView` 聚合视图：`spanCount` / `runningSpanCount` / `kinds`
- `server/src/mcp/core/invocations.test.ts`
  - 补了 trace `debugView` 自动化断言
- `server/src/mcp/routes.test.ts`
  - `/mcp/invocations/:id/trace` 已验证返回 `debugView`

## Verification Results

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/core/invocations.test.ts src/mcp/routes.test.ts`
  - 结果：包含在定向测试集中通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

## Review

- Allowed Changes 内完成
- 未扩散到全量 observability 平台改造
