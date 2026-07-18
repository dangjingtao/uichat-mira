---
status: current
owner: agent-runtime
last_verified: 2026-07-18
layer: raw-source
module: Agent Runtime
feature: AgentObservability
doc_type: runbook
canonical: true
related:
  - docs/harness/agentgraph-harness-protocol.md
  - server/src/agent/observability.ts
  - server/src/agent/graph/index.ts
  - server/src/agent/pi-loop/index.ts
---

# Agent Observability

## 这篇文档解决什么问题

这篇文档只讲：

- 当前 Agent Runtime 如何输出产品 execution trace
- 如何开启 Phoenix / OpenTelemetry tracing
- Pi Loop 与 LangGraph 两种运行时在 trace 中怎样保持兼容
- 哪些内容允许展示，哪些内容禁止记录

它不是新的 Agent 平台，也不是 Agent V2。

## 1. 先说清当前运行时

应用默认运行时是 `pi_loop`，不是 LangGraph。

```text
未设置 MIRA_AGENT_RUNTIME
  -> 应用环境：pi_loop
  -> 测试环境：langgraph（兼容历史测试）
```

显式选择：

```bash
MIRA_AGENT_RUNTIME=pi_loop
MIRA_AGENT_RUNTIME=langgraph
```

两种运行时都通过同一个 `agentGraph.run` 门面，并使用同一套 AgentGraph input/output、execution node 和 tracing 包装。

因此，Phoenix 中仍会看到历史稳定 node name，例如：

- `prepareContext`
- `nextActionPlanner`
- `toolCallNormalize`
- `policyStep`
- `approval`
- `retrieve`
- `tool`
- `evidenceStage`
- `generate`
- `evaluate`
- `error`

这些名称是稳定观测合同，不代表应用默认运行时仍由 LangGraph 图调度。

## 2. 两条观测通道

### 2.1 产品 execution node

通过 `onExecutionNode` 发出，用于桌面端真实产品 UI。

它负责展示：

- 当前步骤状态
- Planner 公开 reason
- 工具调用目标与参数摘要
- Policy / approval 状态
- Tool / Retrieve / Evidence 进展
- Generate / Finalize 状态
- approval resume 后的增量节点
- failure / blocked / completed 结论

Execution node 会持久化进 assistant message 的 data parts，因此刷新线程后仍能恢复可见轨迹。

### 2.2 Phoenix / OpenTelemetry span

这是开发态诊断通道：

- 默认关闭
- 显式环境变量开启
- 不改变业务路由
- 不改变 Planner、Policy、Tool 或 Evidence 语义
- 同时覆盖 Pi Loop 与 LangGraph 兼容运行时

根 span：

```text
agent.graph.run
```

每个语义步骤由 `runWithAgentNodeSpan` 包装。

## 3. Planner 可见思考的边界

前端 Planner thought 只来自 task model JSON 的公开 `reason` 字段。

当前流式行为：

1. task model 流式返回 JSON
2. runtime 只解析尚未完成 JSON 中的 `reason`
3. 当 reason 增长到足够长度或出现自然停顿符号时，发送 execution node 更新
4. Planner 完成后，将最终 reason 标记为非 streaming 状态

不会展示：

- 原始完整模型输出
- 隐藏 reasoning 字段
- 内部 chain of thought
- 未脱敏 prompt

因此 UI 中的“思考下一步”是**公开决策说明**，不是模型私有推理转储。

## 4. 本地启动 Phoenix

推荐 Docker：

```bash
docker run --rm -it -p 6006:6006 -p 4318:4318 arizephoenix/phoenix:latest
```

仓库当前默认 collector 地址是：

```text
http://localhost:16006
```

实际使用时按本机端口覆盖即可。

## 5. 环境变量

最小配置：

```bash
AGENT_TRACE_PHOENIX=true
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:16006
AGENT_TRACE_PROJECT=uichat-mira-dev
```

需要更完整的脱敏状态摘要：

```bash
AGENT_TRACE_VERBOSE=true
```

说明：

| 环境变量 | 作用 |
| --- | --- |
| `AGENT_TRACE_PHOENIX` | 只有显式 `true` 才启用 tracing |
| `PHOENIX_COLLECTOR_ENDPOINT` | collector 根地址；runtime 自动补 `/v1/traces` |
| `AGENT_TRACE_PROJECT` | Phoenix project name，默认 `uichat-mira-dev` |
| `AGENT_TRACE_VERBOSE` | 增加脱敏后的结构化 state 摘要 |
| `MIRA_AGENT_RUNTIME` | 选择 `pi_loop` 或 `langgraph` |

仓库开发命令：

```bash
pnpm dev:electron:win:trace
```

它不会替换普通开发入口，只是注入 trace 配置。

## 6. 查看一次真实 run

1. 启动 Phoenix。
2. 启动桌面开发链：

```bash
pnpm dev:electron:win:trace
```

3. 在聊天页绑定 workspace。
4. 用 Agent 模式发起真实任务。
5. 在 Phoenix 中打开最新 `agent.graph.run`。
6. 检查子 span 是否符合实际执行路径。

典型 Tool 路径：

```text
prepareContext
  -> nextActionPlanner
  -> toolCallNormalize
  -> policyStep
  -> tool
  -> evidenceStage
  -> nextActionPlanner
  -> generate
  -> evaluate
```

典型 Retrieve 路径：

```text
prepareContext
  -> nextActionPlanner
  -> retrieve
  -> evidenceStage
  -> nextActionPlanner
  -> generate
  -> evaluate
```

典型 Approval 路径：

```text
prepareContext
  -> nextActionPlanner
  -> toolCallNormalize
  -> policyStep
  -> approval
  -> END(waiting_approval)
```

Approve 后：

```text
resume execution node
  -> prepareContext
  -> policyStep
  -> tool
  -> evidenceStage
  -> nextActionPlanner
  -> ...
```

恢复时不会重新根据自然语言制造工具参数，而是继续消费 frozen `pendingToolCall`。

## 7. 普通模式字段

每个 node span 的 state 摘要至少包含：

- `runId`
- `threadId`
- `iterationCount`
- `maxIterations`
- `nextActionType`
- `pendingToolId`
- `policyDecisionType`
- `pendingApprovalToolId`
- `lastToolExecutionToolId`
- `latestEvidenceSource`
- `latestEvidenceToolId`
- `retrievedChunkCount`
- `observationCount`
- `answerExists`
- `errorMessage`
- `errorSourceNodeId`
- `blockedReason`

注意：

- `maxIterations` 当前主要是兼容诊断字段。
- Pi Loop 的全局决策循环没有 iteration cap。
- 局部 recovery budget 仍会单独限制 schema replan 与 recoverable failure。

根 span 输入摘要还会包含：

- `messageCount`
- `requestContextCount`
- `knowledgeBaseId`
- `workspaceRoot`
- `selectedToolId`
- `hasPendingToolCall`

根 span 输出摘要包括：

- 最终 `status`
- `terminalReason`
- pending approval / pending tool
- blocked / error 信息
- Evidence 最新来源
- retrieval 与 observation 数量

## 8. verbose 模式

`AGENT_TRACE_VERBOSE=true` 时会增加脱敏 JSON：

- `nextAction`
- `pendingToolCall`
- `policyDecision`
- `pendingApproval`
- `lastToolExecution`
- `latestEvidenceSummary`
- retrieved chunk 来源与内容预览
- answer preview
- graph input 中的 goal / params / approvals

单个 JSON 属性有长度限制，数组有条数限制，递归有深度限制。

Verbose 不是原始 state dump。

## 9. 永远禁止记录的内容

即使 verbose 开启，也禁止记录明文：

- API key
- access token
- refresh token
- secret
- password
- authorization header
- cookie
- credentials
- private key
- session token

当前过滤包括：

1. 敏感字段名过滤
2. Bearer / key pattern 字符串过滤
3. JSON 长度截断
4. 文本摘要长度截断
5. 数组与递归深度限制

这是一套开发态诊断保护，不是完整 DLP 系统。

## 10. 如何关闭 tracing

```bash
AGENT_TRACE_PHOENIX=false
```

或者不设置该变量。

默认不会创建 Phoenix exporter。

## 11. 当前边界

当前 observability 明确不做：

- 不改 Agent 路由
- 不改 Planner 决策
- 不改变审批结果
- 不让 trace 反向驱动工具执行
- 不把 `selectedToolId` 恢复成执行入口
- 不输出隐藏思维链
- 不建设自研 observability 平台
- 不统一成多 Agent / DAG trace 系统

## 12. 最小验证建议

至少验证：

### A. 文件读取

```text
打开 README.md，根据真实内容总结
```

检查：

```text
Planner -> Normalize -> Policy -> Tool -> Evidence -> Planner -> Generate
```

### B. 知识库检索

```text
看看当前知识库有没有发布说明
```

检查：

```text
Planner -> Retrieve -> Evidence -> Planner -> Generate
```

### C. Terminal approval

```text
执行一个只读命令并告诉我结果
```

检查：

- frozen input hash
- waiting approval
- approve 后异步 running
- tool result 进入 Evidence
- 最终 assistant message 与 execution nodes 持久化

### D. Planner 可见 reason

检查 UI 只显示决策 reason，不显示原始 JSON 或隐藏推理。

## 参考

- [AgentGraph 与 Harness 当前协议](../harness/agentgraph-harness-protocol.md)
- Phoenix Docker deployment: [arize.com/docs/phoenix/self-hosting/deployment-options/docker](https://arize.com/docs/phoenix/self-hosting/deployment-options/docker)
