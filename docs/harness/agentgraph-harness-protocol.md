---
status: current
owner: agent-runtime
last_verified: 2026-07-30
layer: wiki
module: Agent
feature: AgentGraphProtocol
doc_type: current-contract
canonical: true
related:
  - ../AGENT_CURRENT_TRUTH.md
  - ../ENGINEERING_MEMORY.md
  - README.md
  - ../skill/README.md
  - ../skill/pi-skill-agent-execution.md
  - ../development/agent-observability.md
  - ../tooling-runtime/tools-protocol.md
---

# AgentGraph 与 Harness 当前协议

> 这页定义 AgentGraph 稳定门面、Main Planner、Harness、Evidence、Approval 与 SubAgent 执行之间的技术合同。整体产品事实先读 [[../AGENT_CURRENT_TRUTH]]。

## 1. Runtime 关系

`AgentGraph` 是稳定运行时门面，不等于 LangGraph 本身。

```text
AgentRun
  -> agentGraph.run(...)
  -> Pi Loop（应用默认）
     或 LangGraph（显式兼容 / 测试对照）
```

| 条件 | 实际运行时 |
| --- | --- |
| 正常应用未设置环境变量 | `pi_loop` |
| `MIRA_AGENT_RUNTIME=pi_loop` | `pi_loop` |
| `MIRA_AGENT_RUNTIME=langgraph` | LangGraph 兼容运行时 |
| 测试环境未显式指定 | LangGraph，保留历史测试行为 |

两种运行时共用：

- AgentGraph input / output；
- AgentRun persistence；
- checkpoint；
- semantic step contract；
- execution node；
- observability；
- Main Planner、Harness、Evidence 与 Generate 实现。

## 2. Main Agent 普通闭环

具体工具路径：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool
  -> Evidence
  -> Planner
```

检索路径：

```text
Planner
  -> Retrieve
  -> Evidence
  -> Planner
```

终止路径：

```text
Planner(answer / ask_user)
  -> Generate
  -> Finalize
```

## 3. 当前额外存在两条委派路径

### 3.1 Generic Task SubAgent

Main Planner 可以选择：

```text
use_tool(delegate_task)
```

`delegate_task` 是 Planner-only runtime protocol，不是普通 Harness tool invocation。

```text
Main Planner
  -> delegate_task(goal, acceptanceCriteria)
  -> isolated generic SubAgent
  -> child-local tool loop
  -> structured observation
  -> Evidence
  -> Main Planner
```

合同：

- 只委派一个边界清楚、可独立验收的工作包；
- Child 只拥有 task-local execution；
- Main Planner 保留 global goal、依赖、验收与最终回答；
- Child 工具面来自当前实际可用的 governed tools，并移除 `delegate_task`；
- V1 不允许 nested delegation；
- completed / insufficient_evidence / recoverable failure 返回 Main Planner；
- needs_input 由 Parent 向用户提问；
- approval 由 Parent 保存 exact invocation 与 checkpoint；
- terminal child failure 进入 error path。

### 3.2 Skill-owned SubAgent

匹配到声明 `execution.context = fork` 的任务型 Skill 时，Prepare Context 可以把领域施工交给 forked SubAgent。

```text
SkillContext + ExecutionProfile
  -> Skill-owned SubAgent
  -> Skill-scoped tools / private runtime
  -> Evidence / Artifact / Requirement
  -> Parent governance
```

Skill-owned SubAgent 与 generic delegation 的完成边界不同：

- Generic Child completed：回 Main Planner，由 Main Planner 判断全局任务；
- Skill-owned Child completed：冻结 Parent finalization packet，直接进入 Generate，避免 Main Planner 重做领域施工。

Stateful Skill Flow 可以作为该 Skill 的确定性 SubAgent controller。它完成、暂停或请求输入时，不再额外叠加自由模型循环。

## 4. Planner 当前合同

Planner 是 task-model 驱动的下一步决策器。

允许动作：

- `answer`
- `ask_user`
- `retrieve`
- `use_tool`
- `error`

Planner 读取：

- 用户目标；
- `currentTaskFrame`；
- bounded conversation history；
- `state.toolExposure`；
- observations；
- Evidence history 与最新正文；
- semantic action ledger；
- schema replan / recoverable failure 上下文；
- pending approval；
- active Skill directive。

Planner 必须区分：

- evidence answerable；
- task completable。

局部证据可以解释一个问题，不代表用户请求已经全部完成。

`answer` 必须提供 `completionProof`，并在进入 Generate 前冻结为 `finalizationPacket`。

`planList` 只有 `{ id, text, done }`，只表达方向和完成状态。工具结果、Evidence、推理和自然语言答案不得写进计划项。

Pi Loop 没有全局 iteration cap。`maxIterations = 0` 只保留兼容与诊断语义。

## 5. Tool Exposure 与委派协议

### 5.1 Harness Tool Exposure

`state.toolExposure` 是 Main Planner 可见 concrete tool definitions 的运行时真相源。

Harness candidate resolver 负责：

```text
eligible concrete tools
  -> <= 20：全部暴露
  -> > 20：capability profile / embedding / rerank
  -> concrete tool expansion
  -> toolId 去重
  -> 前 20 个
  -> state.toolExposure
```

当前没有：

- `minScore` 阈值淘汰；
- 核心工具固定名额；
- capability id 直接执行；
- Planner 二次重写 Harness 排名。

### 5.2 delegate_task

`delegate_task` 由 Agent Runtime 添加到 Main Planner surface：

- 不来自 Harness capability ranking；
- 不对应外部 invocation；
- 不进入 Main Agent 普通 Normalize / Policy / ToolNode；
- 只启动受控 Child execution；
- Child 内 concrete tool 调用仍受工具绑定、Policy、approval 与环境约束。

不得把它解释成绕过 Harness 的万能能力。

## 6. Concrete Tool 不变量

1. Planner 只提出 concrete `nextAction.use_tool`；
2. Normalize 校验 schema 并冻结 `pendingToolCall`；
3. Policy 只判断 frozen invocation；
4. Tool 只执行与 Policy 一致的 frozen invocation；
5. Tool / Retrieve 不直接写累计 Evidence；
6. Evidence 是累计证据的单一写入者；
7. Tool / Retrieve 后必须先进入 Evidence；
8. `selectedToolId` 只服务 UI、trace、diagnostics 与兼容读取；
9. capability match、preferredToolId、UI 状态不得成为执行入口；
10. Generate 只消费 finalization packet 引用的 Evidence。

## 7. frozen pendingToolCall

普通 Planner concrete tool call 至少冻结：

- tool call id；
- `toolId`；
- `args`；
- `inputHash`；
- `reason`；
- `source: planner`；
- `status: frozen`；
- 当前工具 metadata。

Normalize 后，后续节点不得再根据用户文本、capability intent 或旧 `selectedToolId` 重建参数。

SubAgent approval 的 frozen call 还保存：

- `origin: skill_agent`（持久化兼容标记）；
- `skillId`；
- transcript checkpoint；
- checkpoint 中的 pending invocation。

## 8. Policy、Approval 与 Resume

审批绑定：

- `toolId`
- `toolCallId`
- `inputHash`

命令、参数、cwd、env、timeout 或目标资源变化后，必须重新判断。

等待审批时持久化：

- `currentTaskFrame`；
- observations；
- Evidence；
- retrieved chunks；
- last execution；
- iteration count；
- frozen `pendingToolCall`；
- SubAgent transcript checkpoint（如适用）。

Approve 路由快速返回 running，随后异步恢复。恢复入口先校验 exact invocation，重新执行 Policy，再消费原 frozen call。

旧批准不能变成可复用权限。

## 9. Harness 当前职责

Harness 是 Agent 的工具控制平面，不是 Agent 的大脑。

Harness 负责：

- capability / tool registry；
- eligible concrete tool surface；
- schema 与 metadata；
- risk / approval boundary；
- workspace boundary；
- invocation；
- external MCP projection；
- trace / audit；
- result 到 `llmContent` 的投影。

Harness 不负责：

- 多步任务下一步决策；
- task decomposition；
- 工具参数生成；
- 用户目标完成判断；
- 最终自然语言回答；
- SubAgent task-local planner。

Skill-private Runtime 也不是 Harness 的隐形第二注册表。它由 Skill execution profile 和 managed runtime adapter 提供，但仍受 Parent 治理、可用性、审批与审计边界约束。

## 10. Evidence 与 Generate

Tool / Retrieve / SubAgent 先产生 pending facts 或 structured observation，再由 Evidence 统一写入累计对象。

Generate 当前：

- 只接受 `ask_user`，或 `answer + finalizationPacket`；
- `ask_user` 确定性交付，不调用回答模型；
- `answer` 只物化 packet 引用的 Evidence；
- 无法解析 Evidence ref 时失败；
- 不重新判断任务完成；
- 不发起工具调用；
- 检测内部工具调用协议泄漏并阻断；
- 使用 context budget 限制最终输入。

Evaluate 只检查 Planner 终止决定是否成功交付，不重新做语义完成判断。

## 11. 失败与终止合同

### Recoverable failure

目标合同：

```text
failed fact
  -> Evidence
  -> Planner recovery
  -> recovery exhausted
  -> guarded answer
  -> Graph completed
```

### Terminal failure

```text
terminal fact / runtime error
  -> Graph failed
  -> Generate does not run
```

### 当前 dev 偏差

截至 2026-07-30，Planner 在 recovery exhausted 时直接返回 `error`，导致 Graph failed 且 Generate 不运行。

该行为已被测试锁定，但与 settled recoverable C contract 不一致。它是高优先级实现漂移，不是新的目标合同。

详见 [[../AGENT_CURRENT_TRUTH#dev-已知实现漂移恢复耗尽被升级为-terminal-error]]。

## 12. Workspace 与 Terminal

Read / Edit 继续遵守 workspace boundary。

`terminal_session.cwd` 使用 Host Runtime 特例：

- 默认 cwd 为 workspace；
- 相对路径从 workspace 解析；
- 绝对路径与 `..` 可以进入正常审批；
- 审批通过后不再被旧 command sandbox 二次拒绝；
- 越界关系记录为 `outside`。

`terminal_session` 是稳定单一能力合同，当前 Runtime 包括：

- `host_spawn`；
- 完整 Shell；
- Python / Node / Git / package manager；
- pipeline 与 shell-native syntax；
- persistent PTY；
- watcher / dev server / REPL；
- Windows Job Object / taskkill fallback；
- POSIX process group。

旧 command sandbox 已退出主执行链。

## 13. CodeGraph

Planner 只看见 `codebase_explore`。

CodeGraph 返回受控候选和 workspace-verified source excerpts，不是第二个 Planner。

```text
CodeGraph
  -> scoped search_text
  -> workspace_inventory
  -> read_file_slice
```

必须保护：

- 失败不能直接回答“没有”；
- broad explore 不裸传 Planner；
- telemetry 默认关闭；
- 索引不默认污染仓库；
- capability id 不穿透为 invocation tool id。

## 14. Trace 与 UI 状态

产品 execution node 展示：

- Planner public reason；
- direct tool / retrieval / Evidence；
- generic SubAgent；
- Skill-owned SubAgent；
- SubAgent task-local trace 与 working state；
- approval / resume；
- Generate / Finalize；
- waiting / failed / completed。

重复语义节点通过 `attemptKey` 保留每次执行。

SubAgent trace 归入 Parent run；observability 失败不能改变执行语义。

最终 UI 状态必须服从 AgentRun 的真实状态，不能被历史节点覆盖。

## 15. 当前明确没有

当前主线不是：

- Agent V2；
- 开放式多 Agent 系统；
- nested SubAgent；
- DAG scheduler；
- 并发工具执行；
- 多工具 parallel fan-out；
- 通用 durable workflow engine；
- 长期记忆系统；
- 自动 sandbox snapshot / rollback。

当前是有状态、可审批、可恢复、Evidence 驱动的顺序决策系统，并增加了受控的 task-local execution delegation。