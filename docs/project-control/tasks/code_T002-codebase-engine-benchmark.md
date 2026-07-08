---
status: current
priority: P2
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodebaseEngineBenchmarkPlan
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/codebase-understanding-docs-review-index.md
  - docs/tooling-runtime/README.md
  - docs/tooling-runtime/codebase-understanding-consensus.md
task_state: DONE
---

# code_T002 Codebase Engine Benchmark

## Target

把外部 `CARD-02` 本地化为当前仓库的 docs-only 任务卡，并新增 benchmark 方案文档：

- `docs/tooling-runtime/codebase-engine-benchmark.md`

## Allowed Changes

- `docs/tooling-runtime/codebase-engine-benchmark.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/tasks/code_T002-codebase-engine-benchmark.md`
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
- 安装 CodeGraph、`codebase-memory-mcp`、Serena
- 新增测试实现或写接入代码

## Acceptance Criteria

1. `docs/tooling-runtime/codebase-engine-benchmark.md` 存在
2. 文档包含 CodeGraph、`codebase-memory-mcp`、Serena 三个候选
3. 文档包含真实仓库问题集，包括 `agentGraph.run`、Planner 到 Evidence 链路、`selectedToolIds`、`answerReadiness.canAnswer`、`executeHarnessInvocation`、`policyNode` 影响测试
4. 文档包含准确率、工具调用次数、原文位置、Evidence 可用性、Windows 稳定性、索引耗时、重复运行一致性、上下文体积、grep/read 降幅、失败后降级等维度
5. 文档包含评分表模板
6. 文档包含通过/不通过判定规则，并明确不能只看 README 或 demo
7. 没有代码实现变更、没有依赖变更

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
- 明确声明未修改代码实现和依赖

## Completion Evidence

### Changed Files

- `docs/tooling-runtime/codebase-engine-benchmark.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/tasks/code_T002-codebase-engine-benchmark.md`
- `docs/project-control/project-control-ledger.md`

### Diff Summary

- 新增 `docs/tooling-runtime/codebase-engine-benchmark.md`，以 `status: planned` 定义 CodeGraph、`codebase-memory-mcp`、Serena 的真实仓库 benchmark 方案。
- 更新 `docs/tooling-runtime/README.md`，把 benchmark 文档加入工具运行时入口和阅读路径。
- 更新本任务卡 `task_state` 为 `DONE`，并补充完成证据。
- 更新 `docs/project-control/project-control-ledger.md` 中 `code_T002` 的完成状态和索引说明。

### Acceptance Criteria Evidence

- `docs/tooling-runtime/codebase-engine-benchmark.md` 已存在，元数据状态为 `status: planned`。
- 候选范围包含 CodeGraph、`codebase-memory-mcp`、Serena。
- 真实仓库问题集覆盖 `agentGraph.run`、Planner 到 Evidence 链路、`selectedToolIds`、`answerReadiness.canAnswer`、`executeHarnessInvocation`、`policyNode` 影响测试。
- 评估维度覆盖准确率、工具调用次数、原文位置、Evidence 可用性、Windows 稳定性、索引耗时、重复运行一致性、上下文体积、grep/read 降幅、失败后降级。
- 文档包含候选评分表和单次 benchmark 记录模板。
- 文档包含通过/不通过判定规则，并明确不能只看 README、目录树或 demo。
- 本任务未修改代码实现、测试文件、依赖清单或 lockfile。

### Verification

- 内容核对：已按本任务卡 Acceptance Criteria 逐项核对。
- 变更核对：已运行 `git diff --name-only` 和 scoped `git status --short`；当前工作区存在任务外 `server/src/**` 既有改动，本任务只新增或更新允许范围内文档。
- 自动化验证：docs-only 任务包，未运行自动化测试。

`git status --short` 输出：

```text
 M docs/project-control/project-control-ledger.md
 M docs/tooling-runtime/README.md
 M server/src/agent/__tests__/graph.test.ts
 M server/src/agent/__tests__/next-action-planner.test.ts
 M server/src/agent/__tests__/tool-call-normalize.test.ts
 M server/src/agent/evidence.ts
 M server/src/agent/nodes/tool-call-normalize.ts
 M server/src/agent/planner/node.ts
 M server/src/agent/planner/prompt.ts
 M server/src/agent/types.ts
 M server/src/mcp/core/definitions.ts
 M server/src/mcp/tools/terminal-session.tool.test.ts
 M server/src/mcp/tools/terminal-session.tool.ts
 M server/src/mcp/workspace-path-args.ts
?? docs/project-control/reviews/codebase-understanding-docs-review-index.md
?? docs/project-control/tasks/agent_node_T034-terminal-session-cwd-planner-contract.md
?? docs/project-control/tasks/agent_node_T035-planner-answer-stop-task-completion.md
?? docs/project-control/tasks/agent_node_T036-planner-mutation-completion-regression-tests.md
?? docs/project-control/tasks/code_T001-codebase-understanding-consensus-doc-integration.md
?? docs/project-control/tasks/code_T002-codebase-engine-benchmark.md
?? docs/project-control/tasks/code_T003-codegraph-managed-mcp-spike.md
?? docs/project-control/tasks/code_T004-codebase-engine-abstraction.md
?? docs/tooling-runtime/codebase-engine-benchmark.md
?? docs/tooling-runtime/codebase-understanding-consensus.md
```
