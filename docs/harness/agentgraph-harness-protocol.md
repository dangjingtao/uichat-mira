# AgentGraph 与 Harness 当前协议

Status: Current
Owner: agent-runtime
Last verified: 2026-07-18
Layer: wiki
Module: Agent Runtime / Harness
Feature: AgentGraphProtocol
Doc Type: current-contract
Canonical: true
Related:
  - ../chat/agent-runtime-design.md
  - ../development/agent-observability.md
  - ../tooling-runtime/tools-protocol.md

## 这页回答什么

这页只回答一件事：

> **当前代码中，AgentRun、AgentGraph 兼容门面、Pi Loop、LangGraph 兼容运行时和 Harness 到底怎样协作。**

它不是未来设计草图，也不是任务卡汇总。

## 一句话结论

`AgentGraph` 这个名字现在代表的是一个**稳定运行时门面**，不再等同于“应用主链一定由 LangGraph 编排”。

当前应用默认运行时是顺序执行的 `pi_loop`：

```text
AgentRun
  -> agentGraph.run
  -> Pi Loop（默认）
  -> Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
  -> AgentRun
```

旧 LangGraph 图仍保留，用于兼容测试、回归比较和显式回退；它不是当前应用默认主链。

## 1. 当前运行时选择真相

运行时入口保持统一：

```ts
agentGraph.run(input: AgentGraphInput): Promise<AgentGraphOutput>
```

调用方不需要知道内部使用 Pi Loop 还是 LangGraph。

当前选择规则：

| 条件 | 实际运行时 |
| --- | --- |
| 正常应用启动，未设置环境变量 | `pi_loop` |
| `MIRA_AGENT_RUNTIME=pi_loop` | `pi_loop` |
| `MIRA_AGENT_RUNTIME=langgraph` | 旧 LangGraph 编排 |
| 测试环境且未显式指定 | LangGraph，保留历史测试行为 |

因此，文档中以后应区分：

- **Agent Runtime / AgentGraph 门面**：稳定对外合同
- **Pi Loop**：当前应用默认编排器
- **LangGraph**：兼容与对照运行时

不得再把三者写成同一个概念。

## 2. 当前主线不变量

当前 Agent 主链必须保护以下不变量：

1. Planner 只输出 `nextAction`。
2. Normalize 只校验并冻结 `nextAction.use_tool`，生成 frozen `pendingToolCall`。
3. Policy 只审批 frozen `pendingToolCall`。
4. Tool 只执行获得允许、且 `toolId / inputHash` 与 Policy 决策一致的 frozen `pendingToolCall`。
5. Tool 与 Retrieve 不直接改写累计 Evidence，只写 pending 事实。
6. Evidence 是累计证据对象的单一写入者。
7. Tool / Retrieve 完成后必须经过 Evidence，再回 Planner。
8. `capabilityIntent.selectedToolIds` 和 `selectedToolId` 不得进入真实执行链。
9. 审批等待、终止错误和恢复耗尽状态不得继续执行工具。
10. Generate 必须依据已经进入 Evidence 的真实结果回答。

核心闭环是：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool
  -> Evidence
  -> Planner
```

检索闭环是：

```text
Planner
  -> Retrieve
  -> Evidence
  -> Planner
```

收口路径是：

```text
Planner(answer / ask_user)
  -> Generate
  -> Finalize
```

## 3. Pi Loop 当前实际流程

Pi Loop 在一次 run 中按顺序执行语义步骤，不并发执行工具。

### 3.1 首次进入

```text
prepareContext
  -> Planner
```

如果输入中已经带有恢复后的 frozen `pendingToolCall`，则不会重新让 Planner 猜一次执行对象，而是：

```text
prepareContext
  -> Policy
  -> Tool
  -> Evidence
  -> Planner
```

### 3.2 Planner 动作分支

Planner 当前只允许以下动作：

- `answer`
- `ask_user`
- `retrieve`
- `use_tool`
- `error`

对应行为：

| nextAction | 后续行为 |
| --- | --- |
| `answer` | Generate -> Finalize |
| `ask_user` | Generate -> Finalize |
| `retrieve` | Retrieve -> Evidence -> Planner |
| `use_tool` | Normalize -> Policy -> Tool -> Evidence -> Planner |
| `error` | Terminal error |

Pi Loop 使用无上限的 `while (true)` 决策循环。`maxIterations` 目前只是兼容与诊断字段，值为 `0`，不再作为全局工具调用次数上限。

这不等于所有恢复都无限重试。局部恢复仍有独立预算，见“失败与恢复合同”。

## 4. Planner 当前真相

Planner 是 task model 驱动的下一步决策器，不是静态 plan step 推进器。

它会读取：

- 当前用户问题与 goal
- `currentTaskFrame`
- 已暴露工具定义
- 最近执行观察
- Evidence 历史与最新摘要
- 最近 Tool / Retrieve 结果
- schema replan 与 recoverable failure 上下文
- pending approval 状态

然后只输出一个 `nextAction`。

### 4.1 `currentTaskFrame`

`currentTaskFrame` 用于表达当前任务覆盖度、已完成进展和下一步目标。它属于 Planner 的任务完成判断上下文，不是另一套独立执行器，也不直接驱动 ToolNode。

### 4.2 可见“思考”不是隐藏推理

Planner 流式输出时，前端只会看到 Planner JSON 中公开的 `reason` 字段。

系统不会把 task model 的完整原始输出或隐藏推理当作 UI 思维链展示。

### 4.3 兼容直接工具动作

标准合同仍然是：

```json
{
  "type": "use_tool",
  "toolId": "read_open",
  "args": { "path": "README.md" },
  "reason": "需要读取文件"
}
```

如果弱 task model 输出：

```json
{
  "type": "read_open",
  "path": "README.md",
  "reason": "需要读取文件"
}
```

Validator 只在 `read_open` 确实属于本轮 exposed tools 时，将它规范化为标准 `use_tool`。

未暴露或虚构的工具 ID 不会被放行。

## 5. Tool Exposure 的真实职责

Harness Tool Exposure 只回答：

> 本轮 Planner 可以看见哪些工具及其 schema？

它不回答：

> 本轮一定执行哪个工具？

因此：

- Tool Exposure 是候选面。
- Planner 决定 `nextAction`。
- Normalize 冻结具体调用。
- Policy 审批具体调用。
- Tool 执行具体调用。

旧的 capability selector、`capabilityIntent.selectedToolIds`、`selectedToolId` 仍可服务 UI、trace、diagnostics 或兼容读取，但不得重新成为影子执行器。

## 6. frozen `pendingToolCall` 合同

真实执行对象是 frozen `pendingToolCall`，至少包含：

- `id` / tool call id
- `toolId`
- `args`
- `inputHash`
- `reason`
- `source: planner`
- `status: frozen`
- 当轮 tool metadata

Normalize 完成后，后续节点不得重新根据用户文本、capability intent 或旧 selectedToolId 重建参数。

`inputHash` 对工具、参数及来源进行稳定绑定，用于：

- Policy 对齐
- Approval 对齐
- Resume 对齐
- Harness invocation 对齐
- 防止审批后参数漂移

## 7. Workspace Path 与 cwd 边界

当前路径合同分两类，不能混写。

### 7.1 Read / Edit 工作区工具

- `/workspace` 是工作区 sentinel。
- 非 sentinel 的 POSIX 绝对路径保持绝对语义，交给下游 boundary 判断。
- 普通 traversal 仍会被工作区路径合同拒绝或进入边界审批。
- Read / Edit 工具不会因为 Terminal Runtime 放开而自动获得宿主机自由路径能力。

### 7.2 `terminal_session.cwd`

`terminal_session` 使用 Host Runtime：

- 默认 `cwd = workspace`
- 相对路径从 workspace 解析
- 绝对路径和 `..` 可以进入正常审批
- 审批通过后，Runtime 不再二次把它当作非法路径拒绝
- 越界关系会记录为 `outside`，不是静默吞掉

这是一条 Terminal 特例，不是全局放开 Workspace Boundary。

## 8. Policy 与 Approval 当前合同

Policy 只消费 frozen `pendingToolCall` 和工具风险元数据。

需要审批时：

```text
Policy
  -> pendingApproval
  -> status = waiting_approval
  -> 暂停 run
```

Approval 绑定：

- `toolId`
- `toolCallId`
- `inputHash`

审批通过恢复时，三者必须与 frozen `pendingToolCall` 对齐。任何不一致都会阻断执行，工具不会运行。

审批不是对整个 session、某个工具名或未来所有参数的永久授权。新的命令、cwd、env、timeout 或参数会产生新的 hash，需要新的审批判断。

## 9. Approval Resume 与 Checkpoint

公开 approve 路由不会长时间占住 HTTP 请求。

当前行为：

1. 同步把 `AgentRun` 更新为 `running`
2. 保存 approved invocation
3. 保留 frozen `pendingToolCall`
4. 在下一 microtask 异步恢复执行
5. 增量持久化 execution node
6. 前端通过 run polling / thread refresh 看到后续状态

等待审批时会保存 runtime checkpoint：

- `currentTaskFrame`
- `observations`
- `evidence`
- `retrievedChunks`
- `lastToolExecution`
- `iterationCount`

恢复后重新进入同一个 `agentGraph.run` 门面，并优先执行已冻结调用，而不是丢失上下文后重新规划。

当前 checkpoint 主要覆盖 approval pause / resume。它还不是任意进程崩溃后的通用 durable workflow checkpoint。

## 10. Harness Tool Result、Evidence 与 Generate

### 10.1 Harness result projection

成功的 Harness 工具结果会生成适合模型消费的 `llmContent`：

- 保留真实结果正文
- 保留结构化文本
- 标记是否截断
- 记录原始与纳入字符数
- 对不同工具做统一投影

ToolNode 将该投影附加到执行结果，然后交给 Evidence。

### 10.2 Evidence 单一写入

Tool / Retrieve 只写：

- `pendingToolExecution`
- `pendingRetrievalEvidence`
- `pendingEvidenceObservation`

Evidence 再统一写入累计对象：

- `evidence.toolExecutions`
- `evidence.retrievals`
- `evidence.observations`

因此，真实结果必须先进入 Evidence，才能成为后续 Planner 和 Generate 的可信上下文。

### 10.3 Generate 的大结果合同

“Generate 仍直接无边界拼接全部工具结果”已经不是当前真相。

当前 Harness Generate context：

- 只消费已完成的工具执行
- 优先使用已生成的 `llmContent`
- 总字符预算为 `48_000`
- 明确标记 result 是否 truncated
- 超出总预算时截断上下文，不杀死工具进程
- 要求模型只能依据已经展示的结果回答

External MCP 结果也有独立的 Generate context 适配，不再只依赖简短 Evidence summary。

## 11. 失败与恢复合同

### 11.1 Terminal failure

Terminal failure 表示运行时本身无法安全继续：

- Graph / Pi Loop 进入 error
- `status = failed`
- Generate 不执行

### 11.2 Recoverable tool failure

Recoverable failure 会：

1. 写入 Tool execution 失败事实
2. 进入 Evidence
3. 回 Planner 尝试恢复
4. 恢复预算耗尽后进入 Generate，给出受保护的、基于已有事实的回答

当前默认 recoverable tool failure 预算为 2 次。

### 11.3 Schema replan

Planner 生成的工具参数无法通过 schema 时：

- 第一次失败回 Planner 重规划
- 再次失败则停止继续造调用，转 Generate 给出受保护回答

### 11.4 全局循环与局部预算不要混淆

- Agent 主决策循环：无全局 iteration cap
- Tool failure recovery：有局部预算
- Schema replan：有局部预算

## 12. `terminal_session` 当前 Runtime 边界

`terminal_session` 仍然是一个稳定工具合同，不拆成 Python、Node、Git 等多个工具。

当前执行面：

- 默认 `host_spawn`
- 完整 Shell 命令
- Python / Node / Git / package manager
- pipeline 与 shell-native syntax
- persistent PTY
- `attachSessionId`
- dev server / watcher / REPL / 长进程
- Windows Job Object 进程树归属
- Job Object 不可用时使用 `taskkill /t /f` 回收
- POSIX 使用进程组回收

`requiresApproval` 仍为 true。

`sandbox_runtime` 目前只保留为未来隔离 Provider 名称，尚未实现，不会偷偷回退到旧 L1 sandbox executor。

## 13. Trace 与可观测性

当前有两条互补通道：

### 13.1 产品 execution node

通过 `onExecutionNode` 对外发送，用于：

- 前端执行轨迹
- approval 状态
- Planner 公开 reason
- tool / retrieval / evidence / generate 状态
- resume 后的增量更新

### 13.2 Phoenix / OpenTelemetry span

- 根 span：`agent.graph.run`
- Pi Loop 的语义步骤继续使用稳定 trace node name
- LangGraph 兼容运行时使用相同观测包装
- tracing 默认关闭
- verbose 模式只记录脱敏摘要

因此，外部 trace 名称仍可能包含历史 node 术语，但这不表示应用默认编排器仍是 LangGraph。

## 14. 产品运行真相与执行状态

### 14.1 `AgentRun`

`AgentRun` 是产品与持久化层的运行真相，负责保存：

- run identity
- goal
- status
- observations
- pending approval
- approved invocations
- frozen pending tool call
- last tool execution
- runtime input / checkpoint
- assistant message 与 trace 关联

### 14.2 `AgentGraphInput / AgentGraphOutput`

它们是稳定运行时协议，供 Pi Loop 与 LangGraph 共同使用。

Output 当前至少包括：

- `answer`
- `observations`
- `evidence`
- `retrievedChunks`
- `pendingApproval`
- `policyDecision`
- `pendingToolCall`
- `approvedInvocations`
- `lastToolExecution`
- `currentTaskFrame`
- `blockedReason`
- `terminalReason`
- `contextBudget`
- `errorMessage`
- `status`
- `iterationCount`

### 14.3 `selectedToolId`

`selectedToolId` 仍可在 Output、AgentRun、UI 和 trace 中出现，但只是兼容字段。

真实执行永远从 frozen `pendingToolCall` 开始。

## 15. 当前明确没有的能力

当前主线不是：

- 多 Agent 系统
- DAG scheduler
- 并发工具执行器
- 多工具并行 fan-out
- 通用 durable workflow engine
- 长期记忆系统
- 自动 sandbox 快照 / 回滚
- Agent V2

Pi Loop 当前是有状态、可审批、可恢复、Evidence 驱动的**顺序决策循环**。

## 16. 已经过期、不得继续传播的说法

下面这些说法已过期：

- “AgentGraph 应用主链就是 LangGraph。”
- “Pi Loop 只是未来计划。”
- “planNode placeholder 仍在推进应用主链。”
- “selectedToolId 可以驱动工具执行。”
- “Tool / Retrieve 完成后可以直接 Generate。”
- “审批恢复只保存 pendingApproval，不保存上下文。”
- “Generate 仍无边界拼接原始大结果。”
- “terminal_session 必须经过旧 command sandbox。”
- “Agent 有固定 maxIterations 工具调用上限。”

## 17. 最终判断

当前已经成立的是：

```text
AgentRun（产品真相）
  -> AgentGraph 稳定门面
  -> Pi Loop 默认顺序编排
  -> Harness 执行与审批控制
  -> Evidence 统一证据
  -> Planner 决定下一步
  -> Grounded Generate
  -> AgentRun 持久化与 UI trace
```

这已经不是早期 MVP 草图。

它仍是 V1.5 稳定化架构：主线清楚、边界可审计、可以继续增强，但不应在没有明确授权时扩成 Agent V2、DAG 或多 Agent 系统。
