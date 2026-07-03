---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsWriteFileOverwriteApproval
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T006 Write File Overwrite Approval

## Target

让 `write_file` 在目标文件已存在时进入更严格治理，不再直接覆盖落盘。

问题本体：

- `write_file` 目前同时承担新建文件与整文件写入
- 新建文件语义已在 `T005` 收口
- 但覆盖已有文件仍属于高风险写操作，不能与创建文件同级处理

## Allowed Changes

- `edit_file` / `write_file` 覆盖已有文件治理相关实现
- 与已有文件覆盖 `dryRun / approval` 直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成完整 edit action profile 改造
- 顺手修改 `replace_block` 唯一匹配语义
- 顺手引入目录创建 / 删除 / 移动 / 重命名能力

## Acceptance Criteria

1. 目标文件已存在时，`write_file` 进入更严格治理
2. 高风险覆盖不允许直接落盘
3. 覆盖已有文件的结果必须进入 `dryRun` 或明确 approval 流
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P1 / Edit / `write_file` 覆盖治理条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts`

## Implementation Evidence

- `server/src/mcp/edit/runtime.ts`
  - `write_file` 在目标文件已存在且未显式 `dryRun` 时，自动升级为 `dryRun`
  - 覆盖场景追加 `Escalated existing-file overwrite to dry-run` progress 事件
- `server/src/mcp/tools/edit-file.tool.test.ts`
  - 新增已有文件覆盖回归：不落盘、结果 `dryRun: true`、artifact 返回拟写入内容

## Verification Results

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts`
  - 结果：通过，`13 passed`

## Review

- Allowed Changes 内完成
- 未扩散到 action profile、目录改动或其它 Edit 能力

## Notes

- 这张卡不处理创建新文件语义；那已经在 `T005` 完成
- 这张卡不处理 `replace_block` 唯一匹配
