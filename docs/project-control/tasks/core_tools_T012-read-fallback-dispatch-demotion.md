---
status: current
priority: P2
owner: runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: CoreToolsReadFallbackDispatchDemotion
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/read-skill-design.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T012 Read Fallback Dispatch Demotion

## Target

让 `read` 从普通首选工具退回为 fallback / dispatch / 兼容入口，不再抢精细 Read 工具的语义位置。

## Allowed Changes

- `read` 与其它 Read 工具优先级相关的 selector / routing 实现
- 与 `read` 降权直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成整组 Read 工具重写
- 顺手新增第七个 Read 工具
- 顺手修改 `read_open` / `read_extract` / `read_locate` 的 runtime 主体实现

## Acceptance Criteria

1. `read` 不再作为精细工具首选
2. 明确 path 时优先 `read_open`
3. 明确 range 时优先 `read_extract`
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P2 / Read / `read` 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/intent/*.test.ts src/mcp/tools/read*.test.ts`

## Notes

- 这张卡不处理 `read_slice` 暴露面；那是独立任务

## Implementation Evidence

- `server/src/mcp/harness/exposure.ts`
  - `read` 已从 `agent_intent` / `chat_surface` 工具暴露面隐藏，仅保留在 `tools_list`
- `server/src/agent/intent/task-capability-selector.ts`
  - `read` 在 Read 工具优先级中持续降权
  - 明确 path/open 请求优先 `read_open`
  - 明确 range 请求优先 `read_extract`

## Verification Results

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/exposure.test.ts src/agent/intent/task-capability-selector.test.ts`
  - 结果：包含在定向测试集中通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

## Review

- Allowed Changes 内完成
- 未修改 `read_open` / `read_extract` / `read_locate` runtime 主体实现
