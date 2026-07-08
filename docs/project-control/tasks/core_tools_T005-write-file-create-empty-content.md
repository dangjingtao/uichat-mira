---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CoreToolsWriteFileCreate
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T005 Write File Create Empty Content

## Target

明确 `write_file` 支持创建新文件，并且 `content: ""` 作为合法内容处理。

问题本体：

- `edit_file` 当前是唯一真实 Edit runtime tool
- `write_file` 既承担新建文件，也承担整文件写入
- 如果空字符串被当成缺参，会破坏“创建空文件”这个基础语义

## Allowed Changes

- `edit_file` / `write_file` 创建文件语义直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成覆盖已有文件审批/确认链改造
- 顺手修改 `replace_block` 唯一匹配语义
- 顺手引入目录创建 / 删除 / 移动 / 重命名能力

## Acceptance Criteria

1. 文件不存在 + `write_file` 时可以创建文件
2. `content: ""` 必须被视为合法输入，不得当作缺失参数
3. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P1 / Edit `write_file` 创建文件条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server exec vitest run src/mcp/tools/edit-file.tool.test.ts`
  - 结果：通过，`17 passed`

## Implementation Evidence

- `server/src/mcp/edit/runtime.ts`
  - `executeNodeWriteFile` 以 `typeof args.content === "string"` 判定合法内容，空字符串不会被误判为缺参
- `server/src/mcp/tools/edit-file.tool.test.ts`
  - 现有用例覆盖创建非空文件
  - 现有用例覆盖 `content: ""` 时创建空文件且结果 `bytes = 0`
- `docs/tooling-runtime/core-tool-rectification-ledger.md`
  - `P1 / Edit / T005` 条目已回填，确认本卡只覆盖“新建文件语义”和“空内容合法性”

## Risks / Deferred

- 本任务没有处理“覆盖已有文件必须 dryRun 或确认”；那是台账中的下一项独立整改
- 本任务没有新增 `edit_create_file` action profile；那是 P2 的语义入口整改
- 本任务不处理 `replace_block` 或目录级变更；这些仍属于后续独立任务范围

## Review Outcome

- 当前提交结论：评审通过
- 当前状态：`DONE`
- 评审结论：
  - `AC1` 已满足：文件不存在时，`write_file` 可以创建新文件
  - `AC2` 已满足：`content: ""` 被视为合法输入，不会误判为缺失参数
  - `AC3` 已满足：台账已对齐 `P1 / Edit`
  - 验证补充：`pnpm --filter @ui-chat-mira/server typecheck` 通过；`pnpm --filter @ui-chat-mira/server exec vitest run src/mcp/tools/edit-file.tool.test.ts` 通过，`17 passed`
  - 非阻断说明：本卡只确认创建语义与空内容合法性，不处理已有文件覆盖审批，也不处理 `replace_block` 唯一匹配或目录级变更
