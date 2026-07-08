---
status: current
priority: P2
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodeGraphManagedMcpSpikeDesign
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/codebase-understanding-docs-review-index.md
  - docs/tooling-runtime/README.md
  - docs/harness/README.md
task_state: DONE
---

# code_T003 CodeGraph Managed MCP Spike

## Target

把外部 `CARD-03` 本地化为当前仓库的 docs-only 任务卡，并新增设计文档：

- `docs/tooling-runtime/codegraph-managed-mcp-spike.md`

## Allowed Changes

- `docs/tooling-runtime/codegraph-managed-mcp-spike.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/tasks/code_T003-codegraph-managed-mcp-spike.md`
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
- 安装 CodeGraph
- 修改 MCP runtime、server 启动代码、Agent Graph
- 升级 Node

## Acceptance Criteria

1. `docs/tooling-runtime/codegraph-managed-mcp-spike.md` 存在
2. 文档对比 Managed MCP server、独立 Node 22.x Worker、主进程 library 嵌入三种形态
3. 文档明确第一阶段推荐 Managed MCP server，第二阶段再考虑独立 Worker，不建议第一阶段直接嵌入主进程
4. 文档包含 Windows-only 部署方案：binary 路径、版本目录、checksum、启动参数、环境变量、日志路径、索引路径、卸载/清理策略
5. 文档包含进程生命周期：安装/检测、启动、停止、重启、崩溃恢复、索引中断、重复启动保护、workspace 切换、日志采集、状态上报
6. 文档明确 telemetry 默认关闭，并包含 `CODEGRAPH_TELEMETRY=0` 或等价策略
7. 文档明确 workspace 权限、排除规则、原文核验，以及基础 `read/search` 能力不可删除
8. 文档包含 Trace / Evidence 接入点
9. 没有实现代码变更、没有依赖变更

## Verification

- 内容核对：
  - 检查目标文档是否存在
  - 逐条核对 acceptance criteria
- 变更核对：
  - `git diff --name-only`
  - `git status --short`
- 自动化验证：
  - docs-only 任务包，不强制运行自动化命令

## Evidence Requirements

- Changed files
- Diff summary
- Acceptance criteria evidence
- 明确声明未修改 runtime、依赖和 Node 版本

## Completion Evidence

### Changed Files

本任务实际改动：

- `docs/tooling-runtime/codegraph-managed-mcp-spike.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/tasks/code_T003-codegraph-managed-mcp-spike.md`
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
- `docs/project-control/tasks/code_T004-codebase-engine-abstraction.md`
- `docs/tooling-runtime/codebase-engine-benchmark.md`
- `docs/tooling-runtime/codebase-understanding-consensus.md`

### Diff Summary

- 新增 `docs/tooling-runtime/codegraph-managed-mcp-spike.md`，定义 CodeGraph 第一阶段接入前的 Managed MCP spike 设计。
- 文档对比了 Managed MCP server、独立 Node 22.x Worker、主进程 library 嵌入三种形态，并明确第一阶段优先 Managed MCP server。
- 文档补齐 Windows-only 部署方案，包括版本目录、binary 路径、checksum、启动参数、环境变量、日志路径、索引路径与卸载清理策略。
- 文档补齐进程生命周期设计，包括安装检测、启动、停止、重启、崩溃恢复、索引中断、重复启动保护、workspace 切换、日志采集与状态上报。
- 文档明确 telemetry 默认关闭，并把 `CODEGRAPH_TELEMETRY=0` 作为第一阶段最小要求。
- 文档明确 workspace 权限、排除规则、原文核验，以及 `workspace_inventory`、`search_text`、`read_file_slice` 不可删除。
- 更新 `docs/tooling-runtime/README.md`，把新文档加入工具运行时入口。
- 更新 review 索引与项目总台账，将 `code_T003` 推进到 `READY_FOR_REVIEW`。

### Acceptance Criteria Evidence

- AC1：`docs/tooling-runtime/codegraph-managed-mcp-spike.md` 已新增。
- AC2：目标文档 `Deployment Shapes` 与 `Comparison Summary` 章节对比了 Managed MCP server、独立 Node 22.x Worker、主进程 library 嵌入三种形态。
- AC3：目标文档 `Recommendation` 章节明确第一阶段推荐 Managed MCP server，第二阶段再评估独立 Worker，第一阶段不建议直接嵌入主进程。
- AC4：目标文档 `Windows-Only Deployment Plan` 章节包含 binary 路径、版本目录、checksum、启动参数、环境变量、日志路径、索引路径、卸载/清理策略。
- AC5：目标文档 `Process Lifecycle` 章节覆盖安装/检测、启动、停止、重启、崩溃恢复、索引中断、重复启动保护、workspace 切换、日志采集、状态上报。
- AC6：目标文档 `Telemetry Policy` 章节明确 telemetry 默认关闭，并要求 `CODEGRAPH_TELEMETRY=0`。
- AC7：目标文档 `Workspace Permission Boundary`、`Exclusion Rules`、`Source Verification Rule`、`Non-Removable Baseline Tools` 章节明确权限边界、排除规则、原文核验，以及基础 `read/search` 能力不可删除。
- AC8：目标文档 `Trace And Evidence Integration` 章节定义 Trace / Evidence 接入点。
- AC9：本任务未修改运行时代码、依赖、测试文件或 Node 版本；变更仅落在 Allowed Changes。

### Verification

- 内容核对：已按 Acceptance Criteria 逐条核对。
- 变更核对：已执行 `git diff --name-only` 和 `git status --short` 核对变更范围；确认本任务实际改动落在 docs 范围内，`server/src/**` 等条目为任务外既有改动。
- 自动化验证：docs-only 任务包，未运行自动化命令。

## Review Outcome

- 当前状态：`DONE`
- 待评审范围：Managed MCP spike 设计文档及相关 docs 台账
- 明确未修改：runtime、依赖、Node 版本、测试文件、MCP runtime、server 启动代码、Agent Graph
