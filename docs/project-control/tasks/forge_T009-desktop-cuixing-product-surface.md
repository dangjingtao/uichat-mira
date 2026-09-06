---
status: current
priority: P1
owner: forge / desktop
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: CuixingDesktop
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/forge_T008-mira-server-api-and-desktop-client-contract.md
task_state: DOING
---

# forge_T009 淬行 Desktop Product Surface

## Target

根据 owner 提供的 OpenDesign 设计文件，把 Forge 的外部产品界面实现为 Mira Desktop 一级产品域“淬行”。

本卡负责设计转实现，不允许施工线程自行重新设计视觉。内部代码、route、domain 继续使用 `forge` 命名。

## Must Read

- `AGENTS.md`
- `desktop/src/shared/ui/COMPONENTS.md`
- `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`
- `docs/forge/FORGE_CURRENT_CONTRACT.md`
- T008 Forge Desktop client
- owner 提供的 OpenDesign 设计文件 / 导出设计说明

## Allowed Changes

- `desktop/src/features/forge/**`
- Desktop app route / workspace / 一级导航中仅 Forge 所需入口
- `desktop/src/shared/api/forge/**`（仅实现过程中发现的 client bug）
- Forge 专属 i18n 文案
- 必要的 Forge UI tests
- 本任务卡状态 / 证据

## Forbidden Changes

- 未拿到 OpenDesign 设计文件就凭任务卡自行设计页面
- 新建 Forge Design System
- 复制旧 Forge React 19 / Vite 7 工程
- 新增 Forge 独立 package / dependency tree
- iframe 旧 Forge dashboard
- 修改全局 design token 来迁就单页面
- 把“Builder completed”展示成 Task PASS
- 用 raw Event Log 替代 Builder Result Handoff

## Required Product Semantics

界面至少能表达：

- Project Rail
- Main Thread 主工作区
- Repository Task / runtime 双状态
- explicit Dispatch
- active Builder
- Builder Result Handoff
- compact Runtime Summary
- Runtime Inspector
- Event Log
- blocked / failed / interrupted / reviewing / stale
- register project / empty state
- keyboard-first 交互

旧仿 TUI 气质可以作为内部 expert/debug 视图保留，但必须基于同一 Desktop 工程、同一 API、同一依赖体系。

## Construction Evidence

- Base: `dev@18d0f1d0f616c57d9f0376f54c1e0f731be2e1cf`。
- Desktop 入口：
  - 复用 `UChatThreadListSidebar` 已有 `sidebarEntries` app-integration 扩展点，新增“淬行”入口并由 Chat feature 层 `navigate("/forge")`；
  - 未修改 `desktop/src/shared/uchat/**`，未把 Forge route / API 语义塞进 uchat core；
  - 进入 `/forge` 后继续使用独立 `CuixingPage` 全 workspace，不叠加 Chat 256px Sidebar。
- 代码分层：
  - `shared/api/forge/**`：T008 transport contract，T009 未直接改写 transport；
  - `features/forge/core/protocol.ts`：Desktop product protocol adapter，只组合 typed Forge API；
  - `features/forge/core/workspaceModel.ts`：纯函数 view-model，负责 Project/Task/Main Thread/Runtime facts -> 产品投影；
  - `features/forge/hooks/useForgeWorkspace.ts`：唯一 orchestration 层，负责 load / selection / refresh / send / dispatch / cancel / integrate；
  - `CuixingPage.tsx`：只做 route navigation + hook -> view binding；
  - `ForgeWorkspace.tsx`：纯 layout/composition，不 import `forgeApi`；
  - `components/workspace/**`：Task Context、Runtime Panel、Dispatch Modal、Register Modal、Builder Result Card、Task List、presentation helpers。
- OpenDesign 产品骨架保持：
  - Project Rail；
  - Main Thread 主舞台；
  - 右侧 Task Context（窄窗 Drawer）；
  - Runtime Summary / Inspector / Event Log 继续 secondary surface，不常驻抢占主工作区。
- Domain truth 修正（相对静态设计稿）：
  - Repository Task status 与 Runtime Task status 保持并列，不合成单一 Badge；
  - `blocked` 仅来自 T006 readiness projection，不伪造成 `ForgeTask.status`；
  - `failed` 主要来自 Dispatch/runtime record，不伪造成 Task status；
  - 删除静态稿假的 `Enter Review` 操作；T008 没有“创建 reviewer session”的产品能力，T009 不伪造 Reviewer；
  - `reviewing` 只表达“等待独立 Review”，明确提示 Builder Result != Repository PASS；
  - `review_passed` 且 `currentSha == reviewedSha` 时才显示 `Confirm integrated`，实际仍调用 T007 guarded action；
  - Builder Result Handoff 从 Main Thread handoff event 独立渲染，不用 raw Event Log 代替。
- Explicit Dispatch：
  - Builder 选择来自 `/forge/meta`：OpenCode / PiAgent / Codex；
  - 用户点击后显式 dispatch；Repository Task 尚无 runtime batch 时，显式动作先创建单 Task batch，再调用 T006 dispatch；
  - 无 Repository Task truth 时 readiness = unavailable，不显示可派发；
  - taskRef 只在真实 Repository Task ref 存在时发送，不把 UI placeholder 发给后端；
  - 无自动 provider fallback、无 auto push/merge/deploy。
- Main Thread：
  - 无现有 thread 时，第一次真实发送或显式 dispatch 前创建 Main Thread；
  - provider adapter 只从 T008 `mainThreadAdapters` 选择；
  - active Main Thread / Builder 时 3s live refresh，静止态不轮询；
  - 快速 Task 切换用 request identity 防止旧 Inspector 响应覆盖新 selection。
- Project registration：
  - 支持 name / local repository / integration branch；
  - Task Ledger + Task Directory 必须成对填写，否则明确拒绝；
  - 留空不猜历史默认路径。
- Keyboard-first：
  - `Cmd/Ctrl+K` Command palette；
  - `Cmd/Ctrl+P` Dispatch 当前 Task；
  - `Cmd/Ctrl+E` Event Log；
  - `Cmd/Ctrl+Enter` Main Thread send；
  - `Esc` 关闭当前 secondary surfaces。
- UI 使用现有 Mira token / shared UI；未改 global token、未新建 Forge Design System、未引入依赖。
- 错误边界：
  - protocol/hook 负责用户可见错误提示；
  - View 边界消费已报告的 Promise rejection，Modal 失败保持打开，不留下 unhandled rejection。
- 回归：
  - `ForgeWorkspace.test.tsx`：Repository/Runtime 双状态、Builder Result 卡、Event Log keyboard、blocked readiness、empty state；
  - `workspaceModel.test.ts`：Builder completed 不提升 Repository PASS / Runtime reviewing；
  - `UChatThreadListSidebar.test.tsx`：Chat integration “淬行”入口 -> `/forge`。
- Scope audit：生产 Forge UI 不含 `forgeApi` 直连、固定 backend port、Node/fs/child_process、fake Review、伪 blocked/failed Task status；0 conflict marker / 0 trailing whitespace。
- Focused Vitest 已新增/更新，但当前 PR workflow 是否执行这些测试以实际 CI 证据为准，不预先声明已运行。

## Design Difference Record

1. 静态稿的 `Enter Review` 被移除：当前 T008/T007 只有 SHA-bound Review manager contract，没有 Desktop 可合法创建 Reviewer session 的能力。T009 只展示 reviewing 状态，不制造 fake reviewer。
2. 静态稿中的 blocked/failed Runtime Task badge 被拆回真实 domain：blocked = readiness，failed/interrupted = Dispatch/runtime evidence，Task badge 只展示 `ForgeTask.status`。
3. Chat 左栏入口复用现有 uchat `sidebarEntries` 扩展点；为了不污染 shared/uchat，本卡不新增 Forge-specific icon/type 到 uchat core。入口文本为“淬行”，route navigation 留在 Desktop Chat feature 层。

## Acceptance Criteria

1. 一级产品名显示“淬行”，内部命名仍为 Forge。
2. 外部界面使用 Mira Desktop 现有 token / shared UI。
3. 窄窗优先保留 Main Thread，辅助区可折叠 / overlay。
4. Main Thread、Task、Runtime 的层级清楚，不做 SaaS Admin Dashboard。
5. Runtime detail / Event Log 不常驻抢占主工作区。
6. OpenDesign 设计与真实 Forge domain 若冲突，优先保护 domain truth，并形成明确设计差异记录。

## Validation

- Desktop focused UI tests
- keyboard / modal focus tests
- status semantics tests
- desktop typecheck
- `pnpm check`
- owner visual review

## Unknown / Human Decision

已解决：启动 T009 时 `desktop/src/features/forge/components/ForgeWorkspace.tsx` 已包含 owner 之前基于 OpenDesign 确认并落入 Mira Desktop 的静态产品骨架（Project Rail / Main Thread / Task Context / Runtime secondary surfaces）。本卡以该现有实现作为设计输入，只做真实 domain/API 接线与明确的 domain-truth 差异修正，没有自行重画另一套 Forge UI。
