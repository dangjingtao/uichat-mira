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
  - docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md
  - docs/microapp/computer-use-feature-design.md
task_state: DONE
---

# microapp_T116 Computer Use Desktop Entry Integration

## Target

把已经存在的 `Computer Use Studio` 工作台接回当前微应用产品入口。

本卡只负责“从当前 `Settings -> MicroApps` 列表页或详情页点进去”的入口衔接，不负责工作台内部功能，不负责 backend，不负责 shared API 契约扩展。

目标是让后续产品级冒烟不再依赖手输 `/settings/micro-apps/computer-use-studio` 路径。

## Allowed Changes

- `desktop/src/features/Settings/pages/MicroApps/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/Detail.tsx`
- `desktop/src/features/Settings/pages/MicroApps/__tests__/index.test.tsx`
- `desktop/src/features/Settings/pages/MicroApps/__tests__/Detail.test.tsx`
- `desktop/src/features/Settings/i18n/en-US.ts`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `docs/project-control/tasks/microapp_T116-computer-use-desktop-entry-integration.md`

## Forbidden Changes

- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`
- `desktop/src/app/routes/settingsRoutes.tsx`
- `desktop/src/app/routes/settingsRoutes.test.tsx`
- `desktop/src/shared/api/**`
- `server/**`
- `electron/**`
- `tauri/**`

## Product Entry Requirement

必须补齐下面这段真实入口链路：

1. 用户进入 `Settings -> MicroApps`
2. 在当前产品页面里看到 `Computer Use Studio` 的入口
3. 点入口进入现有工作台
4. 不需要手输路径，不需要开发者知道内部路由字符串

如果只做“路由已存在，但只能手工输入 URL”，本卡判定不通过。

## Entry Strategy

本卡至少要完成一个稳定主入口，并推荐补齐一个辅助入口：

- 稳定主入口：
  - 在 `MicroApps/index.tsx` 提供可见、可点击的 `Computer Use Studio` 入口
- 辅助入口：
  - 在 `MicroApps/Detail.tsx` 的相关场景下提供“进入工作台”动作

约束：

- 入口表达要继承当前微应用设置页的信息架构，不要把整页改造成新的导航系统
- 不允许为了露出该入口，顺手改工作台内部结构
- 不允许伪造一个新页面来绕过现有 `T115` 工作台

## Implementation Boundary

本卡处理的是产品入口衔接，不是运行时装配。

因此本卡只允许做：

- 当前列表页内的入口露出
- 当前详情页内的跳转动作
- 当前 settings i18n 文案补齐
- 页面级测试补齐

本卡不允许做：

- 修改 `ComputerUse/**` 工作台的状态、轮询、表单、审批、证据或结果逻辑
- 修改 settings route 定义
- 修改 shared API 请求映射、server route 或 microapp registry

如果实现线程发现“仅改页面文件仍然无法把入口挂出来”，例如必须改 shared API 或 registry 契约，本卡要先停下并升级说明影响面，不能直接越界补丁。

## Recommended UX Shape

### 列表页

- 在当前 `MicroApps` 页面内，为 `Computer Use Studio` 提供独立入口卡或独立提示区
- 入口文案要明确这是“浏览器工作台调试入口”，不要伪装成企业接入入口
- 入口区至少说明：
  - 当前用途是浏览器任务工作台调试
  - 当前只覆盖浏览器内动作
  - 当前包含计划、审批、执行和证据回放

### 详情页

- 如果当前详情页能表达 computer use 这类微应用，页面内应出现“进入工作台”按钮或等价动作
- 如果详情页当前只适用于企业接入型微应用，不适合强行复用，本卡允许把详情页入口降级为“仅在相关场景显示”，但必须在任务证据里说明为什么

## Acceptance Criteria

1. 用户从当前 `Settings -> MicroApps` 页面出发，不手输 URL，也能进入 `Computer Use Studio`。
2. 列表页存在明确、稳定、肉眼可见的 computer use 入口，不藏在开发者说明或纯文本里。
3. 入口文案明确这是“浏览器工作台调试入口”，不会和当前企业接入型微应用配置入口混淆。
4. 不修改 `ComputerUse/**`、`settingsRoutes.tsx`、shared API、backend 或其他 forbidden area。
5. 至少有页面测试覆盖：
   - 列表页入口渲染
   - 点击入口后的路由跳转
6. 如果详情页也补了入口，测试要覆盖其显示条件和跳转行为；如果没有补，任务证据里必须明确原因，且不能影响第 1 条通过。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/features/Settings/pages/MicroApps/__tests__/index.test.tsx src/features/Settings/pages/MicroApps/__tests__/Detail.test.tsx`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证入口渲染、跳转和详情页条件行为
- `rg -n "computer-use-studio" desktop/src/features/Settings/pages/MicroApps`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查入口只落在本卡允许页面范围
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动没有越过本卡边界

## Owned Test Scope

- `desktop/src/features/Settings/pages/MicroApps/__tests__/index.test.tsx`
- `desktop/src/features/Settings/pages/MicroApps/__tests__/Detail.test.tsx`
- 列表页入口渲染、点击跳转和详情页条件行为
- 不覆盖 `ComputerUse/**` 工作台状态机、settings route 定义或 server route 语义

## Evidence

- Required changed files:
  - `desktop/src/features/Settings/pages/MicroApps/index.tsx`
  - `desktop/src/features/Settings/i18n/en-US.ts`
  - `desktop/src/features/Settings/i18n/zh-CN.ts`
- Optional changed files:
  - `desktop/src/features/Settings/pages/MicroApps/Detail.tsx`
  - `desktop/src/features/Settings/pages/MicroApps/__tests__/index.test.tsx`
  - `desktop/src/features/Settings/pages/MicroApps/__tests__/Detail.test.tsx`

- Required evidence:
  - 说明用户从 `Settings -> MicroApps` 如何点进 `Computer Use Studio`
  - 说明入口为什么没有破坏当前企业接入型微应用的列表和详情逻辑
  - 给出测试结果，至少覆盖列表页入口渲染和点击跳转

## Unfinished / Risks

- 本卡不负责浏览器执行真相，只负责产品入口衔接。
- 如果 `T115` 工作台自身仍有待修问题，本卡也不能反向修改 `ComputerUse/**` 去补页面内部逻辑。

## Isolation Rules

- 本卡是 computer use 线程里唯一允许修改 `desktop/src/features/Settings/pages/MicroApps/index.tsx` 和 `Detail.tsx` 的卡。
- `T115` 继续独占 `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**` 与 `settingsRoutes.tsx`；本卡只能消费既有工作台入口，不得反向改工作台内部。
- 后续产品入口级冒烟必须建立在本卡完成之后；如果本卡未完成，只能做“直达路由冒烟”，不能口头升级成产品入口冒烟。
