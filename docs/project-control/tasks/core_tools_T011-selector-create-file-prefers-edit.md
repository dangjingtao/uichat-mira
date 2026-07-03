---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsSelectorCreateFilePrefersEdit
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
task_state: READY_FOR_REVIEW
---

# core_tools_T011 Selector Create File Prefers Edit

## Target

让 “新建 / 创建 / 写入文件” 这类意图优先命中 `Edit`，而不是 `Terminal`。

问题本体：

- `Edit` 已经具备真实文件创建 / 写入能力
- 如果 selector 继续把这类语义优先交给 Terminal，会放大高风险 process 能力
- 这类语义应该优先收敛到 `edit_file`

## Allowed Changes

- selector / tool routing 中与创建文件语义召回直接相关的实现
- 与 “创建文件意图不召回 Terminal” 直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成全量 selector 重写
- 顺手重排所有能力域优先级
- 顺手改 Terminal runtime 或 Edit runtime 实现

## Acceptance Criteria

1. “新建 / 创建 / 写入文件” 语义优先映射到 `Edit`
2. 同类意图不再优先召回 `Terminal`
3. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P1 / Selector 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/intent/*.test.ts`

## Notes

- 这张卡不处理 Read / Web Search 的 selector 降权规则

## Evidence

- 代码：
  - `server/src/agent/intent/task-capability-selector.ts`
  - `server/src/agent/intent/task-capability-selector.test.ts`
- 结果：
  - “创建文件”与结构化“写入文件”语义都会优先选择 `workspace_edit`
  - 对应 tool 解析里，这类文件写请求优先落到 `edit_file`
  - 普通写作请求不会被这条规则误收进文件编辑
- 验证：
  - `pnpm --filter @ui-chat-mira/server typecheck`
    - 结果：通过
  - `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/read-locate.tool.test.ts src/agent/intent/task-capability-selector.test.ts`
    - 结果：通过，`13 passed`
