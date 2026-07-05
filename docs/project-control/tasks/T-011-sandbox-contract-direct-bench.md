---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-05
layer: project-control
module: Harness
feature: SandboxDirectBench
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/harness/sandbox-module.md
  - docs/harness/harness-phase-1-implementation-checklist.md
  - server/src/harness/sandbox/contract.ts
  - server/src/harness/sandbox/bench/runner.ts
task_state: READY_FOR_REVIEW
---

# T-011 Sandbox Contract Direct Bench

## Target

补齐一条绕过 Agent 的 Sandbox direct bench，并把最小 contract 独立出来。

问题本体：

- 现有 `SandboxExecutor` 已有 executor 级输入输出接口和单测
- 但任务卡要求的是 direct bench，不是 executor unit test
- 需要独立的 bench request/result contract、可运行 runner、结构化 JSON 输出
- 做不到的 profile 不能伪装通过，必须明确标记 `not_implemented`

## Allowed Changes

- `server/src/harness/sandbox/**`
- `server/src/harness/sandbox.ts`
- `server/package.json`
- `docs/harness/sandbox-module.md`
- `docs/harness/harness-phase-1-implementation-checklist.md`
- 与本任务直接相关的当前台账文档更新

## Forbidden Changes

- `server/src/agent/**`
- Planner
- `read_list`
- AgentGraph
- Docker / VM / AppContainer 方向
- 用 executor 单测冒充 direct bench 交付

## Acceptance Criteria

1. 存在独立的 bench contract，不直接复用 executor result 充当 bench result
2. 存在 direct bench runner，可直接运行并输出结构化 JSON
3. bench 明确绕过 Agent / LLM / Planner / Tool Selection / `read_list` / Generate
4. bench 至少覆盖：
   - 正向：`echo hello`、中文输出、非零 `exitCode`
   - 负向：`cwd` 越界、超短 `timeout`、巨量输出
5. 当前做不到的项会明确标为 `not_implemented`

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/harness/sandbox.test.ts src/harness/sandbox/index.test.ts src/sandbox/executor.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`3` files, `19` tests)
- `pnpm --filter @ui-chat-mira/server bench:sandbox:direct D:\workspace\rag-demo`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
  - summary:
    - `total: 8`
    - `passed: 7`
    - `failed: 0`
    - `notImplemented: 1`
- `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
- `pnpm package:electron:win`
  - workdir: `D:/workspace/rag-demo`
  - result: failed outside this task's modified scope
  - failure summary:
    - desktop 既有测试断言不匹配：`src/shared/uchat/ui/UChatSidebarView.test.tsx`
    - server 既有测试缺少 `xlsx` 依赖
    - server 既有测试缺少 `thread-request-context-web-search.resolver.js`
    - 构建阶段既有清理失败：`.artifacts/server-bundle/node_modules/better-sqlite3` `ENOTEMPTY`

## Evidence

- Changed files:
  - `server/src/harness/sandbox/contract.ts`
  - `server/src/harness/sandbox/index.ts`
  - `server/src/harness/sandbox/index.test.ts`
  - `server/src/harness/sandbox/bench/cases.ts`
  - `server/src/harness/sandbox/bench/runner.ts`
  - `server/src/harness/sandbox/bench/README.md`
  - `server/src/harness/sandbox.ts`
  - `server/package.json`
  - `docs/harness/sandbox-module.md`
  - `docs/harness/harness-phase-1-implementation-checklist.md`
  - `docs/project-control/tasks/T-011-sandbox-contract-direct-bench.md`
  - `docs/project-control/agent-workboard.md`

- Diff summary:
  - 在 `server/src/harness/sandbox/contract.ts` 新增 bench 级 `SandboxRunRequest / SandboxRunResult / SandboxBenchReport`
  - 在 `server/src/harness/sandbox/index.ts` 新增 direct 调用入口，把 executor 结果转换为 bench contract
  - 在 `server/src/harness/sandbox/bench/runner.ts` 新增可执行 runner，输出结构化 JSON
  - 在 `server/src/harness/sandbox/bench/cases.ts` 新增正向、负向和 coverage case，并把未落地 profile 明确标成 `not_implemented`
  - 在 `server/package.json` 新增 `bench:sandbox:direct` 脚本入口
  - 在 `server/src/harness/sandbox.ts` 补齐已有 harness sandbox POC 测试依赖的模块入口

- Acceptance criteria evidence:
  - AC1:
    - [contract.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/contract.ts:11) 定义 `SandboxRunRequest`
    - [contract.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/contract.ts:21) 定义 `SandboxRunResult`
    - [contract.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/contract.ts:46) 定义 `SandboxBenchReport`
    - 这些 contract 不等同于 executor 的 `SandboxExecutionInput / SandboxExecutionResult`
  - AC2:
    - [runner.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/runner.ts:6) 可直接运行
    - [runner.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/runner.ts:11) 输出 `SandboxBenchReport` JSON
    - [server/package.json](/D:/workspace/rag-demo/server/package.json:15) 提供 `bench:sandbox:direct` 脚本入口
  - AC3:
    - [README.md](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/README.md:3) 明确 bench 绕过 `LLM / Planner / Tool Selection / read_list / Generate`
    - [index.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.ts:65) bench 直接进入 `executeSandboxedCommand(...)`
  - AC4:
    - [cases.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/cases.ts:51) 正向 `echo hello`
    - [cases.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/cases.ts:73) 正向中文输出
    - [cases.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/cases.ts:95) 正向非零 `exitCode`
    - [cases.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/cases.ts:117) 负向 `cwd` 越界
    - [cases.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/cases.ts:142) 负向超短 `timeout`
    - [cases.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/cases.ts:164) 负向巨量输出
  - AC5:
    - [index.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.ts:17) 明确 profile 覆盖表
    - [index.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/index.ts:41) 统一生成 `not_implemented` violation
    - [cases.ts](/D:/workspace/rag-demo/server/src/harness/sandbox/bench/cases.ts:190) `read_only` case 明确返回 `not_implemented`

## Unfinished / Risks

- 当前只把 `command` profile 做实。
- 下面这些 profile 仍未落地，但 bench 已明确暴露，不会伪装成通过：
  - `read_only`
  - `workspace_write`
  - `networked_command`
- `pnpm package:electron:win` 当前仍被仓内既有问题阻断，这次任务没有改动这些故障点。
- 未触碰 forbidden area：没有改 `AgentGraph`、Planner、`read_list`，也没有引入 Docker / VM / AppContainer。

## Review Outcome

- 评审结论：待复评
- 当前状态：`READY_FOR_REVIEW`
- Review 01 跟进：
  - 打回意见指出“没有 direct bench runner / bench contract / JSON 输出 / not_implemented 标记”
  - 当前工作区实际已补：
    - 独立 bench contract：`server/src/harness/sandbox/contract.ts`
    - 独立 direct bench runner：`server/src/harness/sandbox/bench/runner.ts`
    - 结构化 JSON 输出：runner 直接 `console.log(JSON.stringify(report, null, 2))`
    - `not_implemented` 标记：profile coverage 与 coverage case 已显式输出
  - 当前需要的是基于最新工作区重做复评，而不是继续沿用缺少 bench 层的旧结论
