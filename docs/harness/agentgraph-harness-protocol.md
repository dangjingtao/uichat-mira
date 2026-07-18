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
  - ../ENGINEERING_MEMORY.md
  - ../chat/agent-runtime-design.md
  - ../development/agent-observability.md
  - ../tooling-runtime/tools-protocol.md

## 这页回答什么

这页记录当前代码中 AgentRun、AgentGraph 门面、Pi Loop、LangGraph 兼容运行时与 Harness 的真实协作关系。

它不是未来设计草图，也不是任务卡汇总。

## 当前结论

`AgentGraph` 当前是稳定运行时门面，不等同于 LangGraph 本身。

应用默认运行时是 `pi_loop`：

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

LangGraph 只保留为显式兼容运行时、测试对照与回归比较。

## 运行时选择

统一入口：

```ts
agentGraph.run(input: AgentGraphInput): Promise<AgentGraphOutput>
```

| 条件 | 实际运行时 |
| --- | --- |
| 正常应用启动，未设置环境变量 | `pi_loop` |
| `MIRA_AGENT_RUNTIME=pi_loop` | `pi_loop` |
| `MIRA_AGENT_RUNTIME=langgraph` | LangGraph 兼容运行时 |
| 测试环境且未显式指定 | LangGraph，保留历史测试行为 |

必须区分：

- Agent Runtime / AgentGraph 门面：稳定对外合同
- Pi Loop：应用默认编排器
- LangGraph：兼容与对照运行时

## 主线不变量

1. Planner 只输出 `nextAction`。
2. Normalize 只校验并冻结 `nextAction.use_tool`，生成 frozen `pendingToolCall`。
3. Policy 只审批 frozen `pendingToolCall`。
4. Tool 只执行与 Policy 决策一致的 frozen `pendingToolCall`。
5. Tool / Retrieve 只写 pending 事实，不直接改写累计 Evidence。
6. Evidence 是累计证据的单一写入者。
7. Tool / Retrieve 完成后必须先进入 Evidence，再回 Planner。
8. `capabilityIntent.selectedToolIds` 不得进入真实执行链。
9. `selectedToolId` 只保留 UI、trace、diagnostics 与兼容语义。
10. waiting approval、terminal error、recovery exhausted 状态不得继续执行工具。
11. Generate 必须依据已经进入 Evidence 的真实结果回答。

核心闭环：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool
  -> Evidence
  -> Planner
```

检索闭环：

```text
Planner
  -> Retrieve
  -> Evidence
  -> Planner
```

收口路径：

```text
Planner(answer / ask_user)
  -> Generate
  -> Finalize
```

## Planner 当前合同

Planner 是 task model 驱动的下一步决策器，不是静态计划表推进器。

允许动作：

- `answer`
- `ask_user`
- `retrieve`
- `use_tool`
- `error`

Planner 读取：

- 用户目标
- `currentTaskFrame`
- exposed tools
- observations
- Evidence 历史与最新摘要
- 最近 Tool / Retrieve 结果
- schema replan 上下文
- recoverable failure 上下文
- pending approval 状态

Planner 必须区分：

- evidence answerable
- task completable

局部证据可解释，不代表整个任务已完成。

Pi Loop 没有全局 iteration cap。`maxIterations = 0` 只保留兼容与诊断语义。

局部恢复仍有预算：

- schema replan
- recoverable tool failure

## 可见 Planner OS

前端展示的“思考下一步”只来自 Planner JSON 中公开的 `reason` 字段。

它不是：

- 隐藏 chain of thought
- 原始完整模型输出
- 未脱敏 prompt

产品合同：

- Planner 决策期间展示公开 reason
- 回答组织完成后 OS 消失
- 执行轨迹按真实语义顺序展示
- 重复语义节点使用 `attemptKey` 保留每次执行

## Tool Exposure 与真实执行入口

Harness Tool Exposure 只回答：

> 本轮 Planner 可以看见哪些工具及其 schema？

它不决定最终执行哪个工具。

不得恢复为执行入口的对象：

- capability id
- capability match
- preferredToolId
- `capabilityIntent.selectedToolIds`
- `selectedToolId`
- query keyword rule
- UI 选中状态

真实执行永远从 frozen `pendingToolCall` 开始。

## frozen `pendingToolCall`

至少包含：

- tool call id
- `toolId`
- `args`
- `inputHash`
- `reason`
- `source: planner`
- `status: frozen`
- 当前工具 metadata

Normalize 完成后，后续节点不得根据用户文本、capability intent 或旧 selectedToolId 重建参数。

`inputHash` 用于：

- Policy 对齐
- Approval 对齐
- Resume 对齐
- Harness invocation 对齐
- 防止审批后参数漂移

## Policy、Approval 与 Resume

审批绑定 exact invocation：

- `toolId`
- `toolCallId`
- `inputHash`

命令、参数、cwd、env、timeout 变化后必须重新判断。

等待审批时保存 checkpoint：

- `currentTaskFrame`
- observations
- Evidence
- retrieved chunks
- last tool execution
- iteration count
- frozen `pendingToolCall`

Approve 路由快速返回 `running`，后续在异步任务中恢复执行。

恢复时优先消费原 frozen 调用，不重新根据自然语言猜参数。

## Harness 当前职责

Harness 是 Agent 的工具控制平面，不是 Agent 的大脑。

Harness 负责：

- capability / tool registry
- tool exposure
- schema 与 metadata
- risk / approval boundary
- workspace boundary
- invocation
- external MCP projection
- trace / audit
- 结果到 `llmContent` 的统一投影

Harness 不负责：

- 多步任务下一步决策
- 工具参数生成
- 任务完成判断
- 最终自然语言回答

## Evidence 与 Generate

Tool / Retrieve 先写 pending facts，再由 Evidence 统一写入累计对象。

成功 Harness 调用会生成模型可消费的 `llmContent`。

Generate 当前：

- 只消费 completed executions
- 优先使用真实 `llmContent`
- 总字符预算为 `48_000`
- 明确标记 truncated
- 超预算只截断上下文，不终止工具进程
- 要求回答只依据已展示事实

External MCP 结果同样需要进入 Evidence，并经过 Generate context 适配。

## 失败合同

### Recoverable failure

- Tool execution 记录 failed
- 失败事实进入 Evidence
- 回 Planner 尝试恢复
- 恢复耗尽后 Generate guarded answer
- Graph status 为 completed
- Chat finish reason 为 stop

### Terminal failure

- Graph status 为 failed
- finish reason 为 error
- Generate 不执行

工具自身拒绝输入属于工具层能力边界。是否恢复由 Evidence 与 Planner 决定，不能被误判成审批仍在等待。

## Workspace 与 Terminal cwd

Read / Edit 工作区工具继续遵守工作区边界。

`terminal_session.cwd` 使用 Host Runtime 特例：

- 默认 `cwd = workspace`
- 相对路径从 workspace 解析
- 绝对路径与 `..` 可以进入正常审批
- 审批通过后 Runtime 不再二次按旧 sandbox 规则拒绝
- 越界关系记录为 `outside`

Terminal 的能力释放不等于全局放开 Read / Edit 边界。

## Terminal Runtime

`terminal_session` 是稳定能力合同，不拆成 Python、Node、Git、PowerShell 等多个工具。

当前默认 Runtime：

- `host_spawn`
- 完整 Shell
- Python / Node / Git / package manager
- pipeline 与 shell-native syntax
- persistent PTY
- `attachSessionId`
- watcher / dev server / REPL / 长进程
- Windows Job Object
- Job Object 不可用时 `taskkill /t /f`
- POSIX process group

旧 command sandbox 已退出 `terminal_session` 主执行链。

`sandbox_runtime` 只保留未来可选 Provider 名称，当前未实现，也不会偷偷退回旧 sandbox executor。

## CodeGraph 受控合同

Planner 只看见 `codebase_explore`。

原生 `query / explore / affected` 留在 wrapper 内部。

CodeGraph 返回候选，不直接构成最终 Evidence。

进入 Evidence 前必须经过 `read_file_slice` 或等价原文验证。

降级链：

```text
CodeGraph
  -> scoped search_text
  -> workspace_inventory
  -> read_file_slice
```

必须保护：

- CodeGraph 失败不能直接回答“没有”
- broad explore 结果不能裸传 Planner
- telemetry 默认关闭
- 索引不能默认污染仓库
- capability id 不能穿透为 invocation tool id

CodeGraph 是代码理解加速器，不是第二个 Planner。

## Trace 与 UI 状态

产品 execution node 用于：

- Planner 公开 reason
- tool / retrieval / evidence / generate 状态
- approval / resume
- failure / blocked / completed

重复语义节点通过 `attemptKey` 保留每次执行。

approval / resume 通过 `toolCallId` 对齐。

最终页面状态必须服从 AgentRun 的 running / waiting / completed / failed 状态，不能被历史审批节点覆盖。

Phoenix / OpenTelemetry 用于开发诊断，默认关闭，不改变业务路由。

## 当前明确没有的能力

当前主线不是：

- Agent V2
- 多 Agent 系统
- DAG scheduler
- 并发工具执行器
- 多工具并行 fan-out
- 通用 durable workflow engine
- 长期记忆系统
- 自动 sandbox 快照与回滚

Pi Loop 是有状态、可审批、可恢复、Evidence 驱动的顺序决策循环。

## 已过期说法

不得继续传播：

- AgentGraph 应用主链就是 LangGraph
- Pi Loop 只是未来计划
- selectedToolId 可以驱动工具执行
- Tool / Retrieve 完成后可以直接 Generate
- 审批恢复只保存 pendingApproval
- Generate 仍无边界拼接全部工具结果
- terminal_session 必须经过旧 command sandbox
- Agent 有固定全局 maxIterations 上限

## 最终判断

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

这是 Agent V1.5 稳定化架构，不应在没有明确授权时扩成 Agent V2、DAG 或多 Agent 系统。
