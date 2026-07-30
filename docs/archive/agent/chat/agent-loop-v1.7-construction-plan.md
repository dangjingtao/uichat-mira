Status: Current
Owner: chat / runtime / product
Last verified: 2026-07-06
Layer: raw-source
Module: Chat
Feature: AgentLoopV17
Doc Type: implementation-plan
Canonical: true
Related:
  - agent-runtime-design.md
  - agent-phase-2-checklist.md
  - agent-phase-3-checklist.md
  - ../harness/agentgraph-harness-protocol.md
  - ../concepts/CONCEPT_AGENT.md

# Agent Loop v1.7：Planner-Executor Observation Loop 施工总文件

> 给 Codex 执行官使用。先对齐颗粒度，再拆卡施工。
> 本文件目标：把 v1.7 收敛成一套可落地、可验收、不可发散的大纲。

---

## 0. 本期一句话

用户给目标，Agent 能自己推进；中间失败不会死；高风险动作会问；最后给完整结果。

---

## 1. 本期目标

本期不是重做 Agent，不是大型计划系统，也不是复杂 Plan-and-Solve。

本期只做一件事：

> 让 `PlannerNode` 成为真正的“下一步动作决策器”；让所有执行结果，无论成功、失败、等待审批、阻断，都结构化回流给 `PlannerNode`，由 `PlannerNode` 决定下一步。

当前系统已有：

- `nextActionPlannerNode`
- `toolSelectNode`
- `toolGuardNode`
- `toolCallNormalize`
- `policyNode`
- `approvalNode`
- `toolNode`
- `retrieveNode`
- `generateNode`
- `evaluateNode`
- `evidence`
- `observations`
- `lastToolExecution`
- `iterationCount / maxIterations`

本期不是新增一套 Agent，而是把现有链路改成：

```text
NextAction → Execute → Observation → NextAction
```

核心心智：

```text
PlannerNode 负责决定下一步。
Executor 负责执行动作。
Executor 不直接决定终局。
所有结果先变成 Observation / Evidence。
下一步仍由 PlannerNode 决定。
```

---

## 2. 非目标

本期明确不做：

```text
大型计划机
Plan Builder
Step DAG
复杂任务树
长期任务状态系统
多 Agent 协作
复杂自动修复框架
长期 memory
自动无审批写文件
自动无审批跑终端
```

本期也不要求 `PlannerNode` 生成完整计划。

`PlannerNode` 仍然只输出下一步动作：

```text
answer
retrieve
use_tool
ask_user
error
```

---

## 3. 最终架构定义

下一步动作由 `PlannerNode` 决策；
动作由现有 Executor 节点执行；
执行结果统一写入 `Observation / Evidence`；
`Observation` 回流给 `PlannerNode`；
`PlannerNode` 基于结果继续决定 `answer / retrieve / use_tool / ask_user / error`；
高风险动作始终受 `Policy / Approval` 约束。

一句话：

> 用户给目标，Agent 能自己推进；中间失败不会死；高风险动作会问；最后给完整结果。

---

## 4. 关键角色定义

### 4.1 PlannerNode

`PlannerNode` 是下一步动作决策器，不是计划生成器。

职责：

```text
基于当前 question、currentTaskFrame、PlannerObservationContext、toolExposure、iteration、pendingApproval 等状态，决定下一步动作。
```

它不直接执行工具，不直接写文件，不直接绕过 policy。

---

### 4.2 Executor

Executor 是动作执行层。

当前可以先不新增一个物理 `executorNode`，而是把现有节点按 Executor 职责理解：

```text
retrieveNode = retrieve executor
toolNode = tool executor
generateNode = answer executor
approvalNode = approval pause/resume gate
```

本期优先不新增大节点，除非实现上必须抽象公共 result。

---

### 4.3 Observation

`Observation` 是执行结果。

所有动作执行后都应该产生结构化结果。

最小状态枚举：

```ts
type AgentExecutionObservationStatus =
  | "completed"
  | "failed_recoverable"
  | "failed_terminal"
  | "waiting_approval";
```

建议最小结构：

```ts
interface AgentExecutionObservation {
  id: string;
  actionType: "retrieve" | "tool" | "generate" | "ask_user" | "approval";
  status: "completed" | "failed_recoverable" | "failed_terminal" | "waiting_approval";
  summary: string;
  createdAt: string;

  toolId?: string;
  toolCallId?: string;
  inputHash?: string;
  argsPreview?: unknown;

  resultPreview?: unknown;
  errorMessage?: string;
  errorCode?: string;

  recoverable?: boolean;
  suggestedNextActions?: string[];
}
```

---

## 5. currentTaskFrame 颗粒度

`currentTaskFrame` 不是大型计划，不是 Step DAG，也不是任务树。

它只是当前任务状态板。

### 5.1 最小包含字段

```ts
interface CurrentTaskFrame {
  currentGoal: string;
  currentSubtask?: string;
  currentBlocker?: string;
  confirmedObjects?: Array<{
    type: "file" | "command" | "tool" | "script" | "knowledge" | "approval";
    id?: string;
    label: string;
    confidence?: number;
  }>;
  completionCriteria?: string[];
}
```

最小语义：

- `currentGoal`：当前用户目标。
- `currentSubtask`：当前正在推进的子任务。
- `currentBlocker`：当前阻塞点；没有则为空。
- `confirmedObjects`：当前已确认对象，例如已确认文件路径、脚本名、工具对象、审批对象。
- `completionCriteria`：本轮任务完成判据。

### 5.2 哪些节点更新它

必须明确写入权，否则会乱。

建议：

- `prepareContextNode`：可以初始化 `currentTaskFrame`，但不做复杂推理。
- `nextActionPlannerNode`：主更新者，可以更新 `currentSubtask / currentBlocker / completionCriteria`。
- `toolNode / retrieveNode`：不直接推理任务，只根据执行结果补 `confirmedObjects` 或 `currentBlocker`。
- `generateNode / evaluateNode`：只读 `currentTaskFrame`，用于最终回答和检查，不作为主要写入方。

更严格定义：

```text
PlannerNode 是 currentTaskFrame 的主更新者。
Executor 节点只能追加客观执行结果。
Generate/Evaluate 节点只读。
```

---

## 6. 统一 Observation 入口

这里必须定死，避免 `observation / evidence / lastToolExecution / pendingApproval` 多套并行失控。

本期定义：

```text
PlannerNode 的统一观察入口是 PlannerObservationContext。
```

也就是说：

- `lastToolExecution` 是兼容字段 / 快捷字段，不是 Planner 的主入口。
- `evidence` 是生成回答和证据检查用的材料库，不是 Planner 的唯一观察入口。
- `observations` 是历史事件日志，不应该让 PlannerNode 自己到处翻。
- `pendingApproval` 是审批状态，也应该进入统一观察视图。

必须实现或明确一个函数：

```ts
buildPlannerObservationContext(state): PlannerObservationContext
```

它负责把以下内容统一整理成 PlannerNode 可读输入：

- `lastToolExecution`
- `evidence.toolExecutions`
- retrieval evidence
- approval state
- `schemaReplanDiagnostics`
- `currentTaskFrame`
- recent observations
- recovery attempt 状态

`PlannerNode` 不应该自己到处翻 state 字段。

建议最小结构：

```ts
interface PlannerObservationContext {
  currentTaskFrame?: CurrentTaskFrame;
  latestObservation?: AgentExecutionObservation;
  recentObservations: AgentExecutionObservation[];
  latestEvidenceSummary?: string;
  recovery: {
    attemptCount: number;
    maxAttempts: number;
    exhausted: boolean;
  };
  pendingApproval?: {
    toolId: string;
    inputHash?: string;
    reason: string;
  };
}
```

本期允许复用现有 `evidence / observations / lastToolExecution` 存储结构，但必须给 `PlannerNode` 提供统一观察入口。

禁止让 `PlannerNode` 同时直接依赖三套分散状态：

```text
不要让 PlannerNode 一会儿看 lastToolExecution，
一会儿看 evidence，
一会儿看 observations，
一会儿看 pendingApproval。
```

正确做法：

```text
state → buildPlannerObservationContext → PlannerNode prompt
```

最终心智：

```text
Executor 写客观结果；
ObservationContext 整理结果；
PlannerNode 基于 ObservationContext 决策。
```

工程原则：

> 可以复用旧字段存储，但 PlannerNode 必须只面向一个统一观察视图。

---

## 7. 沙盒终端定位

本版本中，`sandbox terminal / terminal_session` 是 Agent 的主力工程执行工具。

它主要用于：

- 搜索 workspace
- 查看目录结构
- 读取非敏感文件片段
- 运行测试、typecheck、lint、build
- 收集 stdout / stderr / exitCode
- 根据失败结果继续推进

但它不是唯一工具，也不是绕过 Policy 的通道。

规则：

1. 终端执行必须进入 `Planner-Executor Observation Loop`。
2. 每次终端执行结果，无论成功或失败，都必须写入 `Observation / Evidence`。
3. 终端失败默认视为 `failed_recoverable`，除非是安全阻断、协议错误或达到恢复上限。
4. 新命令、新 cwd、新 env、新 timeout、新 sessionMode 都必须重新经过 `Policy / Approval`。
5. 不允许用终端绕过结构化写文件审批。
6. 对用户可见的 trace 必须展示命令、状态、摘要、失败原因和下一步动作。

闭环位置：

```text
PlannerNode
  ↓
use_tool: terminal_session
  ↓
Policy / Approval
  ↓
Sandbox Terminal Executor
  ↓
Observation:
  - command
  - cwd
  - exitCode
  - stdoutPreview
  - stderrPreview
  - timedOut
  - status
  ↓
PlannerNode 再决策
```

关键原则：

> terminal 不是绕过架构的万能入口。terminal 只是 Executor。它执行完必须把结果交还 PlannerNode。

---

## 8. 状态设计

### 8.1 最小新增状态

建议在 `AgentGraphState` 增加或明确使用：

```ts
currentTaskFrame?: CurrentTaskFrame;
plannerObservationContext?: PlannerObservationContext;
recoveryAttemptCount?: number;
maxRecoveryAttempts?: number;
lastObservation?: AgentExecutionObservation;
```

如果不想新增 `lastObservation`，也可以先通过 `buildPlannerObservationContext` 从现有字段整理。

但必须保证：

```text
PlannerNode 从 PlannerObservationContext 读观察，不直接散读多个字段。
```

默认：

```ts
maxRecoveryAttempts = 2;
```

MVP 先用 `2`，因为一个失败后可能需要：

```text
第一次失败 → 读取辅助信息 → 第二次执行正确动作
```

---

### 8.2 failed_recoverable 判断

工具失败不要默认 terminal。

建议默认策略：

```text
Harness invocation failed，但 AgentGraph 本身没有崩溃 → failed_recoverable
schema/approval mismatch/security violation/policy deny → failed_terminal 或 blocked
maxRecoveryAttempts exhausted → failed_terminal 或 answer with failure explanation
```

例子：

```text
file not found → recoverable
missing script → recoverable
command exitCode != 0 → recoverable
permission denied → recoverable 或 ask_user，视工具风险
approval mismatch → terminal/blocked
policy denied → terminal/blocked
tool protocol broken → terminal
```

---

## 9. 路由设计

### 9.1 当前问题路由

当前类似：

```text
toolNode failed → errorMessage set → routeAfterTool → error
```

这要改。

### 9.2 目标路由

目标：

```text
routeAfterTool(state):
  if state.pendingApproval:
    return approval

  if latest observation is failed_recoverable:
    if recoveryAttemptCount < maxRecoveryAttempts:
      return toolSelectStep 或 nextActionPlanner
    else:
      return generate 或 error

  if state.errorMessage and terminal:
    return error

  if iteration limit reached:
    return generate

  return toolSelectStep 或 nextActionPlanner
```

为了保持现有心智，MVP 推荐先走现有链路：

```text
tool → toolSelectStep → toolGuardStep → nextActionPlanner
```

理由：

- 少改图。
- 保持工具候选更新。
- 失败后 query/reviewNotes 可以参与候选选择。

---

## 10. ToolNode 改造

### 10.1 当前失败行为

当前 `toolNode` 在 Harness invocation 非 completed 时，会写 failed observation / failed evidence / lastToolExecution，但同时设置类似：

```ts
policyDecision: { type: "error" };
errorMessage;
errorSourceNodeId: "agent-tool";
continueIteration: false;
postToolReviewPending: false;
```

这会导致直接终止。

### 10.2 目标失败行为

对可恢复失败：

```ts
return {
  lastToolExecution: failedExecutionRecord,
  evidence: appendFailedToolExecution(...),
  observations: appendFailedObservation(...),
  lastObservation: failedRecoverableObservation,
  recoveryAttemptCount: state.recoveryAttemptCount + 1,
  errorMessage: undefined,
  errorSourceNodeId: undefined,
  continueIteration: true,
};
```

注意：

- 不要把 recoverable failure 写成全局 `errorMessage`。
- 不要让 recoverable failure 进入 `error` route。
- 必须保留失败原因给 `PlannerObservationContext`。
- 必须能在 trace 里看到失败。

对 terminal failure：

```ts
return {
  errorMessage,
  errorSourceNodeId: "agent-tool",
  blockedReason,
  terminalReason,
};
```

---

## 11. PlannerNode 改造

### 11.1 PlannerNode 输入必须包含统一观察视图

`PlannerNode` 的 prompt/context 应该接收：

```ts
plannerObservationContext: PlannerObservationContext
```

其中必须包含：

```text
上一次动作是什么
toolId 是什么
args/inputHash 是什么
失败原因是什么
stderr/exitCode/errorMessage 是什么
是否 recoverable
已经恢复了几次
最多还能恢复几次
当前目标、当前子任务、当前阻塞点、已确认对象、完成判据
```

不要把完整 stdout/stderr 全塞进去，做 preview。

### 11.2 Planner prompt 加推进规则

在 PlannerNode prompt 中补充规则：

```text
你是下一步动作决策器。
你必须根据 PlannerObservationContext 决定下一步。
如果工具失败但可恢复，不要默认 error。
你可以：
- 换参数重试同一工具
- 换另一个工具
- 读取辅助文件或目录
- ask_user
- answer with failure explanation
- error terminal

任何 use_tool 都只是提出动作，后续必须经过 normalize / policy / approval。
不要假装工具成功。
不要重复同一个失败调用，除非有明确 retry reason。
当恢复次数耗尽时，给出明确失败结论，而不是无限循环。
```

---

## 12. repeated action guard 调整

当前 repeated action guard 可能会阻止重复动作。

本期要求：

```text
禁止无理由重复同一失败调用。
允许有明确原因的 retry。
允许同一 toolId 但不同 args。
允许 terminal_session 同 command 但不同 cwd/env/timeoutMs/sessionMode。
允许瞬时失败的一次同参数 retry，但必须有 retryReason 且受次数限制。
```

MVP 可以先不支持同参数 retry，只支持：

```text
相同 toolId + 不同 args 可以继续
相同 toolId + 相同 inputHash 默认拦截
```

但如果拦截，必须让 Planner answer with failure explanation，而不是系统崩溃。

---

## 13. Policy / Approval 规则

本期必须保持：

```text
所有 use_tool 都必须重新走 toolCallNormalize → policyStep → approval/tool。
```

尤其是：

```text
terminal_session
edit_file
workspace_mutation
external side effect tools
```

规则：

```text
旧审批只适用于同一个 pendingToolCall / inputHash。
新参数、新命令、新工具，必须重新审批。
```

审批恢复仍走：

```text
resumeApprovedAgentRun
```

并校验：

```text
pendingApproval.toolId === pendingToolCall.toolId
pendingApproval.inputHash === pendingToolCall.inputHash
pendingApproval.toolCallId === pendingToolCall.id
```

不得因为失败恢复绕过审批。

---

## 14. 用户可见执行轨迹

本期不是只改内部逻辑，必须让用户看见推进。

执行节点应该展示类似：

```text
正在理解任务
正在查找相关文件
尝试读取 server/src/agent/planner.ts
读取失败：文件不存在
正在重新查找
找到 server/src/agent/planner/node.ts
正在读取文件
正在整理结论
```

对于命令：

```text
需要确认：运行 pnpm test
用户已批准
正在运行 pnpm test
执行失败：missing script test
正在读取 package.json
发现可用脚本 test:server / check
需要确认：运行 pnpm test:server
```

对于写文件：

```text
正在读取 README.md
正在生成修改
需要确认：写入 README.md
写入完成
正在运行验证
```

如果现有 execution node 已支持，只需要补充 node summary/details；不要做复杂 UI。

---

## 15. MVP 用户功能场景

本期完成后，用户应该看到 Agent 能自己推进，而不是一次工具失败就结束。

### 场景 A：自主源码审查

用户输入：

```text
帮我评估这个项目 Agent 闭环哪里还不完整
```

期望用户体验：

```text
系统自己查找 AgentGraph / Planner / Tool / Policy / Evidence
系统读取多个相关文件
系统基于已读证据输出缺口和建议
```

验收：

```text
用户没有提供具体路径。
系统至少完成 2 次以上自主 locate/read 或 terminal search/read。
最终回答说明查看了哪些模块。
如果第一次路径错误，系统会继续定位，不会直接失败结束。
```

---

### 场景 B：失败后自动推进检查

用户输入：

```text
帮我跑一下 Agent 相关测试
```

期望用户体验：

```text
系统请求批准运行测试命令。
如果 pnpm test 不存在，系统读取 package.json。
系统找到更相关脚本。
系统再次请求批准运行正确脚本。
系统分析结果并输出结论。
```

验收：

```text
第一次命令失败不结束。
失败后至少产生一个新的有效动作。
新高风险命令重新请求审批。
最终给出测试结论或明确卡点。
```

---

### 场景 C：小范围修复闭环

用户输入：

```text
修一下工具失败后直接终止的问题，做最小改动，并告诉我改了什么
```

期望用户体验：

```text
系统定位相关代码。
系统读取相关文件。
系统提出修改。
系统请求确认写入。
系统执行修改。
系统请求批准运行验证。
如果验证失败，系统继续修一次或给出明确卡点。
最终总结修改和验证结果。
```

验收：

```text
不能只给建议。
必须至少完成 read → edit proposal → approval → write/test 的闭环。
所有写入/终端动作都有审批。
成功或失败都给完整结果。
```

---

## 16. 黑盒测试建议

建议新增测试文件：

```text
server/src/agent/planner-executor-observation.blackbox.test.ts
```

或：

```text
server/src/agent/graph/planner-executor-observation.blackbox.test.ts
```

### Test 1：成功结果回 Planner

名称：

```text
returns successful tool execution to planner before final answer
```

目标：

```text
工具成功执行后，不由 toolNode 直接终结。
成功结果写入 evidence / observation。
PlannerNode 再次决策 answer。
最终 generate 基于 evidence 回答。
```

---

### Test 2：可恢复失败回 Planner

名称：

```text
returns recoverable tool failure to planner and continues with another action
```

目标：

```text
第一次 read_open 路径错误，或 terminal command 失败。
toolNode 写 failed evidence / AgentExecutionObservation。
Graph 不进入 terminal error。
PlannerNode 通过 PlannerObservationContext 看到失败后选择 read_locate、terminal search 或另一个动作。
第二次成功或给出明确卡点。
最终 answer。
```

---

### Test 3：审批恢复后结果回 Planner

名称：

```text
pauses for approval, resumes approved execution, and returns result to planner
```

目标：

```text
terminal_session 需要审批。
Graph 停在 waiting_approval。
resumeApprovedAgentRun 校验 pendingToolCall/inputHash。
执行结果写入 observation/evidence。
结果回 Planner。
Planner 决定 answer 或下一步。
```

补充断言：

```text
如果 Planner 选择新的 terminal command，必须重新审批。
不得复用旧审批执行不同 inputHash。
```

---

## 17. 实施顺序

### Step 1：对齐当前源码文件清单

先不要写代码。

输出：

```text
当前涉及文件清单。
当前 toolNode 失败后哪些字段导致 Graph 进入 error。
当前 routeAfterTool 如何路由。
当前 PlannerNode prompt/context 读哪些状态。
当前 evidence / observations / lastToolExecution 的实际结构。
当前 terminal_session 的 approval / result 结构。
```

---

### Step 2：定义统一类型与观察入口

实现或提出：

```text
CurrentTaskFrame
AgentExecutionObservation
PlannerObservationContext
buildPlannerObservationContext(state)
```

先保证 `PlannerNode` 只面向统一观察视图。

---

### Step 3：实现 recoverable failure 状态

实现：

```text
recoverable tool failure 不再设置全局 errorMessage。
写入 failed evidence / AgentExecutionObservation / lastToolExecution。
增加 recoveryAttemptCount。
```

---

### Step 4：修改 routeAfterTool

实现：

```text
recoverable failure 且未超过 maxRecoveryAttempts → 回 toolSelectStep 或 nextActionPlanner。
terminal failure → error。
waiting_approval → approval。
completed → 继续现有链路，但确保能回 Planner。
```

---

### Step 5：增强 PlannerNode prompt/context

实现：

```text
PlannerNode 通过 PlannerObservationContext 看到失败 toolId、args/inputHash、errorMessage、resultPreview、recovery 状态、currentTaskFrame。
prompt 允许从失败中继续推进。
禁止假装成功。
恢复次数耗尽后必须 answer/error。
```

---

### Step 6：检查 repeated action guard

实现：

```text
同 inputHash 无理由重复要拦。
不同 args 可以继续。
拦截后应该 answer with existing evidence/failure explanation，而不是系统 error。
```

---

### Step 7：保证 policy/approval 不被绕过

实现：

```text
任何恢复后的 use_tool 都重新进入 toolCallNormalize → policyStep。
旧审批只能执行同一个 frozen pendingToolCall。
```

---

### Step 8：补用户可见 trace

实现：

```text
失败 observation、恢复决策、新动作、审批等待、恢复执行都要有 execution node。
summary 用用户能懂的话，不要只放 JSON。
```

---

### Step 9：补黑盒测试

至少覆盖：

```text
成功结果回 Planner
可恢复失败回 Planner
审批恢复结果回 Planner
```

---

## 18. 验收标准

本期完成必须满足：

```text
1. tool 执行失败不再默认终止 AgentGraph。
2. 可恢复失败会写入 failed evidence / AgentExecutionObservation / lastToolExecution。
3. PlannerNode 通过 PlannerObservationContext 看到失败结果并继续决策。
4. 成功结果也能回 PlannerNode 再决定 answer。
5. PlannerNode 不直接散读 observation/evidence/lastToolExecution/pendingApproval，而是通过统一观察入口读取。
6. currentTaskFrame 最小包含当前目标、当前子任务、当前阻塞点、当前已确认对象、完成判据。
7. currentTaskFrame 的主更新者是 PlannerNode，Executor 只追加客观结果，Generate/Evaluate 只读。
8. terminal_session 是主力工程执行工具，但必须遵守 Planner → Policy/Approval → Execute → Observation → Planner。
9. 所有 use_tool 仍走 normalize / policy / approval。
10. 高风险工具失败恢复不能绕过审批。
11. maxRecoveryAttempts / maxIterations 能防止无限循环。
12. trace 能展示：失败 → 再决策 → 新动作 → 最终结果。
13. 用户能看到推进过程，而不只是最终一句失败。
14. 黑盒测试覆盖成功、失败恢复、审批恢复三类场景。
```

---

## 19. 给 Codex 执行官的第一条指令

```md
请先不要写代码。

请基于本施工总文件，先输出设计对齐报告：

1. 这一定义是否与当前 AgentGraph / PlannerNode / ToolNode / Policy / Approval / terminal_session 结构兼容？
2. 当前最小改动点分别在哪些文件？
3. 哪些现有字段可以复用，比如 evidence、observations、lastToolExecution、pendingToolCall、policyDecision？
4. 哪些字段必须新增，比如 currentTaskFrame、AgentExecutionObservation、PlannerObservationContext、recoveryAttemptCount、maxRecoveryAttempts？
5. 哪个函数作为 PlannerNode 的统一观察入口？如果不存在，请设计 buildPlannerObservationContext(state)。
6. 哪些节点更新 currentTaskFrame？哪些节点只读？
7. 当前哪些 route 会导致“工具失败直接终止”，需要改成 recoverable observation 回 PlannerNode？
8. terminal_session 作为主力 Executor 时，如何保证仍然重新经过 toolCallNormalize → policyStep → approval/tool？
9. 请输出实施文件清单、最小改动顺序、风险点和黑盒测试计划。

禁止引入大型计划系统、Step DAG、复杂任务树或新的 Agent 框架。本期只做 Planner-Executor Observation Loop 的最小改造。
```

---

## 20. 最后定性

这不是计划机。
这是下一步决策闭环。

```text
用户给目标
↓
PlannerNode 决定下一步
↓
Executor 执行
↓
Observation 记录完整结果
↓
PlannerNode 继续推进
↓
高风险动作走审批
↓
最终给完整结果
```

完成 v1.7 后，用户应该明显感觉：

```text
它能查。
它能跑。
它能看错误。
它能换办法。
它能验证。
它能给完整结论。
```
