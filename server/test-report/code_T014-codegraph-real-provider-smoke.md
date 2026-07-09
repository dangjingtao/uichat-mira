# code_T014 CodeGraph Real Provider Smoke

## Summary

- 真实 provider：`codegraph 1.3.0`
- 真实启动链：`node.exe + npm-shim.js serve --mcp`
- telemetry：`verified_off`
- manager detect / start / health：`ready`
- 受控 `codebase_explore` 在真实 provider 下已跑通 3 条 query 的 verified candidate
- 任务最终结论：`blocked`
- review / report / json 已全部落盘，可直接在 GitHub 评审线程核对

## Why Blocked

第一次真实 smoke 尝试为了让当前 UIChat Mira 仓库可查询，真实 CodeGraph 在 repo 根目录创建了新的 `.codegraph/`。

这触发了本任务的硬性阻断条件：

- 不允许把真实 CodeGraph 默认写 repo 根目录 `.codegraph/` 说成“已满足”
- 一旦真实 smoke 证明它会这样写，本任务结论必须是 `blocked`

因此，这次任务证明的是“真实 provider 兼容层成立”，不是“可以进入 ready rollout”。

对应评审入口：

- task card: `docs/project-control/tasks/code_T014-codegraph-real-provider-smoke.md`
- review: `docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-review.md`
- smoke report: `docs/project-control/reviews/code_T014-codegraph-real-provider-smoke-report.md`

## Detect

- command: `codegraph`
- startArgs: `["serve","--mcp"]`
- providerVersion: `1.3.0`
- telemetryStatus: `verified_off`
- appDataRoot: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-smoke\2026-07-09T12-17-39-455Z`
- logRoot: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-smoke\2026-07-09T12-17-39-455Z\managed-codegraph\5346191a525663a8\logs`
- indexRoot: `C:\Users\ADMINI~1\AppData\Local\Temp\uichat-mira-codegraph-smoke\2026-07-09T12-17-39-455Z\managed-codegraph\5346191a525663a8\index`

## Start And Health

- initialize: `ok`
- initialized notification sent: `true`
- health: `ready`
- status: `ready`
- workspaceHash: `5346191a525663a8`

## Query Results

### `agentGraph.run 的入口在哪里？`

- status: `ok`
- candidateCount: `6`
- verifiedCount: `6`
- rejectedCount: `0`
- unverifiableCount: `0`
- fallbackReason: `none`
- raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-agentGraph-run-的入口在哪里-raw.txt`

### `Planner -> Normalize -> Policy -> ToolNode -> Evidence 链路如何走？`

- status: `ok`
- candidateCount: `0`
- verifiedCount: `0`
- rejectedCount: `0`
- unverifiableCount: `0`
- fallbackReason: `none`
- raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-Planner-Normalize-Policy-ToolNode-Evidence-链路如何走-raw.txt`
- note: CLI raw output 已显示 `server/src/agent/nodes/tool-node.ts` 源码块，但当前受控 wrapper / verification 统计仍是 `0`，这说明复杂 flow query 的文本解析还有缺口。

### `selectedToolIds 在哪里写入和消费？`

- status: `ok`
- candidateCount: `2`
- verifiedCount: `2`
- rejectedCount: `0`
- unverifiableCount: `0`
- fallbackReason: `none`
- raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-selectedToolIds-在哪里写入和消费-raw.txt`

### `ToolNode 到 executeHarnessInvocation 的路径是什么？`

- status: `ok`
- candidateCount: `2`
- verifiedCount: `2`
- rejectedCount: `0`
- unverifiableCount: `0`
- fallbackReason: `none`
- raw output: `server/test-report/code_T014-codegraph-real-provider-smoke-ToolNode-到-executeHarnessInvocation-的路径是什么-raw.txt`

## Repo Pollution

- preRepoCodegraph: `false` on the first real smoke attempt
- postRepoCodegraph: `true`
- addedRepoCodegraph: `true`
- preRepoArtifacts: `true`
- postRepoArtifacts: `true`
- addedRepoArtifacts: `false`

## Command Outputs

- version: `server/test-report/code_T014-codegraph-real-provider-smoke-version.txt`
- telemetry: `server/test-report/code_T014-codegraph-real-provider-smoke-telemetry.txt`
- init: `server/test-report/code_T014-codegraph-real-provider-smoke-init.txt`

## Conclusion

`blocked`
