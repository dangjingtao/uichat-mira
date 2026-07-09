---
status: current
priority: P1
owner: microapp
last_verified: 2026-07-10
layer: project-control
module: MicroAPP
feature: CodeGraphStudio
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/tasks/code_T015-codegraph-external-index-root-repo-pollution-control.md
  - docs/project-control/decisions/TD-T016-01-microapp-definition-reconcile-gap.md
task_state: DONE
---

# code_T016 CodeGraph Studio Desktop UX Polish

## Target

把现有 `CodeGraph Studio` 页面调整成 owner 可直接理解和操作的工作台，视觉和信息架构对齐本轮参考图。

本卡只处理 desktop 前端体验：

- 状态总览
- 下一步提示
- 阻断原因表达
- 污染保护摘要
- 配置表单可读性
- 运行时动作区
- smoke 区域
- 原始调试报告折叠区

本卡不解除真实 provider blocked，不改 Planner 主链，不改后端 blocked-safe 逻辑。

## Allowed Changes

- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/**`
- `desktop/src/features/Settings/i18n/en-US.ts`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/__tests__/index.test.tsx`
- `docs/project-control/tasks/code_T016-codegraph-studio-desktop-ux-polish.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/**`
- `desktop/src/shared/api/**`
- `desktop/src/features/Settings/pages/MicroApps/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/Detail.tsx`
- `desktop/src/app/routes/settingsRoutes.tsx`
- Planner
- Normalize
- Policy
- ToolNode
- Evidence
- Generate
- Agent Runtime 主链
- `electron/**`
- `tauri/**`

## UI Baseline

本卡接受一份外部参考图作为页面结构和交互节奏基线：

- `C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-9ed9a139-b14a-4e63-a606-a700fe6a501f.png`

必须尽量保留这张参考图已经明确的页面意图，但不能把其中任何演示态误报成真实后端能力。

## Required Mapping

实现必须至少对齐下面这些区域：

1. 顶部状态总览区
   - 当前状态
   - blocked-safe 说明
   - Planner 暴露状态
   - telemetry 状态
   - 仓库污染状态
   - fake provider 调试提示
   - 下一步说明
2. 阻断原因区
   - 区分“可处理”和“当前不可解除”的原因
   - 不把 blocked reason 只堆成原始错误文本
3. 污染保护摘要区
   - guard 状态
   - repo data dir path
   - exists
   - 行为说明
4. 基础配置区
   - 只读路径
   - command
   - appDataRoot
   - timeout / max results / query limit
   - 高级配置折叠
5. 运行时动作区
   - detect / health / start / stop
   - blocked 时必须明确禁止启动
6. Smoke 区
   - 真实 provider / fake provider 切换提示
   - blocked 时明确显示 blocked
   - 不解释成 empty result
7. 原始调试报告区
   - 默认直接显示 JSON
   - 代码块内部滚动

## Acceptance Criteria

1. 页面信息架构接近参考图，不再是仅面向开发者的原始调试面板。
2. 不会误导用户认为真实 `CodeGraph 1.3.0` 已经 ready。
3. blocked 原因必须被翻译成 owner 能理解的说明和下一步，不只显示原始 code。
4. `App Data Root` 必须被明确标成关键输入项，并说明它需要位于仓库外部。
5. `start` 在 blocked 状态下必须显式表现为不可启动或明确提示当前不可启动。
6. smoke 区必须明确区分真实 provider 与 fake provider 验证路径。
7. 页面文案进入 settings i18n，不新增一批散落硬编码。
8. 使用浏览器实际打开本地页面做对图和手动检查。
9. 不修改 forbidden area。

## Completion

- 2026-07-10：本卡完成。
- 结论：`CodeGraph Studio` 已调整为 owner 可理解、可操作的 blocked-safe 工作台；真实 provider 仍保持 blocked；未开启 dogfood，未默认暴露给 Planner。

## Verification

- `pnpm --filter @ui-chat-mira/desktop test -- src/features/Settings/pages/MicroApps/CodeGraph/__tests__/index.test.tsx`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证页面关键文案、操作和 smoke 区行为
- 浏览器手动检查
  - 入口：`Settings -> Micro Apps -> CodeGraph Studio`
  - purpose: 对照参考图检查布局、按钮状态、阻断说明和引导文案
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动没有越界

## Evidence

- 必须提供：
  - 改动文件清单
  - 浏览器手动检查说明
  - 定向 vitest 原始输出
  - 仍保持 blocked-safe 的明确结论

## Risks

- 本卡只做前端体验，不修后端真实 provider 能力。
- 如果浏览器对图时发现 API 字段不足，只能记录影响并回到后续卡，不得顺手越界改 `server/**`。
