---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: AgentDecisionLoopEvidenceRouting
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T003-agent-graph-wiring.md
  - docs/project-control/tasks/agent_node_T004-policy-node-consume-pending-tool-call.md
  - docs/project-control/tasks/agent_node_T005-tool-node-execute-frozen-pending-tool-call.md
  - docs/chat/agent-runtime-design.md
  - docs/harness/agentgraph-harness-protocol.md
task_state: READY_FOR_REVIEW
---

# agent_node_T006 evidence loop routing

## Target

本任务只做一件事：

让 `toolNode` / `retrieveNode` 的执行结果稳定写入 `state.evidence`，并让 AgentGraph 在每次行动后回到下一轮 Planner 决策，形成最小可用的 Agent Decision Loop v1。

目标闭环：

```text
nextActionPlannerNode
-> routeAfterNextAction
-> retrieve / toolCallNormalize
-> policyNode
-> toolNode
-> evidence update
-> toolExposure / capabilityIntent refresh
-> nextActionPlannerNode
-> ...
-> generate / ask_user / error / maxIterations stop
```

本任务不得重写 Planner、Normalize、Policy、ToolNode、Harness。

## Current Invariants

请严格保持以下边界：

- `planNode` 只做任务语义拆解
- `Harness` 只做 capability match、真实 tools 暴露、tool meta / risk 返回、执行指定 `toolId`
- `nextActionPlannerNode` 只写 `state.nextAction`
- `toolCallNormalizeNode` 只把 `nextAction.use_tool` 校验并冻结为 `state.pendingToolCall`
- `policyNode` 只审批 `state.pendingToolCall`
- `toolNode` 只执行 `state.pendingToolCall`
- `capabilityIntent.selectedToolIds` 不得再直接进入 policy / tool
- `selectedToolId` 不得再作为工具执行入口

本任务只接通 evidence 和 loop routing。

## Required Reading

工作前必须阅读当前实际代码，不要凭猜测改：

- `server/src/agent/graph.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/types.ts`
- `server/src/agent/intent/node.ts`
- `server/src/agent/trace.ts`
- retrieve 相关节点实现
- tool execution / evidence 相关类型和写入逻辑

如果文件路径与实际仓库不一致，以当前仓库实际文件为准。

## Allowed Changes

优先只修改：

- `server/src/agent/graph.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/types.ts`
- 必要的 evidence helper / trace helper
- 与本任务直接相关的 `docs/project-control/` 文档更新

## Forbidden Changes

- Planner prompt
- `nextActionPlannerNode` 的核心决策逻辑
- `toolCallNormalizeNode` 的核心校验逻辑
- Harness registry
- MCP registry
- Provider Gateway
- UI
- 模型设置模块
- 沙箱能力
- 并发调度
- DAG scheduler

## Core Protocol

### 1. 行动结果必须进入 evidence

以下动作完成后，结果必须写入 `state.evidence`：

- `retrieve`
- `tool execution`
- `observation / preflight result`

写入 evidence 后，不得直接丢失执行事实。

### 2. 行动完成后必须回到 Planner

除非出现以下停止条件：

- `nextAction.type === "answer"`
- `nextAction.type === "ask_user"`
- `nextAction.type === "error"`
- `maxIterations reached`
- `fatal error`
- `approval required and waiting for user`

否则以下节点完成后应回到下一轮 Planner：

- `retrieveNode -> toolExposure / capabilityIntent -> nextActionPlannerNode`
- `toolNode -> toolExposure / capabilityIntent -> nextActionPlannerNode`

不得默认：

- `toolNode -> generate`
- `retrieveNode -> generate`

除非 Planner 下一轮明确输出 `answer`。

### 3. 每一轮 Planner 必须看到最新 evidence

下一轮 `nextActionPlannerNode` 的输入必须包含：

- 当前 `state.evidence`
- 最新 retrieval evidence
- 最新 tool execution result
- 当前 `iteration / maxIterations`
- 当前 `toolExposure` 或 `toolIntent.toolExposure`
- 当前 `taskFrame / plan`

不得让 Planner 在看不到上一步结果的情况下继续决策。

## Evidence Requirements

请优先复用当前项目已有类型。

如果当前已有：

```ts
AgentEvidencePayload
AgentObservation
AgentRetrievalEvidence
AgentToolExecutionResult
```

请不要新建一套平行 evidence schema。

可以最小补字段，但不要大规模重构。

### Tool Execution Evidence

工具执行完成后，evidence 中至少能追踪到：

```ts
{
  toolCallId?: string;
  toolId: string;
  inputHash?: string;
  status: "completed" | "failed" | "cancelled" | "timeout";
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
}
```

如果当前 `AgentToolExecutionResult` 已有等价字段，则复用。

如果缺少 `toolCallId` / `inputHash`，可最小增加字段，或至少写入 trace details。

不得把超大 `stdout / stderr / result` 全量塞进普通 state。

### Retrieval Evidence

retrieve 完成后，必须把 retrieval 结果写入 evidence。

至少包含：

```ts
{
  query: string;
  chunkCount: number;
  chunks: Array<...>;
}
```

如果当前已有 `AgentRetrievalEvidence`，请复用。

不得只把 retrieval 结果塞进临时变量后直接 `generate`。

### Observation Evidence

如果已有 observation 体系，请保持。

observation 用于记录：

- 工具前置检查结果
- 任务中间事实
- 文件存在性确认
- 错误观察
- 用户审批等待状态

不要为了本任务新增复杂 observation 系统；只保证已有 evidence 不丢。

### De-duplication

如果 graph retry 或节点重入，避免重复写入同一条 evidence。

推荐按以下字段去重：

- tool execution: `toolCallId` 或 `inputHash + toolId + timestamp`
- retrieval: `query + chunk ids / retrieval id`
- observation: `stepId`

如果当前项目没有 id，至少不要在一次正常路径中重复 append 两次相同结果。

## Iteration And MaxIterations

必须保证 Agent Loop 有停止条件。

### Iteration 语义

一次 Planner 决策可以视为一轮 iteration。

推荐：

```text
进入 nextActionPlannerNode 前或执行 Planner 后递增 iteration
```

但请结合当前项目已有状态，不要引入两套 iteration。

### MaxIterations 规则

当：

```ts
state.iteration >= state.maxIterations
```

或项目当前等价判断成立时：

- 不得继续进入 `retrieve`
- 不得继续进入 `toolCallNormalize`
- 不得继续进入 `policyNode`
- 不得继续进入 `toolNode`

应进入：

- `generate`
- 或 `error`

并说明：

```text
已达到最大执行轮数，停止继续调用工具。
```

## Routing Requirements

### routeAfterNextAction

确保 `routeAfterNextAction` 行为如下：

```ts
switch (state.nextAction?.type) {
  case "answer":
    return "generate";

  case "retrieve":
    return "retrieve";

  case "use_tool":
    return "toolCallNormalize";

  case "ask_user":
    return "generate";

  case "error":
    return "error";

  default:
    return "error";
}
```

要求：

- `use_tool` 必须先进 `toolCallNormalize`
- 不得直接从 `use_tool` 进入 `policyNode`
- `error` 不得继续执行工具

### routeAfterNormalize

Normalize 成功：

```text
toolCallNormalize -> policyNode
```

Normalize 失败：

```text
toolCallNormalize -> error
```

判断条件必须保证：

```text
没有 pendingToolCall，不得进入 policyNode
```

### routeAfterPolicy

Policy allow：

```text
policyNode -> toolNode
```

Policy require approval：

```text
policyNode -> approvalNode / pending approval
```

Policy deny / skip / error：

```text
policyNode -> generate 或 error
```

不得进入 `toolNode`。

### routeAfterTool

`toolNode` 执行完成后：

```text
toolNode -> toolExposure / capabilityIntent -> nextActionPlannerNode
```

或者如果当前项目尚未拆出 `toolExposure` 节点，可先走：

```text
toolNode -> nextActionPlannerNode
```

但必须保证 Planner 能看到最新 evidence。

不得固定：

```text
toolNode -> generate
```

### routeAfterRetrieve

retrieve 完成后：

```text
retrieve -> toolExposure / capabilityIntent -> nextActionPlannerNode
```

或者：

```text
retrieve -> nextActionPlannerNode
```

但必须保证 Planner 能看到 retrieval evidence。

不得固定：

```text
retrieve -> generate
```

## Legacy Path Ban

必须确认以下旧路径不再作为执行入口：

```ts
capabilityIntent.selectedToolIds -> policyStep
selectedToolId -> toolNode
selectedCapabilityId -> policy / tool
```

如果这些字段仍用于 trace / diagnostics / tool exposure，可以保留。

但不得用于：

- 创建 `pendingToolCall`
- 进入 policy
- 进入 `toolNode`
- 执行工具

## Approval Pending Handling

如果 policy 进入 approval pending：

- 不得继续进入 `toolNode`
- 不得继续进入 Planner loop
- 应停止当前 run，等待用户审批
- 审批恢复后必须继续使用原 frozen `pendingToolCall`
- 审批恢复时至少对齐 `toolId`；如果已有 `inputHash`，则必须对齐 `inputHash`

本任务不要求重写 approval 系统，只保证 pending approval 不被 loop 绕过。

## Error Handling

以下情况必须进入 `error` 或安全 `generate`，不得继续工具执行：

- Planner 输出 `error`
- Normalize 失败
- Policy deny / error
- `toolNode` 无 `pendingToolCall`
- `toolNode` policy 未 allow
- `maxIterations reached`
- evidence 写入失败
- route 状态不明

不得用自然语言兜底伪装成成功执行。

## Trace Requirement

接入后 trace 至少能看到以下节点或等价事件：

- `planNode`
- `toolExposure / capabilityIntent`
- `nextActionPlannerNode`
- `toolCallNormalizeNode`
- `policyNode`
- `toolNode`
- `retrieveNode`
- `evidence update`
- `iteration count`

重点 trace details 应包含：

```ts
{
  nextActionType,
  toolId,
  toolCallId,
  inputHash,
  policyDecision,
  toolExecutionStatus,
  retrievalChunkCount,
  evidenceCounts,
  iteration,
  maxIterations
}
```

不要把完整 `args / stdout / stderr / 大段 retrieval chunks` 塞进 trace details。

## Non-goals

本任务不要做：

- 不改 Planner prompt
- 不改 Normalize 校验逻辑
- 不重写 `policyNode`
- 不重写 `toolNode`
- 不重写 Harness
- 不做新的 scheduler
- 不做 DAG
- 不做并发工具调用
- 不做沙箱增强
- 不改 UI
- 不改模型设置
- 不做 capability -> tool 执行转换
- 不删除大批旧类型

## Acceptance Scenarios

### 场景 1：普通问答

用户输入普通问题。

期望：

```text
Planner -> answer
-> generate
```

验收：

- 不进入 `retrieve`
- 不进入 `toolCallNormalize`
- 不进入 `policy`
- 不进入 `toolNode`

### 场景 2：retrieve 后再回答

用户输入需要检索的问题。

期望：

```text
Planner -> retrieve
-> retrieve evidence update
-> Planner
-> answer
-> generate
```

验收：

- retrieve 结果进入 evidence
- retrieve 后不是直接 `generate`
- 第二轮 Planner 能看到 retrieval evidence

### 场景 3：工具调用后再回答

用户输入需要工具的问题。

期望：

```text
Planner -> use_tool
-> Normalize
-> Policy allow
-> ToolNode
-> tool execution evidence update
-> Planner
-> answer
-> generate
```

验收：

- tool result 进入 evidence
- `toolNode` 后不是固定 `generate`
- 第二轮 Planner 能看到 tool execution evidence
- `pendingToolCall` 已清理

### 场景 4：Normalize 失败

Planner 输出未暴露 `toolId`。

期望：

```text
Planner -> use_tool
-> Normalize failed
-> error / generate safe message
```

验收：

- 不进入 `policy`
- 不进入 `toolNode`
- 不执行任何工具

### 场景 5：Policy pending approval

高风险工具需要审批。

期望：

```text
Planner -> use_tool
-> Normalize
-> Policy require approval
-> pending approval
```

验收：

- 不进入 `toolNode`
- 不继续 Planner loop
- 等待用户审批

### 场景 6：maxIterations

构造一个持续 retrieve / use_tool 的场景。

期望：

```text
达到 maxIterations
-> stop
-> generate / error
```

验收：

- 不无限循环
- 超限后不再调用工具
- 输出停止原因

## Final Acceptance Criteria

1. retrieve 完成后结果写入 evidence。
2. `toolNode` 完成后结果写入 evidence。
3. retrieve 完成后回到 Planner，而不是固定 `generate`。
4. `toolNode` 完成后回到 Planner，而不是固定 `generate`。
5. Planner 下一轮能看到最新 evidence。
6. Normalize 失败不会进入 policy / tool。
7. Policy 未 allow 不会进入 `toolNode`。
8. Approval pending 不会继续 Planner loop。
9. `maxIterations` 生效。
10. `capabilityIntent.selectedToolIds` 不再能触发 policy / tool。
11. `selectedToolId` 不再能触发 `toolNode`。
12. trace 能看到 evidence update 和 iteration。
13. 本任务没有引入 scheduler / DAG / 并发 / 沙箱增强 / UI 改动。

## Verification

- `pnpm exec vitest run src/agent/graph.test.ts src/agent/tool-node.test.ts`
  - 执行目录：`server/`
  - 结果：通过，`2` 个测试文件、`13` 个测试通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过
- `pnpm package:electron:win`
  - 结果：命令成功完成并产出 `release/v0.7.1_20260704_014134/electron`
  - 补充说明：打包流程中的前端测试报告步骤暴露了当前分支既有失败项，但未阻断打包命令返回；详见下方 `Risks / Unfinished`

## Changed Files

- `server/src/agent/evidence.ts`
- `server/src/agent/graph.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/tool-node.ts`
- `docs/project-control/tasks/agent_node_T006-evidence-loop-routing.md`
- `docs/project-control/agent-nodes-workboard.md`

## Evidence

### Acceptance Criteria 1 / 2 / 12

- `server/src/agent/evidence.ts` 新增统一 evidence helper，集中处理 observation / retrieval / tool execution 写回和去重
- `server/src/agent/nodes.ts` 在 `retrieveNode` 写回 retrieval evidence 后追加 `agent-evidence-update-retrieve` trace event，details 带 `retrievalChunkCount / evidenceCounts / iteration / maxIterations`
- `server/src/agent/tool-node.ts` 在 completed / failed / awaiting_approval 三条工具结果路径写回 evidence 后追加 `agent-evidence-update-tool` trace event，details 带 `toolId / toolCallId / inputHash / toolExecutionStatus / evidenceCounts / iteration / maxIterations`

### Acceptance Criteria 3 / 4 / 5 / 9

- `server/src/agent/graph.ts` 继续保持 `retrieve -> toolSelectStep -> nextActionPlanner` 与 `tool -> toolSelectStep -> nextActionPlanner` 的回路
- `server/src/agent/graph.ts` 补齐 `routeAfterTool` 的 `maxIterations` 截止分支，超限后不再继续进入下一轮能力选择
- `server/src/agent/graph.ts` 把 `routeAfterNextAction` 默认分支改为 `error`，避免未知动作落到伪 `generate`

### Acceptance Criteria 6 / 7 / 8 / 10 / 11

- `server/src/agent/graph.test.ts` 已覆盖：
  - 普通 `answer` 不进入 normalize / policy / tool
  - `retrieve` 后回到 Planner 再回答
  - `use_tool` 必经 normalize，再进入 policy / tool
  - normalize 失败不进入 policy / tool
  - `selectedToolIds` 旧入口不能绕过 Planner 和 normalize
  - `maxIterations` 到达后不再发起第二次 retrieve
- `server/src/agent/tool-node.test.ts` 已覆盖：
  - `toolNode` 只执行 frozen `pendingToolCall`
  - 缺失 `pendingToolCall` 时阻断
  - `selectedToolId` 漂移不会影响真实执行对象
  - Harness 返回 `awaiting_approval` 时保留 frozen `pendingToolCall`
  - policy 未 allow 时不执行工具

## Risks / Unfinished

- 本任务没有改 Planner prompt、Normalize 核心校验、policyNode 核心审批逻辑、Harness、UI、模型设置、沙箱、并发或 DAG
- `pnpm package:electron:win` 虽然成功返回，但打包流程中的测试报告步骤暴露了当前分支既有失败项，不属于本任务改动范围，主要包括：
  - `desktop` 既有测试失败：`src/shared/uchat/ui/UChatSidebarView.test.tsx`
  - `server` 既有缺依赖 / 缺文件：`xlsx`、`src/mcp/harness/sandbox.ts`、`thread-request-context-web-search.resolver.js`
  - 其他与本任务无关的既有断言失败：`bootstrap-env`、`agent/persistence`、`thread.service`、`rag-nodes/generate.service`
- 本次没有完成 packaged app 启动后的 `/health` 手测，因为打包命令只生成产物，没有自动拉起桌面应用与 bundled backend

## One-line Principle

```text
行动 -> 证据 -> 再决策
```

不要让任何旧 `capability / selectedToolId` 路径绕过 Planner、Normalize、Policy、ToolNode。
