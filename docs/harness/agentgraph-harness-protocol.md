# AgentGraph 与 Harness 协议

Status: Current
Owner: runtime
Last verified: 2026-06-28
Layer: wiki
Module: Harness
Feature: AgentGraphProtocol
Doc Type: current-contract
Canonical: true
Related:
  - harness-assessment-2026-06-28.md
  - harness-phase-1-implementation-checklist.md
  - ../chat/agent-runtime-design.md

## 这页回答什么

这页只回答一件事：

**当前代码里，AgentGraph 和 Harness 之间到底通过什么对象、什么状态、什么边界在协作。**

它不是未来设计草图，也不是产品愿景页。

## 结论

当前已经有一版**可运行的最小协议**，但还不是最终版。

更准确地说：

- `AgentRun` 是产品运行真相
- `AgentGraphInput / AgentGraphOutput` 是图执行协议
- Harness 仍是 tool registry、tool execution、trace / invocation 的执行面
- Agent 目前主要在“能力选择、审批判断、结果收口”这层和 Harness 协作

## 协议分层

### 1. 持久化与产品真相层

当前 Agent 的外部运行真相是 `AgentRun`。

它至少包含：

- `id`
- `threadId`
- `userId`
- `goal`
- `plan`
- `status`
- `observations`
- `traceId`
- `pendingApproval`
- `approvedToolIds`
- `selectedCapabilityId`

这层负责回答：

- 当前 run 是谁
- 当前 run 处于什么状态
- 是否在等待审批
- 已有哪些观察结果
- UI 和恢复逻辑该读什么

### 2. 图执行协议层

当前 `AgentGraph` 的稳定协议面是：

- `AgentGraphInput`
- `AgentGraphOutput`

`AgentGraphInput` 当前至少包括：

- `runId`
- `threadId`
- `userId`
- `goal`
- `plan`
- `messages`

可选输入包括：

- `requestContextMessages`
- `params`
- `knowledgeBaseId`
- `intentConfig`
- `approvedToolIds`
- `selectedCapabilityId`
- `onExecutionNode`

`AgentGraphOutput` 当前至少包括：

- `answer`
- `observations`
- `retrievedChunks`
- `capabilityIntent`
- `pendingApproval`
- `selectedCapabilityId`
- `contextBudget`
- `errorMessage`
- `status`

### 3. Harness 执行层

Harness 当前负责：

- capability registry
- tool metadata
- tool execution
- invocation record
- invocation trace
- external MCP projection

AgentGraph 不直接替代这些能力，而是消费它们。

## 当前实际调用链

当前最真实的一条链路是：

1. 外部入口创建 `AgentRun`
2. 入口把 `goal / plan / messages` 组装成 `AgentGraphInput`
3. `AgentGraph` 在图节点里做：
   - 上下文准备
   - 计划推进
   - capability intent 选择
   - policy 判断
   - retrieve / tool / generate / evaluate
4. 图返回 `AgentGraphOutput`
5. 外层把输出写回 `AgentRunStore`

也就是说，当前不是 “AgentGraph 直接拥有产品真相”，而是：

- `AgentRun` 持有运行真相
- `AgentGraph` 负责一次图执行
- Harness 负责工具运行真相

## 当前节点协议

当前 `AgentGraph` 节点顺序大致是：

- `prepareContext`
- `planStep`
- `capabilityIntentStep`
- `policyStep`
- `approval`
- `retrieve`
- `tool`
- `generate`
- `evaluate`
- `error`

其中真正和 Harness 紧密耦合的是三类节点：

- `capabilityIntentStep`
  - 从 Harness capability surface 中理解候选能力
- `policyStep`
  - 根据 tool metadata 判断是否允许直接执行
- `tool`
  - 通过兼容适配层真正调用 Harness invocation

## 当前审批协议

当前审批协议已经不只停留在 Agent 层，核心 Harness invocation 主链也已有统一前置 gate。

现在的规则是：

- Agent 命中高风险 capability 时，先进入 `policyStep`
- `policyStep` 产出 `pendingApproval`
- Graph 输出 `status: waiting_approval`
- 外层把 `pendingApproval` 写回 `AgentRun`

这意味着当前 Agent 和 Harness 的审批协作协议是：

- Harness 提供 capability 风险元数据
- Harness invocation 在执行前先做统一审批判定
- Agent policy 消费这些元数据
- AgentRun 保存审批等待状态

当前已经成立的是：

- Agent tool path 会经过 Harness 统一 approval gate
- direct MCP invocation 会经过 Harness 统一 approval gate
- 普通 chat tool loop 调用 Harness 时，也会把 `awaiting_approval` 显式回传上层

## 当前 trace / 事件协议

当前 AgentGraph 通过 `onExecutionNode` 向外发 execution node 事件。

这条链目前更像：

- 图执行事件通道

而不是：

- 完整业务协议对象

它已经足够支持：

- execution trace UI
- run 中间过程观察
- 节点级别状态展示

但还没有完全和 Harness invocation trace 统一成一个总协议。

## 当前已经定下来的边界

下面这些边界已经比较明确：

- `AgentRun` 不是 `AgentGraphState`
- `AgentGraph` 不直接替代 Harness
- Agent 不直接维护 tool registry
- 审批等待状态要进入 `AgentRun`
- external MCP 继续走 Harness 专门治理，不让 Agent 自己绕开

## 当前已落地的兼容适配

由于 `AgentGraph` 先于这轮 Harness 收口完成，当前实现遵循的是：

- 保持现有 `AgentGraphInput / AgentGraphOutput` 主形状不倒退
- Harness 去适配 `AgentGraph` 的 `selectedCapabilityId` 驱动方式
- `toolNode` 现在已经不是占位节点，而是会真实调用 Harness invocation

当前这层兼容适配已经补上的协议对象包括：

- `pendingToolCall`
- `lastToolExecution`

其中：

- `pendingToolCall` 表示 AgentGraph 已决定“要调用哪个 capability，以及准备用什么参数调用”
- `lastToolExecution` 表示 Harness 执行后的回填结果，包括：
  - `invocationId`
  - `status`
  - `result`
  - `errorMessage`
  - `approval`

这意味着当前主链已经从：

- 选中工具，等待 Harness

变成：

- 选中工具
- 生成兼容参数
- 调用 Harness invocation
- 把执行结果回填进 AgentGraph 输出和 AgentRun 状态

## 当前还没定死的部分

下面这些还不能说完全定稿：

- Agent tool call 和 Harness invocation 之间是否需要独立桥接对象
- AgentGraph 与 Harness trace 是否统一成同一套跨层 trace id / span contract
- replan / ask_user / memory / retry 的高级状态协议
- 多轮恢复时是否需要更强的 graph checkpoint contract

## 当前判断

如果只问“有没有协议”，答案是：

- 有，而且已经能跑

如果问“是不是最终版协议”，答案是：

- 还不是

更准确的描述应当是：

- 当前已经有一版 MVP 协议
- 它足够支撑 `AgentRun -> AgentGraph -> Harness -> AgentRun`
- 但 approval gate、trace 统一、复杂状态恢复还在后续收口范围内
