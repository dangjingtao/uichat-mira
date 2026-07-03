---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: ToolNodePendingToolCallExecutionContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T003-agent-graph-wiring.md
  - docs/project-control/tasks/agent_node_T004-policy-node-consume-pending-tool-call.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: READY_FOR_REVIEW
---

# agent_node_T005 toolNode execute frozen pendingToolCall only

## Target

本任务只做一件事：

让 `toolNode` 只执行 `state.pendingToolCall` 中已经冻结的工具调用。

不要让 `toolNode` 再从以下旧字段推导或选择工具：

- `state.selectedToolId`
- `state.selectedCapabilityId`
- `state.capabilityIntent.selectedToolIds`
- `state.toolIntent.selectedToolIds`
- `lastToolExecution.capabilityId`
- `query / message / plan / capabilityId`

本任务目标不是重构 `AgentGraph`，也不是重写 Harness。

## Background

当前 Agent Decision Loop v1 的目标链路是：

```text
nextActionPlannerNode
-> toolCallNormalizeNode
-> pendingToolCall
-> policyNode
-> toolNode
-> evidence
-> nextActionPlannerNode
```

其中：

- `nextActionPlannerNode` 只输出 `state.nextAction`
- `toolCallNormalizeNode` 负责把 `nextAction.use_tool` 校验并冻结为 `state.pendingToolCall`
- `policyNode` 负责审批 `pendingToolCall`
- `toolNode` 只能执行 `pendingToolCall`

本任务是 `T-005`，只收敛 `toolNode`。

## Required Reading

工作前必须先读当前实际代码，不要凭猜测改：

- `server/src/agent/nodes.ts`
- `server/src/agent/graph.ts`
- `server/src/agent/types.ts`
- 与 `executeHarnessInvocation` 相关的文件
- 与 `AgentToolExecutionResult / evidence` 写入相关的类型和逻辑

如果文件路径和实际仓库不一致，以当前仓库实际文件为准。

## Allowed Changes

- 优先只修改 `server/src/agent/nodes.ts`
- 必要时修改 `server/src/agent/types.ts`
- 必要时修改少量 graph routing，以保证 `toolNode` 失败不继续执行
- 与本任务直接相关的 `docs/project-control/` 文档更新

## Forbidden Changes

- 改 Planner prompt
- 改 `nextActionPlannerNode` 内部逻辑
- 改 `toolCallNormalizeNode` 内部逻辑
- 改 Harness registry
- 改 MCP registry
- 改 UI
- 改模型设置
- 改沙箱能力
- 做并发调度
- 做 DAG scheduler

## New Responsibility

`toolNode` 只做以下事情：

```text
1. 读取 state.pendingToolCall
2. 确认 policy 已允许执行
3. 调用 executeHarnessInvocation
4. 写入 tool execution result / evidence
5. 清理 pendingToolCall
6. 返回给后续路由，由 AgentGraph 决定是否回到 Planner
```

## Core Execution Entry

`toolNode` 中必须以这个为唯一执行入口：

```ts
const pendingToolCall = state.pendingToolCall;
```

执行 Harness 时必须使用：

```ts
executeHarnessInvocation({
  toolId: pendingToolCall.toolId,
  args: pendingToolCall.args,
  userId,
  threadId,
  ...
});
```

不得修改：

```ts
pendingToolCall.toolId
pendingToolCall.args
```

不得重新 build args。

不得根据 `query / message / capability / selectedToolId` 自动补参数。

## No pendingToolCall

如果 `state.pendingToolCall` 不存在，`toolNode` 必须安全失败或跳过。

要求：

- 不执行任何工具
- 不从旧字段恢复工具
- 不从 `selectedToolId` 恢复工具
- 不从 `capabilityIntent.selectedToolIds` 恢复工具
- 写入明确错误或 trace

建议返回：

```ts
{
  pendingToolCall: undefined,
  errorMessage: "No pendingToolCall available for tool execution.",
  errorSourceNodeId: "agent-tool"
}
```

如果项目已有标准 error flow，请接入现有 error flow。

## Policy Check

执行前必须确认 policy 已允许当前调用执行。

请根据当前项目实际 `policyDecision` 类型判断 `allow` 状态，不要发明新的 policy 类型。

原则：

- 只有 policy 明确 `allow`，`toolNode` 才能执行

以下状态不得执行：

- `require_approval`
- `pending approval`
- `deny`
- `skip`
- `error`
- `missing policy decision`
- `policyDecision` 与当前 `pendingToolCall` 不匹配

如果当前项目还没有 `inputHash` 对齐逻辑，本任务至少保留 `pendingToolCall.inputHash` 到 trace / evidence，不要在本任务里大改 approval 系统。

## Old Logic To Remove Or Bypass

请检查并移除 `toolNode` 中的旧入口：

```ts
const toolId = state.selectedToolId;
```

以及任何类似逻辑：

```ts
state.capabilityIntent?.selectedToolIds
state.toolIntent?.selectedToolIds
state.selectedCapabilityId
state.selectedToolId
```

这些字段不得作为工具执行依据。

如果这些字段仍被其他节点使用，暂时不要全局删除类型，只确保 `toolNode` 不再使用它们执行工具。

## executeHarnessInvocation Requirement

调用 Harness 时，只允许传入 frozen call：

```ts
toolId: pendingToolCall.toolId
args: pendingToolCall.args
```

不得出现：

```ts
toolId: state.selectedToolId
toolId: selectedDefinition.id
args: buildToolArgs(...)
args: resolveReadTargetFromEvidence(...)
```

`toolNode` 不得调用：

- `buildToolArgs`
- `freezeToolCall`
- `selectCapabilityDefinition`
- `capability -> tool` 转换逻辑

## Evidence Writeback

工具执行完成后，必须写入 evidence / tool execution result。

至少保留这些信息：

```ts
{
  toolCallId: pendingToolCall.id,
  toolId: pendingToolCall.toolId,
  inputHash: pendingToolCall.inputHash,
  status,
  errorMessage,
  startedAt,
  finishedAt
}
```

如果当前 `AgentToolExecutionResult` 类型还没有 `toolCallId` 或 `inputHash` 字段：

- 可以在本任务中最小增加字段
- 或先写入 trace details
- 不要大规模重构 evidence schema

不要把超大 `stdout / stderr / result` 全量塞进普通 state。

## Clear pendingToolCall

工具执行结束后，无论成功还是失败，都要清理：

```ts
pendingToolCall: undefined
```

当前项目 reducer 已确认 `pendingToolCall: undefined` 可以清空旧值。

必须避免下一轮误执行旧 `pendingToolCall`。

## Trace Requirement

`toolNode` 至少记录：

```ts
{
  nodeId: "agent-tool",
  nodeType: "tool",
  label: "工具执行",
  details: {
    toolCallId,
    toolId,
    inputHash,
    status,
    durationMs
  }
}
```

不要把完整 `args / stdout / stderr` 大对象直接塞进 trace details。

## Routing Requirement

本任务不要求完整重构主链路，但必须保证：

- `toolNode` 无 `pendingToolCall` 时不会执行工具
- policy 未 `allow` 时不会执行工具
- tool 执行后不会残留 `pendingToolCall`

如果当前 graph 已经接入：

```text
toolNode -> nextActionPlannerNode
```

则保持。

如果当前 graph 仍然是：

```text
toolNode -> generate
```

本任务不要大改路由，可在备注中指出需要后续 `T-006` 做 evidence 回流和 `routeAfterTool` 收敛。

## Non-goals

本任务不要做：

- 不改 Planner
- 不改 Normalize
- 不重写 `policyNode`
- 不重写 Harness
- 不做 `capability -> tool` 转换
- 不做并发工具调用
- 不做 DAG scheduler
- 不做沙箱增强
- 不改 UI
- 不改模型设置模块
- 不做大范围类型清理

只收敛 `toolNode` 执行入口。

## Acceptance Criteria

1. `toolNode` 只读取 `state.pendingToolCall` 作为工具执行入口。
2. 没有 `pendingToolCall` 时，不会执行工具。
3. policy 未明确 `allow` 时，不会执行工具。
4. `toolNode` 不再使用 `state.selectedToolId` 执行工具。
5. `toolNode` 不再使用 `capabilityIntent.selectedToolIds` 执行工具。
6. `toolNode` 不重新生成 `args`。
7. `executeHarnessInvocation.toolId === pendingToolCall.toolId`。
8. `executeHarnessInvocation.args === pendingToolCall.args`。
9. 执行结果写入 evidence 或当前项目等价的 tool execution result。
10. 执行结束后 `pendingToolCall` 被清空。
11. trace 中能看到 `toolCallId`、`toolId`、`inputHash`、`status`。
12. `capabilityId` 不会被当成 `toolId` 执行。
13. 本任务没有引入新的 scheduler、sandbox、UI 或模型设置改动。

## One-line Principle

```text
toolNode 只执行 frozen pendingToolCall。
它不选择工具，不生成参数，不审批，不理解 capability，不做 planner。
```

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm exec vitest run src/agent/tool-node.test.ts src/agent/policy.test.ts src/agent/graph.test.ts src/agent/resume.test.ts`
  - 执行目录：`server/`
  - 结果：通过，`4` 个测试文件、`27` 个测试通过
- `pnpm check`
  - 执行方式：设置 `NODE_OPTIONS=--max-old-space-size=8192` 后重跑
  - 结果：通过
- `pnpm package:electron:win`
  - 执行方式：设置 `NODE_OPTIONS=--max-old-space-size=8192`
  - 结果：未通过
  - 当前阻断：
    - `desktop/src/shared/uchat/ui/UChatSidebarView.test.tsx` 期望 `role="menuitem"`，实际渲染为 `button`
    - 多个 `server` 非本任务测试缺少 `xlsx` 依赖或引用缺失文件，如 `src/mcp/document-readers.test.ts`、`src/mcp/resources/workspace-resource.test.ts`、`src/mcp/tools/read-extract.tool.test.ts`
    - 另有与本任务无关的既有失败：`bootstrap-env.test.ts`、`agent/persistence.test.ts`、`thread.service.test.ts`、`generate.service.test.ts`、`read-locate.tool.test.ts`

## Evidence

- Acceptance 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 12
  - [server/src/agent/tool-node.ts](D:/workspace/rag-demo/server/src/agent/tool-node.ts) 已把 `toolNode` 拆为独立模块，并改成只消费 frozen `pendingToolCall`
  - `toolNode` 现在只接受 `policyDecision.type === "allow"` 且 `toolId + inputHash` 与 frozen 调用对齐的执行请求
  - `toolNode` 不再使用 `selectedToolId`、`selectedCapabilityId`、`capabilityIntent.selectedToolIds`、`toolIntent.selectedToolIds` 作为执行依据
  - [server/src/agent/tool-node.test.ts](D:/workspace/rag-demo/server/src/agent/tool-node.test.ts) 已覆盖：
    - 正常执行 frozen 调用
    - 缺少 `pendingToolCall` 时阻断
    - `selectedToolId` 漂移不再影响执行入口
    - 未明确 `allow` 时阻断
    - Harness 返回 `awaiting_approval` 时保留 frozen 调用

- Acceptance 3 / 9 / 10 / 11
  - [server/src/agent/types.ts](D:/workspace/rag-demo/server/src/agent/types.ts) 新增最小 `AgentPolicyDecision`，并为 `AgentToolExecutionResult` 增加 `toolCallId`、`inputHash`
  - [server/src/agent/policy-node.ts](D:/workspace/rag-demo/server/src/agent/policy-node.ts) 现在会显式写回 `policyDecision`
  - [server/src/agent/graph.ts](D:/workspace/rag-demo/server/src/agent/graph.ts) 只在 `policyDecision.allow` 与 frozen 调用对齐时进入 `toolNode`
  - [server/src/agent/graph.test.ts](D:/workspace/rag-demo/server/src/agent/graph.test.ts) 已验证：
    - `use_tool` 仍然走 `Normalize -> Policy -> Tool`
    - `tool execution result` 已保留 `toolCallId / inputHash`
    - 完成后 `pendingToolCall` 被清空

- Acceptance 9 / 10 / 11
  - [server/src/agent/tool-node.ts](D:/workspace/rag-demo/server/src/agent/tool-node.ts) 已将 `toolCallId`、`toolId`、`inputHash`、`status`、`durationMs` 写入 `tool` trace
  - 执行完成后成功 / 失败都会清理 `pendingToolCall`；`awaiting_approval` 继续保留 frozen 调用以支持恢复链路

## Risks / Deferred

- `awaiting_approval` 场景不是“执行结束”，因此本任务按现有恢复契约保留 frozen `pendingToolCall`，没有在该分支清空它
- 本任务没有重写 Harness，也没有扩大到 approval 协议重构；运行时二次审批仍可能由 Harness 触发
- `pnpm package:electron:win` 当前被仓库里与 `T005` 无关的既有失败拦住，因此整仓打包验收还不能作为本任务已闭环的证据

## Review Result

- 当前状态：`READY_FOR_REVIEW`
- 提交结论：
  - `toolNode` 已收敛为只执行 frozen `pendingToolCall`
  - `toolNode` 已拆为独立文件
  - 定向类型检查、agent 相关测试和 `pnpm check` 已通过
  - 整仓打包仍受非本任务失败项阻断，需单独处理
