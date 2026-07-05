---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-05
layer: project-control
module: Sandbox
feature: L1WorkspaceSandboxRunner
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/harness/sandbox-module.md
  - docs/harness/harness-phase-1-implementation-checklist.md
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - server/src/sandbox/executor.ts
  - server/src/mcp/terminal-sessions.ts
  - server/src/harness/sandbox/index.ts
task_state: READY_FOR_REVIEW
---

# T-012 L1 Workspace Sandbox Runner

## Target

把 Sandbox 推进到 L1 Workspace Sandbox 最小可用能力。

L1 范围：

- cwd 锁 workspace
- env 白名单
- timeout 硬上限
- output limit
- 基础 kill tree
- result contract

## Allowed Changes

- `server/src/sandbox/executor.ts`
- `server/src/sandbox/executor.test.ts`
- `server/src/harness/sandbox/**`
- `server/src/harness/sandbox.test.ts`
- `server/src/mcp/tools/terminal-session.tool.ts`
- `server/src/mcp/tools/terminal-session.tool.test.ts`
- `server/src/mcp/terminal-sessions.ts`
- 与本任务直接相关的当前台账文档更新

## Forbidden Changes

- renderer / desktop UI
- Electron / Tauri 启动链路
- backend route path contract
- packaging scripts
- `pnpm-lock.yaml`
- Docker / VM / AppContainer 方向

## Acceptance Criteria

1. cwd `"."` 成功。
2. cwd 子目录成功。
3. cwd `"../"` blocked。
4. cwd `"C:\"` blocked。
5. 空 cwd 默认 workspaceRoot。
6. env 不含未白名单变量。
7. timeout 返回 `timed_out`。
8. 巨量输出 `truncated=true`。
9. 中文 echo 不崩。
10. exitCode 非 0 不伪装成功。
11. sandbox unavailable / L1 不满足时，`terminal_session` 不进入 `agent_intent` 暴露结果。

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/harness/exposure.test.ts src/mcp/tools/terminal-session.tool.test.ts src/harness/sandbox.test.ts src/harness/sandbox/index.test.ts src/sandbox/executor.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`5` files, `71` tests)
- `pnpm --filter @ui-chat-mira/server bench:sandbox:direct D:\workspace\rag-demo`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
  - summary:
    - `total: 7`
    - `passed: 6`
    - `failed: 0`
    - `notImplemented: 1`
- `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: passed

## Evidence

- Changed files:
  - `server/src/sandbox/executor.ts`
  - `server/src/sandbox/executor.test.ts`
  - `server/src/harness/sandbox/index.ts`
  - `server/src/harness/sandbox/index.test.ts`
  - `server/src/harness/sandbox/bench/cases.ts`
  - `server/src/harness/exposure.test.ts`
  - `server/src/mcp/terminal-sessions.ts`
  - `server/src/mcp/tools/terminal-session.tool.test.ts`
  - `docs/project-control/tasks/T-012-l1-workspace-sandbox-runner.md`
  - `docs/project-control/agent-workboard.md`
  - `docs/harness/sandbox-module.md`
  - `docs/harness/harness-phase-1-implementation-checklist.md`
  - `docs/tooling-runtime/core-tool-rectification-ledger.md`

- Diff summary:
  - `SandboxExecutor` 现在拒绝 `..`、绝对路径和 Windows 绝对路径形式的 `cwd`，空 `cwd` 归一到 workspace root。
  - `SandboxExecutor` 的 env 只从白名单构造，覆盖项也必须命中白名单；不再允许任意 env 进入子进程。
  - `SandboxExecutor` 对 `timeoutMs` 和 `outputLimitBytes` 增加执行层硬上限。
  - `SandboxExecutor` result 增加 `truncated` 和 `violations`，direct contract 会回传这些字段。
  - timeout 时 result 会记录 timed out violation；Windows 下记录 kill tree best-effort limitation。
  - `server/src/harness/sandbox/index.ts` 新增 L1 workspace runner status；`command` profile 只有在所有 L1 requirement 通过时才是 `implemented`。
  - persistent PTY 创建路径复用 sandbox cwd/env 入口，避免全量 `process.env` 进入 PTY。
  - direct contract 测试补齐 L1 验收项：`.`、子目录、`../`、`C:\`、空 cwd、env、timeout、巨量输出、中文输出、非零 exitCode、完整 result 字段、Windows limitation。
  - exposure 测试覆盖 sandbox unavailable / L1 不满足时 `terminal_session` 不进入 `agent_intent`。

- Acceptance criteria evidence:
  - AC1: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:53) 覆盖 cwd `"."`。
  - AC2: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:66) 覆盖 cwd 子目录。
  - AC3: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:98) 覆盖 cwd `".."`。
  - AC4: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:113) 覆盖 cwd `"C:\"`。
  - AC5: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:81) 覆盖空 cwd 默认 workspace root。
  - AC6: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:128) 覆盖非白名单 env 不透传。
  - AC7: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:144) 覆盖 `timed_out`。
  - AC8: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:190) 覆盖 `truncated=true`。
  - AC9: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:151) 覆盖中文输出。
  - AC10: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:163) 覆盖非零 exitCode 返回 `failed`。
  - AC11: [exposure.test.ts](/D:/workspace/rag-demo/server/src/harness/exposure.test.ts:75) 覆盖 L1 command sandbox unavailable 时不暴露 `terminal_session`。
  - L1 status gate: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:43) 覆盖任意 L1 requirement 缺失时 status 为 unavailable。
  - Windows limitation: [index.test.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.test.ts:147) 覆盖 Windows timeout result 包含 `windows_kill_tree_best_effort`，且不会返回 `completed`。

## Unfinished / Risks

- 当前仍是桌面轻量执行层，不是 Docker / VM / AppContainer 级强隔离。
- Windows kill tree 通过 `taskkill /t /f` best-effort 处理，timeout result 已记录 limitation。
- persistent PTY 已复用 cwd/env 边界，但仍未完全并入 `SandboxExecutor` 的 process/result 模型。
- `read_only`、`workspace_write`、`networked_command` profile 仍未落地，direct bench 继续显式标为 `not_implemented`。

## Review Outcome

- 评审结论：待复评
- 当前状态：`READY_FOR_REVIEW`
