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
  - docs/microapp/README.md
  - docs/microapp/image-generation-microapp-poc.md
  - docs/architecture/README.md
  - docs/architecture/ipc-and-preload.md
task_state: READY_FOR_REVIEW
---

# microapp_T001 Image Generation POC Docs Foundation

## Target

把“调用生图 API 的微应用”先收成一组 docs-only POC 文档，明确它在当前项目里的产品定位、运行时边界和最小实现切片。

本任务只做文档基础建设，不实现 renderer、backend、preload、数据库或打包逻辑。

## Allowed Changes

- `docs/microapp/**`
- `docs/project-control/tasks/microapp_T001-image-generation-poc-docs-foundation.md`
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
- provider 调用实现
- secret 存储实现

## Acceptance Criteria

1. 新增一篇正式 POC 文档，明确 `image_generation` 的目标、范围、运行时边界和最小闭环。
2. 文档明确区分 `MicroAPP`、provider API、桌面入口和后端执行器，不把它们混成一个概念。
3. 文档明确 renderer 不直连第三方 API，secret 只允许在 backend 真相层出现。
4. 文档明确第一版只做单 provider、单次生成、单页预览，不扩成多 provider 市场或图片编辑平台。
5. `docs/microapp/README.md` 已把 `image_generation` 挂到当前 `MicroAPP` 候选清单里，并能链接到 POC 文档。
6. `docs/project-control/project-control-ledger.md` 已登记该任务和当前状态。
7. 不修改 forbidden area。

## Verification

- `git diff -- docs/microapp docs/project-control/tasks/microapp_T001-image-generation-poc-docs-foundation.md docs/project-control/project-control-ledger.md`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 核对文档变更范围与内容
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查是否误触 forbidden area
- `git status --short`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查新增文件和修改文件是否都落在允许范围内

本任务是 docs-only，不跑 `pnpm check`：

- 原因：本轮没有修改 runtime、类型、构建、打包或任何可执行代码；验收目标是文档边界、任务登记和 POC 范围，不是实现验证。

## Evidence

- Changed files:
  - `docs/microapp/README.md`
  - `docs/microapp/image-generation-microapp-poc.md`
  - `docs/project-control/tasks/microapp_T001-image-generation-poc-docs-foundation.md`
  - `docs/project-control/project-control-ledger.md`

- Diff summary:
  - 新增 `image_generation` 微应用的 docs-only POC 文档
  - 在 `MicroAPP` 总纲里把 `image_generation` 正式挂到候选清单，并增加文档入口
  - 新增 `project-control` 任务卡，明确这轮只做文档基础建设
  - 在唯一总台账登记该任务为 `READY_FOR_REVIEW`

## Unfinished / Risks

- 当前只完成 docs-only POC，没有批准任何 provider 接入、secret 存储、文件落盘或 UI 实现。
- 由于生图链路天然涉及外部数据发送，后续如进入实现，属于需要再次确认的高风险边界。
- 当前没有选定最终 provider，文档中的 provider 结构只是第一版建议契约，不代表采购或正式技术选型已经完成。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待评审范围：docs-only POC 基础建设
- 明确未批准：runtime / DB / UI / 打包 / provider 实现
