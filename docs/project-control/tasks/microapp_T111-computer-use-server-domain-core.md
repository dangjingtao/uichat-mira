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
  - docs/microapp/computer-use-feature-design.md
task_state: DONE
---

# microapp_T111 Computer Use Server Domain Core

## Target

实现 `computer_use` 的 server 领域核心，只负责统一任务生命周期、领域对象、审批节点、执行计划和服务编排。

本卡不直接实现 Playwright 执行器、不写 Fastify route、不改 desktop。

## Allowed Changes

- `server/src/microapps/computer-use/core/**`
- `server/src/microapps/computer-use/index.ts`
- `server/src/microapps/computer-use/__tests__/core*.test.ts`
- `docs/project-control/tasks/microapp_T111-computer-use-server-domain-core.md`

## Forbidden Changes

- `server/src/microapps/computer-use/runtime/**`
- `server/src/microapps/computer-use/executor/**`
- `server/src/routes/**`
- `server/src/db/**`
- `desktop/**`

## Code Placement

- 统一领域类型放在 `server/src/microapps/computer-use/core/types.ts`
- 统一状态机放在 `server/src/microapps/computer-use/core/task-lifecycle.ts`
- 计划与审批对象放在 `server/src/microapps/computer-use/core/planning.ts`
- 领域服务放在 `server/src/microapps/computer-use/core/service.ts`
- 对外导出面放在 `server/src/microapps/computer-use/index.ts`

## Acceptance Criteria

1. 领域核心已定义统一任务状态、计划步骤、审批请求、结果摘要和 artifact 摘要。
2. 核心 service 通过接口依赖 runtime manager、executor 和 evidence store，不直接持有具体 Playwright 实现。
3. 核心层不直接 import `fastify`、`fs`、`node:path`、`electron` 或 renderer 代码。
4. 核心层显式区分 `Plan`、`Evidence`、`Result` 三类对象，不把它们混成一个返回块。
5. 定向测试覆盖任务状态流转、审批等待和 service 编排。
6. 不修改 forbidden area。

## Verification

- `node ./node_modules/vitest/vitest.mjs run src/microapps/computer-use/__tests__/core.task-lifecycle.test.ts src/microapps/computer-use/__tests__/core.service.test.ts`
  - workdir: `D:/workspace/rag-demo/server`
  - result: `2` 个测试文件、`7` 条测试全部通过
  - purpose: 验证领域核心状态机、审批等待和 service 编排
- `rg -n "from \\\"fastify\\\"|from \\\"node:fs\\\"|from \\\"node:path\\\"" server/src/microapps/computer-use/core server/src/microapps/computer-use/index.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: 无匹配
  - purpose: 检查核心层没有越界依赖
- `pnpm --filter @ui-chat-mira/server typecheck`
  - workdir: `D:/workspace/rag-demo`
  - result: 通过
  - purpose: 验证本卡 server 领域核心类型正确
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: 通过
  - purpose: 按仓库要求执行全量检查
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Owned Test Scope

- `server/src/microapps/computer-use/__tests__/core*.test.ts`
- 任务状态流转、审批等待、service 编排和 `Plan / Evidence / Result` 对象边界
- 不覆盖 Playwright 动作执行、浏览器下载、HTTP 序列化或 desktop 页面状态

## Evidence

- Changed files:
  - `server/src/microapps/computer-use/core/types.ts`
  - `server/src/microapps/computer-use/core/planning.ts`
  - `server/src/microapps/computer-use/core/task-lifecycle.ts`
  - `server/src/microapps/computer-use/core/service.ts`
  - `server/src/microapps/computer-use/index.ts`
  - `server/src/microapps/computer-use/__tests__/core.task-lifecycle.test.ts`
  - `server/src/microapps/computer-use/__tests__/core.service.test.ts`
  - `docs/project-control/tasks/microapp_T111-computer-use-server-domain-core.md`

- Diff summary:
  - 新增 `computer_use` 领域类型，明确任务状态、计划步骤、审批请求、证据对象、结果摘要和 artifact 摘要
  - 新增任务生命周期状态机，约束 `queued / planning / awaiting_approval / running / blocked / succeeded / failed / cancelled` 的统一状态协议
  - 新增计划与审批对象工厂，保证计划步骤唯一、审批对象可独立创建和解析
  - 新增领域 service，通过 `runtimeManager`、`executor`、`evidenceStore`、`taskStore` 做计划创建、执行、审批恢复和取消编排
  - 新增定向测试，覆盖状态流转、审批等待、审批拒绝、`blocked` 状态和 `Plan / Evidence / Result` 对象边界

## Unfinished / Risks

- 本卡提供的是纯领域层，不负责浏览器运行时发现、下载、解压或 Playwright 动作执行。
- 如果后续需要任务持久化或审批持久化，必须单独开卡，不在本卡里顺手加表或兼容分支。

## Isolation Rules

- 本卡只拥有 `core/**` 和根导出文件，不能顺手改 `runtime/**`、`executor/**` 或 route。
- 如果需要 Playwright 特有字段，必须通过接口或结构化透传，不允许把执行器细节塞进核心层。
