---
status: current
priority: P1
owner: microapp
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T020-computer-use-parallel-code-isolation.md
  - docs/microapp/computer-use-microapp-poc.md
task_state: DONE
---

# microapp_T112 Computer Use Browser Runtime And Executor

## Target

实现 `computer_use` 的浏览器运行时管理和浏览器执行器，包括受管 Chromium 检查、本机浏览器探测、按需下载入口，以及基于 Playwright 的最小动作执行。

本卡不改领域核心、不写 Fastify route、不改 desktop。

## Allowed Changes

- `server/package.json`
- `server/build.js`
- `server/src/microapps/computer-use/runtime/**`
- `server/src/microapps/computer-use/executor/**`
- `server/src/microapps/computer-use/__tests__/runtime*.test.ts`
- `server/src/microapps/computer-use/__tests__/executor*.test.ts`
- `.test-artifact/computer-use/**`
- `docs/project-control/tasks/microapp_T112-computer-use-browser-runtime-and-executor.md`

## Forbidden Changes

- `server/src/microapps/computer-use/core/**`
- `server/src/microapps/computer-use/index.ts`
- `server/src/routes/**`
- `server/src/db/**`
- `desktop/**`
- `electron/**`
- `tauri/**`

## Code Placement

- 浏览器运行时发现、下载、元数据登记放在 `server/src/microapps/computer-use/runtime/`
- Playwright 动作执行器放在 `server/src/microapps/computer-use/executor/`
- 测试临时文件只允许写到 `.test-artifact/computer-use/**`

## Acceptance Criteria

1. 运行时管理明确支持三段策略：
   - 优先受管 Chromium
   - 其次本机 Chrome / Edge
   - 最后按需下载受管 Chromium
2. 下载、解压、校验和版本登记都在 `runtime/**`，不依赖 Electron / Tauri 执行下载逻辑。
3. 执行器只实现第一阶段最小动作集：`navigate`、`click`、`type`、`scroll`、`wait_for`、`capture`、`finish`。
4. `runtime/**` 和 `executor/**` 不 import `fastify`、React、Electron 或页面代码。
5. 定向测试覆盖运行时选择策略、下载入口保护和最小动作执行编排。
6. 测试临时文件只写入 `.test-artifact/computer-use/**`。
7. 打包后的 server 产物明确包含可解析的 `playwright-core` 运行库，不依赖开发工作区 `.pnpm` 路径。
8. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/microapps/computer-use/__tests__/runtime*.test.ts src/microapps/computer-use/__tests__/executor*.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证运行时策略和最小动作执行
- `rg -n "from \\\"fastify\\\"|from \\\"react\\\"|from \\\"electron\\\"|window\\.desktopApi" server/src/microapps/computer-use/runtime server/src/microapps/computer-use/executor`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查运行时和执行器没有越界依赖
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围
- `pnpm build`
  - workdir: `D:/workspace/rag-demo/server`
  - purpose: 验证后端 bundle 和 `playwright-core` 产物复制契约
- `Get-Content .artifacts/server-bundle/package.json`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查后端产物依赖声明已包含 `playwright-core`
- `Test-Path .artifacts/server-bundle/node_modules/playwright-core/package.json`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查打包产物内确实存在 `playwright-core` 运行库

## Owned Test Scope

- `server/src/microapps/computer-use/__tests__/runtime*.test.ts`
- `server/src/microapps/computer-use/__tests__/executor*.test.ts`
- 运行时选择策略、下载入口保护、最小动作执行编排和 `.test-artifact/computer-use/**` 产物边界
- 不覆盖领域状态机、HTTP 状态码映射或 desktop shared API

## Evidence

- Changed files:
  - `server/package.json`
  - `server/build.js`
  - `server/src/microapps/computer-use/runtime/manager.ts`
  - `server/src/microapps/computer-use/runtime/types.ts`
  - `server/src/microapps/computer-use/executor/playwright.ts`
  - `server/src/microapps/computer-use/executor/runner.ts`
  - `server/src/microapps/computer-use/executor/types.ts`
  - `server/src/microapps/computer-use/__tests__/runtime.manager.test.ts`
  - `server/src/microapps/computer-use/__tests__/executor.runner.test.ts`
  - `docs/project-control/tasks/microapp_T112-computer-use-browser-runtime-and-executor.md`

- Diff summary:
  - 为 `@ui-chat-mira/server` 明确声明 `playwright-core` 依赖，避免 `computer_use` 执行器只依赖开发工作区里碰巧存在的 Playwright 包。
  - 更新 `server/build.js`，把 `playwright-core` 加入后端产物依赖清单、bundle external 列表和复制步骤，并优先按 `.pnpm/node_modules/<pkg>` 的真实解析路径复制实际运行会命中的包版本。
  - 新增运行时管理器，支持受管 Chromium 优先、本机 Chrome / Edge 兜底探测、以及按需下载受管 Chromium 的三段选择策略。
  - 新增下载实现，负责 `http/https` 下载入口校验、逐 zip entry 路径校验、受控解压、SHA-256 校验和元数据登记，逻辑全部留在 `runtime/**`。
  - 新增仓库内 Playwright launcher 绑定入口，优先加载 `playwright-core` / `playwright`，必要时回退到工作区已安装的 `.pnpm` 模块路径。
  - 新增基于 Playwright launcher 的最小动作执行器，覆盖 `navigate`、`click`、`type`、`scroll`、`wait_for`、`capture`、`finish` 七类动作。
  - 新增定向测试，覆盖运行时策略、下载入口保护、压缩包目录穿越拦截、真实 Playwright 绑定解析，以及截图产物路径必须留在 `.test-artifact/computer-use/**`。

- Verification results:
  - `pnpm exec vitest run src/microapps/computer-use/__tests__/runtime.manager.test.ts src/microapps/computer-use/__tests__/executor.runner.test.ts`
    - workdir: `D:/workspace/rag-demo/server`
    - result: `2` 个测试文件、`8` 个测试全部通过
  - `pnpm exec tsx -`
    - workdir: `D:/workspace/rag-demo/server`
    - purpose: 直接加载 `src/microapps/computer-use/executor/playwright.ts`，验证仓库内默认 Playwright launcher 绑定可解析
    - result: 输出 `function`
  - `pnpm typecheck`
    - workdir: `D:/workspace/rag-demo/server`
    - result: 通过
  - `pnpm build`
    - workdir: `D:/workspace/rag-demo/server`
    - result: 通过，`.artifacts/server-bundle/node_modules/playwright-core/**` 已写入产物
  - `Get-Content .artifacts/server-bundle/package.json`
    - workdir: `D:/workspace/rag-demo`
    - result: 产物依赖已包含 `"playwright-core": "^1.61.1"`
  - `Test-Path .artifacts/server-bundle/node_modules/playwright-core/package.json`
    - workdir: `D:/workspace/rag-demo`
    - result: `True`
  - `Get-ChildItem server/src/microapps/computer-use/runtime,server/src/microapps/computer-use/executor -Recurse -Filter *.ts | Select-String -Pattern 'from "fastify"|from "react"|from "electron"|window\.desktopApi'`
    - workdir: `D:/workspace/rag-demo`
    - result: 无匹配，未发现越界依赖
  - `pnpm check`
    - workdir: `D:/workspace/rag-demo`
    - result: 通过

- Verification notes:
  - 任务卡原命令 `pnpm --filter @ui-chat-mira/server exec vitest run ...` 在当前仓库里无法找到 `vitest` 可执行入口，因此改用等价的 `server` 包内命令 `pnpm exec vitest run ...` 做定向验证。
  - 本轮经项目 owner 明确批准，额外扩 scope 到 `server/package.json` 和 `server/build.js`，目的是把 `playwright-core` 从“开发工作区里碰巧可解析”提升为 server 打包契约。
  - 本轮已补真实 launcher 解析和调用入口，但没有在任务卡范围内新增浏览器二进制安装或真实页面 smoke；当前证据聚焦于“可解析 launcher + 可启动执行链路代码路径 + 定向动作编排与安全边界”。
  - 本轮额外把 `playwright-core` 升级为 server 打包契约：server 自身声明依赖，构建产物 `package.json` 明确记录依赖，`server/build.js` 明确复制模块进入 `.artifacts/server-bundle/node_modules`，不再把开发工作区 `.pnpm` 路径当成打包前提。

## Unfinished / Risks

- 本卡只负责浏览器场景，不负责浏览器插件、宿主桌面控制或登录态迁移。
- 如果实现线程发现需要壳层提供用户目录路径，只能通过可注入路径接口协作，不能顺手改 Electron / Tauri 代码。
- 本轮没有同步更新 `pnpm-lock.yaml`，因为项目规则禁止手工改 lock，且本次批准范围只扩到 `server/package.json`、`server/build.js` 和任务卡；如果后续要走干净安装或冻结锁文件流程，需要单独补 lockfile 同步验证。

## Isolation Rules

- 本卡不能修改 `core/**` 或 route，即使发现接口不顺手，也只能通过明确接口契约协作。
- 本卡是唯一允许新增 `.test-artifact/computer-use/**` 产物的线程。
