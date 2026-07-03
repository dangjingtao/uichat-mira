---
status: current
priority: P2
owner: runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: CoreToolsTerminalExecuteCommandActionProfile
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/terminal-capability-checklist.md
  - docs/tooling-runtime/tools-protocol.md
task_state: DONE
---

# core_tools_T015 Terminal Execute Command Action Profile

## Target

为 Terminal 增加 `terminal_execute_command` action profile，同时保持真实 runtime tool 仍映射到 `terminal_session`。

## Allowed Changes

- Terminal action profile 与 runtime tool 映射相关实现
- 与 action profile 映射直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成 Terminal runtime 生命周期重写
- 顺手增加新的 Terminal runtime tool
- 顺手修改 approval / cwd / timeout 既有治理

## Acceptance Criteria

1. `terminal_execute_command` action profile 存在
2. runtime tool 仍映射到 `terminal_session`
3. action profile 到 runtime tool 的映射可验证
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P2 / Terminal 条目

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/**/*.test.ts src/mcp/**/*.test.ts`

## Notes

- 这张卡不新增 session 管理型 LLM 工具

## Implementation Evidence

- `server/src/mcp/harness/action-profiles.ts`
  - 新增 `terminal_execute_command` action profile
  - 映射到 runtime tool `terminal_session`
- `server/src/mcp/harness/capability-profiles.ts`
  - Terminal capability profile 现在携带 `actionProfileId`
- `server/src/mcp/harness/capability-diagnostics.ts`
  - diagnostics 结果现在返回 action profile 元数据

## Verification Results

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/action-profiles.test.ts src/mcp/harness/capability-profiles.test.ts src/mcp/harness/capability-diagnostics.test.ts`
  - 结果：包含在定向测试集中通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

## Review

- Allowed Changes 内完成
- 未新增新的 Terminal runtime tool，未改 approval / cwd / timeout 既有治理
