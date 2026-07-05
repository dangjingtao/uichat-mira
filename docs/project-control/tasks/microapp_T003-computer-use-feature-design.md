---
status: current
priority: P1
owner: docs
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/microapp/README.md
  - docs/microapp/computer-use-microapp-poc.md
  - docs/microapp/computer-use-feature-design.md
task_state: READY_FOR_REVIEW
---

# microapp_T003 Computer Use Feature Design

## Target

在 `computer_use` 技术 POC 已明确边界的前提下，补齐第一阶段浏览器场景的功能设计，明确用户入口、任务状态、审批交互、运行时安装引导、结果回放和失败反馈。

本任务只做 docs-only 功能设计，不实现 renderer、backend、preload、浏览器执行器、数据库或打包逻辑。

## Allowed Changes

- `docs/microapp/**`
- `docs/project-control/tasks/microapp_T003-computer-use-feature-design.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `desktop/**`
- `server/**`
- `electron/**`
- `tauri/**`
- `scripts/**`
- `runtime.config.cjs`
- DB schema
- 打包链
- `computer-use` / Playwright / 浏览器下载实现代码

## Acceptance Criteria

1. 新文档明确 `computer_use` 第一阶段的用户入口、页面结构和主流程。
2. 文档明确运行时缺失时的安装引导流程，不把下载逻辑塞进壳层产品语义里。
3. 文档明确任务状态、审批等待、执行中、成功、失败、取消的用户可见反馈。
4. 文档明确结果回放和 artifact 展示方式，不把 trace 和最终结果混成一个区域。
5. 文档明确 MVP 非目标，避免默认扩展到插件、宿主桌面或多浏览器。
6. `docs/project-control/project-control-ledger.md` 已登记该任务和当前状态。
7. 不修改 forbidden area。

## Verification

- `git diff -- docs/microapp docs/project-control/tasks/microapp_T003-computer-use-feature-design.md docs/project-control/project-control-ledger.md`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 核对文档变更范围与内容
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查是否误触 forbidden area
- `git status --short`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查新增文件和修改文件是否都落在允许范围内

本任务是 docs-only，不跑 `pnpm check`：

- 原因：本轮没有修改 runtime、类型、构建、打包或任何可执行代码；验收目标是功能设计和任务登记，不是实现验证。

## Evidence

- Changed files:
  - `docs/microapp/README.md`
  - `docs/microapp/computer-use-feature-design.md`
  - `docs/project-control/tasks/microapp_T003-computer-use-feature-design.md`
  - `docs/project-control/project-control-ledger.md`

- Diff summary:
  - 为 `computer_use` 第一阶段浏览器场景建立 docs-only 功能设计任务卡
  - 新增功能设计文档，明确入口、状态、审批、安装引导、结果回放和失败反馈
  - 在 `README` 和项目总台账挂上这份功能设计

## Unfinished / Risks

- 当前只完成 docs-only 功能设计，没有批准任何 UI、后端接口、浏览器下载或自动化执行实现。
- 运行时安装、审批持久化和 artifact 存储仍属于后续实现阶段，需要单独任务卡承接。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待评审范围：docs-only 功能设计
- 明确未批准：runtime / DB / UI / preload / browser runtime implementation
