---
status: current
owner: agent-runtime
last_verified: 2026-07-30
layer: raw-source
module: Agent
feature: AgentObservability
doc_type: runbook
canonical: true
related:
  - ../AGENT_CURRENT_TRUTH.md
  - ../harness/agentgraph-harness-protocol.md
  - ../skill/pi-skill-agent-execution.md
  - ../../server/src/agent/observability.ts
  - ../../server/src/agent/pi-loop/index.ts
---

# Agent Observability

> 本页只讲当前 Agent Runtime 如何输出产品 execution trace 和开发态 tracing。Observability 不得成为第二控制平面。

## 1. 当前运行时

应用默认：

```text
MIRA_AGENT_RUNTIME 未设置
  -> 应用：pi_loop
  -> 测试：langgraph（历史兼容）
```

显式选择：

```bash
MIRA_AGENT_RUNTIME=pi_loop
MIRA_AGENT_RUNTIME=langgraph
```

两种运行时都通过 `agentGraph.run(...)`，共用同一组语义步骤、execution nodes 与 tracing 包装。

## 2. 两条观测通道

### 产品 execution node

通过 `onExecutionNode` 发出，用于桌面 UI 与 assistant message data parts。

它展示：

- Prepare Context；
- Planner public reason；
- generic task SubAgent；
- Skill-owned SubAgent / Skill Flow；
- concrete tool / retrieval；
- Evidence；
- Policy / approval / resume；
- Generate / Finalize；
- waiting / blocked / failed / completed。

刷新线程后，已持久化节点仍可恢复。

### Phoenix / OpenTelemetry

开发态诊断通道：

- 默认关闭；
- 显式开启；
- 不改变业务路由；
- 不改变 Planner、SubAgent、Policy、Tool 或 Evidence；
- 同时覆盖 Pi Loop 与 LangGraph compatibility runtime。

根 span：

```text
agent.graph.run
```

## 3. 稳定语义步骤

普通 Main Agent 节点名：

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

Generic delegation 额外包含：

- `genericTaskSubAgent`
- 产品 node `agent-generic-task-subagent`

Skill-owned execution 额外包含：

- 产品 node `agent-forked-skill-agent`
- `subagent-trace:<runId>:<seq>`
- `subagent-working-state:<runId>:<timestamp>`

这些名称是观测合同，不代表底层一定由 LangGraph 节点调度。

## 4. Planner public reason

UI 中的“思考下一步”只来自 Planner structured JSON 的公开 `reason`。

流式过程：

1. task model 返回结构化 JSON；
2. runtime 从未完成 JSON 中只提取 `reason`；
3. 达到长度或自然停顿时发 execution update；
4. 完整 JSON 通过 parse / schema / validation 后才可执行；
5. 完成时记录最终 reason。

不会展示：

- 原始完整模型输出；
- hidden reasoning；
- chain of thought；
- 未脱敏 prompt；
- 不完整 JSON 中的工具参数作为可执行调用。

## 5. SubAgent trace

SubAgent runtime event 会投影到 Parent AgentRun。

当前可以看到：

- Child run id；
- Skill id；
- task-local sequence；
- working state；
- current judgement；
- current action；
- next action；
- tool started / completed / failed；
- approval required；
- input required；
- artifacts；
- requirements；
- missing Evidence；
- completed / failed。

Generic Child 与 Skill-owned Child 都归入 Parent execution history，但 task-local trace 不等于新的 global control plane。

`publishSubAgentRuntimeEvent(...)` 失败时，Child execution 仍继续；最终 structured observation 会保留 bounded trace snapshot。

## 6. 典型路径

### Direct answer

```text
prepareContext
  -> nextActionPlanner
  -> generate
  -> evaluate
```

### Concrete tool

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

### Retrieve

```text
prepareContext
  -> nextActionPlanner
  -> retrieve
  -> evidenceStage
  -> nextActionPlanner
  -> generate
  -> evaluate
```

### Generic delegation

```text
prepareContext
  -> nextActionPlanner
  -> genericTaskSubAgent
  -> child trace / concrete tools
  -> evidenceStage
  -> nextActionPlanner
  -> ...
```

### Skill-owned completed

```text
prepareContext
  -> Skill-owned SubAgent / Skill Flow
  -> evidenceStage
  -> frozen Parent finalization packet
  -> generate
  -> evaluate
```

### Skill needs input

```text
prepareContext
  -> Skill-owned SubAgent / Skill Flow
  -> evidenceStage
  -> deterministic ask_user
  -> generate
  -> evaluate(waiting_user)
```

### Approval

```text
...
  -> exact invocation
  -> approval
  -> END(waiting_approval)
```

Approve 后：

```text
resume execution node
  -> prepareContext
  -> validate checkpoint / exact invocation
  -> Policy or resumed Child
  -> Evidence
  -> Planner / frozen delivery
```

## 7. Approval trace 对齐

Resume 必须记录：

- toolId；
- toolCallId；
- inputHash；
- approval id；
- Parent run id；
- SubAgent checkpoint / Child run id（如适用）。

任何 mismatch 都会产生 blocked / error execution node，并阻断工具运行。

历史 approval node 不能覆盖 AgentRun 当前状态。

## 8. Planner 运行时记忆的观测边界

- `planList` 只有 `{id, text, done}`；
- bounded conversation history 服务上下文续轮；
- 已进入 Evidence 的 canonical result 才能成为 Planner事实；
- semantic action ledger 汇总全量 execution observations 并合并重复目标；
- latest Evidence content 与摘要分别记录；
- 不存在通过打开工程记忆文件恢复 Agent 状态的隐藏流程。

## 9. 环境变量

```bash
AGENT_TRACE_PHOENIX=true
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:16006
AGENT_TRACE_PROJECT=uichat-mira-dev
AGENT_TRACE_VERBOSE=true
```

| 变量 | 作用 |
| --- | --- |
| `AGENT_TRACE_PHOENIX` | 只有显式 `true` 才启用 |
| `PHOENIX_COLLECTOR_ENDPOINT` | collector 根地址，runtime 补 `/v1/traces` |
| `AGENT_TRACE_PROJECT` | project name |
| `AGENT_TRACE_VERBOSE` | 增加脱敏结构化摘要 |
| `MIRA_AGENT_RUNTIME` | `pi_loop` 或 `langgraph` |

开发命令：

```bash
pnpm dev:electron:win:trace
```

## 10. 查看一次真实 run

1. 启动 Phoenix；
2. 启动桌面开发链；
3. 绑定 workspace；
4. 发起 Agent 任务；
5. 打开最新 `agent.graph.run`；
6. 根据实际任务判断应该出现 direct、generic Child 或 Skill-owned Child 路径；
7. 检查 Evidence 是否先于下一次 Planner 或 Generate；
8. 检查 final AgentRun status 与 UI 一致。

不能只看节点数量判断成功。

## 11. 普通摘要字段

至少包括：

- runId / threadId；
- iterationCount；
- nextActionType；
- pendingToolId；
- policyDecisionType；
- pendingApprovalToolId；
- lastToolExecutionToolId；
- latestEvidenceSource / ToolId；
- retrievedChunkCount；
- observationCount；
- answerExists；
- errorMessage / errorSourceNodeId；
- blockedReason；
- final status / terminalReason。

说明：

- `maxIterations` 是兼容诊断字段；
- Main Pi Loop 没有全局 iteration cap；
- schema replan 与 recoverable failure 有局部预算；
- SubAgent 自己有 task-local终止状态与 checkpoint。

## 12. Verbose 模式

`AGENT_TRACE_VERBOSE=true` 可以增加脱敏后的：

- nextAction；
- currentTaskFrame；
- toolExposure；
- pendingToolCall；
- policyDecision；
- pendingApproval；
- lastToolExecution；
- Evidence summary；
- retrieved chunk preview；
- finalization packet；
- SubAgent working state；
- answer preview。

Verbose 仍不是原始 state dump。

## 13. 永远禁止记录

禁止明文记录：

- API key；
- access / refresh token；
- password；
- authorization header；
- cookie；
- credentials；
- private key；
- session token；
- provider secret；
- 未脱敏用户敏感输入。

当前过滤包括敏感字段名、Bearer / key pattern、长度限制、数组和递归深度限制。

这不是完整 DLP 系统。

## 14. 已知合同漂移如何观测

当前 `dev` 在 recoverable recovery exhausted 时会出现：

```text
nextActionPlanner(error)
  -> error
  -> AgentRun failed
```

settled contract 目标是 guarded answer + completed。

观测系统必须如实显示当前 failed 行为，但文档和验收应把它标记为实现漂移，而不是把失败 trace 当成新合同证据。

详见 [[../AGENT_CURRENT_TRUTH#dev-已知实现漂移恢复耗尽被升级为-terminal-error]]。

## 15. Observability 不做什么

- 不改路由；
- 不改 Planner 或 Child 决策；
- 不批准工具；
- 不补写 Evidence；
- 不从 trace 重放 invocation；
- 不恢复 `selectedToolId` 为执行入口；
- 不输出 hidden reasoning；
- 不建设多 Agent / DAG control plane；
- 不因为 SSE 或 persistence 失败改变 Agent 语义。