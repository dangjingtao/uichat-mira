---
status: current
priority: P1
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodeGraphBenchmarkSpike
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/codegraph-benchmark-spike.md
  - docs/tooling-runtime/codebase-engine-benchmark.md
  - docs/tooling-runtime/codegraph-managed-mcp-spike.md
task_state: DONE
---

# code_T006 CodeGraph Benchmark Spike

## Target

在不接入 Agent Runtime 的前提下，做一次本地 CodeGraph benchmark spike，验证 CodeGraph 是否适合作为 UIChat Mira 的核心 Codebase Understanding Engine 第一候选。

本任务输出的是实验记录与结论文档，不是运行时实现：

- `docs/project-control/reviews/codegraph-benchmark-spike.md`

## Allowed Changes

- `docs/project-control/reviews/codegraph-benchmark-spike.md`
- `docs/project-control/tasks/code_T006-codegraph-benchmark-spike.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/**`
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `docs/tooling-runtime/**`
- `package.json`
- `pnpm-lock.yaml`
- Planner / Normalize / Policy / ToolNode / Evidence
- 新增正式 MCP server
- 把 CodeGraph 暴露给 Planner
- 任何生产代码改动

## Acceptance Criteria

1. 新增 `docs/project-control/reviews/codegraph-benchmark-spike.md`
2. spike 按 `docs/tooling-runtime/codebase-engine-benchmark.md` 的 Q1-Q8 执行，并至少覆盖：
   - `agentGraph.run` 入口
   - Planner -> Normalize -> Policy -> ToolNode -> Evidence 链路
   - `selectedToolIds` 生成、写入、消费
   - `answerReadiness.canAnswer` 生成和消费
   - ToolNode 到 `executeHarnessInvocation` 的路径
   - `policyNode` 改动影响哪些测试
3. review 文档明确记录：
   - CodeGraph 版本 / 安装方式 / 运行命令
   - Windows 环境信息
   - 索引耗时
   - 每个问题的查询过程
   - 返回的文件路径和行号
   - 必要的 follow-up read 次数
   - 命中 / 漏报 / 误报
   - 是否比 `rg + read` 更省工具调用
   - 是否能进入 Evidence 前候选事实池
   - 最终建议：继续 / 暂缓 / 放弃
4. 如果本地安装了 CodeGraph，review 文档必须额外记录：
   - 安装命令
   - 版本
   - 运行环境
   - 索引路径
   - telemetry 是否关闭，以及具体关闭方式
5. 整个 spike 不接入 runtime，不修改生产代码，不新增正式 MCP server
6. 没有修改 `server/src/**`、`desktop/src/**`、`package.json`、`pnpm-lock.yaml`

## Verification

- 内容核对：
  - 检查 `docs/project-control/reviews/codegraph-benchmark-spike.md` 是否存在
  - 逐条核对 acceptance criteria
- 变更核对：
  - `git diff --name-only`
  - `git status --short`
  - 确认实际改动只落在 Allowed Changes
- 实验核对：
  - review 文档需列出实际运行命令、实验环境和结果摘要

## Evidence Requirements

- Changed files
- Diff summary
- Acceptance criteria evidence
- 明确声明未修改 runtime、未新增正式 MCP server、未修改生产代码
- 如果安装或运行了 CodeGraph，必须记录实际命令、版本和 telemetry 关闭方式

## Completion Evidence

- 新增 `docs/project-control/reviews/codegraph-benchmark-spike.md`
- 本地已实际执行：
  - `npm install -g @colbymchenry/codegraph`
  - `codegraph telemetry off`
  - `codegraph init .`
  - `codegraph status .`
  - 针对 Q1-Q8 的 `query` / `explore` / `affected` 命令
- review 已记录：
  - CodeGraph 版本、安装方式、运行命令
  - Windows 环境信息
  - 索引耗时、索引规模、索引路径
  - 每个问题的查询过程、返回文件路径与行号
  - follow-up read 次数
  - 命中、漏报、误报
  - 与 `rg + read` 基线对比
  - Candidate fact pool / Evidence 边界判断
  - 最终建议：`继续`

## Known Risks / Blockers

- CodeGraph 若需要单独安装或下载 binary，本任务只能做本地实验，不得把安装结果混入仓库正式 runtime
- dev 分支当前存在任务外 runtime / UI / bugfix 改动；实验记录必须明确这些改动不属于本 spike 的审查范围
- 如果 CodeGraph 无法稳定返回 source path / line range，本任务结论应为 `暂缓` 或 `放弃`，不得为了推进后续任务弱化 Evidence 门槛
