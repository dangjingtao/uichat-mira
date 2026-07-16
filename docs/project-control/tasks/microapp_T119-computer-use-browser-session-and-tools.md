---
status: current
priority: P1
owner: microapp / runtime
last_verified: 2026-07-14
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/microapp/computer-use-feature-design.md
  - docs/project-control/tasks/microapp_T118-computer-use-runtime-and-managed-browser.md
  - docs/project-control/tasks/microapp_T112-computer-use-browser-runtime-and-executor.md
task_state: DONE
---

# microapp_T119 Computer Use Browser Session And Tools

## Target

基于 T118 的运行时，建立真正的浏览器 session 和最小浏览器工具能力。对外协议最终包含三个高层工具：

- `browser_observe`
- `browser_act`
- `browser_assert`

本卡实现浏览器 session、页面状态、ref、动作执行和断言，不负责 MCP registry、模型循环或 Debugger 页面。

## Allowed Changes

- `server/src/microapps/computer-use/browser/**`
- `server/src/microapps/computer-use/session/**`
- `server/src/microapps/computer-use/executor/**`
- `server/src/microapps/computer-use/__tests__/browser*.test.ts`
- `server/src/microapps/computer-use/__tests__/session*.test.ts`
- `.test-artifact/computer-use/browser/**`
- `docs/project-control/tasks/microapp_T119-computer-use-browser-session-and-tools.md`

## Forbidden Changes

- `server/src/microapps/computer-use/runtime/**`
- `server/src/mcp/**`
- `server/src/agent/**`
- `desktop/**`
- `electron/**`
- `tauri/**`
- 通用 Harness capability 和工具暴露策略

## Contract

### `browser_observe`

读取当前 URL、标题、accessibility snapshot、可见文本摘要和可选截图，并返回 snapshot hash。

### `browser_act`

执行受控动作：

- `navigate`
- `click`
- `type`
- `select`
- `press`
- `scroll`
- `wait`

每次动作后返回新的页面状态和执行结果。

### `browser_assert`

验证：

- title
- URL
- text
- visible ref
- value

断言失败必须是结构化失败，不得直接把任务标记为成功。

## Acceptance Criteria

1. session 创建、复用、停止和异常关闭都有明确状态。
2. Agent 和 renderer 不接触 Playwright `Page`、`BrowserContext` 或任意执行器对象。
3. 页面元素通过 snapshot 中的 ref 定位，不把任意 CSS selector 作为主协议。
4. 所有导航遵守 allowed domains 和 URL scheme 限制。
5. 每个动作结果包含当前 URL、标题、snapshot hash、错误和 artifact 引用。
6. `browser_act` 不提供任意 JavaScript 或任意 Playwright code execution。
7. T118 未提供可用 runtime 时，session 返回明确阻塞状态。

## Verification

- `pnpm exec vitest run src/microapps/computer-use/__tests__/browser*.test.ts src/microapps/computer-use/__tests__/session*.test.ts`
  - workdir: `server`
- 覆盖公开页面导航、文本读取、动作失败、ref 失效、域名越界、超时和 session stop。
- 覆盖截图和结构化结果进入 `.test-artifact/computer-use/browser/**`。

## Owned Test Scope

- session lifecycle
- observe output
- action dispatch
- assert output
- ref and snapshot hash
- domain boundary
- timeout and cleanup

## Dependencies

- T118 提供可用 runtime record 和 executable path。
- T120 只能消费本卡的 browser service，不得把 Playwright 细节复制到 MCP tool 文件。

## Evidence

- Changed files:
  - `server/src/microapps/computer-use/browser/types.ts`
  - `server/src/microapps/computer-use/browser/service.ts`
  - `server/src/microapps/computer-use/session/manager.ts`
  - `server/src/microapps/computer-use/__tests__/browser.service.test.ts`
  - `server/src/microapps/computer-use/__tests__/session.manager.test.ts`
- Session manager owns Playwright browser/context/page objects and exposes only session info and structured tool results.
- Browser service implements observe, navigate/click/type/select/press/scroll/wait actions, title/URL/text/visible/value assertions, ref-to-internal-selector resolution, snapshot hash checks, allowed scheme/domain checks, structured failures, and screenshot artifacts.
- `pnpm exec vitest run ...` in `server`: 4 files, 19 tests passed, including existing T118/T112 tests.
- `pnpm check`: all workspace typechecks passed.
- `git diff --check`: passed. Test artifacts are scoped to `.test-artifact/computer-use/browser/**`.

### Review Follow-up

- Implemented `sessionTimeoutMs` with resettable timers, browser/context cleanup, `stopped` transition, and removal from the active session table.
- Applied `actionTimeoutMs` to navigation, click, type, select, press, scroll, and wait; same-session actions are serialized through an action queue.
- Action failures now recover the current page state and include its snapshot hash when observation is available.
- `maxSnapshotChars` is passed through observation state collection and covered by a regression test.
- Follow-up verification: 4 computer-use test files, 22 tests passed; T119-specific tests cover timeout, cleanup, recovered snapshot hash, truncation, and serialization.
- Current workspace `server pnpm typecheck` is blocked by unrelated pre-existing errors in `server/src/db/repositories/mail-messages.repository.ts` (2 errors) and `server/src/routes/microapps/index.ts` (1 error). No T119 file is named in those diagnostics.
- No real browser binary smoke was run in this follow-up; launcher behavior remains covered with injected mock browser objects.

### Review Follow-up 2

- Timeout errors now retain the underlying Playwright operation promise. The action queue is released only after that promise settles, so a timed-out operation cannot overlap the next action.
- Navigation uses the same pending-operation handling, while click/type/select/press/scroll pass the native Playwright timeout and use the shared timeout guard.
- Added a regression test proving that a timed-out underlying click keeps the next action from starting until the underlying promise resolves.
- Final verification: 4 computer-use test files, 23 tests passed; `pnpm check` passed; `git diff --check` passed.
- Real browser binary smoke remains unexecuted; tests use injected mock launcher/page objects.
