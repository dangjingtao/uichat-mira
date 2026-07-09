---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphRealProviderSmokeReview
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T014-codegraph-real-provider-smoke.md
  - docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-report.md
  - docs/project-control/tasks/code_T013-codegraph-controlled-planner-exposure.md
  - docs/project-control/project-control-ledger.md
  - server/test-report/code_T014-codegraph-real-provider-smoke.md
---

# code_T014 CodeGraph Real Provider Smoke Review

## Scope

本 review 只审：

- 真实 CodeGraph provider detect / start / health
- 真实 provider 下的受控 `codebase_explore` wrapper、verification、trace、fallback
- repo pollution 风险是否被诚实记录

不审：

- Planner prompt 改造
- Agent Graph 主路由
- Generate 行为
- 大范围 rollout

## What This Task Proves

1. 真实 CodeGraph provider 在当前 Windows 环境下不是“完全起不来”，而是可以被 detect、可以走标准 MCP `serve --mcp`、可以完成 `initialize + initialized + tools/list + tools/call`。
2. `managed-codegraph` 隔离层在不改主链的前提下，已经兼容了真实 provider 与 fake provider 之间的三类真实差异：Windows npm shim 启动、标准 MCP 方法名、`codegraph_explore` 文本输出解析。
3. 真实 provider 下，`codebase_explore` 仍然保持受控工具边界，verified-only Evidence gate 没有被放宽，trace 也没有吸入 raw output。

## What This Task Does Not Prove

1. 真实 CodeGraph provider 可以在当前仓库上无污染接入。
2. 所有架构类中文问题都能稳定得到可核验 candidate。
3. `codebase_explore` 已适合默认向普通 Agent 或所有仓库开放。

## Review Findings

### 1. 真实 provider 兼容层已经成立

- 默认启动参数已修正为真实 CLI 需要的 `serve --mcp`
- manager 现在会发送标准 `initialized`，同时保留 legacy `notifications/initialized`，因此真实 provider 与既有 fake-provider 回归都能共存
- health 现在能识别标准 `tools/list` / `codegraph_status`，不再把真实 MCP server 误判成 provider unavailable

### 2. Windows 全局 npm shim 问题被定位并修正

- PowerShell 里 `codegraph` 可执行，不代表 Node `spawn("codegraph")` 可执行
- 真实问题在于 Windows 全局 npm shim 的 `.cmd` 启动链
- 当前实现已改为直接解析到 `node.exe + npm-shim.js`，因此 detect / probe / MCP session / smoke script 走的是同一条稳定启动链

### 3. 受控链路没有越界

- 没有把 CodeGraph 原生命令暴露给普通 Agent
- 没有改 Planner / Normalize / Policy / ToolNode / Evidence 主链
- `codebase_explore` 仍然只输出 verification bridge 可消费的受控结果
- trace 里有 `exposureMode / providerVersion / workspaceHash / telemetryStatus / fallbackReason`，没有 raw output / snippet / minimalExcerpt

### 4. 真实 query 能跑，但不是所有 query 都同样稳

- `agentGraph.run 的入口在哪里？`、`selectedToolIds 在哪里写入和消费？`、`ToolNode 到 executeHarnessInvocation 的路径是什么？` 都拿到了 verified candidate
- `Planner -> Normalize -> Policy -> ToolNode -> Evidence 链路如何走？` 这条 query 的 CLI raw output 明明带了文件源码块，但当前受控 wrapper 统计里 verified count 为 `0`

这说明：

- 真实 provider 不是不能查
- 但当前文本解析与 verification bridge 对复杂多段结构问题仍有稳定性缺口

这属于可继续收敛的实现缺口，不是主链边界失守。

### 5. 阻断点是 repo pollution，不是 provider readiness

- 当前仓库在第一次真实 smoke 尝试时新增了 repo 根目录 `.codegraph/`
- 这触发了任务卡明确写死的阻断条件
- 因此本任务不能写 PASS，也不能写 ready

## Remaining Risks

1. 真实 CodeGraph 当前仍默认把索引写到 repo 根目录 `.codegraph/`，这与本任务的“默认不污染 repo”边界冲突。
2. 某些复杂中文 query 已经能在 CLI raw output 里看到可读结果，但 wrapper 还不能稳定把它们全部转成 verified candidate。
3. 由于 repo 已经污染，后续再跑 smoke 时不能再把结果当成 clean-baseline 证明。

## Review Conclusion

- 总结论：`不通过 / blocked`
- 阻断原因：
  - 真实 CodeGraph 在当前仓库根目录创建了 `.codegraph/`
- 非阻断发现：
  - 真实 provider 兼容层已经成立
  - 三条 query 已经能在受控链路中产出 verified candidate
  - 复杂 flow query 仍有 wrapper 解析缺口
- 建议下一步：
  - 单开 `code_T015`，专门解决真实 provider repo pollution 与 external index root 控制问题
  - `code_T015` 未解决前，不进入 dogfood
  - 复杂 flow query 的 candidate 解析与 verification 命中率缺口，作为 `code_T015` 之外的后续质量项单列

## Review Thread Verification Pointers

- 任务卡：`docs/project-control/tasks/code_T014-codegraph-real-provider-smoke.md`
- smoke report：`docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-report.md`
- smoke JSON：`server/test-report/code_T014-codegraph-real-provider-smoke.json`
- 原始输出：
  - `server/test-report/code_T014-codegraph-real-provider-smoke-vitest.txt`
  - `server/test-report/code_T014-codegraph-real-provider-smoke-typecheck.txt`
  - `server/test-report/code_T014-codegraph-real-provider-smoke-pnpm-check.txt`
