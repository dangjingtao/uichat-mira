---
status: current
owner: project-owner
last_verified: 2026-07-06
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
| Harness Context System | `DONE` | Context Read Bench 已验收通过，补齐真实读取压测 | [harness_context_T001](tasks/harness_context_T001-context-read-plan-dsl.md), [harness_context_T002](tasks/harness_context_T002-context-read-bench.md) | T001、T002 已 DONE；整仓检查仍有任务外 typecheck 阻断 |
| AgentGraph / Agent V1.5 | `READY_FOR_REVIEW` | 主链合同、弱模型防线、审批恢复、evidence grounded answer | [agent-nodes-workboard.md](agent-nodes-workboard.md), `agent_node_T001-T017` | 旧专项 workboard 存在状态冲突，见下方 Agent Nodes Index |
| Harness / Sandbox | `READY_FOR_REVIEW` | 候选排序、sandbox direct contract、artifact/output contract；L1 workspace sandbox runner 已通过，跨层 diagnostics 闭环已补专门回归并通过 `pnpm check` | [T-010](tasks/T-010-harness-candidate-ordering.md), [T-011](tasks/T-011-sandbox-contract-direct-bench.md), [T-012](tasks/T-012-l1-workspace-sandbox-runner.md), [T-013](tasks/T-013-sandbox-artifact-output-contract.md), [T-014](tasks/T-014-cross-layer-diagnostics-closure.md) | T-012、T-013、T-014 已 DONE，其余仍按各自任务状态处理 |
| Deep Agents Spike | `IN_PROGRESS` | `T-DeepAgents-02` 正在验证 selector baseline 与 middleware 可抽取性；不接入现有 Harness 主链 | [T-DeepAgents-01](tasks/T-DeepAgents-01-deepagents-js-spike.md), [T-DeepAgents-02](tasks/T-DeepAgents-02-selector-middleware-baseline.md) | 独立 spike package，`T-01` 已形成条件通过结论；`T-02` 继续验证 selector、domain gate、middleware 风险和 `T-03` 前提 |
| Core Tools | `READY_FOR_REVIEW` | read / write / terminal / web-search 工具治理尾项 | `core_tools_T001-T019` | 多数已完成，仍有 review 队列 |
| Codebase Understanding Docs | `READY_FOR_REVIEW` | `code_T001`、`code_T002`、`code_T003`、`code_T004`、`code_T007` 已补齐 scoped docs 卡；`code_T006` 已完成本地 CodeGraph benchmark spike review，结论为继续做受控候选，并在 runtime 前新增 wrapper 合同，不接 runtime | [code_T001](tasks/code_T001-codebase-understanding-consensus-doc-integration.md), [code_T002](tasks/code_T002-codebase-engine-benchmark.md), [code_T003](tasks/code_T003-codegraph-managed-mcp-spike.md), [code_T004](tasks/code_T004-codebase-engine-abstraction.md), [code_T006](tasks/code_T006-codegraph-benchmark-spike.md), [code_T007](tasks/code_T007-codegraph-wrapper-contract.md), [review](reviews/codebase-understanding-docs-review-index.md), [codegraph benchmark spike](reviews/codegraph-benchmark-spike.md) | 文档正文统一落入 `docs/tooling-runtime/`；总审查材料按仓库规则落入 `reviews/`，不沿用外部 `docs/agent/`；`code_T007` 是 docs-only wrapper 合同任务，不是 runtime 接入任务 |
| Agent Runtime T29-T33 Task Pack | `TODO` | 登记 `server` 测试全绿、failed tool 路径合同、terminal 结果语义、结构化 failure code、核心工具 summary contract 五个任务包 | [agent-runtime-t29-t33-ledger.md](../tooling-runtime/agent-runtime-t29-t33-ledger.md), [agent_node_T029](tasks/agent_node_T029-server-test-report-green.md), [agent_node_T030](tasks/agent_node_T030-failed-tool-path-contract.md), [agent_node_T031](tasks/agent_node_T031-terminal-result-semantics.md), [agent_node_T032](tasks/agent_node_T032-structured-failure-code.md), [agent_node_T033](tasks/agent_node_T033-core-tool-summary-contracts.md) | 已完成仓库内正式登记；当前只新增任务卡和专项台账，未开始实现 |
| Agent Phase 1 | `ARCHIVED_DONE` | Agent MVP 主链历史归档 | [agent-phase-1-2-archive-decision.md](phase-conclusions/agent-phase-1-2-archive-decision.md), [agent-phase-1-checklist.md](../chat/agent-phase-1-checklist.md) | 一期完成归档；剩余增强项转后续 |
| Agent Phase 2 | `ARCHIVED_PARTIAL_SUPERSEDED` | 可用闭环阶段部分归档，后续由 Agent V1.5 / 老三期接管 | [agent-phase-1-2-archive-decision.md](phase-conclusions/agent-phase-1-2-archive-decision.md), [agent-phase-2-checklist.md](../chat/agent-phase-2-checklist.md) | 不按完成归档；未完成项不得口头升级为 DONE |
| Phase-1 Remediation | `DONE_WITH_HISTORY` | 早期 P0/P1/P2 缺陷整改 | [agent-workboard.md](agent-workboard.md), `T-001-T008` | 仅作为历史证据，不再作为当前项目台账；阶段口径见 Agent Phase 1 |
| Test Report / Evidence Hygiene | `PROPOSED` | 测试报告 JSON 合并与瘦身 | [T-009](tasks/T-009-test-report-json-consolidation.md) | `status: proposed`, `canonical: false`，未进入当前执行 |
| Skill Docs Foundation | `DONE` | `docs/skill` 基础数据 POC 整理为 docs-only Phase 0 | [skill_T001](tasks/skill_T001-docs-only-foundation.md), [docs/skill/roadmap.md](../skill/roadmap.md) | docs-only Phase 0 评审通过；未批准 runtime / DB / UI / AgentGraph / Harness / MCP 实现 |
| MicroAPP Image Generation POC | `READY_FOR_REVIEW` | 生图微应用 docs-only 基础建设：兼容底座、统一任务生命周期、ComfyUI workflow runner 边界；当前仅服务微应用界面调试 | [microapp_T001](tasks/microapp_T001-image-generation-poc-docs-foundation.md), [image-generation-microapp-poc.md](../microapp/image-generation-microapp-poc.md) | 当前只提交 docs-only POC；未批准 runtime / DB / UI / provider 实现 |
| MicroAPP Image Generation Interaction Spec | `READY_FOR_REVIEW` | 生图微应用调试页交互说明：页面结构、状态反馈、Prompt/Workflow 双模式 | [microapp_T011](tasks/microapp_T011-image-generation-debug-workspace-interaction-spec.md), [interaction-spec.md](../microapp/image-generation-debug-workspace-interaction-spec.md) | 当前只提交 docs-only 交互说明；未批准 UI 实现 |
| MicroAPP Computer Use POC | `READY_FOR_REVIEW` | `computer_use` 微应用 docs-only 基础建设：隔离执行面优先、审批链、回放 artifact 与 Electron / Tauri 边界 | [microapp_T002](tasks/microapp_T002-computer-use-poc-docs-foundation.md), [computer-use-microapp-poc.md](../microapp/computer-use-microapp-poc.md) | 当前只提交 docs-only POC；未批准 runtime / DB / UI / preload / desktop automation 实现 |
| MicroAPP Computer Use Feature Design | `READY_FOR_REVIEW` | `computer_use` 第一阶段浏览器工作台功能设计：入口、状态、审批、安装引导、结果回放 | [microapp_T003](tasks/microapp_T003-computer-use-feature-design.md), [computer-use-feature-design.md](../microapp/computer-use-feature-design.md) | 当前只提交 docs-only 功能设计；未批准 runtime / DB / UI / browser runtime implementation |
| MicroAPP Computer Use Parallel Build | `READY_FOR_REVIEW` | 并行施工代码隔离：共享注册层、server core、runtime/executor、route、desktop API、desktop 工作台，以及产品入口衔接卡 | [microapp_T020](tasks/microapp_T020-computer-use-parallel-code-isolation.md), [microapp_T110-T116](tasks/microapp_T110-computer-use-shared-registry-and-seed.md) | 当前已补入口衔接任务卡；实现与评审按各自任务状态推进 |
| MicroAPP Computer Use Smoke | `READY_FOR_REVIEW` | `Computer Use Studio` 产品入口级冒烟已补第二轮真实证据：即使目标明确要求输出页面标题和主标题文本，当前链路仍只生成“导航 + 截图”plan，并返回同样的截图型结果摘要 | [microapp_T117](tasks/microapp_T117-computer-use-browser-smoke.md) | 证据目录已回填到 `.test-artifact/computer-use-smoke/2026-07-06-T117/`；当前阻塞已收敛为一期能力边界，不再只是证据缺失 |
| MicroAPP Image Generation Parallel Build | `IN_PROGRESS` | 并行施工代码隔离：共享注册层、server domain、adapter、route、desktop API、desktop 调试页，以及产品入口衔接卡 | [microapp_T010](tasks/microapp_T010-image-generation-parallel-code-isolation.md), [microapp_T100](tasks/microapp_T100-image-generation-shared-registry-and-seed.md), [microapp_T106](tasks/microapp_T106-image-generation-desktop-entry-integration.md) | `T100`、`T101`、`T103`、`T104`、`T105`、`T106` 已 DONE；`T102` 待评审 |
| MicroAPP Image Generation Smoke | `DONE` | `ComfyUI Local` 产品入口级冒烟：从当前微应用列表页进入 `Image Generation Studio`，使用合法 workflow 跑真实任务终态并保留证据 | [microapp_T107](tasks/microapp_T107-image-generation-comfyui-smoke.md), [image-generation-comfyui-smoke-guide.md](../microapp/image-generation-comfyui-smoke-guide.md) | 已完成两轮真实冒烟；第二轮在补齐 `UI_CHAT_IMAGE_GENERATION_COMFYUI_BASE_URL` 并重启 backend 后成功到 `succeeded` |

## Active Review Queue

这些是当前不应从视野里消失的非 DONE 项。

| Task | State | Area | Required Next Step |
| --- | --- | --- | --- |
| [agent_node_T002](tasks/agent_node_T002-tool-call-normalize-node.md) | `TODO` | AgentGraph | 状态异常审计：代码与后续任务显示 normalize 已接入，但任务卡仍是 TODO |
| [agent_node_T012](tasks/agent_node_T012-repeated-tool-guard.md) | `READY_FOR_REVIEW` | AgentGraph | 评审 repeated guard 是否可接受，以及旧线程 `<function_calls>` 异常是否另开任务 |
| [agent_node_T016](tasks/agent_node_T016-local-tool-routing-and-schema-guard.md) | `READY_FOR_REVIEW` | AgentGraph | 评审弱模型防线和最新前台 smoke 证据 |
| [core_tools_T008](tasks/core_tools_T008-read-locate-keyword-preview.md) | `READY_FOR_REVIEW` | Core Tools | 评审 read locate preview |
| [core_tools_T011](tasks/core_tools_T011-selector-create-file-prefers-edit.md) | `READY_FOR_REVIEW` | Core Tools | 评审 create-file selector 策略 |
| [core_tools_T017](tasks/core_tools_T017-web-search-artifact-sensitive-field-scrubbing.md) | `READY_FOR_REVIEW` | Core Tools | 评审敏感字段清理 |
| [code_T001](tasks/code_T001-codebase-understanding-consensus-doc-integration.md) | `READY_FOR_REVIEW` | Docs / Tooling Runtime | 评审 `CARD-01` 本地化后的代码库理解共识文档 |
| [code_T002](tasks/code_T002-codebase-engine-benchmark.md) | `DONE` | Docs / Tooling Runtime | benchmark 问题集、评估维度、评分模板和通过/不通过规则已落入正式文档 |
| [code_T006](tasks/code_T006-codegraph-benchmark-spike.md) | `DONE` | Docs / Tooling Runtime | 本地 CodeGraph benchmark spike 已完成；review 记录见 `reviews/codegraph-benchmark-spike.md`，结论是继续做受控候选，不直接接 runtime |
| [code_T004](tasks/code_T004-codebase-engine-abstraction.md) | `DONE` | Docs / Tooling Runtime | 抽象层设计文档、索引与台账已回填；2026-07-08 项目 owner 明确要求直接标记完成，后续仍执行总审查 |
| [code_T007](tasks/code_T007-codegraph-wrapper-contract.md) | `READY_FOR_REVIEW` | Docs / Tooling Runtime | 评审 CodeGraph wrapper 合同是否足够固定 scope、裁剪、核验和降级边界 |
| [T-011](tasks/T-011-sandbox-contract-direct-bench.md) | `READY_FOR_REVIEW` | Harness / Sandbox | 评审 sandbox direct bench contract |
| [T-DeepAgents-01](tasks/T-DeepAgents-01-deepagents-js-spike.md) | `READY_FOR_REVIEW` | Agent Runtime / Spike | 已完成 runtime feasibility spike；按项目 owner 结论为“有条件通过” |
| [T-DeepAgents-02](tasks/T-DeepAgents-02-selector-middleware-baseline.md) | `READY_FOR_REVIEW` | Agent Runtime / Spike | 已完成 selector baseline、domain gate 对比与 middleware extractability inspection，等待评审是否进入 `T-03` |
| [T-012](tasks/T-012-l1-workspace-sandbox-runner.md) | `DONE` | Harness / Sandbox | Review 02 已通过：L1 workspace sandbox runner |
| [T-009](tasks/T-009-test-report-json-consolidation.md) | `PROPOSED` | Evidence Hygiene | 决定是否进入执行队列 |
| [harness_context_T002](tasks/harness_context_T002-context-read-bench.md) | `DONE` | Harness Context | 已验收通过；保留任务外 typecheck 阻断记录 |
| [microapp_T001](tasks/microapp_T001-image-generation-poc-docs-foundation.md) | `READY_FOR_REVIEW` | MicroAPP | 评审 docs-only 生图微应用兼容底座、ComfyUI runner 边界，以及“仅微应用界面调试”范围是否可接受 |
| [microapp_T011](tasks/microapp_T011-image-generation-debug-workspace-interaction-spec.md) | `READY_FOR_REVIEW` | MicroAPP | 评审生图微应用调试页的交互语言是否足够完整，能否直接进入设计出稿 |
| [microapp_T002](tasks/microapp_T002-computer-use-poc-docs-foundation.md) | `READY_FOR_REVIEW` | MicroAPP | 评审 docs-only `computer_use` 微应用边界、隔离执行面优先级和后续高风险切片是否可接受 |
| [microapp_T003](tasks/microapp_T003-computer-use-feature-design.md) | `READY_FOR_REVIEW` | MicroAPP | 评审 `computer_use` 第一阶段浏览器工作台功能设计是否可接受 |
| [microapp_T020](tasks/microapp_T020-computer-use-parallel-code-isolation.md) | `READY_FOR_REVIEW` | MicroAPP | 评审 `computer_use` 并行施工的代码隔离、共享文件归属和推荐批次是否可接受 |
| [microapp_T117](tasks/microapp_T117-computer-use-browser-smoke.md) | `READY_FOR_REVIEW` | MicroAPP | 评审两轮真实冒烟证据，并确认当前阻塞应按一期能力边界处理，还是另开实现卡修复 |
| [microapp_T010](tasks/microapp_T010-image-generation-parallel-code-isolation.md) | `READY_FOR_REVIEW` | MicroAPP | 评审 `image_generation` 并行施工的代码隔离、共享文件归属和推荐批次是否可接受 |

## MicroAPP Image Generation Parallel Task Index

| Task | Ledger State | Notes |
| --- | --- | --- |
| [microapp_T100](tasks/microapp_T100-image-generation-shared-registry-and-seed.md) | `DONE` | 共享注册层、默认 seed、runtime 识别入口 |
| [microapp_T101](tasks/microapp_T101-image-generation-server-domain-core.md) | `DONE` | `server/src/microapps/image-generation/core/**` 领域核心 |
| [microapp_T102](tasks/microapp_T102-image-generation-server-adapters-and-artifacts.md) | `READY_FOR_REVIEW` | provider adapter、ComfyUI runner、artifact 回收 |
| [microapp_T103](tasks/microapp_T103-image-generation-server-http-surface.md) | `DONE` | `server/src/routes/microapps/**` 和 server 注册 |
| [microapp_T104](tasks/microapp_T104-image-generation-desktop-api-client.md) | `DONE` | `desktop/src/shared/api/imageGeneration.ts` 共享 API client |
| [microapp_T105](tasks/microapp_T105-image-generation-desktop-debug-workspace.md) | `DONE` | 微应用界面调试页和 settings route 挂载 |
| [microapp_T106](tasks/microapp_T106-image-generation-desktop-entry-integration.md) | `DONE` | 已补列表页稳定主入口、详情页边界说明和页面测试证据；用户无需手输 URL 即可进入 `Image Generation Studio` |
| [microapp_T107](tasks/microapp_T107-image-generation-comfyui-smoke.md) | `DONE` | 已完成 `ComfyUI Local` 冒烟；第二轮已真实跑通 `queued -> running -> succeeded`，并回收到本地预览图 |

## MicroAPP Computer Use Parallel Task Index

| Task | Ledger State | Notes |
| --- | --- | --- |
| [microapp_T110](tasks/microapp_T110-computer-use-shared-registry-and-seed.md) | `DONE` | 共享注册层、默认 seed、runtime 识别入口和 `computer-use.microapp.ts` 桥接文件 |
| [microapp_T111](tasks/microapp_T111-computer-use-server-domain-core.md) | `DONE` | `server/src/microapps/computer-use/core/**` 领域核心 |
| [microapp_T112](tasks/microapp_T112-computer-use-browser-runtime-and-executor.md) | `DONE` | 浏览器运行时管理、Playwright 执行器和 `.test-artifact/computer-use/**` |
| [microapp_T113](tasks/microapp_T113-computer-use-server-http-surface.md) | `DONE` | `server/src/routes/microapps/computer-use/**`、route 聚合和 server 注册 |
| [microapp_T114](tasks/microapp_T114-computer-use-desktop-api-client.md) | `DONE` | `desktop/src/shared/api/computerUse.ts` 共享 API client |
| [microapp_T115](tasks/microapp_T115-computer-use-desktop-studio-workspace.md) | `DONE` | 浏览器工作台、settings route 挂载和 settings i18n 文案 |
| [microapp_T116](tasks/microapp_T116-computer-use-desktop-entry-integration.md) | `DONE` | 当前微应用列表页 / 详情页到 `Computer Use Studio` 的产品入口衔接 |
| [microapp_T117](tasks/microapp_T117-computer-use-browser-smoke.md) | `READY_FOR_REVIEW` | 两轮真实证据都只证明“导航 + 截图”成功；当前仍未证明能把页面标题和主标题文本产出到结果里 |

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
| [agent_node_T029](tasks/agent_node_T029-server-test-report-green.md) | `TODO` | `TODO` | 外部 `T29` 正式登记；必须先于 `T30-T33` |
| [agent_node_T030](tasks/agent_node_T030-failed-tool-path-contract.md) | `DONE` | `DONE` | failed tool 路径合同断言已与 C 合同对齐；定向 vitest 26/26 通过；未回填 `T29` |
| [agent_node_T031](tasks/agent_node_T031-terminal-result-semantics.md) | `DONE` | `DONE` | terminal result 三层语义已拆开；受限回答与 `T30` 失败路径合同复核通过 |
| [agent_node_T032](tasks/agent_node_T032-structured-failure-code.md) | `DONE` | `DONE` | ToolNode 与 Harness failure 已接入最小结构化 `failureCode`；结构化优先、fallback 与 evidence 可见性复核通过 |
| [agent_node_T033](tasks/agent_node_T033-core-tool-summary-contracts.md) | `DONE` | `DONE` | edit/workspace mutation/action profile summary contract 已补齐；dry-run、真实写入与 unknown fallback 复核通过 |

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
| [core_tools_T014](tasks/core_tools_T014-web-search-normalized-results-and-provider-errors.md) | `DONE` | web search normalized results |
| [core_tools_T015](tasks/core_tools_T015-terminal-execute-command-action-profile.md) | `DONE` | terminal action profile |
| [core_tools_T016](tasks/core_tools_T016-edit-action-profiles.md) | `DONE` | edit action profiles |
| [core_tools_T017](tasks/core_tools_T017-web-search-artifact-sensitive-field-scrubbing.md) | `READY_FOR_REVIEW` | artifact sensitive field scrubbing |
| [core_tools_T018](tasks/core_tools_T018-observability-trace-debug-panel-contract.md) | `DONE` | trace debug panel contract |
| [core_tools_T019](tasks/core_tools_T019-workspace-mutation-boundary-retention.md) | `DONE` | mutation boundary retention |

## Codebase Understanding Task Index

| Task | Ledger State | Notes |
| --- | --- | --- |
| [code_T001](tasks/code_T001-codebase-understanding-consensus-doc-integration.md) | `READY_FOR_REVIEW` | 外部 `CARD-01` 已本地化；目标共识文档已进入 `docs/tooling-runtime/`，等待评审 |
| [code_T002](tasks/code_T002-codebase-engine-benchmark.md) | `DONE` | 外部 `CARD-02` 已本地化；真实仓库 benchmark 文档已进入 `docs/tooling-runtime/`，评审已通过 |
| [code_T003](tasks/code_T003-codegraph-managed-mcp-spike.md) | `DONE` | 外部 `CARD-03` 已本地化；Managed MCP spike 设计文档已进入 `docs/tooling-runtime/`，并已完成当前 docs-only 任务包 |
| [code_T004](tasks/code_T004-codebase-engine-abstraction.md) | `DONE` | 外部 `CARD-04` 已本地化；抽象层设计文档已进入 `docs/tooling-runtime/`，并按 2026-07-08 项目 owner 明确决定标记完成 |
| [code_T006](tasks/code_T006-codegraph-benchmark-spike.md) | `DONE` | 本地 CodeGraph benchmark spike 已执行；输出已进入 `docs/project-control/reviews/codegraph-benchmark-spike.md`，未接入 runtime |
| [code_T007](tasks/code_T007-codegraph-wrapper-contract.md) | `READY_FOR_REVIEW` | 新增 CodeGraph wrapper 合同文档，明确 Planner 只见 `codebase_explore`，CodeGraph 原生命令只允许留在 wrapper 内部，当前为 docs-only |

## Codebase Understanding Review Index

| File | Role | Notes |
| --- | --- | --- |
| [codebase-understanding-docs-review-index.md](reviews/codebase-understanding-docs-review-index.md) | `review` | 外部 `CARD-05` 本地化；四张文档施工卡现已齐备，可用于总审查 |

## Harness / Remediation Index

| Task | Ledger State | Notes |
| --- | --- | --- |
| [harness_context_T001](tasks/harness_context_T001-context-read-plan-dsl.md) | `DONE` | Context Read Plan DSL MVP |
| [harness_context_T002](tasks/harness_context_T002-context-read-bench.md) | `DONE` | Context / Read bench |
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
| [T-DeepAgents-01](tasks/T-DeepAgents-01-deepagents-js-spike.md) | `READY_FOR_REVIEW` | deepagents 独立集成验证已完成，结论是“有条件通过”，不进入现有 Harness 主线 |
| [T-DeepAgents-02](tasks/T-DeepAgents-02-selector-middleware-baseline.md) | `READY_FOR_REVIEW` | selector baseline 与 middleware extractability 基线已完成，不进入现有 Harness 主线 |

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
