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
  - docs/microapp/computer-use-microapp-poc.md
  - docs/project-control/tasks/microapp_T020-computer-use-parallel-code-isolation.md
task_state: DONE
---

# microapp_T118 Computer Use Runtime And Managed Browser

## Target

把浏览器运行时从“可按参数下载”提升为用户可实际使用的运行时能力：优先复用受管 Chromium 和本机 Chrome / Edge；都不存在时，应用使用固定、可校验的受管 Chromium 包完成安装，或明确返回可解释的阻塞原因。

本卡只负责运行时发现、默认包配置、下载、校验、安装和状态，不负责浏览器动作、MCP 工具、模型调用或新 UI。

## Allowed Changes

- `server/src/microapps/computer-use/runtime/**`
- `server/src/microapps/computer-use/__tests__/runtime*.test.ts`
- `server/src/package.json` 或 `server/package.json`（仅 runtime 依赖，如确有需要）
- `.test-artifact/computer-use/runtime/**`
- `docs/project-control/tasks/microapp_T118-computer-use-runtime-and-managed-browser.md`

## Forbidden Changes

- `desktop/**`
- `electron/**`
- `tauri/**`
- `server/src/mcp/**`
- `server/src/agent/**`
- `server/src/microapps/computer-use/executor/**`
- `server/src/microapps/computer-use/core/**`
- DB schema 和通用任务持久化

## Acceptance Criteria

1. 明确并测试运行时选择顺序：受管 Chromium、本机 Chrome / Edge、无运行时。
2. 固定受管 Chromium 的版本、下载来源、可执行文件相对路径和 SHA-256，不要求用户填写下载 URL。
3. 下载、解压、路径穿越防护、校验、metadata 登记和重复复用均有定向测试。
4. 没有可用运行时时，状态明确为 `not_installed` 或等价阻塞状态。
5. 安装失败必须返回具体错误，不得伪装为 runtime ready。
6. 安装完成后重新探测可得到 executablePath，并能被后续执行器消费。
7. 测试产物只能写入 `.test-artifact/computer-use/runtime/**`。

## Verification

- `pnpm exec vitest run src/microapps/computer-use/__tests__/runtime*.test.ts`
  - workdir: `server`
- `pnpm typecheck`
  - workdir: `server`
- 检查默认运行时配置不依赖页面传入的任意下载地址。
- 检查无浏览器环境、已安装系统浏览器、已安装受管浏览器三种状态。

## Owned Test Scope

- runtime discovery priority
- managed package metadata
- download and checksum
- archive path safety
- installation failure
- missing-runtime status

## Unfinished / Risks

- 本卡不决定浏览器动作协议。
- 本卡不负责把 Chromium 二进制直接打进安装包；是否内置二进制由后续打包决策另行确认。
- 下载来源必须是受信任的固定配置，不允许用任意用户输入替代产品配置。

## Evidence

- Changed files:
  - `server/src/microapps/computer-use/runtime/types.ts`
  - `server/src/microapps/computer-use/runtime/manager.ts`
  - `server/src/microapps/computer-use/__tests__/runtime.manager.test.ts`
  - `docs/project-control/tasks/microapp_T118-computer-use-runtime-and-managed-browser.md`
- 固定受管包为 Chrome for Testing `152.0.7948.0` Windows 64 位包，配置包含官方 Google Storage URL、`chrome-win64/chrome.exe` 和已实测 SHA-256。
- 运行时选择顺序为受管 Chromium、本机 Chrome / Edge、`not_installed`。
- 安装支持 HTTP 状态错误、下载异常、SHA-256 校验、zip entry 路径穿越防护、受控解压、可执行文件确认、metadata 登记、metadata 校验和重复复用；失败不会登记为 ready。
- `pnpm exec vitest run src/microapps/computer-use/__tests__/runtime.manager.test.ts`（server）通过，1 个测试文件、11 个测试全部通过。
- `pnpm typecheck`（server）通过。
- T118 修复后 runtime 测试为 11/11，server `pnpm typecheck` 单独通过；重跑 workspace `pnpm check` 时无关的 `desktop` TypeScript 进程以 Windows 退出码 `3221225477` 中断，其他已运行 workspace 包和 server typecheck 无诊断通过。
- `git diff --check` 通过；测试产物仅使用 `.test-artifact/computer-use/runtime/**`，本轮未留下该目录外的 runtime 测试产物。
