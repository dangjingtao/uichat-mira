---
status: current
priority: P2
owner: docs
last_verified: 2026-07-06
layer: project-control
module: SKILL
feature: SkillDocsFoundation
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/skill/README.md
  - docs/skill/skill-memory-poc.md
  - docs/skill/schema/skill-card.schema.md
  - docs/skill/catalog/README.md
  - docs/skill/roadmap.md
task_state: READY_FOR_REVIEW
---

# skill_T001 Docs-Only Foundation

## Target

把 `docs/skill` 基础数据 POC 整理成可评审、可演进的 `0.1` 版本。

本任务只整理文档，不实现 runtime，不修改 Agent/Harness/MCP/DB/server/desktop 代码。

当前任务明确停留在 `docs-only Phase 0`。

## Allowed Changes

- `docs/skill/**`
- `docs/project-control/tasks/skill_T001-docs-only-foundation.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/**`
- `desktop/**`
- `tauri/**`
- `scripts/**`
- DB schema
- AgentGraph
- Harness
- MCP
- ToolNode
- Policy
- Planner
- runtime 代码

## Acceptance Criteria

1. 所有 skill id 命名统一为 snake_case，文件名保持 kebab-case，并在 schema 中明确 file slug 与 skill id 的区别。
2. `save_preference` 明确当前 POC 只支持把偏好条目以可见文本形式并入 thread-level memory，用户可手动编辑或清空整段 memory，逐条编辑 / 逐条删除属于 `Phase 2`。
3. `save_thread_memory` 明确覆盖、追加、改写现有 memory 前都必须先生成合并草案，默认不直接覆盖，只有用户明确确认覆盖时才允许覆盖。
4. 新增 `docs/skill/catalog/README.md` 作为 skill card 入口索引。
5. 新增 `docs/skill/roadmap.md`，明确 `Phase 0 / Phase 1 / Phase 2 / Phase 3 / Phase 4` 的边界，并说明当前任务停留在 `docs-only Phase 0`。
6. `docs/skill/eval/*.md` 与 `docs/project-control/project-control-ledger.md` 已同步更新到同一口径。
7. 不新增 runtime，不修改 forbidden area。

## Verification

- `git diff -- docs/skill docs/project-control/tasks/skill_T001-docs-only-foundation.md docs/project-control/project-control-ledger.md`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 核对变更范围、确认 docs-only 文档整理内容
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查是否误触 forbidden area

本任务是 docs-only，不跑 `typecheck` 或 `pnpm check`：

- 原因：本次没有修改 runtime、类型、构建链、打包链或任何可执行代码；验收目标是文档口径统一和范围约束，不是实现验证。

## Evidence

- Changed files:
  - `docs/project-control/tasks/skill_T001-docs-only-foundation.md`
  - `docs/project-control/project-control-ledger.md`
  - `docs/skill/README.md`
  - `docs/skill/skill-memory-poc.md`
  - `docs/skill/schema/skill-card.schema.md`
  - `docs/skill/catalog/README.md`
  - `docs/skill/catalog/save-thread-memory.skill.md`
  - `docs/skill/catalog/save-preference.skill.md`
  - `docs/skill/catalog/save-decision.skill.md`
  - `docs/skill/eval/skill-selection-cases.md`
  - `docs/skill/eval/skill-boundary-cases.md`
  - `docs/skill/roadmap.md`

- Diff summary:
  - 建立 docs-only 任务卡并登记到项目总台账
  - 把 skill 基础数据从零散 POC 文档收成 `Phase 0` 文档包
  - 统一 skill card 的命名口径：文件名 kebab-case，稳定 id snake_case
  - 修正 `save_preference` 与 `save_thread_memory` 的当前 POC 验收边界
  - 新增 catalog 索引与 roadmap，明确后续分阶段演进路径
  - 同步更新 eval 文档，避免评估用例仍沿用旧口径

## Unfinished / Risks

- 当前只完成 docs-only 基础数据，不包含 runtime、存储协议、UI 入口或执行 trace 设计。
- `Phase 1` 之后一旦进入实现，仍需重新评估 thread-level memory 的写回契约、确认交互和可见对象归属，不能把本任务文档直接当成已批准的实现方案。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 提交内容：docs-only `Phase 0` 基础文档整理
