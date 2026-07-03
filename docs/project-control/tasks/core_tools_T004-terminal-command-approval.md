---
status: current
priority: P0
owner: runtime
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CoreToolsTerminalApproval
doc_type: task-card
canonical: true
related:
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - docs/tooling-runtime/core-tool-matrix-review.md
  - docs/tooling-runtime/tools-protocol.md
  - docs/tooling-runtime/terminal-capability-checklist.md
task_state: DONE
---

# core_tools_T004 Terminal Command Approval

## Target

确保 `terminal_session.command` 始终经过 approval / policy gate，不因 session 复用而绕过。

问题本体：

- Terminal 默认高风险
- command 是核心字段，但不应直接落地执行
- `attachSessionId` 复用已有 session 不等于自动继承执行权限

## Allowed Changes

- `terminal_session` approval / policy gate 相关实现
- 与 terminal command approval 直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成完整 approval 持久化系统重写
- 顺手修改 Terminal 的 LLM-facing 输入面
- 顺手引入 session/thread 级 grant 全模型

## Acceptance Criteria

1. `terminal_session.command` 进入明确的 approval / policy gate
2. 新 command 不允许直接执行
3. 复用已有 session 的新 command 仍然要过 approval / policy gate
4. 台账回填：
   - 对应 `core-tool-rectification-ledger.md` P0 / Terminal approval

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/terminal-session.tool.test.ts src/mcp/core/invocations.test.ts`
  - 结果：通过，`2` 个测试文件、`22` 个测试通过

## Notes

- 这张卡不要求一次做完 session/thread 级持久化 grant
- 这张卡只要求 command 执行不绕过当前 gate

## Evidence

- Changed files:
  - `server/src/mcp/core/permissions.ts`
  - `server/src/mcp/core/invocations.test.ts`
  - `docs/tooling-runtime/core-tool-rectification-ledger.md`
  - `docs/tooling-runtime/terminal-capability-checklist.md`
  - `docs/project-control/tasks/core_tools_T004-terminal-command-approval.md`
- Diff summary:
  - Added a narrow clarification comment in Harness approval evaluation for the invocation-bound approval rule.
  - Added a regression test covering “same `attachSessionId`, different `command`” and asserting it still returns `awaiting_approval`.
  - Backfilled the P0 terminal approval ledger item and approval-specific checklist note with the new regression evidence.
- Acceptance criteria evidence:
  - AC1: `terminal_session.command` remains gated by Harness preflight approval because `requiresApproval` is enforced in `evaluateInvocationApproval`.
  - AC2: A new command without an exact approved invocation returns `awaiting_approval`, covered by `src/mcp/core/invocations.test.ts`.
  - AC3: Reusing an existing session with a changed `command` still returns `awaiting_approval`, covered by the new regression test.
  - AC4: `core-tool-rectification-ledger.md` P0 / Terminal approval is now backfilled to done with evidence.

## Unfinished / Risks

- This task intentionally does not introduce session-level or thread-level durable approval grants.
- `pnpm check` and `pnpm package:electron:win` were not run in this task package because the requested scope is a focused terminal approval regression and the workspace already contains many unrelated in-progress changes.

## Review Outcome

- 评审结论：通过
- 当前状态：`DONE`
- 结论依据：
  - Terminal command approval remains invocation-bound, not session-bound
  - `attachSessionId` 复用不会自动批准新的 `command`
