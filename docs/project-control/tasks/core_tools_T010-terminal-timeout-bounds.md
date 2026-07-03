---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsTerminalTimeoutBounds
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/terminal-capability-checklist.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T010 Terminal Timeout Bounds

## Target

让 `terminal_session.timeoutMs` 进入明确的限幅治理。

问题本体：

- Terminal 命令可能长时间阻塞
- `timeoutMs` 如果没有明确边界，会制造无限长任务或异常长阻塞
- timeout 需要稳定默认值和上限行为

## Allowed Changes

- `terminal_session.timeoutMs` 归一化 / 限幅相关实现
- 与 timeout 默认值和边界处理直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 persistent session 生命周期重写
- 顺手修改 Terminal approval 逻辑
- 顺手引入新的 session 管理工具

## Acceptance Criteria

1. `timeoutMs` 具备稳定默认值
2. 小于下限时有明确处理
3. 大于上限时 `clamp` 或拒绝
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P1 / Terminal / `timeoutMs` 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/terminal-session.tool.test.ts`

## Implementation Evidence

- `server/src/mcp/terminal/runtime.ts`
  - 现有 `normalizeTimeoutMs()` 继续作为默认值/上下限治理实现：
    - default `2000`
    - min `100`
    - max `60000`
- `server/src/mcp/tools/terminal-session.tool.test.ts`
  - 新增默认 timeout 回归
  - 新增低于下限时 clamp 回归
  - 新增高于上限时 clamp 回归

## Verification Results

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/terminal-session.tool.test.ts`
  - 结果：通过，测试包含在终端定向集内，总计 `18 passed`

## Review

- 本卡以测试补强和证据回填为主
- 未扩到 persistent session 生命周期或 approval 语义

## Notes

- 这张卡不处理 `cwd` workspace boundary
