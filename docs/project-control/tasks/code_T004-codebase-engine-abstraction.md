---
status: current
priority: P2
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodebaseUnderstandingEngineAbstraction
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/codebase-understanding-docs-review-index.md
  - docs/tooling-runtime/README.md
  - docs/tooling-runtime/codegraph-managed-mcp-spike.md
task_state: DONE
---

# code_T004 Codebase Engine Abstraction

## Target

把外部 `CARD-04` 本地化为当前仓库的 docs-only 任务卡，并新增抽象层设计文档：

- `docs/tooling-runtime/codebase-engine-abstraction.md`

## Allowed Changes

- `docs/tooling-runtime/codebase-engine-abstraction.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/tasks/code_T004-codebase-engine-abstraction.md`
- `docs/project-control/reviews/codebase-understanding-docs-review-index.md`
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
- 新增 TypeScript 接口文件
- 修改 runtime
- 接入 CodeGraph
- 安装依赖

## Acceptance Criteria

1. `docs/tooling-runtime/codebase-engine-abstraction.md` 存在
2. 文档明确抽象目标，统一 CodeGraph、`codebase-memory-mcp`、Serena、`builtin-rg-tsmorph`
3. 文档包含 provider 预留：`codegraph`、`codebase-memory-mcp`、`serena`、`builtin-rg-tsmorph`
4. 文档包含 `index`、`status`、`explore`、`findSymbol`、`findReferences`、`impact` 接口草案
5. 文档定义结果合同：`source path`、`line range`、`summary`、`confidence`、`limitations`、`engine/provider`、`raw references`
6. 文档明确没有 `source path` / `line range` 的结果只能作为线索，不能作为高置信 Evidence
7. 文档明确第一阶段对 Agent 只暴露 `codebase_explore`
8. 文档明确 `CodebaseContext -> 原文核验 -> EvidenceItem` 接入关系
9. 文档明确降级策略：引擎降级、结构工具失败降级、索引 stale 降级
10. 没有代码实现变更、没有依赖变更

## Verification

- 内容核对：
  - 检查目标文档是否存在
  - 逐条核对 acceptance criteria
- 变更核对：
  - `git diff --name-only`
- 自动化验证：
  - docs-only 任务包，不强制运行自动化命令

## Evidence Requirements

- Changed files
- Diff summary
- Acceptance criteria evidence
- 明确声明未新增接口代码、未修改 runtime、未安装依赖

## Completion Evidence

### Changed Files

本任务实际改动：

- `docs/tooling-runtime/codebase-engine-abstraction.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/tasks/code_T004-codebase-engine-abstraction.md`
- `docs/project-control/reviews/codebase-understanding-docs-review-index.md`
- `docs/project-control/project-control-ledger.md`

任务外既有改动：

- `server/src/agent/__tests__/graph.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/tool-call-normalize.test.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/nodes/tool-call-normalize.ts`
- `server/src/agent/planner/node.ts`
- `server/src/agent/planner/prompt.ts`
- `server/src/agent/types.ts`
- `server/src/mcp/core/definitions.ts`
- `server/src/mcp/tools/terminal-session.tool.test.ts`
- `server/src/mcp/tools/terminal-session.tool.ts`
- `server/src/mcp/workspace-path-args.ts`
- `docs/project-control/tasks/agent_node_T034-terminal-session-cwd-planner-contract.md`
- `docs/project-control/tasks/agent_node_T035-planner-answer-stop-task-completion.md`
- `docs/project-control/tasks/agent_node_T036-planner-mutation-completion-regression-tests.md`
- `docs/project-control/tasks/code_T001-codebase-understanding-consensus-doc-integration.md`
- `docs/project-control/tasks/code_T002-codebase-engine-benchmark.md`
- `docs/project-control/tasks/code_T003-codegraph-managed-mcp-spike.md`
- `docs/tooling-runtime/codebase-engine-benchmark.md`
- `docs/tooling-runtime/codebase-understanding-consensus.md`
- `docs/tooling-runtime/codegraph-managed-mcp-spike.md`

### Diff Summary

- 新增 `docs/tooling-runtime/codebase-engine-abstraction.md`，定义多 provider 代码库理解层的统一抽象目标、provider 角色、结果合同、Evidence 门槛和降级策略。
- 文档明确第一阶段对 Agent 只暴露 `codebase_explore`，不把 provider 原子接口直接裸露给 Planner。
- 文档补齐 `index`、`status`、`explore`、`findSymbol`、`findReferences`、`impact` 六类接口草案。
- 文档补齐统一结果合同，明确 `source path` / `line range` 缺失时只能作为线索，不能作为高置信 Evidence。
- 文档补齐 `CodebaseContext -> 原文核验 -> EvidenceItem` 接入关系。
- 更新 `docs/tooling-runtime/README.md`，把抽象层设计文档纳入工具运行时主线入口。
- 更新 review 索引和项目总台账，将 `code_T004` 推进到完成状态，并标记四张文档卡已齐备可总审查。

### Acceptance Criteria Evidence

- AC1：`docs/tooling-runtime/codebase-engine-abstraction.md` 已新增。
- AC2：目标文档 `Abstraction Goal` 与 `Provider Roles` 章节明确统一 CodeGraph、`codebase-memory-mcp`、Serena、`builtin-rg-tsmorph`。
- AC3：目标文档 `Provider Roles` 章节预留 `codegraph`、`codebase-memory-mcp`、`serena`、`builtin-rg-tsmorph` 四类 provider。
- AC4：目标文档 `Interface Draft` 章节包含 `index`、`status`、`explore`、`findSymbol`、`findReferences`、`impact` 六类接口草案。
- AC5：目标文档 `Unified Result Contract` 章节定义 `source path`、`line range`、`summary`、`confidence`、`limitations`、`engine/provider`、`raw references` 结果合同。
- AC6：目标文档 `Evidence Gate` 章节明确没有 `source path` / `line range` 的结果只能作为线索，不能作为高置信 Evidence。
- AC7：目标文档 `Phase 1 Exposure Rule` 章节明确第一阶段对 Agent 只暴露 `codebase_explore`。
- AC8：目标文档 `Integration Path` 与 `Result Shapes By Stage` 章节明确 `CodebaseContext -> 原文核验 -> EvidenceItem` 接入关系。
- AC9：目标文档 `Degradation Strategy` 章节明确引擎降级、结构工具失败降级、索引 stale 降级。
- AC10：本任务未新增接口代码、未修改 runtime、未安装依赖；变更仅落在 Allowed Changes。

### Verification

- 内容核对：已按 Acceptance Criteria 逐条核对。
- 变更核对：将通过 `git diff --name-only` 核对本任务改动范围；任务外既有改动已单独列出，未触碰 `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**`、测试文件、`package.json`、`pnpm-lock.yaml`。
- 自动化验证：docs-only 任务包，未运行自动化命令。

## Review Outcome

- 当前状态：`DONE`
- 待后续动作：执行 `codebase-understanding-docs-review-index.md` 总审查
- 明确未修改：runtime、依赖、测试文件、TypeScript 接口代码、Agent Runtime 主链
- owner 决定：2026-07-08 项目 owner 已明确要求直接将 `code_T004` 和相关台账标记为 `DONE`，本状态以 owner 明确认可为准
