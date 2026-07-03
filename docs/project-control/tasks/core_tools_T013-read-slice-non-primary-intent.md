---
status: current
priority: P2
owner: runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: CoreToolsReadSliceNonPrimaryIntent
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/read-skill-design.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T013 Read Slice Non Primary Intent

## Target

让 `read_slice` 退出普通用户意图首选，只用于已有读取结果的窗口化处理。

## Allowed Changes

- `read_slice` 意图暴露面与前置条件相关的 selector / routing 实现
- 与 `read_slice` 不作为普通首选直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 Read 全链路重写
- 顺手把 `read_slice` 改回 path-based 文件入口
- 顺手修改 `read_extract` 或 `read_open` 主体语义

## Acceptance Criteria

1. `read_slice` 不作为普通用户意图首选
2. 无 `sourceId` / `previousResultId` 时不应优先选择 `read_slice`
3. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P2 / Read / `read_slice` 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/intent/*.test.ts src/mcp/tools/read*.test.ts`

## Notes

- 这张卡不处理 `read` fallback 降权；那是独立任务

## Implementation Evidence

- `server/src/mcp/harness/exposure.ts`
  - `read_slice` 已从 `agent_intent` / `chat_surface` 工具暴露面隐藏，仅保留在 `tools_list`
- `server/src/agent/intent/node.ts`
  - `read_slice` 被纳入显式目标守卫集合，避免无目标时被直接放行
- `server/src/agent/intent/task-capability-selector.ts`
  - `read_slice` 不再作为普通打开/定位意图首选

## Verification Results

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/exposure.test.ts src/agent/intent/task-capability-selector.test.ts`
  - 结果：包含在定向测试集中通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

## Review

- Allowed Changes 内完成
- 未把 `read_slice` 改回 path-based 文件入口
