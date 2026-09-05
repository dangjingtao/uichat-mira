---
status: current
priority: P0
owner: forge / architecture
last_verified: 2026-09-05
layer: project-control
module: Forge
feature: IntegrationBaseline
doc_type: task-card
canonical: true
related:
  - AGENTS.md
  - docs/project-control/project-control-ledger.md
  - docs/architecture/README.md
task_state: TODO
---

# forge_T001 Forge Integration Contract and Source Baseline

## Target

冻结“淬行（Forge）并入 Mira”的迁移合同和源代码基线，避免后续施工把 Forge 重写成任务管理页、第二套 Agent Runtime 或独立 sidecar。

源基线固定为：`dangjingtao/mira-forge` `dev@6557b9ff552c4be3d3d1be2da0b24bb6d1344ed0`。迁移目标为 `dangjingtao/uichat-mira` `dev`。

本卡只建立迁移真相与文件映射，不实现业务代码。

## Verified Context

- 对外中文名统一为“淬行”；内部工程名继续使用 `forge`。
- Forge 必须进入 `uichat-mira` 单仓，不再作为独立产品仓长期演进。
- Forge 不允许保留自己的 `package.json`、lockfile、workspace 或独立依赖安装体系。
- Forge 外部产品界面必须使用 Mira Desktop 现有设计体系；OpenDesign 设计文件是后续外部 UI 的视觉输入。
- 原仿 TUI 界面允许保留为内部 / expert / debug surface，但不得因此保留第二套前端工程。
- Forge 的核心模型必须保留：Project、Main Thread、Repository Task、Batch / Runtime Task、Dispatch、Session、Review、Runtime Event、Builder Result Handoff。
- Repository Task Truth 与 Forge Runtime Truth 必须继续分离。
- Main Thread 不是 Builder；Builder 成功退出只进入 `reviewing`，不能制造 PASS。
- 当前 Forge T018 仍为 REVIEW，迁移不得把未完成验收偷偷升级为 PASS。

## Allowed Changes

- `docs/forge/**`
- `docs/project-control/tasks/forge_T001-integration-contract-and-source-baseline.md`
- `docs/project-control/project-control-ledger.md`（仅本任务状态 / 证据）

## Forbidden Changes

- `server/**`
- `desktop/**`
- `electron/**`
- `tauri/**`
- `package.json`
- `pnpm-lock.yaml`
- 修改旧 Forge 仓库
- 重新设计 Forge 状态机

## Required Output

至少形成：

- `docs/forge/README.md`：淬行 / Forge 产品与工程边界；
- `docs/forge/FORGE_CURRENT_CONTRACT.md`：当前必须保留的不变量；
- `docs/forge/migration-source-map.md`：源仓文件到 Mira 目标模块的迁移映射；
- 明确列出旧 Forge 中“不迁移”的独立 Web/Vite/package/runtime 外壳。

## Acceptance Criteria

1. 源基线 SHA、目标仓库、目标分支明确。
2. 单仓、单依赖体系、Mira Server 一级 domain、Desktop UI 归一化四项边界写入 current contract。
3. 两套真相、Main Thread / Builder 分离、explicit dispatch、SHA-bound review、builder_result handoff 被列为不可丢失合同。
4. 迁移映射覆盖旧 Forge `server/**`、`src/**`、docs 和测试的去向 / 不迁移结论。
5. 不把 V2 历史计划当作当前施工真相；以源代码、T015-T018、work ledger 为准。

## Validation

- 文档链接与路径检查
- `git diff --check`
- 人工核对源基线与迁移映射

## Unknown / Human Decision

None.

## Handoff

后续任务必须先读本卡产出的 `FORGE_CURRENT_CONTRACT.md`。如果迁移过程中发现源仓当前代码与固定基线存在会改变方向的冲突，先报告，不得自行换用移动中的 Forge `dev` HEAD。
