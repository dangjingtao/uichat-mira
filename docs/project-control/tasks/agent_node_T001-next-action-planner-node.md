---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-03
layer: project-control
module: ProjectControl
feature: NextActionPlannerNode
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: DONE
---

# agent_node_T001 nextActionPlannerNode

## Target

只实现 `nextActionPlannerNode`。

该节点负责在每一轮 Agent loop 中，根据当前任务语义、已有 evidence、Harness 暴露的真实工具列表，输出下一步动作 `AgentNextAction`。

当前已经确认的实现真相：

- 不允许硬编码上下文假设
- 不允许写规则化分支替代真实 planner 决策
- 该节点的具体实现必须调用现有 task model
- 本地代码只负责组装输入、解析 JSON、校验结构、执行 fallback 和写 trace
- 失败场景不得伪装成 `answer`

## Allowed Changes

- `server/src/agent/` 中与 `nextActionPlannerNode` 直接相关的类型、节点实现、定向测试
- 与 `nextActionPlannerNode` 直接相关的 graph state 字段
- 与本任务直接相关的 trace 输出
- 与本任务直接相关的当前文档更新

## Forbidden Changes

- 改 Harness
- 改 `policyNode`
- 改 `toolNode`
- 做完整 Agent loop 重构
- 做并发工具调用
- 做 DAG scheduler
- 改 UI
- 改模型设置模块
- 把 capability 选择链路改造成工具执行链主入口
- 用硬编码上下文判断替代 task model 决策

## Required Type

必须新增统一类型：

```ts
export type AgentNextAction =
  | {
      type: "answer";
      reason: string;
    }
  | {
      type: "retrieve";
      query: string;
      reason: string;
    }
  | {
      type: "use_tool";
      toolId: string;
      args: Record<string, unknown>;
      reason: string;
    }
  | {
      type: "ask_user";
      question: string;
      reason: string;
    }
  | {
      type: "error";
      reason: string;
    };
```

## Node Contract

实现：

```ts
export async function nextActionPlannerNode(
  state: AgentGraphState
): Promise<Partial<AgentGraphState>>
```

该节点读取：

- `state.messages`
- `state.question`
- `state.plan` 或 `state.taskFrame`
- `state.evidence`
- `state.lastToolExecution`
- `state.toolExposure?.exposedTools`
- `state.toolExposure?.toolMeta`
- `state.iteration`
- `state.maxIterations`
- `state.pendingApproval`

该节点只允许输出：

```ts
{
  nextAction: AgentNextAction
}
```

该节点不得写入：

- `state.pendingToolCall`
- `state.selectedToolId`
- `state.selectedCapabilityId`
- `state.pendingApproval`

## Task Model Contract

`nextActionPlannerNode` 必须调用现有 task model，让模型只做下一步动作决策。

Prompt 中必须包含：

- 用户原始问题
- 当前任务拆解结果：`state.plan / taskFrame`
- 已有 evidence 摘要
- 上一次工具执行结果
- 当前可用真实工具列表：`toolExposure.exposedTools`
- 每个工具的 schema / description / meta
- 当前 `iteration / maxIterations`
- 严格要求输出 JSON

模型输出必须只允许以下四种结构：

```json
{ "type": "answer", "reason": "..." }
```

```json
{ "type": "retrieve", "query": "...", "reason": "..." }
```

```json
{
  "type": "use_tool",
  "toolId": "read_open",
  "args": {},
  "reason": "..."
}
```

```json
{
  "type": "ask_user",
  "question": "...",
  "reason": "..."
}
```

## Validation Rules

PlannerNode 内必须做基础校验：

1. JSON parse 校验
2. action type 校验
3. `use_tool` 校验

`use_tool` 场景下必须满足：

- `toolId` 必须是 string
- `args` 必须是 object
- `toolId` 必须存在于 `state.toolExposure.exposedTools`
- 不允许使用 `capabilityId` 当 `toolId`
- 不允许使用未暴露工具

校验失败时：

- 不得自动替换 `toolId`
- 不得继续执行工具
- 只能 fallback / error / 要求重新规划

## Fallback Strategy

当以下情况发生时：

- task model 调用失败
- JSON parse 失败
- schema 校验失败
- `use_tool` 使用了未暴露工具
- `iteration` 已达到 `maxIterations`

返回停止动作：

```ts
{
  nextAction: {
    type: "error",
    reason: "Planner fallback: unable to safely determine next action."
  }
}
```

## Trace Requirement

节点执行时写 trace，至少包含：

```ts
{
  nodeId: "agent-next-action-planner",
  nodeType: "plan",
  label: "下一步动作决策",
  details: {
    exposedToolCount,
    selectedActionType,
    selectedToolId,
    reason,
    iteration,
    maxIterations
  }
}
```

不要把完整大段 evidence 直接塞进 trace detail。

## Acceptance Criteria

1. `nextActionPlannerNode` 能输出合法 `AgentNextAction`
2. 普通问答场景输出 `answer`
3. 需要检索时输出 `retrieve`
4. 需要工具时输出 `use_tool`
5. `use_tool.toolId` 必须来自 `state.toolExposure.exposedTools`
6. 使用未暴露工具时不会继续执行
7. JSON 无效时不会继续执行
8. Planner 不写 `pendingToolCall`
9. Planner 不读 `capabilityIntent.selectedToolIds` 作为执行依据
10. trace 能看到本轮 `nextAction` 决策

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/next-action-planner.test.ts`
  - 结果：通过，`1` 个测试文件、`10` 个测试通过

## Evidence

- Acceptance 1 / 2 / 3 / 4
  - [server/src/agent/types.ts](D:/workspace/rag-demo/server/src/agent/types.ts) 新增 `AgentNextAction` 与最小 `AgentToolExposureState`
  - [server/src/agent/next-action-planner.ts](D:/workspace/rag-demo/server/src/agent/next-action-planner.ts) 新增独立 `nextActionPlannerNode`
  - 节点当前通过 `providerProxyService.streamTaskChatText(...)` 调用现有 task model，不做规则化上下文分支

- Acceptance 5 / 6 / 7 / 8 / 9
  - [server/src/agent/next-action-planner.ts](D:/workspace/rag-demo/server/src/agent/next-action-planner.ts) 对 task model 输出执行 JSON parse、action type、`use_tool.toolId` 暴露面、`args` 结构校验
  - 节点返回值只写 `nextAction`，没有写入 `pendingToolCall`、`selectedToolId`、`pendingApproval`
  - 非法 JSON、非法 action type、非法 `toolId`、非法 `args`、task model 调用失败、iteration 用尽时，节点统一返回 `nextAction.type = "error"`，不会伪装成 `answer`
  - [server/src/agent/next-action-planner.test.ts](D:/workspace/rag-demo/server/src/agent/next-action-planner.test.ts) 覆盖：
    - `answer`
    - `retrieve`
    - `use_tool`
    - `ask_user`
    - 非法 JSON fallback
    - 未暴露工具 fallback
    - 非法 `args` fallback
    - `maxIterations` fallback

- Acceptance 10
  - [server/src/agent/next-action-planner.ts](D:/workspace/rag-demo/server/src/agent/next-action-planner.ts) 为 `agent-next-action-planner` 写入 `plan/start` 与 `plan/done` trace
  - [server/src/agent/next-action-planner.test.ts](D:/workspace/rag-demo/server/src/agent/next-action-planner.test.ts) 断言 trace 中包含 `selectedActionType`、`selectedToolId`

## Risks / Deferred

- 本任务不处理 `toolCallNormalizeNode`
- 本任务不处理 `policyNode`
- 本任务不处理 `toolNode`
- 本任务不处理 Harness 暴露机制重构
- 本任务不处理完整 Agent loop 重排
- 当前节点已实现，但尚未接入现有 graph 路由；这不在本任务允许范围内

## Review Outcome

- 当前提交结论：评审通过
- 当前状态：`DONE`
- 评审确认：
  - 当前节点可以通过 `Planner` 节点评审
  - `AgentNextAction` 必须包含 `error`
  - `routeAfterNextAction` 后续必须处理 `error`
  - normalize 节点后续必须负责 schema 校验和 `pendingToolCall` freeze
- 范围说明：
  - `routeAfterNextAction` 和 normalize 节点的后续接入，只是当前节点通过评审的接入前提
  - 它们不属于 `agent_node_T001` 当前实现范围
