---
status: current
priority: P2
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodebaseUnderstandingConsensusDocIntegration
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/README.md
  - docs/WIKI_SYSTEM_SCHEMA.md
task_state: READY_FOR_REVIEW
---

# code_T001 Codebase Understanding Consensus Doc Integration

## Target

把外部 `CARD-01` 本地化为当前仓库的 docs-only 任务卡，并新增或更新共识文档：

- `docs/tooling-runtime/codebase-understanding-consensus.md`

该文档属于当前仓库自己的文档系统，不沿用外部任务包里的 `docs/agent/` 目录。

## Allowed Changes

- `docs/tooling-runtime/codebase-understanding-consensus.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/tasks/code_T001-codebase-understanding-consensus-doc-integration.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/**`
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`
- 任何测试文件
- `docs/agent/**`
- 直接接入 CodeGraph、`codebase-memory-mcp`、Serena
- 修改 Agent Runtime、Planner、Normalize、Policy、ToolNode、Evidence 主循环

## Acceptance Criteria

1. `docs/tooling-runtime/codebase-understanding-consensus.md` 存在
2. 文档明确区分 OpenCode、CodeGraph、`codebase-memory-mcp`、Serena 的定位
3. 文档明确 `workspace_inventory`、`search_text`、`read_file_slice` 是不可删除的基础能力
4. 文档明确图谱结果必须回到原文核验后，才能进入 Evidence
5. 文档明确 CodeGraph 即使成为核心工具，Harness 仍保留权限、调度、Trace、Evidence、降级和最终裁决职责
6. 文档明确当前阶段只做文档，不修改 Runtime，不安装依赖，不接入实现
7. 目标文档元数据符合当前 docs schema，尤其 `layer`、`module`、`doc_type`、`status` 合法，且归类与 `Tool` 模块一致
8. 没有运行时代码变更、没有依赖变更、没有测试文件无关改动

## Verification

- 内容核对：
  - 检查目标文档是否存在
  - 逐条核对 acceptance criteria
  - 核对目标文档 front matter 是否符合 `docs/WIKI_SYSTEM_SCHEMA.md` 的 allowed values
- 变更核对：
  - `git diff --name-only`
  - `git status --short`
  - 两者结合核对已跟踪变更和未跟踪新增文件，结果只应落在允许改动范围内
- 自动化验证：
  - docs-only 任务包，不强制运行自动化命令

## Evidence Requirements

- Changed files
- Diff summary
- Acceptance criteria evidence
- 明确声明未修改运行时代码、依赖和测试文件

## Evidence

- Changed files:
  - `docs/tooling-runtime/codebase-understanding-consensus.md`
  - `docs/tooling-runtime/README.md`
  - `docs/project-control/tasks/code_T001-codebase-understanding-consensus-doc-integration.md`
  - `docs/project-control/project-control-ledger.md`

- Diff summary:
  - 新增 `codebase-understanding-consensus.md`，把 OpenCode、CodeGraph、`codebase-memory-mcp`、Serena 的定位收敛到当前仓库文档系统。
  - 将目标文档元数据归入当前 schema 允许值：`layer: wiki`、`module: Tool`、`doc_type: current-contract`、`status: current`。
  - 明确 `workspace_inventory`、`search_text`、`read_file_slice` 是不可删除的基础能力。
  - 明确图谱、索引、语义导航结果必须回到原文核验后才能进入 Evidence。
  - 明确即使 CodeGraph 成为核心工具，Harness 仍保留权限、调度、Trace、Evidence、降级和最终裁决职责。
  - 更新 `docs/tooling-runtime/README.md`，把共识文档加入工具运行时入口。
  - 同步更新项目总台账中 `code_T001` 的任务状态和说明。
  - 从 `code_T001` 施工范围移除 `docs/project-control/reviews/codebase-understanding-docs-review-index.md`；该文件属于 CARD-05 review 材料，不作为 CARD-01 必要产物。
  - 将范围核对验证从单独 `git diff --name-only` 补强为 `git diff --name-only` 加 `git status --short`，覆盖未跟踪新增文件。

- Acceptance criteria evidence:
  - AC1：`docs/tooling-runtime/codebase-understanding-consensus.md` 已新增。
  - AC2：目标文档 `名词定位` 章节分别定义 OpenCode、CodeGraph、`codebase-memory-mcp`、Serena。
  - AC3：目标文档 `不可删除的基础能力` 章节明确 `workspace_inventory`、`search_text`、`read_file_slice` 不可删除。
  - AC4：目标文档 `Evidence 原文核验规则` 章节明确图谱结果进入 Evidence 前必须回到原文核验。
  - AC5：目标文档 `Harness 保留的职责` 章节明确 Harness 保留权限、调度、Trace、Evidence、降级和最终裁决职责。
  - AC6：目标文档 `当前阶段边界` 章节明确当前阶段只做文档，不修改 Runtime，不安装依赖，不接入实现。
  - AC7：目标文档 front matter 使用 schema 允许值：`layer: wiki`、`module: Tool`、`doc_type: current-contract`、`status: current`。
  - AC8：本任务未修改运行时代码、依赖文件或测试文件；变更范围只落在 Allowed Changes。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待评审范围：docs-only 共识文档集成
- 明确未修改：运行时代码、依赖文件、测试文件、Agent Runtime、Planner、Normalize、Policy、ToolNode、Evidence 主循环

## Known Risks / Blockers

- 外部卡片默认把文档落到 `docs/agent/`，与当前仓库文档系统不一致；施工时不得照搬
