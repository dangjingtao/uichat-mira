---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: AgentGraphWiring
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T001-next-action-planner-node.md
  - docs/project-control/tasks/agent_node_T002-tool-call-normalize-node.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: TODO
---

# agent_node_T003 AgentGraph wiring

## Target

只做 `AgentGraph` 主链路接线。

将已实现的两个节点接入 `AgentGraph`：

- `nextActionPlannerNode`
- `toolCallNormalizeNode`

当前已经确认的任务真相：

- 这是主链路 wiring 任务，不是节点内部重写任务
- 不允许借本任务重写 Planner、Normalize、Harness、policyNode、toolNode
- 必须把工具执行入口切到 `Planner -> Normalize -> Policy -> Tool`
- 必须让旧入口 `capabilityIntent.selectedToolIds -> policyNode` 失效

目标主链路：

```text
prepareContext
-> planNode
-> toolExposure / capabilityIntent
-> nextActionPlannerNode
-> routeAfterNextAction
-> generate / retrieve / toolCallNormalize / askUser / error
-> policyNode
-> toolNode
-> evidence update
-> nextActionPlannerNode
```

一句话原则：

```text
Planner 决策 -> Normalize 冻结 -> Policy 审批 -> Tool 执行 -> Evidence 回流 -> Planner 再决策
```

## Allowed Changes

- `server/src/agent/graph.ts`
- 与本次接线直接相关的 `server/src/agent/` graph state、路由函数、节点注册
- 与本次接线直接相关的 graph / node 定向测试
- 与本任务直接相关的当前文档更新

## Forbidden Changes

- 重写 `nextActionPlannerNode`
- 重写 `toolCallNormalizeNode`
- 重写 Harness
- 重写 `policyNode`
- 重写 `toolNode`
- 做 DAG scheduler
- 做并发工具调用
- 改模型设置模块
- 改 UI
- 增加未经批准的 fallback 执行路径

## Registration Requirement

必须在 `AgentGraph` 中注册两个节点：

```ts
nextActionPlannerNode
toolCallNormalizeNode
```

节点名称建议固定为：

```text
nextActionPlanner
toolCallNormalize
```

不新增额外复杂节点。

## Planner Wiring

在已有 `planNode` / `capabilityIntentNode` / `toolGuardNode` 之后，进入：

```text
nextActionPlannerNode
```

Planner 输入必须能拿到：

- `state.plan / taskFrame`
- `state.evidence`
- `state.lastToolExecution`
- `state.toolExposure` 或 `state.toolIntent.toolExposure`
- `state.iteration / maxIterations`

Planner 只负责写入：

```ts
state.nextAction
```

## Required Route

必须新增路由函数：

```ts
function routeAfterNextAction(state: AgentGraphState) {
  switch (state.nextAction?.type) {
    case "answer":
      return "generate";

    case "retrieve":
      return "retrieve";

    case "ask_user":
      return "generate";

    case "use_tool":
      return "toolCallNormalize";

    case "error":
      return "error";

    default:
      return "generate";
  }
}
```

强制约束：

- `use_tool` 不能直接进入 `policyNode`
- `use_tool` 必须先经过 `toolCallNormalizeNode`
- `error` 不得继续执行工具

## Normalize Wiring

当：

```ts
state.nextAction?.type === "use_tool"
```

时，进入：

```text
toolCallNormalizeNode
```

Normalize 成功后进入：

```text
policyNode
```

Normalize 失败后进入：

```text
error
```

判断方式必须明确：

```ts
if (state.errorMessage || !state.pendingToolCall) {
  return "error";
}

return "policyStep";
```

不得在 normalize 失败后继续进入 policy / tool。

## Policy Entry Constraint

本任务不重写 `policyNode`，但接线后必须保证：

```text
policyNode 只在 pendingToolCall 存在时被进入
```

也就是说：

```ts
state.pendingToolCall
```

是 `policyNode` 的唯一工具调用入口。

以下路径不得继续进入 `policyNode`：

- `capabilityIntent.selectedToolIds`
- `selectedToolId`
- `selectedCapabilityId`

这些字段只允许继续用于：

- tool exposure
- trace
- diagnostics
- 候选工具解释

## Tool And Retrieve Back-Route

`toolNode` 执行完成后，不得直接默认 `generate`。

必须回到下一轮决策：

```text
toolNode -> nextActionPlannerNode
```

如果当前结构确实需要先刷新暴露面，也只能是：

```text
toolNode -> capabilityIntent / toolExposure -> nextActionPlannerNode
```

`retrieve` 完成后也不得直接默认 `generate`。

必须回到：

```text
retrieve -> nextActionPlannerNode
```

或：

```text
retrieve -> toolExposure -> nextActionPlannerNode
```

原则：

- 工具结果进入 evidence 后，由 Planner 再判断下一步
- retrieval evidence 进入 evidence 后，由 Planner 再判断下一步

## Old Path Removal

必须删除、绕开或禁用旧执行入口，例如：

```ts
if (state.capabilityIntent?.selectedToolIds?.length > 0) {
  return "policyStep";
}
```

这类逻辑不得继续存在为执行入口。

## Max Iterations

主链路中必须保证 `iteration / maxIterations` 生效。

当达到 `maxIterations`：

- 不得继续进入 `retrieve`
- 不得继续进入 `toolCallNormalize`
- 不得继续进入 `policyNode`
- 不得继续进入 `toolNode`

应进入：

- `generate`
- 或 `error`

并明确停止原因。

## Trace Requirement

接入后 trace 至少要能看到：

- `planNode`
- `toolExposure / capabilityIntent`
- `nextActionPlannerNode`
- `toolCallNormalizeNode`
- `policyNode`
- `toolNode`
- `evidence update`

重点确认 trace 中能看到：

- `nextAction`
- `pendingToolCall`
- `policyDecision`
- `toolExecution`

## Non-Goals

本任务不要做：

- 改 Planner prompt
- 改 Normalize 校验逻辑
- 重写 Harness
- 重写 `policyNode`
- 重写 `toolNode`
- 做 DAG scheduler
- 做并发工具调用
- 做模型设置模块
- 做 UI 改动
- 做沙箱增强

## Acceptance Criteria

1. 普通问答时，Planner 输出 `answer`，Graph 进入 `generate`，不会进入 `policyNode / toolNode`
2. 检索任务时，Planner 输出 `retrieve`，retrieve 结果进入 evidence，并回到 Planner 再判断
3. 工具任务时，Planner 输出 `use_tool`，会先进入 `toolCallNormalizeNode`，生成 `pendingToolCall` 后再进入 `policyNode` 和 `toolNode`
4. Normalize 失败时，不进入 `policyNode`，不进入 `toolNode`，而是进入 `error` 或安全说明路径
5. 工具执行完成后，tool result 写入 evidence，并回到 Planner，由 Planner 决定继续还是回答
6. `capabilityIntent.selectedToolIds` 不再能直接触发 `policyNode / toolNode`
7. `policyNode` 只有在 `pendingToolCall` 存在时才能进入
8. 超过 `maxIterations` 后，不会继续调用工具或 retrieve

## Verification

- 待具体接线实现后补充命令与结果
- 至少应包含：
  - `pnpm --filter @ui-chat-mira/server typecheck`
  - `vitest` 针对 `AgentGraph` 主链路接线的定向测试
  - 普通问答、检索任务、工具任务、Normalize 失败、超出 `maxIterations` 的路由验证
  - 旧入口失效验证：`capabilityIntent.selectedToolIds` 不能再直接触发 `policyNode`

## Evidence

- 当前为任务建立阶段，尚无实现证据
- 当前已确认的设计真相：
  - `nextActionPlannerNode` 与 `toolCallNormalizeNode` 已经是独立节点任务
  - 第三个任务只负责把这两个节点接入 `AgentGraph`
  - 执行入口必须从“能力命中执行”切到“Planner 决策执行”

## Risks / Deferred

- 本任务不处理 Planner 节点内部策略
- 本任务不处理 Normalize 节点内部校验细节
- 本任务不处理 Harness 执行边界重构
- 本任务不处理 `policyNode` / `toolNode` 内部实现重写
- 本任务不处理审批协议升级
- 本任务不处理完整 runtime 架构改造
