Status: Planned
Owner: planning / chat / runtime
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: AgentRuntime
Doc Type: plan
Canonical: true
Related:
  - agent-swot-plan.md
  - concepts/CONCEPT_AGENT.md
  - uchat.md
  - chat-tool-integration-poc.md
  - chat-execution-trace-design.md
  - tooling-runtime/harness-runtime-design.md
  - ../architecture/rag-langgraph-flow.md

# Agent Runtime Design

## Executive Summary

当前系统最需要的不是继续给 chat 增加更多工具，而是把 “Agent” 从一个开关和 tool loop，升级成有独立状态、独立策略、独立轨迹的 backend runtime。

核心改造判断：

> 先建立 `AgentRun` 运行模型，再把现有 chat、RAG、Harness tools 接进来。不要让 `chat-tool-loop.ts` 继续膨胀成事实上的 Agent runtime。

第一阶段不追求全自动复杂 Agent，而是做一个可观察、可暂停、可审批、可恢复的最小 Agent Runtime。

这里的 MVP 边界不是“其它能力不做”，而是区分三条线：

- MVP 主链：用户从 chat 输入框旁边的 Agent 按钮进入，创建 `AgentRun`，围绕工程任务做目标拆解、上下文收集、计划、动作、校验和收口，产出可追踪结果。
- 并行基建：`read/search/RAG`、`edit_file`、`terminal_session`、企业微信外部动作、memory、approval、LangGraph 等能力可以继续建设，但它们是支撑工程任务智能体的能力，不是 Agent 的主叙事。
- 暂缓接入：高风险或复杂能力可以被 runtime 识别、拦截、展示和排期，但不在第一版以“模型自动执行”的方式开放给用户。

## Current Problem

当前系统已经具备很多 Agent 组件，但它们还没有被一个统一运行时收束。

主要问题是：

1. `agentEnabled` 的语义偏弱
   - 当前更接近 tool-enabled chat。
   - 它能让模型调用工具，但没有一等公民的 goal、plan、run、approval、memory。

2. `chat-tool-loop.ts` 承担了过多未来风险
   - 它适合做 request-local tool calling。
   - 不适合承载长任务、审批、恢复、记忆、计划重排。

3. RAG、tool、trace 各自有好底座，但还没有统一执行模型
   - RAG 有 graph。
   - Harness 有 invocation。
   - Chat 有 SSE。
   - Execution trace 有 UI 雏形。
   - 但 Agent 需要一个上层 `AgentRun` 串起来。

4. 缺少明确的安全边界
   - 工具越多，越需要统一 policy。
   - 高风险工具不能只靠模型自觉，也不能只靠前端隐藏。

5. Memory 还没有产品语义
   - thread history、summary、knowledge base 都不是 Agent memory。
   - 持久记忆必须有写入原因、可见性和删除路径。

## Design Goal

本轮改造目标：

- 建立 backend-first 的 Agent Runtime。
- 让每次 Agent 执行都有 `AgentRun`。
- 让计划、工具调用、RAG 检索、审批、记忆写入都进入统一 trace。
- 让 UI 能展示 Agent 在做什么，但不让 UI 负责 Agent 编排。
- 让 Harness 继续负责工具执行和边界控制。
- 让 `uchat` 继续负责用户交互和消息呈现。

MVP 主线边界：

- 不重写 `uchat`。
- 不重写 RAG graph。
- 不删除现有 `chat-tool-loop.ts`。
- 不把 `edit_file`、`terminal_session`、企业微信发送等高风险或外部副作用能力作为第一版默认自动执行路径。
- 不把 durable memory 写入作为第一版默认行为。
- 不把多 Agent 协作和完整 LangGraph Agent 编排作为第一版主链。

并行推进不受此限制：

- Harness capability 基建可以继续推进。
- approval API / policy metadata 可以继续推进。
- memory schema / memory design 可以继续推进。
- LangGraph Agent 编排应进入 MVP 主链，但采用最小图，不做复杂多 Agent 图。

## Target Architecture

目标结构：

```text
renderer / uchat
  |
  | send message / show trace / approve action
  v
server routes
  |
  v
server/src/agent
  |-- AgentRunStore
  |-- AgentGraph
  |-- AgentPlannerNode
  |-- AgentExecutorNode
  |-- AgentEvaluator
  |-- AgentPolicy
  |-- AgentMemory
  |-- AgentTraceEmitter
  |
  | uses
  v
Harness tools / RAG graph / Provider proxy / Thread context
```

关键原则：

- Agent runtime 放在 backend。
- Renderer 只负责显示、输入和审批动作。
- Harness 是工具执行控制平面。
- RAG 是 Agent 可调用的感知/检索能力。
- Provider proxy 是模型调用能力，不是 Agent 状态所有者。
- Execution trace 是跨能力的观察语言。
- LangGraph / LangChain 是 Agent MVP 的编排内核，不另起一套低配 workflow。
- `AgentRun` 是产品与业务运行真相，`AgentGraph` 是执行图；两者不要互相替代。

## LangGraph Strategy

项目已经嵌入 LangChain / LangGraph，并且 RAG 链路已经通过 `StateGraph` 证明了节点编排、条件路由和流式事件的可行性。因此 Agent MVP 不应重新发明一套自定义小状态机。

本轮策略：

- 新增 `AgentGraph`，使用 `@langchain/langgraph` 的 `StateGraph` 编排 Agent 主链。
- 复用现有 `ragGraph` / `ragRunnableSequence` / `retrieveOnlyRunnable`，不要复制 RAG 节点逻辑。
- Harness invocation 仍由 Harness 层负责，Agent 只通过 graph/runnable 选择和编排可用能力。
- 将 Agent graph node event 映射到现有 `data-execution-node`。
- `AgentRunStore` 只保存业务状态、进度、审批和审计信息，不承载具体图执行逻辑。

第一版 `AgentGraph` 建议最小节点：

```text
START
  -> prepareContext
  -> plan
  -> capabilityIntent
  -> routeStep
      -> retrieve
      -> tool
      -> generate
      -> approvalRequired
  -> evaluate
  -> END
```

其中：

- `prepareContext` 复用 thread context、role context、knowledge base context。
- `retrieve` 优先复用现有 RAG graph 或 retrieve runnable。
- `tool` 只负责选择低风险 Harness capability，并把执行交给 Harness 控制平面。
- `approvalRequired` 不执行高风险工具，只写入 `AgentRun.pendingApproval` 和 trace。
- `generate` 复用 provider proxy / existing generation 能力。
- `evaluate` 第一版可以规则化，但作为 graph node 存在，后续可替换成模型评估。

## UI Entry

从 UI 层面，Agent 第一版应该是输入框旁边的一个按钮。这个入口很小，但极其重要。

它承担的不是“多一个发送按钮”，而是用户对本轮执行模式的明确授权：

- 普通发送：按现有 chat 流程回答。
- Agent 按钮：创建 `AgentRun`，允许系统进行计划、工具调用、观察和 trace 展示。

MVP UI 要求：

- Agent 按钮位于 composer 发送区附近，和普通发送形成清晰区分。
- Agent 按钮只表达“本轮用 Agent 模式执行”，不在第一版承载复杂工具选择面板。
- 点击后，assistant 消息上方展示 execution trace。
- 如果 runtime 拦截了高风险工具，应在 trace 中显示“需要审批/当前 MVP 未自动执行”，而不是静默失败。
- Agent 按钮状态要能表达 running / waiting / failed / completed，避免用户误以为只是普通消息发送。

这个按钮是产品心智入口。后续 approval、memory、多工具选择、长任务恢复都可以围绕它扩展，但第一版要保持克制：入口清楚，反馈可信，过程可见。

## Core Model

第一版核心对象：

```ts
type AgentRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "waiting_user"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

type AgentRun = {
  id: string;
  threadId: string;
  userId: number;
  goal: AgentGoal;
  plan: AgentPlan;
  status: AgentRunStatus;
  currentStepId?: string;
  observations: AgentObservation[];
  pendingApproval?: AgentApprovalRequest;
  traceId: string;
  createdAt: string;
  updatedAt: string;
};
```

```ts
type AgentPlan = {
  id: string;
  goalId: string;
  version: number;
  steps: AgentPlanStep[];
};

type AgentPlanStep = {
  id: string;
  kind: "reason" | "retrieve" | "tool" | "generate" | "memory" | "ask_user";
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  toolId?: string;
  input?: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
};
```

```ts
type AgentObservation = {
  id: string;
  runId: string;
  stepId: string;
  status: "ok" | "partial" | "failed" | "blocked";
  facts: string[];
  errorMessage?: string;
  rawRef?: string;
  createdAt: string;
};
```

这些对象是 Agent 的运行真相。消息、trace UI、tool invocation 都应从这里映射，而不是反过来由 UI patch 出 Agent 状态。

## Module Boundaries

建议新增目录：

```text
server/src/agent/
  index.ts
  types.ts
  run-store.ts
  graph.ts
  nodes.ts
  runnables.ts
  evaluator.ts
  policy.ts
  memory.ts
  trace.ts
  routes.ts
```

职责拆分：

| Module | 职责 |
| --- | --- |
| `run-store.ts` | 创建、读取、更新 `AgentRun`。第一版可内存态，正式版进 SQLite。 |
| `graph.ts` | 定义 `AgentGraphState`、LangGraph 节点顺序和条件路由。 |
| `nodes.ts` | 提供 `prepareContext`、`plan`、`retrieve`、`tool`、`generate`、`evaluate` 等节点实现。 |
| `runnables.ts` | 将 RAG 和 provider 能力包装成 LangChain runnable，便于 graph 复用。 |
| `evaluator.ts` | 判断 step / run 是否完成、是否需要 replan、是否要追问。 |
| `policy.ts` | 根据 risk、tool、scope、approval 决定能否执行。 |
| `memory.ts` | 处理短期状态和长期记忆写入请求。 |
| `trace.ts` | 把 Agent events 映射成 `data-execution-node`。 |
| `routes.ts` | 暴露 Agent run / approval / cancel API。 |

## Event Contract

Agent 不需要另起一套 UI 事件系统，应复用并扩展 `data-execution-node`。

建议节点类型：

```ts
type AgentExecutionNodeType =
  | "plan"
  | "reason"
  | "retrieve"
  | "tool"
  | "approval"
  | "memory"
  | "generate"
  | "evaluate";
```

建议事件：

```ts
type AgentExecutionNodeEvent = {
  nodeId: string;
  nodeType: AgentExecutionNodeType;
  phase: "start" | "done" | "error";
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
  environment?: Record<string, unknown>;
};
```

映射规则：

- plan 创建：发 `nodeType: "plan"`。
- RAG 检索：发 `nodeType: "retrieve"`。
- Harness 调用：发 `nodeType: "tool"`。
- 审批等待：发 `nodeType: "approval"`。
- 记忆写入：发 `nodeType: "memory"`。
- 最终回答：发 `nodeType: "generate"`。
- evaluator 判断：发 `nodeType: "evaluate"`。

## API Plan

第一版 API 建议：

```text
POST /agent/runs
GET  /agent/runs/:runId
POST /agent/runs/:runId/approve
POST /agent/runs/:runId/reject
POST /agent/runs/:runId/cancel
GET  /agent/runs/:runId/events
```

与 chat 的关系：

- 普通 chat 入口可以在 `agentEnabled = true` 时创建 `AgentRun`。
- 第一版仍可把最终回答写回 assistant message。
- `AgentRun` 不应依赖 assistant message metadata 才能恢复。

## Migration Plan

### Phase 0: 文档和命名收口

目标：

- 把当前能力命名为 tool-enabled chat。
- 明确 Agent Runtime 是下一层，而不是当前 tool loop 的别名。

动作：

- 保留 `chat/agent-swot-plan.md`。
- 新增本设计文档。
- 在 chat tool POC 文档中补一句：`chat-tool-loop.ts` 不是 Agent Runtime。

完成条件：

- 团队讨论时不再混用 “工具调用” 和 “Agent Runtime”。

### Phase 1: AgentRun 最小闭环

目标：

- 建立最小可运行 AgentRun。高风险能力可以被识别和拦截，但不进入默认自动执行路径。

范围：

- 主链支持工程任务所需的上下文收集、检索、工具执行和生成。
- `edit_file` / `terminal_session` / external side-effect tools 可以作为并行 capability 存在，但 Agent MVP 中只允许进入 blocked / approval-required trace，不自动执行。
- durable memory 可以做 schema / design / API 草案，但 MVP 主链不静默写入。
- run store 可先内存态。

动作：

- 新增 `server/src/agent/types.ts`。
- 新增 `run-store.ts`。
- 新增 `graph.ts`，使用 LangGraph `StateGraph` 定义 Agent MVP 主链。
- 新增 `nodes.ts` / `runnables.ts`，复用 Harness、RAG graph 和 provider。
- 新增 `trace.ts`，统一发 `data-execution-node`。
- 在 chat agent mode 中创建 run，并把 run trace 显示到 uchat。

完成条件：

- 用户发起一次 Agent 请求后，可以看到 plan、retrieve/tool/generate 过程。
- 后端可以通过 run id 查到执行状态。
- 最终回答仍能进入现有 chat 消息。

### Phase 2: Policy 和 Approval

目标：

- 高风险动作必须先暂停等待审批。

范围：

- write / terminal / external side-effect tools 先不自动执行，但要能形成明确的 approval request 或 blocked observation。
- 低风险上下文收集和检索可以自动执行。

动作：

- 为 Harness capability 增加 `riskLevel` 或等价 metadata。
- `AgentPolicy` 统一判断工具是否可执行。
- 增加 approval request 状态。
- 增加 approve / reject API。
- UI 在 trace 中展示 approval node，并允许用户批准或拒绝。

完成条件：

- 模型请求高风险工具时，runtime 能暂停。
- 用户批准后继续执行。
- 用户拒绝后 Agent 能生成解释或改计划。

### Phase 3: Planner / Graph Routing / Evaluator

目标：

- 从“模型边想边调工具”升级成显式 plan，并由 LangGraph 负责节点编排和条件路由。

第一版 planner node：

- 可规则化生成：
  - clarify
  - retrieve
  - tool
  - generate
  - evaluate
- 不必一开始让模型自由生成复杂计划，但 planner 应作为 graph node 存在，方便后续替换成 model-driven planner。

第一版 evaluator node：

- 检查是否满足 success criteria。
- 检查是否需要补充检索。
- 检查是否要追问用户。
- 检查是否应停止，避免无限循环。

完成条件：

- AgentRun 可以展示当前 plan。
- 执行失败后可以 replan 一次。
- 达到完成条件后明确 stop。

### Phase 4: Persistence 和 Resume

目标：

- AgentRun 可以跨刷新和后端短暂重启恢复。

动作：

- 增加 SQLite schema：
  - `agent_runs`
  - `agent_run_steps`
  - `agent_observations`
  - `agent_approvals`
- trace raw details 可先引用 Harness invocation trace，不重复存大对象。
- 启动时恢复 waiting 状态 run。

完成条件：

- 刷新前端后还能看到 run 状态。
- waiting_approval 的 run 不会丢。
- completed run 可用于审计。

### Phase 5: Memory

目标：

- 建立明确的 Agent memory，而不是偷用 thread history。
- 这是 AgentRun MVP 之后的独立能力阶段，不作为第一版 Agent 按钮主链的默认行为。

动作：

- 新增 `docs/agent-memory-design.md`。
- 区分：
  - short-term run memory
  - thread summary
  - knowledge base
  - durable user/project memory
- durable memory 写入必须有原因和可见记录。
- 进入 memory 阶段后，第一批只允许低风险偏好和项目事实写入。

完成条件：

- 用户可以看到 Agent 记住了什么。
- 用户可以删除或禁用 durable memory。
- memory write 会进入 execution trace。

## MVP Implementation Plan

我建议第一个实际 milestone 不是做“全能 Agent”，而是做：

> Read/Search/RAG AgentRun MVP

### MVP 主链

- 接收目标。
- 生成简单 plan。
- 自动使用低风险上下文收集和检索能力。
- 生成 final answer。
- 全程进入 execution trace。
- 后端可通过 run id 查询状态。
- UI 上通过输入框旁边的 Agent 按钮触发。

### 并行推进基建

这些能力不应被描述成“不做”。更准确的说法是：它们可以同步推进，但第一版不作为 Agent 主链的默认自动执行能力。

| 能力 | MVP 处理方式 | 完成信号 |
| --- | --- | --- |
| `edit_file` | Harness capability、risk metadata、dry-run / validation 可以继续推进；Agent 主链中默认拦截为 `approval_required`。 | 模型请求编辑时，trace 显示被 policy 暂停，而不是直接改文件。 |
| `terminal_session` | terminal runtime 可以继续建设；Agent 主链中默认拦截，后续进入审批流。 | 模型请求终端时，AgentRun 生成 pending approval / blocked observation。 |
| 企业微信发送等外部副作用工具 | 集成和工具定义可以继续推进；Agent 主链默认不自动发送。 | 模型请求发送消息时，trace 显示外部副作用需要显式授权。 |
| durable memory | memory schema、设计文档、用户控制可以推进；MVP 主链不静默写入长期记忆。 | memory write 只能作为 trace proposal 或 disabled node 出现。 |
| 长时间后台任务 | 可以预留 run status 和 resume 字段；第一版不承诺后台长时间自治。 | `AgentRunStatus` 能表达 queued/running/waiting，但不要求完整后台调度。 |
| 复杂审批 UI | approval API 和 trace node 可以先做；UI 第一版可只做最小确认入口。 | 高风险动作不会执行，用户能看到为什么停下。 |
| 多 Agent 协作 | 暂不进入 MVP 主链，但 plan 数据结构不封死未来多执行者。 | `AgentRun` 不依赖单一 assistant message metadata。 |
| 完整 LangGraph Agent 编排 | MVP 使用 LangGraph 最小主链；复杂多 Agent、checkpoint interrupt、深度 replan 暂缓。 | 后续增强 graph 时不影响 `AgentRun` 外部契约。 |

### 暂缓接入主入口

这些能力暂缓的是“进入用户点击 Agent 按钮后的自动主链”，不是暂停研发：

- 自动编辑文件。
- 自动执行 terminal。
- 自动发送企业微信或其它外部副作用动作。
- 自动写入 durable memory。
- 无上限长时间后台自治。
- 复杂多级审批 UI。
- 多 Agent 协作主流程。
- 复杂 LangGraph Agent 接管全部主编排。

原因：

- 这个范围能验证 AgentRun 模型是否成立。
- 风险可控。
- 能复用现有 Harness、RAG、trace。
- 不会把审批、记忆、外部副作用和长任务复杂度全部压进第一版主入口。

## Files To Touch First

第一批建议改动文件：

```text
server/src/agent/types.ts
server/src/agent/run-store.ts
server/src/agent/graph.ts
server/src/agent/nodes.ts
server/src/agent/runnables.ts
server/src/agent/evaluator.ts
server/src/agent/policy.ts
server/src/agent/trace.ts
server/src/agent/routes.ts
server/src/index.ts
server/src/routes/proxy-provider/chat.routes.ts
desktop/src/features/chat/core/protocol.ts
desktop/src/shared/uchat/ui/UChatRagExecutionTrace.tsx
desktop/src/shared/uchat/ui/executionParsers.ts
```

第一批不建议改：

```text
electron/*
tauri/*
runtime.config.cjs
scripts/build-dist.js
```

原因：

- Agent Runtime 是 backend/chat/runtime 改造。
- 不应该在第一阶段触碰桌面启动、打包和网络边界。

## Risk Controls

必须守住以下规则：

1. Agent Runtime 不放在 renderer。
2. 高风险工具默认不进第一版 MVP。
3. 所有工具执行仍走 Harness。
4. 所有可见过程统一走 execution trace。
5. `chat-tool-loop.ts` 不继续承载审批、恢复和 memory。
6. durable memory 不静默写入。
7. Provider 差异必须在 backend 归一。

## Open Decisions

需要 owner 决策：

1. `AgentRun` 第一版是否直接 SQLite 持久化？
2. 第一版是否允许 web_search 之外的外部工具？
3. AgentGraph 第一版是否只做最小工程任务图，复杂 replan 留到第二阶段？
4. Approval UI 是直接放在 chat trace 中，还是先做只读 trace，审批走后端 API 调试？
5. Agent memory 是否进入本轮，还是等 AgentRun 稳定后单独立项？

## My Recommendation

作为 Agent 总设计，我建议：

1. 第一版就使用 LangGraph `StateGraph`，但只做最小 AgentGraph，不做复杂多 Agent 图。
2. `AgentRun` 第一版可以先内存态，但 `waiting_approval` 一旦进入范围就必须 SQLite。
3. 工具范围先限制在低风险上下文收集与检索，并把高风险工具映射成 `approvalRequired` 节点。
4. 把 `data-execution-node` 定为 Agent trace 的唯一 UI 主通道。
5. 在 `server/src/agent/` 建独立模块，复用现有 `ragGraph`、LangChain runnables、Harness invocation，避免 route 文件继续变厚。

这个路径的好处是：既充分利用已有 LangChain / LangGraph 基建，又不让 AgentRun 失去产品运行真相。系统会越长越清楚，而不是越长越像一团聪明但难管的 tool loop。
