---
status: current
priority: P3
owner: runtime
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: CoreToolsWorkspaceMutationBoundaryRetention
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T019 Workspace Mutation Boundary Retention

## Target

继续保持 Workspace Mutation 与 `edit_file` 的边界隔离，不把目录创建 / 删除 / 移动 / 重命名混进 `edit_file`。

## Allowed Changes

- `edit_file` 与 Workspace Mutation 边界约束相关文档与验证
- 与边界隔离直接相关的测试或契约检查
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 借机实现 Workspace Mutation 新能力
- 顺手扩写 `edit_file` 支持目录/移动/删除
- 顺手重写 Edit action profile

## Acceptance Criteria

1. `edit_file` 不承接目录创建 / 删除 / 移动 / 重命名
2. Workspace Mutation 边界在文档与验证中明确保留
3. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P3 / Workspace Mutation 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts src/agent/intent/__tests__/task-capability-selector.test.ts`

## Notes

- 这张卡是边界保留任务，不是新能力开发任务

## Evidence

- 代码：
  - `server/src/mcp/edit/runtime.ts`
  - `server/src/mcp/tools/edit-file.tool.test.ts`
- 结果：
  - `edit_file` 继续只承接 `write_file / replace_block`
  - `delete / move` 这类 Workspace Mutation 语义不会被 `edit_file` 承接
  - 目录路径与目录目标会被显式拒绝，继续保持 Workspace Mutation 边界隔离
- 验证：
  - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts src/agent/intent/__tests__/task-capability-selector.test.ts`
    - 结果：通过，`30 passed`
  - `pnpm --filter @ui-chat-mira/server typecheck`
    - 结果：通过
  - 说明：
    - 任务卡原测试 glob `src/agent/**/*.test.ts` 在当前仓库已不能覆盖迁移后的 `src/agent/intent/__tests__/task-capability-selector.test.ts`，因此验证命令同步收敛为当前真实测试路径
