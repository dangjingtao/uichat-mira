---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: ToolCallNormalizeNode
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T001-next-action-planner-node.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: TODO
---

# agent_node_T002 toolCallNormalizeNode

## Target

只实现 `toolCallNormalizeNode`。

该节点是 `nextActionPlannerNode` 后面的“编译/冻结节点”，只做一件事：

- 把 `nextAction.use_tool` 规范化、校验并冻结成 `state.pendingToolCall`

当前已经确认的实现真相：

- 不允许用硬编码规则替代上游 task model 的核心输出
- `toolCallNormalizeNode` 只消费 `nextActionPlannerNode` 已产出的 `nextAction`
- 它不是一个重新决策节点，不负责从消息内容重新判断“该不该用工具”或“该用哪个工具”
- 必须补充完备测试，覆盖成功、失败和越界输入场景

目标链路：

```text
nextActionPlannerNode
-> toolCallNormalizeNode
-> policyNode
-> toolNode
```

本任务只实现中间这一段：

```text
nextAction.use_tool -> pendingToolCall
```

## Allowed Changes

- `server/src/agent/` 中与 `toolCallNormalizeNode` 直接相关的类型、节点实现、定向测试
- 与 `toolCallNormalizeNode` 直接相关的 graph state 字段
- 与 `PendingToolCall` 统一结构直接相关的类型定义
- 与本任务直接相关的 trace / error 输出
- 与本任务直接相关的当前文档更新

## Forbidden Changes

- 改 Harness
- 改 `policyNode`
- 改 `toolNode`
- 改 `nextActionPlannerNode`
- 用硬编码规则重做 planner 决策
- 做完整 Agent loop 重构
- 做审批流实现
- 执行工具
- 做 capability -> tool 执行链改造
- 读取 `capabilityIntent.selectedToolIds` 作为执行依据
- 从 `query / message` 重新 build `args`
- 修改 `state.nextAction`
- 修改 `state.selectedToolId`
- 修改 `state.selectedCapabilityId`
- 做并发工具调用
- 做 DAG scheduler
- 改 UI
- 改模型设置模块

## Required Type

必须新增或复用统一结构：

```ts
export type PendingToolCall = {
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

字段约束：

- `id`：本次工具调用唯一 ID
- `toolId`：Planner 选择的真实工具 ID
- `args`：Planner 生成的参数
- `source`：固定为 `"planner"`
- `reason`：来自 `nextAction.reason`
- `inputHash`：基于 `toolId + args + source` 生成
- `status`：固定为 `"frozen"`
- `toolMeta`：从 `state.toolExposure.toolMeta` 绑定
- `createdAt`：ISO 时间字符串

## Node Contract

实现：

```ts
export async function toolCallNormalizeNode(
  state: AgentGraphState
): Promise<Partial<AgentGraphState>>
```

该节点读取：

- `state.nextAction`
- `state.toolExposure?.exposedTools`
- `state.toolExposure?.toolMeta`

该节点只允许写入：

```ts
{
  pendingToolCall: PendingToolCall | undefined
}
```

以及必要的 trace / error 信息。

只有当：

```ts
state.nextAction?.type === "use_tool"
```

时，才允许创建 `pendingToolCall`。

否则返回安全空结果或 error，不得创建工具调用。

## Validation Rules

校验节点只能对 `nextAction` 做 contract validation。

不允许把下面这些行为塞进本节点：

- 通过关键词、消息文本或 query 规则重新判断是否应该 `use_tool`
- 通过本地规则重新选择工具
- 通过硬编码分支把上游 task model 输出改写成别的动作类型

### 1. 必须存在 `nextAction`

没有 `state.nextAction` 时，不得创建 `pendingToolCall`。

### 2. `nextAction` 必须是 `use_tool`

只有：

```ts
state.nextAction.type === "use_tool"
```

才允许继续。

以下类型都不得创建 `pendingToolCall`：

- `answer`
- `retrieve`
- `ask_user`

### 3. `toolId` 必须是非空 string

必须满足：

```ts
typeof nextAction.toolId === "string"
```

且不能为空。

### 4. `args` 必须是普通 object

必须满足：

```ts
typeof nextAction.args === "object"
Array.isArray(nextAction.args) === false
nextAction.args !== null
```

### 5. `toolId` 必须来自 `exposedTools`

必须从：

```ts
state.toolExposure.exposedTools
```

中找到对应 tool。

不允许：

- 使用未暴露工具
- 使用 `capabilityId`
- 使用 `selectedToolIds`
- 自动 fallback 到别的工具
- 猜测相似工具名

### 6. `args` 需要按 `inputSchema` 校验

根据 exposed tool 的 `inputSchema` 校验 `args`。

可以先实现轻量 schema validation。

校验失败时：

- 不得自动修复 `args`
- 不得删除字段后继续执行
- 不得猜测默认参数
- 必须写入 trace / error
- 返回安全失败状态

## Hash Contract

必须实现稳定 hash：

```ts
inputHash = hash({
  toolId,
  args,
  source: "planner"
})
```

要求：

- 同样 `toolId + args` 生成相同 hash
- 字段顺序稳定
- 用于 trace / replay / approval 对齐

## Trace Requirement

规范化成功时至少写入：

```ts
{
  nodeId: "agent-tool-call-normalize",
  nodeType: "tool",
  label: "工具调用规范化",
  details: {
    toolId,
    source: "planner",
    argKeys,
    hasToolMeta,
    inputHash,
    status: "frozen"
  }
}
```

规范化失败时至少写入：

```ts
{
  nodeId: "agent-tool-call-normalize",
  nodeType: "tool",
  label: "工具调用规范化失败",
  details: {
    reason,
    toolId,
    availableToolCount
  }
}
```

不要把完整 `args` 大对象直接塞进 trace。

## Failure Handling

以下情况必须失败：

- `nextAction` 不存在
- `nextAction.type` 不是 `use_tool`
- `toolId` 为空
- `args` 非 object
- `toolId` 不在 `exposedTools`
- `args` 不符合 `inputSchema`

失败时应返回：

```ts
{
  pendingToolCall: undefined,
  error: ...
}
```

或者走项目现有 error flow。

原则：

- 失败时宁可停止，也不要猜测执行

## Absolute Non-Goals

`toolCallNormalizeNode` 不得：

- 选择工具
- 替换 `toolId`
- 执行工具
- 审批工具
- 调用 Harness invocation
- 读取 `capabilityIntent.selectedToolIds` 作为执行依据
- 从 `query / message` 里重新 build `args`
- 修改 `nextAction`
- 修改 `selectedToolId`
- 修改 `selectedCapabilityId`

它只能做：

```text
校验 -> 绑定 meta -> freeze pendingToolCall
```

## Acceptance Criteria

1. 当 `nextAction.type !== "use_tool"` 时，不创建 `pendingToolCall`
2. 当 `nextAction.type === "use_tool"` 且 `toolId` 合法时，创建 `frozen pendingToolCall`
3. `pendingToolCall.toolId` 等于 `nextAction.toolId`
4. `pendingToolCall.args` 等于 `nextAction.args`
5. `toolId` 必须来自 `state.toolExposure.exposedTools`
6. 未暴露 `toolId` 不会被执行，也不会被自动替换
7. `capabilityId` 不会被当成 `toolId`
8. `args` schema 校验失败时，不创建 `pendingToolCall`
9. `pendingToolCall` 包含 `inputHash`
10. trace 能看到 normalize 成功或失败原因
11. `toolCallNormalizeNode` 不读取 `capabilityIntent.selectedToolIds`
12. `toolCallNormalizeNode` 不调用 Harness invocation

## Verification

- 待具体实现任务补充命令与结果
- 至少应包含：
  - `vitest` 针对 `toolCallNormalizeNode` 的完备测试
  - `server` 包定向 `typecheck`
  - 成功路径测试：合法 `use_tool` 生成 frozen `pendingToolCall`
  - 非 `use_tool` 路径测试：`answer / retrieve / ask_user` 不生成 `pendingToolCall`
  - 失败路径测试：缺失 `nextAction`、空 `toolId`、非法 `args`、未暴露 `toolId`、schema 校验失败
  - 越界保护测试：不会读取 `capabilityIntent.selectedToolIds`，不会调用 Harness invocation，不能自动替换 `toolId`

## Evidence

- 当前为任务建立阶段，尚无实现证据
- 当前已确认的设计真相：
  - `toolCallNormalizeNode` 是 Planner 输出和 Policy 执行链之间的安全编译层
  - 它只负责 `nextAction.use_tool -> validate -> freeze -> pendingToolCall`
  - 它不负责选择、不负责审批、不负责执行
  - 它不允许用硬编码规则替代上游 task model 的核心输出

## Risks / Deferred

- 本任务不处理 `nextActionPlannerNode`
- 本任务不处理 `policyNode`
- 本任务不处理 `toolNode`
- 本任务不处理 Harness 暴露机制重构
- 本任务不处理审批实现
- 本任务不处理完整 Agent loop 重排
