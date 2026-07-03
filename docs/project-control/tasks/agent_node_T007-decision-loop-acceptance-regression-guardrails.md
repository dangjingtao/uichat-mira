---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: AgentDecisionLoopAcceptanceRegressionGuardrails
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T003-agent-graph-wiring.md
  - docs/project-control/tasks/agent_node_T004-policy-node-consume-pending-tool-call.md
  - docs/project-control/tasks/agent_node_T005-tool-node-execute-frozen-pending-tool-call.md
  - docs/project-control/tasks/agent_node_T006-evidence-loop-routing.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: TODO
---

# agent_node_T007 decision loop acceptance and regression guardrails

## Target

本任务是 Agent Decision Loop v1 的验收测试与回归护栏任务。

本任务不新增功能，不重构架构，只做四件事：

- 验证闭环
- 补自动化测试
- 补最小护栏
- 防止旧执行路径回流

需要证明当前链路已经成立：

```text
Planner
-> Normalize
-> Policy
-> ToolNode
-> Evidence
-> Planner
```

## Current Invariants

请严格保持以下边界：

- `nextActionPlannerNode` 只输出 `state.nextAction`
- `toolCallNormalizeNode` 只从 `nextAction.use_tool` 创建 `state.pendingToolCall`
- `policyNode` 只审批 `state.pendingToolCall`
- `toolNode` 只执行 `state.pendingToolCall`
- `retrieveNode` / `toolNode` 的结果必须写入 `state.evidence`
- 行动完成后必须回到 Planner
- `capabilityIntent.selectedToolIds` 不得直接进入 policy / tool
- `selectedToolId` 不得触发 `toolNode`
- `maxIterations` 必须阻断无限循环
- normalize / policy / tool 任一环出错时，不得继续执行工具

## Required Reading

工作前必须阅读当前实际代码，不要凭猜测补测试：

- `server/src/agent/graph.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/types.ts`
- `server/src/agent/next-action-planner*`
- `server/src/agent/tool-call-normalize*`
- `server/src/agent/trace.ts`
- 当前项目已有测试目录和测试框架
- `package.json` 中 server 相关 test 命令

如果路径与实际仓库不一致，以当前仓库实际文件为准。

## Allowed Changes

优先只修改或新增：

- agent 相关测试文件
- 必要的 test helper / mock helper
- 必要的最小 bug fix
- 必要的类型导出，便于测试
- 与本任务直接相关的 `docs/project-control/` 文档更新

## Forbidden Changes

- UI
- 模型设置模块
- Harness registry 大结构
- MCP registry
- Provider Gateway
- 沙箱能力
- 并发工具调用
- DAG scheduler
- 多智能体
- 记忆系统

## Test Strategy

优先复用当前项目已有测试框架。

不要引入新的大型测试框架。

如果当前没有 agent 验收测试目录，可新增类似：

```text
server/src/agent/__tests__/agent-decision-loop.test.ts
```

具体位置以当前仓库规范为准。

## Required Scenarios

### 1. 普通问答不进入工具链

- Planner 输出 `answer`
- Graph 进入 `generate`
- 不得进入 `toolCallNormalize / policyNode / toolNode`
- 不得创建 `pendingToolCall`
- 不得执行 Harness invocation
- trace 中必须能看到 `nextAction = answer`

### 2. retrieve 后回到 Planner

- Planner 第一轮输出 `retrieve`
- 流程必须是 `Planner -> retrieve -> evidence.retrievals append -> Planner`
- retrieval 结果必须写入 `state.evidence.retrievals`
- retrieve 后不得直接固定进入 `generate`
- 第二轮 Planner 必须能看到 retrieval evidence
- 不得进入 `toolNode`

### 3. use_tool 正常闭环

- Planner 输出 `use_tool`
- 流程必须是 `Planner -> toolCallNormalize -> pendingToolCall -> policy allow -> toolNode -> evidence.toolExecutions append -> pendingToolCall cleared -> Planner`
- `pendingToolCall.toolId` 与 Planner 输出一致
- `pendingToolCall.args` 与 Planner 输出一致
- `executeHarnessInvocation.toolId` 与 `pendingToolCall.toolId` 一致
- `executeHarnessInvocation.args` 与 `pendingToolCall.args` 一致
- tool result 必须写入 evidence

### 4. Normalize 拒绝未暴露工具

- Planner 输出 `use_tool`
- `state.toolExposure.exposedTools` 不包含该 `toolId`
- 不得创建 `pendingToolCall`
- 不得进入 `policyNode`
- 不得进入 `toolNode`
- 不得调用 `executeHarnessInvocation`
- trace / error 中必须记录 `tool_not_exposed` 或等价原因

### 5. Normalize 拒绝 capabilityId

- Planner 输出的 `toolId` 实际上是 capabilityId
- normalize 必须失败
- 不得创建 `pendingToolCall`
- 不得进入 policy / tool
- 不得自动替换为其它 read 工具

### 6. policy 未 allow 时 toolNode 不执行

- `state.pendingToolCall` 存在
- `state.policyDecision` 为 `deny / require_approval / skip / error`
- `toolNode` 不得执行 Harness invocation
- 不得写入成功 toolExecution
- 必须进入审批、报错或安全停止路径

### 7. toolNode 不读取 selectedToolId

- 构造危险 state：`state.selectedToolId` 存在，但 `state.pendingToolCall` 缺失
- `toolNode` 不得执行任何工具
- 不得从 `selectedToolId` 恢复工具
- 必须返回 error 或安全停止

### 8. capabilityIntent.selectedToolIds 不能直通 policy / tool

- `state.capabilityIntent.selectedToolIds = ["read_open"]`
- `state.nextAction = undefined`
- `state.pendingToolCall = undefined`
- 不得进入 `policyNode`
- 不得进入 `toolNode`
- 不得执行 `read_open`

### 9. maxIterations 生效

- `state.iteration >= state.maxIterations`
- 即使 Planner 原本可能继续 `retrieve / use_tool`
- 也不得继续进入 `retrieve / toolCallNormalize / policyNode / toolNode`
- 必须进入 `generate / error / stop`
- trace 或输出中必须说明达到最大轮数

### 10. pending approval 停止当前 loop

- 流程为 `Planner -> use_tool -> Normalize -> pendingToolCall -> Policy require_approval`
- 不得进入 `toolNode`
- 不得继续 Planner loop
- 当前 run 必须停止并等待用户审批

## Mock Requirements

测试中请 mock：

- `providerProxyService`
- `executeHarnessInvocation`
- retrieve service
- trace emit

不要真实调用：

- 外部模型
- 真实 Harness 工具
- 真实文件删除 / 写入 / terminal
- 网络请求

测试必须可重复、可离线运行。

## Allowed Minimal Fixes

如果测试暴露以下问题，可以做最小修复：

- 路由仍然从 `capabilityIntent.selectedToolIds` 进入 policy
- `toolNode` 仍然读取 `selectedToolId`
- normalize 失败仍然进入 policy
- retrieve / tool 后没有 evidence
- tool 后没有清理 `pendingToolCall`
- `maxIterations` 没有阻断

修复必须最小化，不得扩散重构。

## Prohibited Moves

不得为了让测试通过而：

- 删除核心安全校验
- 放宽 `toolId` 校验
- 允许 capabilityId 当 `toolId`
- 自动替换 `toolId`
- 让 policy 重新 build args
- 让 `toolNode` 从 `selectedToolId` 执行
- 用自然语言 fallback 假装执行成功
- 引入新 scheduler / DAG / 并发系统

## Deliverables

任务完成后必须输出：

1. 新增或修改了哪些测试文件
2. 覆盖了哪些场景
3. 是否发现并修复了实现问题
4. 当前测试命令
5. 是否仍有未覆盖风险

## Final Acceptance

1. 普通 `answer` 不进入工具链。
2. `retrieve` 结果进入 evidence，并回到 Planner。
3. `use_tool` 必须经过 Normalize。
4. Normalize 成功才进入 Policy。
5. Normalize 失败不进入 Policy / Tool。
6. Policy 未 allow 不执行 Tool。
7. `toolNode` 只执行 `pendingToolCall`。
8. `toolNode` 不读取 `selectedToolId`。
9. `capabilityIntent.selectedToolIds` 不再能触发执行。
10. Tool execution result 进入 evidence。
11. `pendingToolCall` 执行后清空。
12. `maxIterations` 生效。
13. approval pending 会暂停 loop。
14. 所有测试离线、可重复、不会真实执行危险工具。

## One-line Rule

`agent_node_T007` 只做 Agent Decision Loop v1 的测试验收和回归护栏。

必须证明这条链真实成立：

```text
Planner -> Normalize -> Policy -> Tool -> Evidence -> Planner
```
