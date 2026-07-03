---
status: current
owner: agent-runtime
last_verified: 2026-07-04
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
  - docs/project-control/tasks/agent_node_T004-policy-node-consume-pending-tool-call.md
  - docs/project-control/tasks/agent_node_T005-tool-node-execute-frozen-pending-tool-call.md
  - docs/project-control/tasks/agent_node_T006-evidence-loop-routing.md
  - docs/project-control/tasks/agent_node_T007-decision-loop-acceptance-regression-guardrails.md
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
| `agent_node_T004` | `policyNode` 只消费 `pendingToolCall` | 当前任务只收敛 `policyNode`：它只能审批冻结后的 `pendingToolCall`，不得自己造工具调用，不得从 `capabilityIntent / query / selectedToolId` 推导执行对象，也不得把 `capabilityId` 当执行对象 | `TODO` | [agent_node_T004-policy-node-consume-pending-tool-call.md](D:/workspace/rag-demo/docs/project-control/tasks/agent_node_T004-policy-node-consume-pending-tool-call.md) |
| `agent_node_T005` | `toolNode` 只执行 frozen `pendingToolCall` | `toolNode` 收敛与独立模块拆分已评审通过：它现在只在 `policyDecision.allow` 与 frozen `pendingToolCall` 对齐时执行；执行结果会保留 `toolCallId / inputHash`，成功或失败后会清理 `pendingToolCall`；整仓打包阻断项已明确为非本任务问题 | `DONE` | [agent_node_T005-tool-node-execute-frozen-pending-tool-call.md](D:/workspace/rag-demo/docs/project-control/tasks/agent_node_T005-tool-node-execute-frozen-pending-tool-call.md) |
| `agent_node_T006` | `evidence` 回流与 Agent loop 路由闭环 | `retrieveNode / toolNode -> evidence -> Planner` 的最小闭环已接通；retrieval / tool evidence 写回、evidence-update trace、去重 helper、`maxIterations` 收口和旧入口阻断都已有定向验证，评审已通过 | `DONE` | [agent_node_T006-evidence-loop-routing.md](D:/workspace/rag-demo/docs/project-control/tasks/agent_node_T006-evidence-loop-routing.md) |
| `agent_node_T007` | Agent Decision Loop v1 验收测试与回归护栏 | 已补齐当前 commit 专属验收证据：4 个定向测试源码、vitest JSON 报告、typecheck 报告、场景映射、运行时间与剩余风险均已回填到任务卡；当前证据不再引用 `2026-07-03` 的旧失败报告 | `DONE` | [agent_node_T007-decision-loop-acceptance-regression-guardrails.md](D:/workspace/rag-demo/docs/project-control/tasks/agent_node_T007-decision-loop-acceptance-regression-guardrails.md) |

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
- `agent_node_T004` 当前任务已经明确：
  - `policyNode` 的核心入口必须是 `state.pendingToolCall`
  - `policyNode` 只审批冻结调用，不选择工具、不生成参数、不创建工具调用
  - `policyNode` 不得再从 `capabilityIntent.selectedToolIds`、`selectedToolId`、`selectedCapabilityId` 推导执行对象
  - 无 `pendingToolCall` 时必须 `skip` 或进入现有 error flow，不得继续进入 `toolNode`
  - 已审批恢复必须至少校验 `toolId + inputHash`，避免审批对象与真实执行对象错位
- `agent_node_T005` 当前任务已经明确：
  - `toolNode` 的唯一执行入口必须是 `state.pendingToolCall`
  - `toolNode` 只执行 frozen 调用，不选择工具、不生成参数、不审批、不理解 capability
  - `toolNode` 不得再从 `selectedToolId`、`selectedCapabilityId`、`capabilityIntent.selectedToolIds`、`toolIntent.selectedToolIds` 推导执行对象
  - 无 `pendingToolCall` 时必须阻断执行并写入明确错误或 trace，不得从旧字段恢复工具
  - 只有 `policy` 明确 `allow` 时才允许执行；`require_approval / deny / skip / error / missing policy decision` 均不得执行
  - 工具执行结束后必须清理 `pendingToolCall`，避免下一轮误执行旧调用
  - 当前代码已拆出独立 `tool-node.ts`，并补齐最小 `policyDecision` 状态与 `toolCallId / inputHash` writeback
- `agent_node_T006` 当前任务已经明确：
  - `retrieveNode` 与 `toolNode` 的执行结果必须稳定写入 `state.evidence`
  - `retrieve` / `tool` 完成后必须回到下一轮 Planner，而不是固定直接 `generate`
  - Planner 下一轮必须能看到最新 retrieval evidence、tool execution result、iteration / maxIterations、toolExposure、taskFrame / plan
  - `use_tool` 必须继续走 `nextAction -> toolCallNormalize -> policyNode -> toolNode`，不得从旧 `selectedToolId / selectedToolIds` 入口绕过
  - `approval pending` 时不得继续进入 `toolNode` 或 Planner loop；必须等待用户审批恢复原 frozen `pendingToolCall`
  - `maxIterations` 到达后不得继续进入 `retrieve / toolCallNormalize / policyNode / toolNode`
  - trace 必须能看到 `evidence update`、`iteration` 与关键字段：`nextActionType / toolId / toolCallId / inputHash / policyDecision / retrievalChunkCount / evidenceCounts`
- `agent_node_T007` 当前任务已经明确：
  - 只做 Agent Decision Loop v1 的验收测试、回归护栏和必要的最小修复
  - 必须覆盖 `answer / retrieve / use_tool / normalize reject / policy reject / approval pending / maxIterations` 等关键闭环场景
  - 必须证明 `capabilityIntent.selectedToolIds`、`selectedToolId`、capabilityId 已不能绕过 `Normalize -> Policy -> Tool`
  - 测试必须 mock provider、retrieve、Harness invocation、trace，不得真实执行外部模型、危险工具或网络请求
  - 除非测试直接暴露实现缺陷，否则不得借机改 Planner、Harness、MCP registry、Provider Gateway 或架构边界

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
- `2026-07-04`
  - 追加第四个节点任务编号 `agent_node_T004`
  - 明确第四个任务只收敛 `policyNode`：只审批 `pendingToolCall`，不再生成工具调用
  - 补齐 `agent_node_T004` 任务卡链接与当前真相说明
  - 追加第五个节点任务编号 `agent_node_T005`
  - 明确第五个任务只收敛 `toolNode`：只执行 frozen `pendingToolCall`，不再从旧字段推导工具或参数
  - 补齐 `agent_node_T005` 任务卡链接与当前真相说明
  - `agent_node_T005` 已完成实现并提交评审：`toolNode` 已拆分为独立模块，执行入口只保留 frozen `pendingToolCall`
  - 定向 `server` typecheck、`tool-node / policy / graph / resume` 测试与 `pnpm check` 已通过
  - `pnpm package:electron:win` 仍被仓库现有的前端 / server 非本任务失败项阻断，当前状态更新为 `READY_FOR_REVIEW`
  - `agent_node_T005` 评审通过，状态更新为 `DONE`
  - 追加第六个节点任务编号 `agent_node_T006`
  - 明确第六个任务只接通 `evidence` 回流与 Agent loop 路由闭环：`行动 -> 证据 -> 再决策`
  - 补齐 `agent_node_T006` 任务卡链接、路由约束、`approval pending` 限制与 `maxIterations` 停止条件
  - `agent_node_T006` 已完成实现并进入 `READY_FOR_REVIEW`
  - 当前实现已补：
    - retrieval / tool evidence 写回去重 helper
    - `agent-evidence-update-retrieve` / `agent-evidence-update-tool` trace 事件
    - `routeAfterNextAction` 默认错误分支与 `routeAfterTool` 的 `maxIterations` 停止收口
  - 定向验证已通过：`graph.test.ts`、`tool-node.test.ts`、`server` typecheck、`pnpm check`
  - `agent_node_T006` 评审通过，状态更新为 `DONE`
  - 追加第七个节点任务编号 `agent_node_T007`
  - 把 Agent Decision Loop v1 的验收测试与回归护栏正式纳入 `AgentNodes` 总台账
  - 明确第七个任务只负责闭环验证、测试覆盖、最小护栏和旧执行路径回流防护
  - `agent_node_T007` 已补齐当前 commit 专属验收证据，状态保持 `DONE`
  - 当前验收只引用以下新报告，不再引用 `2026-07-03` 的旧全量失败报告：
    - `server/test-report/agent-node-T007-8110b0aa-vitest.json`
    - `server/test-report/agent-node-T007-8110b0aa-vitest.meta.txt`
    - `server/test-report/agent-node-T007-8110b0aa-typecheck.txt`
    - `server/test-report/agent-node-T007-8110b0aa-summary.md`
  - 定向验证结果：
    - `pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/tool-call-normalize.test.ts src/agent/tool-node.test.ts src/agent/policy.test.ts`
      - 结果：通过，`46 passed`
    - `pnpm --filter @ui-chat-mira/server typecheck`
      - 结果：通过
