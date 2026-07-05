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

1. 正式 POC 文档已升级为“兼容底座设计版”，明确 `image_generation` 的目标、范围、运行时边界和最小闭环。
2. 文档明确区分 `MicroAPP`、provider API、桌面入口、后端执行器和本地 workflow runner，不把它们混成一个概念。
3. 文档明确 renderer 不直连第三方 API，secret 只允许在 backend 真相层出现。
4. 文档明确第一版先抽统一任务生命周期，不先抽统一模型参数层。
5. 文档明确 `ComfyUI` 必须支持，且支持边界是“用户提供 workflow API JSON，我们负责提交和回收结果”。
6. 文档明确当前能力只在微应用界面里调试，不提前开放给 chat、第三方平台入口或通用调用面。
7. 文档明确首批适配器范围和第二批预留范围，不追求 provider 数量最多。
8. `docs/microapp/README.md` 已把 `image_generation` 挂到当前 `MicroAPP` 候选清单里，并能链接到 POC 文档。
9. `docs/project-control/project-control-ledger.md` 已登记该任务和当前状态。
10. 不修改 forbidden area。

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
  - 把 `image_generation` POC 文档从单 provider 示意升级为兼容底座设计文档
  - 增加 provider 分层、统一任务生命周期、产物落盘规则和首批 adapter 范围
  - 明确 `ComfyUI` 以 workflow API JSON runner 形式接入，不再尝试统一其局部能力语义
  - 明确当前能力只服务微应用界面调试，不提前扩散到 chat 或第三方入口
  - 保持 `project-control` 任务卡和总台账与最新 POC 口径一致

## Unfinished / Risks

- 当前只完成 docs-only POC，没有批准任何 provider 接入、secret 存储、文件落盘或 UI 实现。
- 由于生图链路天然涉及外部数据发送，后续如进入实现，属于需要再次确认的高风险边界。
- 当前首批 provider 范围是兼容底座建议，不代表采购或正式商务选型已经完成。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待评审范围：docs-only POC 基础建设
- 明确未批准：runtime / DB / UI / 打包 / provider 实现
