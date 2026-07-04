---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: PhoenixMinimumHumanObservability
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/chat/agent-runtime-design.md
  - docs/development/agent-observability.md
  - server/src/agent/graph.ts
  - server/src/agent/observability.ts
  - server/src/agent/graph.test.ts
  - server/src/agent/observability.test.ts
task_state: DONE
---

# agent_node_T015 phoenix minimum human observability

## Task Alias

这张任务卡对应台账里的正式编号是 `agent_node_T015`。

为了和项目 owner 提到的名字对齐，本任务同时使用别名：

- `T_phonex`

## Target

`T015 / T_phonex` 是 `Agent V1.5 minimum human observability` 任务。

目标只有一个：

- 给当前 AgentGraph 增加默认关闭、环境变量开启的开发态 tracing，让开发者能在 Phoenix UI 中看到一次 run 经过了哪些节点、每个节点的大致输入输出、耗时、工具调用、证据状态和最终收口路径

这不是 Agent V2，也不是架构重写。

## Allowed Changes

- `server/package.json`
- `server/src/agent/graph.ts`
- `server/src/agent/observability.ts`
- `server/src/agent/observability.test.ts`
- `server/src/agent/graph.test.ts`
- `server/src/agent/next-action-planner.test.ts`
- `server/src/agent/tool-call-normalize.test.ts`
- `server/src/agent/policy.test.ts`
- `server/src/agent/tool-node.test.ts`
- `server/src/agent/nodes.test.ts`
- `docs/development/agent-observability.md`
- `docs/README.md`
- `docs/project-control/tasks/agent_node_T015-phoenix-minimum-human-observability.md`
- `docs/project-control/agent-nodes-workboard.md`

## Forbidden Changes

- 各 node 的业务语义
- AgentGraph 条件路由
- Harness 大改
- 前端大改
- Approval resume 合同
- workspace path contract
- Agent V2
- DAG / 并发 tool calls / 多 Agent / 长期记忆

## Defect Layer

这是后端运行时开发可观测性缺口，不是前端展示样式缺口。

原始问题不是 Agent 不会跑，而是：

1. 当前本地开发缺少一条统一的人眼 trace 链路
2. 要看 AgentGraph 究竟卡在哪个节点，往往只能翻 execution trace 事件或日志
3. 节点级耗时、输入输出摘要、证据状态和最终收口路径没有统一聚合到一个可视化 trace 页面

## Implementation Choice

本次选择的接入方式是：

1. 新增 `server/src/agent/observability.ts`
2. 在 `graph.ts` 组装层统一包装所有 graph node
3. 额外给整次 `agentGraph.run` 增加根 span `agent.graph.run`
4. 默认不启用；只有 `AGENT_TRACE_PHOENIX=true` 时才注册 OTel provider 并导出到 Phoenix collector

这样做的原因是：

- 侵入最小
- 不需要逐个改 node 业务实现
- 不改现有执行语义
- span 能天然反映真实图路由

## Metadata Contract

普通模式记录摘要字段：

- `runId`
- `threadId`
- `nodeName`
- `iterationCount`
- `maxIterations`
- `nextAction.type`
- `pendingToolCall.toolId`
- `policyDecision.type`
- `pendingApproval.toolId`
- `lastToolExecution.toolId`
- `latestEvidenceSummary`
- `retrievedChunks count`
- `observations count`
- `answer exists`
- `errorMessage`
- `errorSourceNodeId`
- `blockedReason`
- `latencyMs`

`AGENT_TRACE_VERBOSE=true` 时额外记录脱敏后的 JSON 摘要：

- `nextAction`
- `pendingToolCall`
- `policyDecision`
- `pendingApproval`
- `lastToolExecution`
- `latestEvidenceSummary`
- `retrievedChunks` 来源与内容预览
- `answerPreview`

## Secret Filter

本次没有把 raw 调试信息原样直出到 trace。

统一过滤规则：

1. 命中敏感字段名直接替换成 `[REDACTED]`
2. Bearer token、`sk-...` 一类 key/token 文本会被替换
3. `api_key=...`、`token=...`、`secret=...`、`password=...` 这类明文片段会被替换

## Result

本次实现已完成：

1. 新增 Phoenix/OpenTelemetry tracing 模块
2. 新增 `agent.graph.run` 根 span
3. `prepareContext / toolSelectStep / toolGuardStep / nextActionPlanner / toolCallNormalize / policyStep / tool / retrieve / generate / evaluate` 均已接入统一 wrapper
4. tracing 默认关闭
5. 只在 `AGENT_TRACE_PHOENIX=true` 时启用
6. `AGENT_TRACE_VERBOSE=true` 时可看到更完整的脱敏 state 摘要
7. 新增开发文档 `docs/development/agent-observability.md`
8. 新增定向测试，覆盖：
   - 默认关闭时不产出 tracing 记录
   - 开启后能产出 node span
   - verbose 输出会过滤 secret

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server test -- src/agent/observability.test.ts`
  - 结果：通过，`2 passed`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/next-action-planner.test.ts src/agent/tool-call-normalize.test.ts src/agent/policy.test.ts src/agent/tool-node.test.ts src/agent/nodes.test.ts src/agent/observability.test.ts`
  - 结果：通过，`115 passed`

本次没有执行：

- `pnpm check`
- `pnpm package:electron:win`

原因：

- 本任务没有改打包链、网络契约或桌面运行边界
- 当前验收重点是 AgentGraph tracing 接入和相关后端回归

## Invariants Confirmed

这次完成后仍保持：

1. 没有改变 AgentGraph 行为
2. 没有改变 Planner 语义
3. 没有改变 Normalize 语义
4. 没有改变 Policy 语义
5. 没有改变 ToolNode 语义
6. 没有改变 Evidence 写回语义
7. 没有改变 Generate / Evaluate 收口语义

## Conclusion

`T015 / T_phonex = DONE`
