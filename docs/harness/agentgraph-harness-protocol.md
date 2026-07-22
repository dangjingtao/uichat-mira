# AgentGraph 与 Harness 当前协议

Status: Current
Owner: agent-runtime
Last verified: 2026-07-22
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

职责边界：

- Harness 的 `PrepareContext -> candidate resolver` 负责生成本轮 `toolExposure`。
- `toolExposure` 是 Planner 当前可见工具集合和工具元数据的唯一运行时真相源。
- Planner 不暴露工具、不计算候选排名；Planner 只从 `toolExposure` 中选择下一步是否使用某个具体 tool id。
- capability profile、embedding 与 rerank 都是 Harness 内部的上下文压缩机制，不得直接生成 `pendingToolCall`。

### 当前暴露流程

```text
Harness Registry
  -> eligibility / public exposure
  -> eligible concrete tool definitions
  -> <= 20：全部暴露
  -> > 20：capability profiles
           -> embedding 全量召回
           -> reranker 最终排序
           -> embedding 仅用于 rerank 同分排序
           -> 展开为 concrete tools
           -> toolId 去重
           -> 取前 20
  -> state.toolExposure
  -> Planner
```

当前查询文本由 `prepareContextNode` 确定：

```ts
getLatestUserQuestion(state.messages) || state.goal.text
```

这意味着排序使用本轮最新用户问题；它不会自动把更早消息重新拼成一个完整任务描述。

### 不超过 20 个工具

当 eligible concrete tools 数量不超过 `20`：

- Harness 全部暴露，不运行 embedding 或 rerank。
- 用户措辞、`topK`、`maxTools`、`minScore` 不会缩小 Planner 可见工具面。
- 工具顺序不构成 Planner 的执行决定。

### 超过 20 个工具

当 eligible concrete tools 数量超过 `20`：

1. Harness 先把 concrete tools 归入 capability profiles；没有预定义 profile 的工具使用一工具一 profile 的 fallback profile。
2. capability 文档与查询文本一起进入本地 embedding，余弦相似度写入 `embeddingScore`。
3. 当前实现把全部 capability matches 交给本地 reranker，不在 rerank 前按 `topK` 截断。
4. `rerankScore` 决定最终顺序；不再使用 `0.8 * embeddingScore + 0.2 * rerankScore`。
5. `rerankScore` 相同时，使用 `embeddingScore` 降序作为稳定排序依据。
6. 排序后的 capability 展开为其 `supportingToolIds`，具体工具继承 capability 的 rerank 与 embedding 分数。
7. 具体工具再次按 rerank、embedding 排序，按 `toolId` 去重，最后取前 `20` 写入 `toolExposure`。

当前没有：

- `ruleScore` 加分；该字段当前为 `0`。
- `minScore` 阈值淘汰。
- 给 `terminal_session` 或其他核心工具保留固定名额。
- Planner 二次补选或改写 Harness 排名。

`topK` 当前只限制诊断结果中的 `topCandidates` 数量，不改变 Planner 最终可见的 `20` 个工具。

### 退化路径

- 查询为空或没有 capability profile：按 eligible tool definition 的稳定顺序取前 `20`。
- embedding 调用失败：按 eligible tool definition 的稳定顺序取前 `20`，并返回 retrieval error 诊断。
- reranker 调用失败：保留 embedding 排序。
- reranker 没有返回某个 capability 的分数：该 capability 的 `rerankScore` 记为 `0`，再由 embedding 处理同分顺序。
- 展开后如果出现未排名的 public tool：按稳定顺序补入，再统一截取前 `20`。

这些退化路径只保证工具面可构造，不保证任何指定工具必然进入前 `20`。关键工具是否需要固定暴露资格属于 Tool Exposure Policy，不属于分数校准。

不得恢复为执行入口的对象：

- capability id
- capability match
- preferredToolId
- `capabilityIntent.selectedToolIds`
- `selectedToolId`
- query keyword rule
- UI 选中状态

真实执行永远从 frozen `pendingToolCall` 开始。

### Code Anchors

- `server/src/agent/nodes/prepare-context.ts`
- `server/src/agent/intent/embedding-capability-matcher.ts`
- `server/src/harness/exposure-core/resolver.ts`
- `server/src/harness/candidates-core/resolver.ts`
- `server/src/harness/candidates-core/rerank.ts`
- `server/src/harness/candidates-core/expand-tool-candidates.ts`
- `server/src/harness/profiles/resolver.ts`
- `server/src/agent/intent/capability-documents.ts`

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
