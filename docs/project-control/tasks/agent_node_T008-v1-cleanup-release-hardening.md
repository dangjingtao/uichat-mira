---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: AgentDecisionLoopV1CleanupReleaseHardening
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T003-agent-graph-wiring.md
  - docs/project-control/tasks/agent_node_T006-evidence-loop-routing.md
  - docs/project-control/tasks/agent_node_T007-decision-loop-acceptance-regression-guardrails.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/README.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: DONE
---

# agent_node_T008 V1 cleanup / release hardening

## Target

本任务是项目 owner 明确批准打包的一张 V1 收尾任务卡。

本任务不新增业务能力，不宣称 `TaskFrame` 已完成，也不把文档整理误报成架构完成。

本任务只处理以下 5 项：

1. 清理 `main` 里的生成报告、coverage、大型 `test-report`、临时 sqlite `-wal / -shm` 文件。
2. 明确 `planNode` 当前是 placeholder，不宣称 `TaskFrame` 已完成。
3. 给 `selectedToolId` 增加迁移说明：它只供 UI / trace，不得作为执行入口。
4. 给 `generate` 阶段增加 `tool result size guard / summary` 的待办说明。
5. 把 Agent Decision Loop v1 当前架构不变量写入正式文档。

## Why This Task Exists

当前 Agent Decision Loop v1 已有最小闭环与验收护栏，但主分支仍存在两类交付风险：

- 仓库存在不应长期留在 `main` 的派生产物与临时文件，影响发布与评审清晰度。
- 文档口径与实现边界仍有混淆点，容易把 placeholder、兼容字段或后续待办误说成已完成能力。

这不是局部代码风格问题，而是发布清洁度与架构口径问题。

## Current Invariants

本任务必须保持以下当前真相，不得擅自拔高结论：

- Agent Decision Loop v1 当前已成立的最小闭环是：

```text
Planner
-> Normalize
-> Policy
-> ToolNode
-> Evidence
-> Planner
```

- `planNode` 当前仍是 placeholder，不能被描述成完整 `TaskFrame` 实现。
- `selectedToolId` 可以保留给 UI、trace、diagnostics 或兼容读路径，但不得再作为工具执行入口。
- 工具执行入口仍然只能是：

```text
nextAction.use_tool
-> toolCallNormalizeNode
-> pendingToolCall
-> policyNode
-> toolNode
```

- `generate` 阶段目前需要明确大结果体的 size guard / summary 策略尚未完成；如果代码未落地，只能记录为 TODO。
- 架构不变量写入文档，不等于 Harness、Planner、TaskFrame、摘要压缩、发布治理都已完整结束。

## Allowed Changes

优先只修改或新增：

- `docs/project-control/agent-nodes-workboard.md`
- 与本任务直接相关的 `docs/project-control/tasks/` 文档
- 与本任务直接相关的 Agent runtime / docs 文件
- 清理明确属于派生产物、报告产物、coverage 产物、临时 sqlite `-wal / -shm` 文件

## Forbidden Changes

- 不得顺手重写 Planner、Policy、ToolNode、Harness 主流程
- 不得把 `selectedToolId` 恢复成执行入口
- 不得宣称 `TaskFrame`、`planNode`、`generate` summary guard 已完成，除非有对应实现与验证证据
- 不得借本任务修改无关 UI、Provider Gateway、MCP registry、沙箱能力或打包架构
- 不得手工编辑 `pnpm-lock.yaml`

## Acceptance Criteria

### AC1 产物清理范围明确

- 明确列出要清理的派生产物类别：
  - 生成报告
  - coverage
  - 大型 `test-report`
  - 临时 sqlite `-wal / -shm`
- 清理范围必须限定在明确可再生成或临时的文件，不得误删源码、手写文档或当前任务证据。

### AC2 `planNode` / `TaskFrame` 口径纠正

- 相关文档必须明确：
  - `planNode` 当前是 placeholder
  - 当前不能宣称 `TaskFrame` 已完成
  - 后续若要补齐 `TaskFrame`，应另开任务卡处理

### AC3 `selectedToolId` 迁移说明落地

- 相关文档或代码注释必须明确：
  - `selectedToolId` 仅用于 UI / trace / diagnostics
  - 它不是执行契约
  - 不得从 `selectedToolId` 推导真实工具执行

### AC4 `generate` 阶段待办口径清楚

- 文档必须明确记录：
  - `tool result size guard` 仍需补
  - 超大 tool result 后续需要 `summary` 方案
  - 当前若未实现，只能作为 TODO，不得写成“已支持”

### AC5 V1 架构不变量进入正式文档

- 至少一份正式文档明确写出当前 V1 架构不变量，包括：
  - Planner 只负责输出下一步动作
  - Normalize 只负责冻结工具调用
  - Policy 只审批 frozen 调用
  - ToolNode 只执行 frozen 调用
  - evidence 在 retrieve / tool 后回流
  - `selectedToolId` / `capabilityIntent.selectedToolIds` 不得作为执行入口

## Verification

至少提供以下验证证据：

1. 变更文件列表与 diff summary。
2. 被清理文件类别或实际路径证据。
3. 文档中新增或更新的口径位置。
4. 若涉及代码注释或实现改动，列出对应文件与验证命令。

如果本任务只做文档与产物清理，也必须明确说明：

- 未运行哪些自动化验证
- 为什么本次未运行

## Evidence Requirements

任务完成后必须回填：

- changed files
- diff summary
- 实际清理掉的文件或目录
- 是否运行 `pnpm check`
- 是否运行 `pnpm package:electron:win`
- 若未运行，必须说明原因
- 仍未完成的后续项，尤其是 `generate` size guard / summary 如果还只是 TODO

## Risks And Non-Goals

- 本任务不负责实现真正的 `TaskFrame`
- 本任务不负责完成 `generate` 大结果裁剪或摘要能力，只负责把缺口说清楚，或在明确实现时补最小可验证落地
- 本任务不负责新一轮架构重构
- 如果清理范围触及需要保留的测试证据或发布证据，必须先重新确认后再删

## 当前 V1 总结

- 代码闭环有条件通过。
- 前台手测未通过。
- 阻塞项：`read_list` evidence 未被 Planner 正确用于 `answer` 决策，导致重复工具调用直到失败。

## Delivery Evidence

### Changed Files

- `server/src/agent/nodes.ts`
- `server/src/agent/index.ts`
- `server/src/agent/resume.ts`
- `docs/harness/README.md`
- `docs/harness/agentgraph-harness-protocol.md`
- `docs/project-control/agent-nodes-workboard.md`
- `docs/project-control/tasks/agent_node_T008-v1-cleanup-release-hardening.md`

### Cleanup Evidence

已从仓库清理以下主分支派生产物与临时文件：

- `desktop/test-report/coverage-report.json`
- `desktop/test-report/test-report.json`
- `server/client-coverage/coverage-report.json`
- `server/client-coverage/test-report.json`
- `server/server-coverage/coverage-report.json`
- `server/server-coverage/test-report.json`
- `server/test-report/coverage-report.json`
- `server/test-report/test-report.json`
- `server/tmp-integrations-route.sqlite-shm`
- `server/tmp-integrations-route.sqlite-wal`
- `server/tmp-wecom-route.sqlite-shm`
- `server/tmp-wecom-route.sqlite-wal`

清理前已核对典型体积：

- `desktop/test-report/coverage-report.json`: `11,090,980` bytes
- `server/client-coverage/coverage-report.json`: `11,609,583` bytes
- `server/server-coverage/coverage-report.json`: `11,592,504` bytes
- `server/test-report/coverage-report.json`: `11,269,942` bytes

这些文件都属于可再生成报告或 sqlite 临时文件，不是源码或手写文档。

### Acceptance Criteria Evidence

- `AC1` 已满足：
  - 已清理主分支中被跟踪的大型 `test-report` / coverage 产物与 sqlite `wal/shm`
  - 清理列表见上
- `AC2` 已满足：
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts) 已明确 `createAgentPlan` / `planNode` 只是 V1 placeholder
  - [agentgraph-harness-protocol.md](D:/workspace/rag-demo/docs/harness/agentgraph-harness-protocol.md) 已明确不能宣称 `TaskFrame` 完成
- `AC3` 已满足：
  - [server/src/agent/index.ts](D:/workspace/rag-demo/server/src/agent/index.ts) 与 [resume.ts](D:/workspace/rag-demo/server/src/agent/resume.ts) 已补 `selectedToolId` 只供 UI / trace 的迁移注释
  - [README.md](D:/workspace/rag-demo/docs/harness/README.md) 与 [agentgraph-harness-protocol.md](D:/workspace/rag-demo/docs/harness/agentgraph-harness-protocol.md) 已写入正式说明
- `AC4` 已满足：
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts) 在 generate 组装 tool result 的两处入口都补了 `TODO(agent_node_T008)`
  - [agentgraph-harness-protocol.md](D:/workspace/rag-demo/docs/harness/agentgraph-harness-protocol.md) 已明确这仍是未完成项
- `AC5` 已满足：
  - [agentgraph-harness-protocol.md](D:/workspace/rag-demo/docs/harness/agentgraph-harness-protocol.md) 已新增 `V1 当前不变量`
  - [README.md](D:/workspace/rag-demo/docs/harness/README.md) 已补充执行入口、placeholder 和 generate 待办口径

### Verification

- 自动化验证：
  - 未运行 `pnpm check`
  - 未运行 `pnpm package:electron:win`
- 原因：
  - 本任务只涉及文档、注释和派生产物清理，没有改动运行时分支逻辑或打包脚本
  - 为避免把无关存量失败混入本任务结论，本次只提交范围证据与文件级核对

### Remaining Gaps

- `generate` 阶段对超大 `tool result` 的 size guard / summary 仍然只是显式 TODO，未在本任务实现
- `planNode` 仍是 placeholder；如果要补真正的 `TaskFrame`，必须另开任务卡
