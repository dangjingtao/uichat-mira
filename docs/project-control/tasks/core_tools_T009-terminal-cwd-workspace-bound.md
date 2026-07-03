---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsTerminalCwdWorkspaceBound
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/terminal-capability-checklist.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T009 Terminal Cwd Workspace Bound

## Target

让 `terminal_session.cwd` 严格受 `workspaceRoot` 约束。

问题本体：

- Terminal 默认高风险
- `cwd` 是真实执行环境的一部分
- 如果 `cwd` 越界，Terminal 会绕开当前工作区边界

## Allowed Changes

- `terminal_session` 的 `cwd` workspace boundary 相关实现
- 与 `cwd` 越界拒绝直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 approval 系统改造
- 顺手修改 Terminal 的 LLM-facing 输入面
- 顺手重做 terminal runtime 生命周期

## Acceptance Criteria

1. 所有 `cwd` resolve 后必须仍在 `workspaceRoot` 内
2. workspace 内 `cwd` 可以正常执行
3. 越界 `cwd` 必须拒绝
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P1 / Terminal / `cwd` 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/terminal-session.tool.test.ts src/mcp/core/invocations.test.ts`

## Implementation Evidence

- `server/src/mcp/workspace.ts`
  - 新增 `resolveWorkspaceDirectoryPath()`，对 `cwd` 执行目录存在性、目录类型、`realpath` 后 workspace 边界校验
- `server/src/sandbox/executor.ts`
  - ephemeral terminal `cwd` 统一改走 `resolveWorkspaceDirectoryPath()`
- `server/src/mcp/terminal-sessions.ts`
  - persistent PTY session `cwd` 统一改走 `resolveWorkspaceDirectoryPath()`
- `server/src/mcp/tools/terminal-session.tool.test.ts`
  - 新增 workspace 内 `cwd` 成功
  - 新增越界 `cwd` 拒绝

## Verification Results

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/terminal-session.tool.test.ts src/mcp/core/invocations.test.ts`
  - 结果：通过，`27 passed`

## Review

- Allowed Changes 内完成
- 未改 Terminal LLM-facing 输入面，未触碰 approval 生命周期

## Notes

- 这张卡不处理 `timeoutMs` 限幅
- 这张卡不处理 command approval；那已经在 `T004` 收口
