---
status: current
priority: P0
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsTerminalInputSurface
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
  - docs/tooling-runtime/terminal-capability-checklist.md
task_state: DONE
---

# core_tools_T003 Terminal LLM Input Surface

## Target

收窄 `terminal_session` 的 LLM-facing 输入面，隐藏高风险 runtime/session 管理字段。

问题本体：

- `terminal_session` 能力本身成立
- 当前风险不在能力不足，而在输入面太宽
- `env` / `attachSessionId` / `sessionMode` 不应由模型自由生成

## Allowed Changes

- `terminal_session` 的 LLM-facing 输入 schema 或 action profile 暴露面
- 与 `env` / `attachSessionId` / `sessionMode` 隐藏直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把 `terminal_session` 拆成多个真实 runtime tool
- 顺手重做 terminal runtime 生命周期
- 顺手引入新的 session 管理工具

## Acceptance Criteria

1. LLM-facing Terminal 输入面不再直接暴露 `env`
2. LLM-facing Terminal 输入面不再直接暴露 `attachSessionId`
3. LLM-facing Terminal 输入面不再直接暴露 `sessionMode`
4. runtime 侧仍可由 Harness / policy 内部使用这些字段
5. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P0 / Terminal 输入面

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/harness/exposure.test.ts src/routes/proxy-provider/chat-tool-surface.test.ts src/mcp/tools/terminal-session.tool.test.ts`
- 结果：
  - `resolveHarnessToolExposure` 验证 `tools_list` 仍保留完整 runtime schema
  - `resolveHarnessToolExposure` 验证 `agent_intent` 不再暴露 `env` / `attachSessionId` / `sessionMode`
  - `terminal_session` 既有 persistent / attach / env 相关 runtime 测试继续覆盖内部能力未回退

## Notes

- 这张卡不处理 `cwd` workspaceBound
- 这张卡不处理 `timeoutMs` 限幅
- 这张卡不处理 command approval
