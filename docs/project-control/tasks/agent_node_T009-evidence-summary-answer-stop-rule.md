---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: AgentEvidenceSummaryAnswerStopRule
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T006-evidence-loop-routing.md
  - docs/project-control/tasks/agent_node_T007-decision-loop-acceptance-regression-guardrails.md
  - server/src/agent/graph.ts
  - server/src/agent/nodes.ts
  - server/src/agent/evidence.ts
  - server/src/agent/types.ts
  - server/src/agent/tool-node.ts
  - server/src/agent/next-action-planner.ts
  - server/src/agent/tool-call-normalize.ts
task_state: READY_FOR_REVIEW
---

# agent_node_T009 evidence summary and answer stop rule

## Target

本任务只定义并约束以下 5 件事：

1. `Evidence Summary` 最小协议
2. `Answer Stop Rule`
3. Planner 可读的 evidence 摘要输入
4. `read_list / read_open / web_search / terminal_session` 的最小 summary schema
5. trace 中“为什么 answer / 为什么继续 / 为什么停止”的可审计表达

本任务只做任务卡，不改实现代码，不改测试，不改 Harness，不改 UI。

## Current V1 Invariants

必须保持以下 V1 不变量不变：

1. Planner 只输出 `nextAction`
2. Normalize 只把 `nextAction.use_tool` 冻结成 `pendingToolCall`
3. Policy 只审批 `pendingToolCall`
4. ToolNode 只执行 `pendingToolCall`
5. `capabilityIntent.selectedToolIds` 不得直通 policy / tool
6. `selectedToolId` 只允许 legacy / UI / trace 兼容，不得作为执行入口
7. retrieve / tool 结果必须进入 evidence
8. 行动后必须回到 Planner 再决策
9. 错误、审批等待、`maxIterations` 不得继续执行工具

## Required Reading

工作前必须阅读当前仓库真实代码，不要凭空设计：

- `server/src/agent/graph.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- `server/src/agent/tool-node.ts`
- `server/src/agent/next-action-planner.ts`
- `server/src/agent/tool-call-normalize.ts`
- `docs/project-control/tasks/agent_node_T006-evidence-loop-routing.md`
- `docs/project-control/tasks/agent_node_T007-decision-loop-acceptance-regression-guardrails.md`
- `docs/project-control/agent-nodes-workboard.md`

## Current Problem

当前真实代码已经具备以下事实：

- `toolNode` 已能把工具执行结果写入 `state.evidence.toolExecutions`
- `retrieveNode` 已能把检索结果写入 `state.evidence.retrievals`
- `graph.ts` 已保证 `toolNode / retrieveNode` 完成后回到 Planner，而不是固定直接 `generate`
- 但 `next-action-planner.ts` 当前传给 Planner 的 `evidenceSummary` 只有计数和弱摘要：
  - `observationCount / toolExecutionCount / retrievalCount`
  - `latestObservation`
  - `latestToolExecution`
  - `latestRetrieval`
- 当前 `latestToolExecution` 只包含 `toolId / status / errorMessage`
- 当前 `latestRetrieval` 只包含 `query / chunkCount / documents`
- 当前 Planner 看不到“这个结果是否已经足够回答”的稳定字段
- 当前 `generateNode` 仍可能吃到完整 `tool execution.result` JSON；这不是 Planner 收口所需的稳定协议

### Current Code Locations

- `server/src/agent/tool-node.ts`
  - completed / failed / awaiting_approval 结果都会写入 `appendToolExecutionEvidence(...)`
  - trace 会发 `agent-evidence-update-tool`
- `server/src/agent/nodes.ts`
  - `retrieveNode` 会写入 `appendRetrievalEvidence(...)`
  - trace 会发 `agent-evidence-update-retrieve`
- `server/src/agent/evidence.ts`
  - 当前只负责 evidence append 与去重
  - 还没有独立的 evidence summary 结构
- `server/src/agent/next-action-planner.ts`
  - `summarizePlannerEvidence(...)` 仅返回弱摘要
  - `buildNextActionPlannerMessages(...)` 直接把弱摘要发给 Planner
- `server/src/agent/graph.ts`
  - `routeAfterTool` 与 `routeAfterRetrieve` 当前只依据 `error / pendingApproval / maxIterations` 决定下一跳
  - 还没有 answer stop rule 的正式边界说明
- `server/src/agent/types.ts`
  - 当前有 `AgentEvidencePayload / AgentToolExecutionResult / AgentRetrievalEvidence / AgentObservation`
  - 还没有 `AgentEvidenceSummary` 类型

## Allowed Changes

后续实现任务优先只允许修改：

- `server/src/agent/types.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/next-action-planner.ts`
- `server/src/agent/graph.ts`
- `server/src/agent/tool-node.ts`
- `server/src/agent/nodes.ts`
- agent 相关定向测试
- 必要的 trace helper
- 与本任务直接相关的 `docs/project-control/` 文档

## Forbidden Changes

本任务及后续对应实现必须明确禁止：

- 不做 Agent V2
- 不做 DAG scheduler
- 不做并发工具调用
- 不做多智能体
- 不做长期记忆系统
- 不大改 Harness 架构
- 不急着接 MCP marketplace
- 不改 MCP registry
- 不改 Provider Gateway
- 不改 UI
- 不改模型配置模块
- 不让 `capabilityIntent.selectedToolIds` 直通 policy / tool
- 不让 `selectedToolId` 成为执行入口
- 不让 ToolNode 直接决定 answer
- 不把 full result 全量塞进 Planner

## Design Boundary

### 1. 不新增平行 evidence 系统

必须优先复用现有：

- `AgentEvidencePayload`
- `AgentObservation`
- `AgentRetrievalEvidence`
- `AgentToolExecutionResult`

允许最小新增 `summary` 字段或独立 summary type。

不允许再并行引入一套大型 evidence store。

### 2. Answer Stop Rule 不是 ToolNode 直答

收口判断不能让 `toolNode` 直接进入 `generate`。

必须保持：

```text
ToolNode -> evidence update -> Planner
```

收口判断应发生在以下三类位置之一：

- Planner 输入准备
- Planner 前置规则
- Planner 输出后置校验

具体实现位置由后续实现任务决定，本任务卡只定义边界和验收。

### 3. Planner 只能看 summary，不吃 full result

Planner 需要的是稳定、可比较、可审计的 evidence summary。

Planner 不应依赖：

- 完整目录列表原文
- 完整文件全文
- 完整搜索 provider 原始响应
- 完整 terminal stdout / stderr
- 完整工具 result JSON

这些原始数据可以保留在 evidence raw payload 或 generate 阶段使用，但不应成为 Planner 收口协议本体。

## Evidence Summary Protocol

建议最小协议如下；命名可按当前类型微调，但语义必须保留：

```ts
type AgentEvidenceSummary = {
  source: "tool" | "retrieval" | "observation";
  status: "completed" | "failed" | "awaiting_approval" | "partial" | "blocked";
  toolId?: string;
  inputHash?: string;
  actionTaken: string;
  keyFindings: string[];
  answerReadiness: {
    canAnswer: boolean;
    reason: string;
    missingInfo?: string[];
  };
  rawRef?: {
    evidenceIndex?: number;
    toolCallId?: string;
    invocationId?: string;
  };
};
```

### Required Semantics

- `source`
  - 标记该摘要来自 `tool / retrieval / observation`
- `status`
  - 只表达当前证据状态，不表达路由动作
- `actionTaken`
  - 用一句人话说明刚刚完成了什么
- `keyFindings`
  - 只放能支持 Planner 收口判断的事实
- `answerReadiness.canAnswer`
  - 表示基于当前这条最新证据，是否已足够进入回答
- `answerReadiness.reason`
  - 说明为什么能回答或为什么还不能回答
- `answerReadiness.missingInfo`
  - 明确下一步若要继续，应补什么，而不是泛泛说“信息不足”
- `rawRef`
  - 指向原 evidence，便于 trace 和 generate 回查

## Tool Summary Minimum Schema

至少覆盖以下 4 类工具摘要。

### read_list

最小摘要必须能表达：

- `path` 或 `uri`
- `entryCount`
- `fileCount`
- `directoryCount`
- `entriesPreview`
- `truncated`
- `canAnswerDirectoryQuestion`

### read_open

最小摘要必须能表达：

- `path` 或 `uri`
- `contentPreview`
- `contentLength`
- `truncated`
- `keySections` 可选
- `canAnswerFileQuestion`

### web_search

最小摘要必须能表达：

- `query`
- `resultCount`
- `topFindings`
- `citations` 或 `sourcesPreview`
- `canAnswerSearchQuestion`

### terminal_session

最小摘要必须能表达：

- `command`
- `exitCode`
- `stdoutPreview`
- `stderrPreview`
- `timedOut`
- `canAnswerCommandQuestion`

## Planner Input Requirement

Planner 下一轮至少必须看得到：

- `latestEvidenceSummary`
- `latestEvidenceSummary.source`
- `latestEvidenceSummary.status`
- `latestEvidenceSummary.answerReadiness.canAnswer`
- `latestEvidenceSummary.answerReadiness.reason`
- `latestEvidenceSummary.answerReadiness.missingInfo`
- 当前 `iteration / maxIterations`
- 当前 `pendingApproval`
- 当前 `errorMessage`

如果保留当前 `evidenceSummary` 总量计数，也只能作为辅助，不得替代最新 evidence summary。

## Answer Stop Rule

当最新 `completed` evidence summary 同时满足以下条件时：

1. `answerReadiness.canAnswer === true`
2. 没有 `pendingApproval`
3. 没有 `errorMessage`
4. 没有明确 `missingInfo`
5. 没有必须继续调用工具的用户意图
6. 没有 `maxIterations` 继续执行空间要求

则下一步必须进入 `answer / generate`，不得继续 `use_tool / retrieve`。

### Rule Notes

- 这条规则不是让 ToolNode 直接 `generate`
- 这条规则是对 Planner 收口的约束，不是替代 Planner
- 命中 answer stop rule 后，不再二次调用 `nextActionPlanner` 的 task model
- 命中 answer stop rule 后，不再二次执行相同工具，也不再进入 `use_tool / retrieve` 的重复执行链路
- 当前 graph 仍可能再次经过 `toolSelectStep / toolGuardStep`
- 当前前台 trace 仍可能出现候选选择节点；这不属于 T009 失败
- 如果 `failed / awaiting_approval / blocked`，默认不满足 `canAnswer === true`
- 若用户问题本身是在问“命令失败了什么”或“为什么审批等待”，后续实现可以允许基于失败状态回答，但必须在任务实现中明确单独规则，不能默认放开

## Trace Requirements

trace 至少能看到：

- evidence summary 生成完成
- `latestEvidenceSummary` 类型
- `answerReadiness.canAnswer`
- `answerReadiness.reason`
- answer stop rule 是否触发
- 如果继续调用工具，要说明 `missingInfo` 或继续理由
- 如果停止回答，要说明基于哪条 evidence

不要把 full result 全量塞进 trace。

## Acceptance Scenarios

### 场景 1：read_list 后回答

用户问：

“看看当前 workspace 有哪些文件”

期望：

```text
Planner -> use_tool(read_list)
-> Normalize
-> Policy allow
-> ToolNode completed
-> Evidence Summary canAnswer = true
-> Planner / answer stop rule
-> answer
-> generate
```

验收：

- `read_list` 只执行一次
- evidence 中有 `read_list summary`
- Planner 能看到 `entryCount / entriesPreview / canAnswer`
- 不得再次调用 `read_list`

### 场景 2：read_open 后回答

用户问：

“打开 README.md 看看内容”

期望：

- `read_open` completed 后 summary 包含 `contentPreview`
- `answerReadiness.canAnswer = true`
- 下一步 answer
- 不重复 `read_open`

### 场景 3：web_search 后回答

用户问需要联网搜索的问题。

期望：

- `web_search` completed 后 summary 包含 `topFindings / citations preview`
- evidence 足够时 answer
- 不重复相同 query 的 `web_search`

### 场景 4：terminal_session 后回答

用户要求执行明确命令并查看结果。

期望：

- `terminal_session` completed 后 summary 包含 `exitCode / stdoutPreview / stderrPreview / timedOut`
- 如果结果足够说明命令结论，下一步 answer
- 如果 `failed / timedOut`，需要说明失败或不足

### 场景 5：failed / awaiting_approval 不误判

期望：

- `failed` 不得 `canAnswer = true`，除非问题只是在询问失败状态
- `awaiting_approval` 不得继续 Planner loop
- approval waiting 不得进入 `toolNode`
- error 不得继续调用工具

### 场景 6：maxIterations

期望：

- 达到 `maxIterations` 后不再进入 `retrieve / normalize / policy / tool`
- trace 明确说明停止原因
- 可以 `generate` 基于已有 evidence 的保守回答

## Final Acceptance Criteria

1. 当前 evidence 原始载体继续复用现有 `AgentEvidencePayload`
2. 新增或约定统一 `AgentEvidenceSummary` 协议，不引入平行大型系统
3. Planner 下一轮必须可读最新 evidence summary，而不只看到 completed 计数
4. `read_list / read_open / web_search / terminal_session` 都有最小 summary schema
5. `answerReadiness` 字段必须能表达能否回答、为什么、缺什么
6. 当 answer stop rule 命中时，下一步必须 answer，不得重复工具调用
7. `awaiting_approval / error / maxIterations` 不得被误判为可继续工具执行
8. trace 必须能审计为什么 answer、为什么继续、为什么停止
9. 本任务不改 V1 执行入口边界，不引入 Agent V2、DAG、并发、多智能体、长期记忆或 Harness 大改

## T010 Reserved Boundary

本任务只做 `Evidence Summary + Answer Stop Rule`。

`Repeated Tool Guard` 不在 T009 实现。

后续任务：

`agent_node_T010-repeated-tool-guard`

目标是阻止相同 `toolId + normalized args / inputHash` 的无意义重复调用。

T009 不实现 T010，只预留边界。

## Delivery Rule

本任务是否可标记 `DONE`，取决于后端定向验证与前台 black-box smoke test 是否同时满足。

## Implementation Result

本次实现已完成以下收口：

1. 在现有 `AgentEvidencePayload` 上补入 `latestSummary`，没有新建平行 evidence 系统
2. 在 `AgentObservation / AgentRetrievalEvidence / AgentToolExecutionResult` 上补入可审计的 `summary`
3. 为 `read_list / read_open / web_search / terminal_session` 接入最小 summary schema
4. 在 `nextActionPlannerNode` 前置接入 answer stop rule
5. 让 Planner 在 stop rule 命中时直接输出 `answer`，不再二次调用 `nextActionPlanner` 的 task model
6. 在 retrieval / tool evidence update trace 中暴露 `latestEvidenceSummary`
7. 保持 `Planner -> Normalize -> Policy -> ToolNode -> Evidence -> Planner` 边界不变

本任务不修改前端组件、trace UI、状态映射、样式和 i18n。前台展示可读性单独拆到：

- `agent_node_T012-frontend-status-mapping`
- `agent_node_T013-trace-readability`

## Known Limitation

- `state.evidence.toolExecutions[n].summary` 已接入
- `state.evidence.latestSummary` 已接入
- `state.lastToolExecution.summary` 可能仍为空
- 当前 answer stop rule 依赖 `state.evidence.latestSummary`，不依赖 `state.lastToolExecution.summary`
- 该问题不阻断 T009，后续可在 `T010 / T011` 或 evidence cleanup 中统一处理

## Manual Smoke Test

### Smoke 1: read_list workspace overview

Input:

```txt
看看当前 workspace 有哪些文件
```

Expected:

- final answer generated
- `read_list` executed once
- no repeated `read_list`
- no tool loop until failure

Observed:

- result: `FAIL`
- evidence source: frontend execution nodes / trace event
- notes: `2026-07-04` 在 `http://127.0.0.1:5173/#/chat` 前台手测；线程已绑定 `T009 Smoke Workspace -> D:\workspace\rag-demo` 并开启 Agent，但在进入工具执行前即显示 `Planner output was invalid JSON; planner must stop instead of pretending an answer is ready.`。前台步骤停在 `5 / 6`，显示 `准备上下文 -> 执行计划 -> 候选选择 -> 调用前守卫 -> 执行计划 -> 错误节点`，未出现 `read_list` 执行节点，也没有最终回答。

### Smoke 2: read_open file content

Input:

```txt
打开 README.md 看看内容
```

Expected:

- final answer generated
- `read_open` executed once
- no repeated `read_open`

Observed:

- result: `FAIL`
- evidence source: frontend execution nodes / trace event
- notes: 与 Smoke 1 相同，前台在工具执行前失败于 `Planner output was invalid JSON`；未出现 `read_open` 执行节点，没有最终回答。

### Smoke 3: file content should not stop at read_list

Input:

```txt
看看 README.md 的内容
```

Expected:

- if `read_list` runs first, it must not be treated as enough
- agent should continue toward `read_open`, or otherwise explain missing content
- must not answer as if README content was read when only directory listing exists

Observed:

- result: `FAIL`
- evidence source: frontend execution nodes / trace event
- notes: 前台仍在工具执行前失败于 `Planner output was invalid JSON`；既没有错误地把目录列表当成文件内容，也没有继续到 `read_open`，因此该场景当前无法证明 T009 收口链路在前台真实可用。

### Smoke 4: terminal approval waiting

Input:

```txt
执行 dir 命令看看结果
```

Expected:

- if terminal requires approval, run enters `waiting_approval`
- must not continue Planner loop
- must not generate answer pretending command was executed

Observed:

- result: `FAIL`
- evidence source: frontend execution nodes / trace event
- notes: 前台同样在工具执行前失败于 `Planner output was invalid JSON`，没有进入 `terminal_session`，也没有到达 `waiting_approval`。

## Changed Files

- `server/src/agent/types.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/next-action-planner.ts`
- `server/src/agent/tool-node.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/graph.test.ts`
- `server/src/agent/next-action-planner.test.ts`
- `docs/project-control/tasks/agent_node_T009-evidence-summary-answer-stop-rule.md`
- `docs/project-control/agent-nodes-workboard.md`

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/next-action-planner.test.ts src/agent/tool-node.test.ts src/agent/policy.test.ts src/agent/tool-call-normalize.test.ts`
  - 结果：通过，`65 passed`
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过
- 前台 black-box smoke test
  - 结果：失败，`2026-07-04` 在内置浏览器登录账号 `Tomz` 下执行 4 条手测，线程绑定 `T009 Smoke Workspace -> D:\workspace\rag-demo` 后均在工具执行前失败于 `Planner output was invalid JSON`

## Review Outcome

- 当前提交结论：后端定向实现与测试证据成立，前台 black-box smoke test 未通过
- 当前状态：`READY_FOR_REVIEW`
