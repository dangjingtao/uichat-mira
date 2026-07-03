---
status: current
owner: agent-runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: AgentNodesWorkboard
doc_type: workboard
canonical: true
related:
  - docs/project-control/README.md
  - docs/project-control/tasks/agent_node_T001-next-action-planner-node.md
  - docs/project-control/tasks/agent_node_T002-tool-call-normalize-node.md
  - docs/project-control/tasks/agent_node_T003-agent-graph-wiring.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
---

# AgentNodes Workboard

Agent node 专属总台账。

本页只做三件事：

- 记录当前正在拆分和治理的 Agent graph node 任务
- 给每个 node 任务分配独立任务编号 `agent_node_T+编号`
- 把“节点职责”与“非目标”分开，避免一次任务扩大成整条 Agent loop 重写

## Naming Rule

- 任务编号格式：`agent_node_T001`、`agent_node_T002`、`agent_node_T003`
- 一张任务卡只处理一个 node 或一个非常明确的 node contract
- 不允许把 Harness、policy、tool execution、UI、模型配置系统混进同一张 node 任务卡，除非项目 owner 明确批准

## AgentNodes Workboard

| ID | Node / Topic | Current Judgment | Status | Task Card |
| --- | --- | --- | --- | --- |
| `agent_node_T001` | `nextActionPlannerNode` | 节点评审已通过；当前节点只负责 `AgentNextAction` 决策与 `error` 输出，route / normalize 接入前提已确认但不在本节点实现范围内 | `DONE` | [agent_node_T001-next-action-planner-node.md](D:/workspace/rag-demo/docs/project-control/tasks/agent_node_T001-next-action-planner-node.md) |
| `agent_node_T002` | `toolCallNormalizeNode` | 当前只实现 Planner 后的“工具调用规范化/冻结节点”，只负责把 `nextAction.use_tool` 校验并冻结成 `pendingToolCall`；不得顺手改 Harness / policy / toolNode / Planner / 完整 loop | `TODO` | [agent_node_T002-tool-call-normalize-node.md](D:/workspace/rag-demo/docs/project-control/tasks/agent_node_T002-tool-call-normalize-node.md) |
| `agent_node_T003` | `AgentGraph wiring for planner -> normalize -> policy -> tool loop` | 当前任务只做主链路接线：把 `nextActionPlannerNode` 与 `toolCallNormalizeNode` 接入 `AgentGraph`，并让旧的 `capabilityIntent.selectedToolIds -> policyNode` 执行入口失效；不得借机重写 Planner / Normalize / Harness / policy / toolNode | `TODO` | [agent_node_T003-agent-graph-wiring.md](D:/workspace/rag-demo/docs/project-control/tasks/agent_node_T003-agent-graph-wiring.md) |
| `agent_node_T004` | `policyNode` 只消费 `pendingToolCall` | 当前判断：`policyNode` 只能审批冻结后的 `pendingToolCall`，不得自己造工具调用，不得从 `capabilityIntent / query / selectedToolId` 推导执行对象 | `TODO` |  |

## Current Ground Truth

- `nextActionPlannerNode` 当前任务已经明确：
  - 不允许硬编码上下文假设
  - 不允许规则化直接判断“这类问题就该 retrieve / use_tool”
  - 具体下一步动作必须调用现有 task model 产出
- 当前任务只允许写入 `state.nextAction`
- 当前任务不允许直接写入：
  - `state.pendingToolCall`
  - `state.selectedToolId`
  - `state.selectedCapabilityId`
  - `state.pendingApproval`
- `toolCallNormalizeNode` 当前任务已经明确：
  - 只处理 `state.nextAction.type === "use_tool"` 的规范化
  - 只允许把合法 `nextAction.use_tool` 冻结成 `state.pendingToolCall`
  - 不允许读取 `capabilityIntent.selectedToolIds` 作为执行依据
  - 不允许替换 `toolId`、猜测参数、自动修复 schema
  - 不允许执行工具、审批工具或调用 Harness invocation
- `agent_node_T003` 当前任务已经明确：
  - 只做 `AgentGraph` 主链路接线，不重写节点内部逻辑
  - 新的工具执行入口必须是 `nextAction.use_tool -> toolCallNormalizeNode -> pendingToolCall -> policyNode -> toolNode`
  - `capabilityIntent.selectedToolIds` 只能继续用于暴露面、trace、diagnostics，不得直接触发执行
  - `toolNode` / `retrieve` 完成后必须回到 Planner 再决策，不能直接默认 `generate`
  - `maxIterations` 到达后不得继续进入 retrieve / normalize / policy / tool

## Work Rules

- 节点级任务先确认节点职责，再动代码
- 若节点真实职责仍不清楚，先补任务卡或设计说明，不直接实现
- 节点任务完成后，只更新自己的任务卡和本页对应条目
- 不把单个节点任务的完成，误报成整个 Agent graph 收口

## Update Log

- `2026-07-03`
  - 新建 `AgentNodes` 总台账
  - 确认第一个节点任务编号为 `agent_node_T001`
  - 记录 `nextActionPlannerNode` 的当前真相：必须调用现有 task model，不允许硬编码上下文假设
  - `agent_node_T001` 已完成代码实现与定向验证，状态更新为 `READY_FOR_REVIEW`
  - `agent_node_T001` 评审通过，状态更新为 `DONE`
  - 记录接入前提：
    - `routeAfterNextAction` 后续必须处理 `error`
    - normalize 节点后续必须负责 schema 校验和 `pendingToolCall` freeze
    - 上述两点不属于 `agent_node_T001` 当前实现范围
  - 追加第二个节点任务编号 `agent_node_T002`
  - 记录 `toolCallNormalizeNode` 的当前真相：只负责 `nextAction.use_tool -> validate -> freeze -> pendingToolCall`
  - 追加第三个节点任务编号 `agent_node_T003`
  - 明确第三个任务只做 `AgentGraph` 主链路接线：`Planner -> Normalize -> Policy -> Tool -> Evidence -> Planner`
  - 明确旧执行入口 `capabilityIntent.selectedToolIds -> policyNode` 必须失效，不得继续作为工具执行入口
