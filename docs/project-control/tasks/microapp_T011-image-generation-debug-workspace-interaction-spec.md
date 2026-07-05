---
status: current
priority: P2
owner: docs
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ImageGeneration
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/microapp/image-generation-microapp-poc.md
  - docs/microapp/image-generation-debug-workspace-interaction-spec.md
  - desktop/src/shared/ui/ui-design-guidelines-tailwind.md
task_state: READY_FOR_REVIEW
---

# microapp_T011 Image Generation Debug Workspace Interaction Spec

## Target

补一份可直接交给设计师的 Markdown 交互说明，覆盖 `image_generation` 微应用调试页的页面结构、状态和关键交互语言。

本任务只写交互设计文档，不实现 UI、不改 runtime。

## Allowed Changes

- `docs/microapp/image-generation-debug-workspace-interaction-spec.md`
- `docs/project-control/tasks/microapp_T011-image-generation-debug-workspace-interaction-spec.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `desktop/**`
- `server/**`
- `electron/**`
- `tauri/**`
- `scripts/**`
- DB schema
- 打包链

## Acceptance Criteria

1. 新增一篇正式 Markdown 文档，明确生图微应用调试页的页面定位、信息架构和关键交互流。
2. 文档明确区分 `Prompt 模式` 和 `Workflow 模式` 的页面结构与交互差异。
3. 文档明确成功、失败、生成中、空态、JSON 非法等关键状态表现。
4. 文档明确当前页面只服务微应用界面调试，不扩到 chat、第三方平台入口或通用调用面。
5. 文档语言足够完整，设计师无需再反推产品意图就能开始出稿。
6. `docs/project-control/project-control-ledger.md` 已登记该任务和状态。
7. 不修改 forbidden area。

## Verification

- `git diff -- docs/microapp/image-generation-debug-workspace-interaction-spec.md docs/project-control/tasks/microapp_T011-image-generation-debug-workspace-interaction-spec.md docs/project-control/project-control-ledger.md`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 核对交互文档、任务卡和台账更新范围
- `git status --short`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查本轮只新增或修改文档文件

本任务是 docs-only，不跑 `pnpm check`：

- 原因：本轮没有修改 runtime、类型、构建、打包或任何可执行代码；验收目标是交互说明文档，不是实现验证。

## Evidence

- Changed files:
  - `docs/microapp/image-generation-debug-workspace-interaction-spec.md`
  - `docs/project-control/tasks/microapp_T011-image-generation-debug-workspace-interaction-spec.md`
  - `docs/project-control/project-control-ledger.md`

- Diff summary:
  - 新增生图微应用调试页交互说明文档
  - 把页面目标、双栏结构、关键交互流、状态矩阵和设计验收点写成可交付设计师的语言
  - 在总台账登记该交互文档任务

## Unfinished / Risks

- 当前只完成交互语言说明，不包含视觉稿、组件清单或像素级标注。
- 如果后续把页面能力从“微应用界面调试”扩大到 chat 或第三方入口，这份交互说明需要单独修订，不能直接复用。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待评审范围：生图微应用调试页交互说明文档

