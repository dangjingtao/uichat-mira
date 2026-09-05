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
task_state: TODO
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

OpenDesign 设计文件当前尚未入仓。启动本卡时若仍缺失，停止施工并等待设计输入；不得自行补画。
