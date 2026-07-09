---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphRealProviderSmokeReport
doc_type: smoke-report
canonical: true
related:
  - docs/project-control/tasks/code_T014-codegraph-real-provider-smoke.md
  - docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-review.md
  - docs/project-control/project-control-ledger.md
  - server/test-report/code_T014-codegraph-real-provider-smoke.json
---

# code_T014 CodeGraph Real Provider Smoke Report

## Conclusion

- 结论：`blocked`
- 不允许把本次真实 provider smoke 写成 `pass` 或 `ready`
- 阻断原因：第一次真实 smoke 在当前仓库根目录新增 `.codegraph/`
- 本报告是评审线程的 GitHub 核验入口，所有原始输出都必须以仓库路径可追溯。

## Provider Summary

- provider version: `1.3.0`
- command: `codegraph`
- resolved launch: `C:\Program Files\nodejs\node.exe C:\Program Files\nodejs\node_modules\@colbymchenry\codegraph\npm-shim.js`
- start args: `serve --mcp`
- telemetry: `verified_off`
- app-data root: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-smoke\2026-07-09T12-17-39-455Z`
- log root: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-smoke\2026-07-09T12-17-39-455Z\managed-codegraph\5346191a525663a8\logs`
- index root: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-smoke\2026-07-09T12-17-39-455Z\managed-codegraph\5346191a525663a8\index`
- workspace hash: `5346191a525663a8`

## Detect / Start / Health

- detect: `ready`
- initialize: `ok`
- initialized notification: `sent`
- health: `ready`
- runtime status: `ready`
- planner exposure default: unchanged, `UI_CHAT_CODEGRAPH_PLANNER_ENABLED` 仍默认关闭

## Query Summary

4 条 smoke query 中有 3 条产出了 verified candidate。

| Query | Status | Candidate | Verified | Rejected | Unverifiable | Fallback |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `agentGraph.run 的入口在哪里？` | `ok` | 6 | 6 | 0 | 0 | `null` |
| `Planner -> Normalize -> Policy -> ToolNode -> Evidence 链路如何走？` | `ok` | 0 | 0 | 0 | 0 | `null` |
| `selectedToolIds 在哪里写入和消费？` | `ok` | 2 | 2 | 0 | 0 | `null` |
| `ToolNode 到 executeHarnessInvocation 的路径是什么？` | `ok` | 2 | 2 | 0 | 0 | `null` |

## Quality Gap

`Planner -> Normalize -> Policy -> ToolNode -> Evidence` 这条 flow query 的 CLI raw output 已出现源码块，但受控 wrapper 最终统计仍是 `0 verified`。这说明当前缺口在真实 provider 文本输出到受控 candidate / verification bridge 的转换质量，不在 Planner 默认暴露，也不允许据此放宽 Evidence gate。

这条缺口只能作为后续质量项记录，不能把它改写成“链路 ready”或“可默认 rollout”。

## Repo Pollution

- first attempt pre-repo `.codegraph/`: `false`
- current repo `.codegraph/` exists: `true`
- added repo `.codegraph/`: `true`
- added repo `.artifacts/`: `false`
- 结论：repo pollution 风险已被真实 smoke 触发，因此任务状态必须保持 `BLOCKED`

## Verification Outputs

- smoke JSON: `server/test-report/code_T014-codegraph-real-provider-smoke.json`
- smoke summary: `server/test-report/code_T014-codegraph-real-provider-smoke.md`
- vitest raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-vitest.txt`
- typecheck raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-typecheck.txt`
- pnpm check raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-pnpm-check.txt`
- provider version raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-version.txt`
- telemetry raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-telemetry.txt`
- init raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-init.txt`

## Scope Guard

- 未默认启用 Planner exposure
- 未默认开启 `codebase_explore`
- 未改 Planner / Normalize / Policy / ToolNode / Evidence 主链
- 未把 CodeGraph raw output / snippet / minimalExcerpt 塞进 Trace 或 Evidence
- 后续建议单开 `code_T015`，处理真实 provider repo pollution 与 external index root 控制；在此之前不进入 dogfood
