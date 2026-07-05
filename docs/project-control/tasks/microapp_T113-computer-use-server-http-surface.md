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
  - docs/microapp/computer-use-feature-design.md
task_state: DONE
---

# microapp_T113 Computer Use Server HTTP Surface

## Target

实现 `computer_use` 第一阶段浏览器工作台的 server HTTP surface，包括运行时状态查询、运行时安装触发、任务创建、任务详情、审批和取消接口。

本卡不改领域核心、不改浏览器执行器、不改 desktop。

## Allowed Changes

- `server/src/routes/microapps/computer-use/**`
- `server/src/routes/microapps/index.ts`
- `server/src/index.ts`
- `server/src/routes/microapps/__tests__/computer-use*.test.ts`
- `docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md`

## Forbidden Changes

- `server/src/microapps/computer-use/core/**`
- `server/src/microapps/computer-use/runtime/**`
- `server/src/microapps/computer-use/executor/**`
- `server/src/db/**`
- `desktop/**`

## Code Placement

- `computer_use` route 统一放到 `server/src/routes/microapps/computer-use/`
- route 聚合入口放在 `server/src/routes/microapps/index.ts`
- 全局注册只改 `server/src/index.ts`

## Acceptance Criteria

1. route 保持 prefix-free，开发态仍通过前端 `/api/...` 代理访问。
2. 至少提供下面这些入口：
   - 运行时状态查询
   - 运行时安装触发
   - 任务创建
   - 任务详情查询
   - 审批提交
   - 任务取消
   - 任务启动
3. HTTP 层只做参数校验、状态码映射和序列化，不重写领域规则。
4. route 测试覆盖成功、参数缺失、等待审批和取消失败场景。
5. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/routes/microapps/__tests__/computer-use*.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 route 契约和错误映射
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 按仓库全局规则补跑类型校验，确认本卡没有引入新的 workspace 级类型错误
- `rg -n "/api/" server/src/routes/microapps/computer-use server/src/routes/microapps/index.ts server/src/index.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查 backend route 没有把 `/api` 写进自身路径
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Owned Test Scope

- `server/src/routes/microapps/__tests__/computer-use*.test.ts`
- route 参数校验、状态码映射、等待审批响应和取消失败场景
- 不覆盖领域编排细节、浏览器运行时策略或 desktop 页面交互

## Isolation Rules

- 本卡是唯一允许修改 `server/src/routes/microapps/computer-use/**`、`server/src/routes/microapps/index.ts` 和 `server/src/index.ts` 的线程。
- HTTP 层如果发现领域接口缺口，只能通过契约调整协作，不能顺手改 `core/**`、`runtime/**` 或 `executor/**`。

## Evidence

- Changed files:
  - `docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md`
  - `server/src/routes/microapps/computer-use/**`
  - `server/src/routes/microapps/index.ts`
  - `server/src/index.ts`
  - `server/src/routes/microapps/__tests__/computer-use*.test.ts`

- Diff summary:
  - 新增 `computer_use` HTTP route 子目录，补齐运行时状态、运行时安装、任务创建、任务启动、任务查询、审批提交和取消接口。
  - 在 `server/src/routes/microapps/index.ts` 接入 `computer_use` 子路由，并保持 backend route prefix-free。
  - 在 `server/src/index.ts` 完成 `computer_use` runtime service、内存 task store 和第一阶段最小 executor 的装配。
  - 新增 route 定向测试，覆盖成功、缺参、等待审批、404、409 和取消失败映射。

- Verification results:
  - `pnpm --filter @ui-chat-mira/server test -- src/routes/microapps/__tests__/computer-use.routes.test.ts`
    - 结果：通过
  - `pnpm --filter @ui-chat-mira/server typecheck`
    - 结果：通过
  - `pnpm check`
    - 结果：未通过
    - 原因：命中仓库现存 `@ui-chat-mira/desktop typecheck` 任务外错误，[desktop/src/features/Settings/pages/MicroApps/index.tsx:151](../../../../desktop/src/features/Settings/pages/MicroApps/index.tsx) 的 `Badge variant="info"` 不满足 `BadgeVariant` 类型约束，不是本卡新增的 server 侧诊断
  - `rg -n "/api/" server/src/routes/microapps/computer-use server/src/routes/microapps/index.ts server/src/index.ts`
    - 结果：无匹配，backend route 仍未把 `/api` 写进自身路径

## Unfinished / Risks

- 本卡不负责 desktop shared API、不负责页面交互、不负责最终系统级冒烟。
- 如果实现线程发现需要任务持久化字段或 DB 结构调整，必须停下单开卡，不能顺手改库层。
- `computer_use` 当前 server 装配使用内存 task store 和第一阶段最小 executor，重启服务后任务不会保留；如果后续需要持久化任务历史，必须单开卡处理存储层。
