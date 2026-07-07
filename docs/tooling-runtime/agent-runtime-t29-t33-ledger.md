# Agent Runtime T29-T33 Task Ledger

Status: Current
Owner: agent-runtime
Last verified: 2026-07-07
Layer: raw-source
Module: Tool
Feature: AgentRuntimeTaskPackT29T33
Doc Type: checklist
Canonical: true
Related:
  - ../project-control/project-control-ledger.md
  - ../project-control/tasks/agent_node_T029-server-test-report-green.md
  - ../project-control/tasks/agent_node_T030-failed-tool-path-contract.md
  - ../project-control/tasks/agent_node_T031-terminal-result-semantics.md
  - ../project-control/tasks/agent_node_T032-structured-failure-code.md
  - ../project-control/tasks/agent_node_T033-core-tool-summary-contracts.md
  - core-tool-rectification-ledger.md
  - tools-protocol.md

## Purpose

记录外部 `T29-T33` 任务包在仓库内的正式登记方式、统一命名标准、依赖关系和当前状态。

这份台账只服务这五个任务包，不替代 `docs/project-control/project-control-ledger.md` 的项目总控制职责。

## Naming Standard

仓库内统一使用下面这套名称标准：

- Stream id: `agent_runtime_t29_t33`
- Pack display name: `Agent Runtime T29-T33 Task Pack`
- Task card id: `agent_node_T0NN`
- Task card file name: `agent_node_T0NN-<kebab-case>.md`
- Title format: `agent_node_T0NN <English Title>`

外部任务包里的 `T29`、`T30`、`T31`、`T32`、`T33` 保留为来源编号，只用于映射和对照，不直接作为仓库文件名。

## Mapping Table

| External Task | Standard Task Id | Standard File Name | Priority | Current State | Dependency |
| --- | --- | --- | --- | --- | --- |
| `T29` `server/test-report 全绿` | `agent_node_T029` | `agent_node_T029-server-test-report-green.md` | `P0` | `TODO` | 必须先于 `T30-T33` |
| `T30` `失败路径合同裁决卡` | `agent_node_T030` | `agent_node_T030-failed-tool-path-contract.md` | `P1` | `READY_FOR_REVIEW` | 依赖 `T29` |
| `T31` `terminal result 语义拆分` | `agent_node_T031` | `agent_node_T031-terminal-result-semantics.md` | `P1` | `DONE` | 依赖 `T29`；不得混入 `T30/T32/T33` 内容 |
| `T32` `结构化 failure code 小补` | `agent_node_T032` | `agent_node_T032-structured-failure-code.md` | `P1` | `DONE` | 依赖 `T29`；建议晚于或平行于 `T31` |
| `T33` `核心工具 summary contract` | `agent_node_T033` | `agent_node_T033-core-tool-summary-contracts.md` | `P2` | `DONE` | 依赖 `T29`；建议晚于 `T31` 和 `T32` |

## Scope Summary

| Task | Main Problem | Primary Area | Main Risk |
| --- | --- | --- | --- |
| `T29` | `server` 测试报告不全绿 | `server/test-report`、server 测试 | 容易把任务外失败误判成 Agent 或 Harness 缺陷 |
| `T30` | failed tool 终态断言仍停留在旧合同 | 3 个失败路径测试 | 容易把 recoverable failure 误断言成全局失败 |
| `T31` | `terminal_session` 结果语义混淆 | `server/src/agent/evidence.ts`、terminal summary | 把“进程结束”误写成“任务完成” |
| `T32` | Harness 失败分类过度依赖字符串 | `server/src/agent/nodes/tool-node.ts`、failure summary | 结构化失败原因不稳定，后续分类容易漂移 |
| `T33` | edit 和 action profile 的 summary contract 不稳定 | `server/src/agent/evidence.ts`、generate fallback | dry-run、真实写入和失败状态容易被说错 |

## Execution Rules

1. `T29` 先处理，因为它决定后续任务能否在干净的 `server` 测试基线上推进。
2. `T30` 只处理 failed tool 主链合同断言，不改 `failureKind` 规则。
3. `T31`、`T32`、`T33` 必须各自独立，不要在同一个补丁里混写多类语义。
4. 每个任务包都必须使用正式任务卡，不直接把外部 `task30.md` 之类文件当仓库执行真相。
5. 项目级状态只在 `docs/project-control/project-control-ledger.md` 更新；本页只做专项追踪和命名映射。

## Current Status

- 2026-07-07：已完成仓库内正式登记和编号顺延。
- `T030` 已完成合同断言同步并进入 `READY_FOR_REVIEW`。
- `T031` 已完成 terminal result 语义拆分复核并回填 `DONE`。
- `T033` 已完成核心工具 summary contract 复核并回填 `DONE`。
- `T029` 仍处于 `TODO`。
- `T032` 已完成最小结构化 `failureCode` 接入并回填 `DONE`。

## Related Docs

- `../project-control/README.md`
- `core-tool-rectification-ledger.md`
- `tools-protocol.md`
