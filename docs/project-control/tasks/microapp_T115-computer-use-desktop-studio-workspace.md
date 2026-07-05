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

# microapp_T115 Computer Use Desktop Studio Workspace

## Target

实现只服务 `computer_use` 浏览器工作台调试的 desktop 页面。

本卡只负责 `Settings -> MicroApps` 下的独立工作台页面、页面内状态和 settings route 挂载，不做 shared API client、不做 backend。

## Allowed Changes

- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`
- `desktop/src/app/routes/settingsRoutes.tsx`
- `desktop/src/app/routes/settingsRoutes.test.tsx`
- `desktop/src/features/Settings/i18n/en-US.ts`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `docs/project-control/tasks/microapp_T115-computer-use-desktop-studio-workspace.md`

## Forbidden Changes

- `desktop/src/shared/api/**`
- `desktop/src/features/Settings/pages/MicroApps/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/Detail.tsx`
- `server/**`
- `electron/**`
- `tauri/**`

## Code Placement

- 工作台页面、局部 hook、局部组件统一放到 `desktop/src/features/Settings/pages/MicroApps/ComputerUse/`
- route 挂载只放到 `desktop/src/app/routes/settingsRoutes.tsx`
- 文案只放到 `desktop/src/features/Settings/i18n/*.ts`

## Prototype Baseline

当前已接受一份外部前端原型作为 `T115` 的视觉和交互基线：

- [computer-use-studio.jsx](C:/Users/Administrator/Downloads/computer-use-studio.jsx)

这份原型适合作为：

- 页面信息架构基线
- 三栏工作台布局基线
- 状态反馈语言基线
- `Plan / Evidence / Result` 分区基线

这份原型不应被直接当成生产代码照搬。

实现线程必须区分：

- 要保留的是页面结构、交互节奏和状态表达
- 不应直接继承的是原型里的本地模拟状态、假下载进度、假浏览器快照和演示开关

## Required Prototype Mapping

实现必须尽量对齐这份原型已经明确的页面意图：

1. 顶部状态栏
   - `Computer Use Studio` 标题
   - 运行时状态 pill
   - 任务状态 pill
2. 左侧任务面板
   - `Goal`
   - `Site scope`
   - 风险提示
   - 主操作按钮区
3. 中间执行面板
   - 空态说明
   - 运行时缺失安装引导卡
   - 下载中进度态
   - 执行中浏览器画布
   - 等待审批卡
   - 终态浏览器快照占位
4. 右侧证据面板
   - `Plan`
   - `Evidence`
   - `Result`

## Prototype Translation Rules

为了避免实现线程把原型里的演示逻辑误带进生产页面，必须遵守这些转换规则：

1. 原型里的演示控制项
   - `runtimeStatus` 下拉
   - `simulateOutcome` 切换
   - 纯前端定时器模拟
   都只能作为开发参考，不能原样进入正式页面
2. 原型里的假浏览器画布
   - 可以保留为 UI 占位视觉语言
   - 但正式实现要改成可接真实执行状态的组件结构
3. 原型里的本地 `useState` 状态机
   - 只能作为页面状态草图
   - 正式实现必须改成调用 `desktop/src/shared/api/computerUse.ts`
4. 原型里的文案和分区命名
   - 应优先保留
   - 除非与现有 i18n 或功能设计硬冲突

## Acceptance Criteria

1. 新页面只服务浏览器工作台，不顺手接 chat、插件入口或宿主桌面控制。
2. 页面内所有 backend 调用都通过 `desktop/src/shared/api/computerUse.ts`，不直接请求 URL。
3. 页面不直接访问 Node API、`window.desktopApi` 或 preload 细节。
4. route 变更只落在 `settingsRoutes.tsx` 和对应测试，不修改现有 `MicroApps/index.tsx`、`Detail.tsx`。
5. 页面结构必须完整实现：
   - 顶部状态栏
   - 左侧任务面板
   - 中间执行面板
   - 右侧 `Plan / Evidence / Result`
6. 页面显式覆盖空态、运行时缺失、规划中、等待审批、执行中、成功、失败和取消场景。
7. 有定向页面测试覆盖：
   - 路由挂载
   - 运行时缺失安装引导
   - 状态切换占位
   - `Plan / Evidence / Result` 结构存在
8. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/app/routes/settingsRoutes.test.tsx src/features/Settings/pages/MicroApps/ComputerUse/__tests__/index.test.tsx`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 route 挂载和页面基础行为
- `rg -n "fetch\\(|axios\\(|/microapps/computer-use|/api/" desktop/src/features/Settings/pages/MicroApps/ComputerUse`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查页面没有绕过 shared API 直接请求后端
- `rg -n "window\\.desktopApi|from \\\"node:|from \\\"electron\\\"" desktop/src/features/Settings/pages/MicroApps/ComputerUse`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查页面没有越界触碰 native 能力
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Owned Test Scope

- `src/app/routes/settingsRoutes.test.tsx`
- `src/features/Settings/pages/MicroApps/ComputerUse/__tests__/index.test.tsx`
- 路由挂载、运行时缺失安装引导、状态切换占位和 `Plan / Evidence / Result` 结构存在
- 不覆盖 shared API 请求映射或后端 route 错误语义

## Evidence

- Changed files:
  - `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`
  - `desktop/src/app/routes/settingsRoutes.tsx`
  - `desktop/src/app/routes/settingsRoutes.test.tsx`
  - `desktop/src/features/Settings/i18n/en-US.ts`
  - `desktop/src/features/Settings/i18n/zh-CN.ts`

- Diff summary:
  - 新增 `Computer Use Studio` 页面、局部状态 hook 和定向页面测试
  - 在 `settingsRoutes` 挂载 `/settings/micro-apps/computer-use-studio`
  - 补齐 settings 中英文文案，覆盖运行时、任务状态、安装引导、计划、证据和结果分区
  - 补充页面状态矩阵测试，并把验证命令改成当前环境下可真实命中的显式测试文件路径

## Unfinished / Risks

- 本卡不负责浏览器执行真相，只负责页面工作台。
- 如果后端接口未稳定，允许本卡先按 loading / empty / error 占位态接入，不允许反过来改 shared API 或 server 文件。

## Isolation Rules

- 本卡是唯一允许修改 `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`、`desktop/src/app/routes/settingsRoutes.tsx`、`desktop/src/app/routes/settingsRoutes.test.tsx` 和 settings i18n 文案文件的线程。
- 页面层发现 API 不顺手，只能回到 `T114` 对齐共享 API，不允许直接改 `desktop/src/features/Settings/pages/MicroApps/index.tsx`、`Detail.tsx` 或任何 server 文件。
