---
status: current
priority: P2
owner: runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: CoreToolsEditActionProfiles
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T016 Edit Action Profiles

## Target

为 Edit 增加 `edit_create_file` / `edit_overwrite_file` / `edit_replace_block` action profile，并统一映射到底层 `edit_file`。

## Allowed Changes

- Edit action profile 与 runtime tool 映射相关实现
- 与三个 action profile 映射直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 Edit runtime 重写
- 顺手引入删除/移动/重命名/批量修改
- 顺手改变现有 `edit_file` 风险治理语义

## Acceptance Criteria

1. 三个 action profile 存在
2. 最终都映射到 `edit_file`
3. action profile 到 runtime tool 的映射可验证
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P2 / Edit 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/**/*.test.ts src/mcp/tools/edit*.test.ts`

## Notes

- 这张卡不引入 Workspace Mutation 新能力

## Implementation Evidence

- `server/src/mcp/harness/action-profiles.ts`
  - 新增 `edit_create_file` / `edit_overwrite_file` / `edit_replace_block`
  - 三者统一映射到 runtime tool `edit_file`
- `server/src/mcp/harness/capability-profiles.ts`
  - `workspace_edit` capability profile 现在携带 action profile 元数据
- `server/src/mcp/harness/capability-diagnostics.ts`
  - diagnostics 结果现在返回 Edit action profile 元数据

## Verification Results

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/action-profiles.test.ts src/mcp/harness/capability-profiles.test.ts src/mcp/harness/capability-diagnostics.test.ts`
  - 结果：包含在定向测试集中通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

## Review

- Allowed Changes 内完成
- 未引入删除/移动/重命名/批量修改等新能力
