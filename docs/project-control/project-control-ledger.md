---
status: current
owner: project-owner
last_verified: 2026-07-05
layer: project-control
module: ProjectControl
feature: ProjectControlLedger
doc_type: master-ledger
canonical: true
related:
  - AGENTS.md
  - docs/project-control/README.md
  - docs/project-control/governance-principles.md
  - docs/project-control/phase-conclusions/agent-phase-1-2-archive-decision.md
---

# Project Control Ledger

这是 `docs/project-control/` 下唯一的项目总控制台账。

规则：

- 所有当前项目、任务流、评审队列和阻塞项都必须登记在这里。
- 旧 `agent-workboard.md`、`agent-nodes-workboard.md`、评审文档、复测文档和任务卡可以作为证据来源，但不能再作为项目总台账。
- 历史任务卡不要求迁移、不要求重写；本文件只记录当前可管理状态和索引。
- 任务实际状态以任务卡中的 `task_state` 为准。
- 如果本文件状态与任务卡冲突，必须修正本文件；如果任务卡缺少 `task_state` 或元数据异常，本文件只能标记为 `TASK_CARD_STATE_MISSING` 或 `TASK_CARD_STATE_INVALID`，不能替任务卡判定完成。
- 如果旧 workboard 与任务卡冲突，以任务卡为准；旧 workboard 只作为历史证据。
- 新任务开工前必须先在本文件登记。

## Current Streams

| Stream | State | Current Focus | Evidence / Source | Ledger Note |
| --- | --- | --- | --- | --- |
| Project Control Governance | `IN_PROGRESS` | 建立唯一总控制台账，停止多 workboard 争抢当前真相 | [governance-principles.md](governance-principles.md) | 本文件建立后，其他 workboard 只作为证据来源 |
| Harness Context System | `READY_FOR_REVIEW` | Context Read Bench 已提交评审，补齐真实读取压测 | [harness_context_T001](tasks/harness_context_T001-context-read-plan-dsl.md), [harness_context_T002](tasks/harness_context_T002-context-read-bench.md) | T001 已 DONE；T002 bench 定向验证通过，整仓检查仍被任务外 typecheck 问题阻断 |
| AgentGraph / Agent V1.5 | `READY_FOR_REVIEW` | 主链合同、弱模型防线、审批恢复、evidence grounded answer | [agent-nodes-workboard.md](agent-nodes-workboard.md), `agent_node_T001-T017` | 旧专项 workboard 存在状态冲突，见下方 Agent Nodes Index |
| Harness / Sandbox | `READY_FOR_REVIEW` | 候选排序、sandbox direct contract、artifact/output contract；L1 workspace sandbox runner 已通过，跨层 diagnostics 闭环已补专门回归并通过 `pnpm check` | [T-010](tasks/T-010-harness-candidate-ordering.md), [T-011](tasks/T-011-sandbox-contract-direct-bench.md), [T-012](tasks/T-012-l1-workspace-sandbox-runner.md), [T-013](tasks/T-013-sandbox-artifact-output-contract.md), [T-014](tasks/T-014-cross-layer-diagnostics-closure.md) | T-012、T-013、T-014 已 DONE，其余仍按各自任务状态处理 |
| Core Tools | `READY_FOR_REVIEW` | read / write / terminal / web-search 工具治理尾项 | `core_tools_T001-T019` | 多数已完成，仍有 review 队列 |
| Agent Phase 1 | `ARCHIVED_DONE` | Agent MVP 主链历史归档 | [agent-phase-1-2-archive-decision.md](phase-conclusions/agent-phase-1-2-archive-decision.md), [agent-phase-1-checklist.md](../chat/agent-phase-1-checklist.md) | 一期完成归档；剩余增强项转后续 |
| Agent Phase 2 | `ARCHIVED_PARTIAL_SUPERSEDED` | 可用闭环阶段部分归档，后续由 Agent V1.5 / 老三期接管 | [agent-phase-1-2-archive-decision.md](phase-conclusions/agent-phase-1-2-archive-decision.md), [agent-phase-2-checklist.md](../chat/agent-phase-2-checklist.md) | 不按完成归档；未完成项不得口头升级为 DONE |
| Phase-1 Remediation | `DONE_WITH_HISTORY` | 早期 P0/P1/P2 缺陷整改 | [agent-workboard.md](agent-workboard.md), `T-001-T008` | 仅作为历史证据，不再作为当前项目台账；阶段口径见 Agent Phase 1 |
| Test Report / Evidence Hygiene | `PROPOSED` | 测试报告 JSON 合并与瘦身 | [T-009](tasks/T-009-test-report-json-consolidation.md) | `status: proposed`, `canonical: false`，未进入当前执行 |

## Active Review Queue

这些是当前不应从视野里消失的非 DONE 项。

| Task | State | Area | Required Next Step |
| --- | --- | --- | --- |
| [agent_node_T002](tasks/agent_node_T002-tool-call-normalize-node.md) | `TODO` | AgentGraph | 状态异常审计：代码与后续任务显示 normalize 已接入，但任务卡仍是 TODO |
| [agent_node_T012](tasks/agent_node_T012-repeated-tool-guard.md) | `READY_FOR_REVIEW` | AgentGraph | 评审 repeated guard 是否可接受，以及旧线程 `<function_calls>` 异常是否另开任务 |
| [agent_node_T016](tasks/agent_node_T016-local-tool-routing-and-schema-guard.md) | `READY_FOR_REVIEW` | AgentGraph | 评审弱模型防线和最新前台 smoke 证据 |
| [core_tools_T008](tasks/core_tools_T008-read-locate-keyword-preview.md) | `READY_FOR_REVIEW` | Core Tools | 评审 read locate preview |
| [core_tools_T011](tasks/core_tools_T011-selector-create-file-prefers-edit.md) | `READY_FOR_REVIEW` | Core Tools | 评审 create-file selector 策略 |
| [core_tools_T014](tasks/core_tools_T014-web-search-normalized-results-and-provider-errors.md) | `READY_FOR_REVIEW` | Core Tools | 评审 web search 结果规范化和 provider error |
| [core_tools_T017](tasks/core_tools_T017-web-search-artifact-sensitive-field-scrubbing.md) | `READY_FOR_REVIEW` | Core Tools | 评审敏感字段清理 |
| [core_tools_T019](tasks/core_tools_T019-workspace-mutation-boundary-retention.md) | `READY_FOR_REVIEW` | Core Tools | 评审 workspace mutation boundary retention |
| [T-011](tasks/T-011-sandbox-contract-direct-bench.md) | `READY_FOR_REVIEW` | Harness / Sandbox | 评审 sandbox direct bench contract |
| [T-012](tasks/T-012-l1-workspace-sandbox-runner.md) | `DONE` | Harness / Sandbox | Review 02 已通过：L1 workspace sandbox runner |
| [T-009](tasks/T-009-test-report-json-consolidation.md) | `PROPOSED` | Evidence Hygiene | 决定是否进入执行队列 |
| [harness_context_T002](tasks/harness_context_T002-context-read-bench.md) | `READY_FOR_REVIEW` | Harness Context | 评审 Context / Read bench 的覆盖面和任务外 typecheck 阻断记录是否可接受 |

## Agent Nodes Index

| Task | Ledger State | Task Card State | Notes |
| --- | --- | --- | --- |
| [agent_node_T001](tasks/agent_node_T001-next-action-planner-node.md) | `DONE` | `DONE` | nextAction planner node |
| [agent_node_T002](tasks/agent_node_T002-tool-call-normalize-node.md) | `TODO_REVIEW_STATE` | `TODO` | 后续代码与任务显示 normalize 已接入；需要确认是否只是任务卡未更新 |
| [agent_node_T003](tasks/agent_node_T003-agent-graph-wiring.md) | `DONE` | `DONE` | 旧 `agent-nodes-workboard.md` 顶部表格仍标 TODO，是旧台账错误 |
| [agent_node_T004](tasks/agent_node_T004-policy-node-consume-pending-tool-call.md) | `DONE` | `DONE` | 旧 `agent-nodes-workboard.md` 顶部表格仍标 TODO，是旧台账错误 |
| [agent_node_T005](tasks/agent_node_T005-tool-node-execute-frozen-pending-tool-call.md) | `DONE` | `DONE` | toolNode frozen call |
| [agent_node_T006](tasks/agent_node_T006-evidence-loop-routing.md) | `DONE` | `DONE` | evidence loop routing |
| [agent_node_T007](tasks/agent_node_T007-decision-loop-acceptance-regression-guardrails.md) | `DONE` | `DONE` | regression guardrails |
| [agent_node_T008](tasks/agent_node_T008-v1-cleanup-release-hardening.md) | `DONE` | `DONE` | V1 cleanup |
| [agent_node_T009](tasks/agent_node_T009-evidence-summary-answer-stop-rule.md) | `DONE` | `DONE` | evidence summary / answer stop |
| [agent_node_T010](tasks/agent_node_T010-next-action-planner-json-contract-hardening.md) | `DONE` | `DONE` | planner JSON hardening |
| [agent_node_T011](tasks/agent_node_T011-workspace-path-argument-contract.md) | `DONE` | `DONE` | workspace path contract |
| [agent_node_T012](tasks/agent_node_T012-repeated-tool-guard.md) | `READY_FOR_REVIEW` | `READY_FOR_REVIEW` | repeated tool guard |
| [agent_node_T013](tasks/agent_node_T013-evidence-grounded-final-answer.md) | `DONE` | `DONE` | grounded final answer |
| [agent_node_T014](tasks/agent_node_T014-approval-resume-contract.md) | `DONE` | `DONE` | approval resume contract |
| [agent_node_T015](tasks/agent_node_T015-phoenix-minimum-human-observability.md) | `DONE` | `DONE` | Phoenix observability |
| [agent_node_T016](tasks/agent_node_T016-local-tool-routing-and-schema-guard.md) | `READY_FOR_REVIEW` | `READY_FOR_REVIEW` | local routing / schema guard |
| [agent_node_T017](tasks/agent_node_T017-toolcall-loop-regression-matrix.md) | `DONE` | `DONE` | Review 02 已通过；toolCall loop 黑盒回归矩阵 |

## Core Tools Index

| Task | Ledger State | Notes |
| --- | --- | --- |
| [core_tools_T001](tasks/core_tools_T001-edit-workspace-boundary.md) | `DONE` | edit workspace boundary |
| [core_tools_T002](tasks/core_tools_T002-web-search-provider-input-hardening.md) | `DONE` | web search provider input |
| [core_tools_T003](tasks/core_tools_T003-terminal-llm-input-surface.md) | `DONE` | terminal LLM input surface |
| [core_tools_T004](tasks/core_tools_T004-terminal-command-approval.md) | `DONE` | terminal command approval |
| [core_tools_T005](tasks/core_tools_T005-write-file-create-empty-content.md) | `DONE` | write file empty content |
| [core_tools_T006](tasks/core_tools_T006-write-file-overwrite-approval.md) | `DONE` | overwrite approval |
| [core_tools_T007](tasks/core_tools_T007-replace-block-unique-match.md) | `DONE` | replace block unique match |
| [core_tools_T008](tasks/core_tools_T008-read-locate-keyword-preview.md) | `READY_FOR_REVIEW` | read locate preview |
| [core_tools_T009](tasks/core_tools_T009-terminal-cwd-workspace-bound.md) | `DONE` | terminal cwd bound |
| [core_tools_T010](tasks/core_tools_T010-terminal-timeout-bounds.md) | `DONE` | terminal timeout bounds |
| [core_tools_T011](tasks/core_tools_T011-selector-create-file-prefers-edit.md) | `READY_FOR_REVIEW` | selector create-file policy |
| [core_tools_T012](tasks/core_tools_T012-read-fallback-dispatch-demotion.md) | `DONE` | read fallback demotion |
| [core_tools_T013](tasks/core_tools_T013-read-slice-non-primary-intent.md) | `DONE` | read slice exposure |
| [core_tools_T014](tasks/core_tools_T014-web-search-normalized-results-and-provider-errors.md) | `READY_FOR_REVIEW` | web search normalized results |
| [core_tools_T015](tasks/core_tools_T015-terminal-execute-command-action-profile.md) | `DONE` | terminal action profile |
| [core_tools_T016](tasks/core_tools_T016-edit-action-profiles.md) | `DONE` | edit action profiles |
| [core_tools_T017](tasks/core_tools_T017-web-search-artifact-sensitive-field-scrubbing.md) | `READY_FOR_REVIEW` | artifact sensitive field scrubbing |
| [core_tools_T018](tasks/core_tools_T018-observability-trace-debug-panel-contract.md) | `DONE` | trace debug panel contract |
| [core_tools_T019](tasks/core_tools_T019-workspace-mutation-boundary-retention.md) | `READY_FOR_REVIEW` | mutation boundary retention |

## Harness / Remediation Index

| Task | Ledger State | Notes |
| --- | --- | --- |
| [harness_context_T001](tasks/harness_context_T001-context-read-plan-dsl.md) | `DONE` | Context Read Plan DSL MVP |
| [harness_context_T002](tasks/harness_context_T002-context-read-bench.md) | `READY_FOR_REVIEW` | Context / Read bench |
| [T-001](tasks/T-001-policy-deny.md) | `DONE` | policy deny |
| [T-002](tasks/T-002-toolnode-no-fallback.md) | `DONE` | toolNode no fallback |
| [T-003](tasks/T-003-terminal-command-safety.md) | `DONE` | terminal command safety |
| [T-004](tasks/T-004-approval-invocation-level.md) | `DONE` | approval invocation level |
| [T-005](tasks/T-005-capability-tool-separation.md) | `DONE` | capability / tool separation |
| [T-006](tasks/T-006-harness-schema-and-boundary.md) | `DONE` | Harness schema / boundary |
| [T-007](tasks/T-007-intent-shortcut-demotion.md) | `DONE` | intent shortcut demotion |
| [T-008](tasks/T-008-evidence-chain-completion.md) | `DONE` | evidence chain completion |
| [T-009](tasks/T-009-test-report-json-consolidation.md) | `PROPOSED` | test report JSON consolidation |
| [T-010](tasks/T-010-harness-candidate-ordering.md) | `DONE` | Harness candidate ordering |
| [T-011](tasks/T-011-sandbox-contract-direct-bench.md) | `READY_FOR_REVIEW` | sandbox contract direct bench |
| [T-012](tasks/T-012-l1-workspace-sandbox-runner.md) | `DONE` | L1 workspace sandbox runner |
| [T-013](tasks/T-013-sandbox-artifact-output-contract.md) | `DONE` | sandbox artifact/output contract |
| [T-014](tasks/T-014-cross-layer-diagnostics-closure.md) | `DONE` | cross-layer diagnostics closure（dedicated regression + evidence/generate fix） |

## Non-Ledger Evidence Files

这些文件可以继续存在，但不是项目台账：

| File | Role |
| --- | --- |
| [agent-workboard.md](agent-workboard.md) | Phase-1 remediation historical workboard / evidence source |
| [agent-nodes-workboard.md](agent-nodes-workboard.md) | Agent node historical workboard / evidence source; contains known state conflicts |
| [agent-nodes-V1.5 终审.md](phase-conclusions/agent-nodes-V1.5%20终审.md) | Phase conclusion / final review summary |
| [agent-phase-1-2-archive-decision.md](phase-conclusions/agent-phase-1-2-archive-decision.md) | Phase 1 completed archive and Phase 2 partial superseded archive decision |
| [agent-nodes-V1.5 全新线程复测.md](testEvidence/agent-nodes-V1.5%20全新线程复测.md) | Test evidence / fresh-thread smoke record |
| `testEvidence/` | Test evidence folder |
| `phase-conclusions/` | Stage conclusion folder |
| `reviews/` | Review inputs only |
| `decisions/` | Accepted decisions only |
| `archive/` | Historical snapshots only |

## Ledger Maintenance Rules

- 更新任务卡状态时，必须同步更新本文件。
- 任务实际状态以任务卡 `task_state` 为准；本文件只做汇总、索引和冲突提示。
- 本文件不得把任务卡中的 `TODO / READY_FOR_REVIEW / DONE / BLOCKED` 改写成另一个实际状态。
- 任务卡缺少 `task_state` 时，本文件必须标记为 `TASK_CARD_STATE_MISSING`，并把修复任务卡元数据列为下一步。
- 本文件不得记录长篇过程；长证据放任务卡或 smoke report，本文件只链接。
- `DONE` 必须有任务卡或 smoke / verification 证据。
- `READY_FOR_REVIEW` 表示等待 owner / reviewer 接受，不得口头升级为 DONE。
- 旧 workboard 与任务卡冲突时，以任务卡为准；不直接改旧 workboard，先在本文件记录冲突，再单独开清理任务。
- 不允许再新增第二个项目总台账。
