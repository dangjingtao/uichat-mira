---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsReplaceBlockUniqueMatch
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T007 Replace Block Unique Match

## Target

让 `replace_block` 只在 `expectedOldText` 恰好唯一匹配时执行替换。

问题本体：

- `replace_block` 当前只要存在一次命中就会替换
- 这会让多命中场景产生不确定修改
- 局部替换的安全前提，是旧内容匹配必须唯一

## Allowed Changes

- `replace_block` 唯一匹配相关实现
- 与 `expectedOldText` 唯一匹配直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 `write_file` 覆盖治理
- 顺手引入复杂 patch engine
- 顺手修改其它 Edit capability 选择逻辑

## Acceptance Criteria

1. `0` 次匹配必须拒绝
2. `2` 次及以上匹配必须拒绝
3. 只允许恰好一次匹配成功替换
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P1 / Edit / `replace_block` 唯一匹配条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts`

## Implementation Evidence

- `server/src/mcp/edit/runtime.ts`
  - `replace_block` 现在要求 `expectedOldText` 非空且恰好唯一命中
  - `0` 次命中继续拒绝，`2` 次及以上命中新增拒绝 `expectedOldText must match exactly once`
- `server/src/mcp/tools/edit-file.tool.test.ts`
  - 新增多命中失败回归

## Verification Results

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/edit-file.tool.test.ts`
  - 结果：通过，`13 passed`

## Review

- Allowed Changes 内完成
- 未顺手改 `write_file` 之外的 Edit 语义选择逻辑

## Notes

- 这张卡不处理 `write_file` 创建或覆盖语义
