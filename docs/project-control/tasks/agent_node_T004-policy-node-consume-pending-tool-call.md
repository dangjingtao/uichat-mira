---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: PolicyNodePendingToolCallContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T002-tool-call-normalize-node.md
  - docs/project-control/tasks/agent_node_T003-agent-graph-wiring.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: TODO
---

# agent_node_T004 policyNode consume pendingToolCall only

## Target

只收敛 `policyNode`。

让 `policyNode` 只消费已经冻结的：

```ts
state.pendingToolCall
```

并基于它做权限检查、风险判断、审批决策。

本任务不要改 Planner。
不要改 Normalize。
不要改 Harness。
不要改 `toolNode`。
不要重构完整 `AgentGraph`。

## Background

当前新链路是：

```text
nextActionPlannerNode
-> toolCallNormalizeNode
-> pendingToolCall
-> policyNode
-> toolNode
```

因此 `policyNode` 不应再承担：

```text
选择工具
生成 args
从 capabilityIntent 推导工具
从 query 构造工具调用
```

这些旧职责必须移除或绕开。

## Allowed Changes

- `server/src/agent/` 中与 `policyNode` 直接相关的实现、类型、路由判断和定向测试
- 与 `policyNode` 审批对象语义直接相关的 trace / approval / state 字段
- 与本任务直接相关的 `docs/project-control/` 文档更新

## Forbidden Changes

- 改 Planner
- 改 `toolCallNormalizeNode`
- 改 Harness
- 改 `toolNode`
- 重构完整 `AgentGraph`
- 做新的 tool schema validator
- 做 DAG scheduler
- 做并发工具调用
- 改 UI
- 改模型设置
- 做沙箱增强

## New Responsibility

`policyNode` 只做：

```text
1. 读取 state.pendingToolCall
2. 找到对应 tool definition / toolMeta
3. 评估 policy
4. 判断 allow / require_approval / deny / skip
5. 写入 policyDecision / pendingApproval
6. 决定是否进入 approval 或 toolNode
```

## What policyNode Must Not Do

禁止继续使用：

```ts
state.capabilityIntent?.selectedToolIds
state.selectedToolId
state.selectedCapabilityId
```

作为工具执行依据。

禁止继续：

```text
- selectCapabilityDefinition(...)
- buildToolArgs(...)
- freezeToolCall(...)
- 根据 query 自动补 args
- 根据 read/open/list 词汇自动选择 read_list/read_open
- 从 capabilityIntent.selectedToolIds 进入 policy
```

这些逻辑可以先保留为未使用 helper，但不得被 `policyNode` 调用。

## Allowed Input

`policyNode` 只允许使用：

```ts
state.pendingToolCall
state.toolExposure
state.toolIntent?.toolExposure
state.approvedToolIds
state.userId
state.threadId
state.requestContext
```

其中核心入口必须是：

```ts
const pendingToolCall = state.pendingToolCall;
```

没有 `pendingToolCall` 时，`policyNode` 必须安全失败或跳过，不得自己创建工具调用。

## PendingToolCall Contract

`policyNode` 应消费：

```ts
type PendingToolCall = {
  id: string;
  toolId: string;
  args: Record<string, unknown>;
  source: "planner";
  reason?: string;
  inputHash: string;
  status: "frozen";
  toolMeta?: ToolMeta;
  createdAt: string;
};
```

## Processing Rules

### 1. No pendingToolCall

当不存在：

```ts
state.pendingToolCall
```

`policyNode` 返回：

```ts
{
  policyDecision: {
    type: "skip",
    reason: "No pendingToolCall available for policy evaluation."
  }
}
```

或进入现有 error flow。

但不得继续进入 `toolNode`。

### 2. Resolve tool definition and meta

根据：

```ts
pendingToolCall.toolId
```

从当前 exposed tools / tool registry 中找到工具定义和 meta。

找不到时：

- 不得猜测相似工具
- 不得回退到别的工具
- 不得使用 `capabilityId` 替代
- 不得进入 `toolNode`

### 3. Approve frozen call only

`policyNode` 审批对象必须是：

```ts
pendingToolCall.toolId
pendingToolCall.args
pendingToolCall.inputHash
```

不得修改：

```ts
pendingToolCall.toolId
pendingToolCall.args
```

### 4. Risk evaluation

基于 `toolMeta` / tool definition 判断：

```text
- readonly
- sideEffect
- requiresApproval
- riskLevel
- workspaceBound
- longRunning
```

高风险工具进入 approval。

例如：

```text
write / delete / move / terminal / network / external_message / install_dependency
```

不得自动执行。

### 5. Approved call replay

如果已有审批记录，必须校验审批对象与当前 frozen call 对齐：

```text
toolId 一致
inputHash 一致
approvalId 一致或可追踪
```

不要只看 `toolId`。

避免：

```text
用户审批了 A 参数
系统执行了 B 参数
```

## Output

`policyNode` 可以写入：

```ts
state.policyDecision
state.pendingApproval
state.approvedToolIds
```

不得写入：

```ts
state.pendingToolCall
state.selectedToolId
state.selectedCapabilityId
```

`state.pendingToolCall` 只有在明确清理失败状态时才允许处理，不得作为正常审批路径写回。

## Routing Requirement

`policyNode` 之后：

```text
allow -> toolNode
require_approval -> approvalNode
deny / skip / error -> generate 或 error
```

不得在 `deny / skip / error` 后进入 `toolNode`。

## Trace Requirement

trace 至少记录：

```ts
{
  nodeId: "agent-policy",
  nodeType: "policy",
  label: "审批策略",
  details: {
    toolId: pendingToolCall.toolId,
    inputHash: pendingToolCall.inputHash,
    decisionType,
    requiresApproval,
    riskLevel,
    sideEffect,
    reason
  }
}
```

不要把完整 `args` 大对象塞进 trace。

## Old Logic To Remove Or Bypass

确认 `policyNode` 内不再存在执行入口：

```ts
const selectedToolIds = state.capabilityIntent?.selectedToolIds ?? [];
```

确认 `policyNode` 不再调用：

```ts
buildToolArgs(...)
freezeToolCall(...)
selectCapabilityDefinition(...)
```

作为当前工具调用生成逻辑。

## Non-goals

本任务不要做：

```text
- 不改 Planner
- 不改 Normalize
- 不改 Harness
- 不改 toolNode
- 不做新的 tool schema validator
- 不做 DAG scheduler
- 不做并发工具调用
- 不改 UI
- 不改模型设置
- 不做沙箱增强
```

只收敛 `policyNode`。

## Acceptance Criteria

1. `policyNode` 没有 `pendingToolCall` 时不会进入 `toolNode`。
2. `policyNode` 只审批 `state.pendingToolCall`。
3. `policyNode` 不再从 `capabilityIntent.selectedToolIds` 生成工具调用。
4. `policyNode` 不再从 `query` 构造 `args`。
5. `policyNode` 不修改 `pendingToolCall.toolId`。
6. `policyNode` 不修改 `pendingToolCall.args`。
7. 高风险工具会进入 approval。
8. 低风险 `allow` 后进入 `toolNode`。
9. `deny / skip / error` 不会进入 `toolNode`。
10. trace 能看到 `toolId`、`inputHash`、`decisionType`、risk 信息。
11. 已审批恢复时，至少校验 `toolId + inputHash`。
12. `capabilityId` 不会被当作 `toolId` 审批或执行。

## One-line Principle

```text
policyNode 只审 frozen pendingToolCall。
它不选择工具，不生成参数，不创建工具调用。
```
