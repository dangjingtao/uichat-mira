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
  - docs/project-control/tasks/code_T016-codegraph-studio-desktop-ux-polish.md
task_state: DONE
---

# code_T016-Fix CodeGraph Studio Merge Blockers

## Target

只修 `T16 CodeGraph Studio` 合并阻断问题：

- `App Data Root` 后端强校验
- `Raw Debug` 默认折叠
- 提交范围收口

本卡不重做 UI，不改视觉，不解除真实 provider blocked，不改 `Planner / Normalize / Policy / ToolNode / Evidence / Generate`，不碰 `TTS / 模型设置 / Agent` 其它文件。

## Allowed Changes

- `server/src/microapps/codegraph/**`
- `server/src/routes/microapps/codegraph/**`
- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/**`
- `docs/project-control/tasks/code_T016-fix-codegraph-studio-merge-blockers.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/agent/**`
- `server/src/routes/microapps/tts/**`
- `desktop/src/features/Settings/pages/MicroApps/Tts/**`
- `desktop/src/features/Settings/pages/ModelSetting/**`
- `Planner`
- `Normalize`
- `Policy`
- `ToolNode`
- `Evidence`
- `Generate`

## Completion

- 2026-07-10：已完成 `App Data Root` 后端强校验。
- 2026-07-10：已恢复 `Raw Debug` 默认折叠，默认不渲染完整 JSON，展开后才显示。
- 2026-07-10：调试卡最终仅保留标题“原始调试报告”，不再显示“供开发调试使用”副文案。
- 2026-07-10：已补 service / route / desktop page tests。
- 2026-07-10：已确认真实 `CodeGraph 1.3.0` 仍保持 blocked-safe。

## T16 File Scope

本次 `T16-fix` 相关文件清单：

- `server/src/microapps/codegraph/index.ts`
- `server/src/microapps/codegraph/__tests__/studio.service.test.ts`
- `server/src/routes/microapps/codegraph/index.test.ts`
- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/__tests__/index.test.tsx`
- `docs/project-control/tasks/code_T016-fix-codegraph-studio-merge-blockers.md`
- `docs/project-control/project-control-ledger.md`

当前工作树中另有 `TTS / shared ui` 相关未提交改动，但不属于本卡，不应随本次 `T16-fix` 合并进入主线。

## Verification

- `pnpm --filter @ui-chat-mira/desktop test -- src/features/Settings/pages/MicroApps/CodeGraph/__tests__/index.test.tsx`
- `pnpm vitest run server/src/microapps/codegraph/__tests__/studio.service.test.ts server/src/routes/microapps/codegraph/index.test.ts`

## Result

通过条件已满足：

1. `App Data Root` 后端强校验存在。
2. workspace 内 `appDataRoot` 无法保存。
3. `Raw Debug` 默认折叠。
4. `T16` 页面仍保持当前 owner 可用结构。
5. 真实 `CodeGraph 1.3.0` 仍 blocked。
6. 测试已更新并通过。
