---
status: current
priority: P1
owner: docs
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphManagedMcpRuntimeImplementationPlan
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/README.md
  - docs/tooling-runtime/codegraph-managed-mcp-runtime-implementation-plan.md
  - docs/tooling-runtime/codegraph-managed-mcp-spike.md
  - docs/tooling-runtime/codegraph-wrapper-contract.md
task_state: DONE
---

# code_T008 CodeGraph Managed MCP Runtime Implementation Plan

## Target

新增 CodeGraph Managed MCP Runtime Implementation Plan 文档，作为未来 runtime spike / runtime implementation 的前置设计。

本任务只做实现计划，不写 runtime 代码，不接 CodeGraph，不新增正式 MCP server。

本任务目标文档：

- `docs/tooling-runtime/codegraph-managed-mcp-runtime-implementation-plan.md`

## Allowed Changes

- `docs/project-control/tasks/code_T008-codegraph-managed-mcp-runtime-implementation-plan.md`
- `docs/tooling-runtime/codegraph-managed-mcp-runtime-implementation-plan.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/**`
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`
- 任何测试文件
- Agent Runtime / Planner / Normalize / Policy / ToolNode / Evidence 实现
- MCP runtime 实现代码
- CodeGraph 安装、启动、进程托管代码
- CodeGraph wrapper runtime 代码

## Acceptance Criteria

1. 新增 `docs/tooling-runtime/codegraph-managed-mcp-runtime-implementation-plan.md`
2. 文档明确本任务是 implementation plan，不是 implementation
3. 文档明确 T008 不接入 runtime，不启动 CodeGraph，不新增 MCP server
4. 文档明确后续 runtime 施工必须另开任务卡，如 `code_T009`、`code_T010`
5. 文档明确 T008 输出只作为后续实现的设计约束
6. 文档包含完整 runtime architecture
7. 文档包含 process manager 计划
8. 文档包含 Windows-only 部署边界
9. 文档包含 telemetry 策略
10. 文档包含 scope / wrapper 继承规则
11. 文档包含 `codebase_explore` 四层 runtime 分层
12. 文档包含 Trace 计划
13. 文档包含 Evidence 接入计划
14. 文档包含失败降级矩阵
15. 文档包含权限边界
16. 文档包含 provider 状态机
17. 文档包含后续任务切分 `code_T009` 到 `code_T013`
18. 文档明确：
    - T009 之前不得让 Planner 看到 CodeGraph
    - T011 之前不得把 CodeGraph candidate 接入 Evidence
    - T013 之前不得默认启用给普通 Agent
19. `docs/tooling-runtime/README.md` 已补入该文档索引
20. `docs/project-control/project-control-ledger.md` 已登记 `code_T008`
21. 明确本任务 docs-only，不接 runtime
22. 没有修改任何 runtime / production / test / dependency 文件

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
- 明确声明本任务 docs-only，未接 runtime
- 明确声明未修改 `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**`、测试文件、`package.json`、`pnpm-lock.yaml`

## Completion Evidence

### Changed Files

本任务实际改动：

- `docs/project-control/tasks/code_T008-codegraph-managed-mcp-runtime-implementation-plan.md`
- `docs/tooling-runtime/codegraph-managed-mcp-runtime-implementation-plan.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/project-control-ledger.md`

### Diff Summary

- 新增 `docs/tooling-runtime/codegraph-managed-mcp-runtime-implementation-plan.md`，把 CodeGraph 进入 runtime 前的托管进程、wrapper 接线、原文核验、Trace、Evidence、失败降级和权限边界固定成 implementation plan。
- 文档明确 T008 只是 implementation plan，不接 runtime、不启动 CodeGraph、不新增 MCP server，并把真正施工拆分为 `code_T009` 到 `code_T013`。
- 文档补齐 Windows-only 部署边界、telemetry 默认关闭策略、provider 状态机与失败降级矩阵，确保 CodeGraph 不会污染 Agent Runtime 主链。
- 更新 `docs/tooling-runtime/README.md` 与 `docs/project-control/project-control-ledger.md`，把 `code_T008` 纳入工具运行时入口和项目总台账。

### Acceptance Criteria Evidence

- AC1-5：目标文档 `Purpose` 与 `Stage Positioning` 章节明确 T008 是 implementation plan，不是 implementation；不接 runtime、不启动 CodeGraph、不新增 MCP server；后续需另开 `code_T009` 到 `code_T013`；当前输出只作为设计约束。
- AC6：目标文档 `Target Architecture` 章节给出完整链路，并明确 Planner 不直接调用 CodeGraph、CodeGraph process 不直接写 Evidence、结果必须先标准化、进入 Evidence 前必须原文核验。
- AC7：目标文档 `Managed MCP Process Plan` 章节设计 `ManagedMcpProcessManager` 的十项职责，并明确第一阶段推荐 Managed MCP Process、Node 22.x Worker 仅作为第二阶段候选、CodeGraph 崩溃不能影响主链、不可用时必须降级到基础读取能力。
- AC8：目标文档 `Windows-Only Deployment Boundary` 章节定义 Windows-only 部署边界、app data 目录布局、workspace hash 隔离、repo 污染边界和 `.codegraph/` Phase 1 风险记录。
- AC9：目标文档 `Telemetry Policy` 章节明确 telemetry 默认关闭、启动前必须验证关闭、最少记录项，以及无法验证关闭时只能是 `unavailable` 或 `blocked`。
- AC10-11：目标文档 `Scope And Wrapper Inheritance` 与 `Runtime Layering` 章节明确完全继承 `code_T007` wrapper 合同，并定义 capability exposure、wrapper、provider、verification 四层。
- AC12：目标文档 `Trace Plan` 章节列出所需 trace 字段，并明确 Trace 只放诊断摘要，不直接承载大量源码或完整 raw output。
- AC13：目标文档 `Evidence Plan` 章节明确 candidate 先进入候选事实池，核验后才能形成 `EvidenceItem`，失败必须标记 `rejected` / `unverifiable`。
- AC14：目标文档 `Failure Degradation Matrix` 章节给出标准降级链和失败场景矩阵。
- AC15：目标文档 `Permissions Boundary` 章节明确 workspace 权限与 path validation 边界。
- AC16：目标文档 `Provider State Machine` 章节定义 provider 状态。
- AC17-18：目标文档 `Follow-On Task Split` 章节规划 `code_T009` 到 `code_T013`，并明确各阶段前置限制。
- AC19：`docs/tooling-runtime/README.md` 已补入该文档索引。
- AC20：`docs/project-control/project-control-ledger.md` 已登记 `code_T008`。
- AC21-22：目标文档 `Out Of Scope` 与本任务卡 `Target`、`Forbidden Changes` 章节明确本任务 docs-only，不接 runtime，且未修改任何 runtime / production / test / dependency 文件。

### Verification

- 内容核对：已按 acceptance criteria 逐条核对。
- 自动化验证：未运行自动化命令；原因是本任务仅修改 docs，不涉及 runtime、打包或测试实现。

## Review Outcome

- 当前状态：`DONE`
- 评审结论：`code_T008` 文档可作为后续 runtime 任务的设计约束
- 明确未修改：runtime、依赖、测试文件、Agent Runtime 实现、MCP runtime 实现、CodeGraph 安装/启动/托管代码、CodeGraph wrapper runtime 代码
