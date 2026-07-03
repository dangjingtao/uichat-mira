Status: Planned
Owner: planning / chat / runtime
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: AgentRoadmap
Doc Type: plan
Related:
  - concepts/CONCEPT_AGENT.md
  - uchat.md
  - chat-tool-integration-poc.md
  - chat-execution-trace-design.md
  - tooling-runtime/harness-runtime-design.md
  - rag-langgraph-flow.md
  - architecture/README.md

# Agent SWOT 计划

## 目的

这份计划基于当前文档和抽样代码，评估 UI Chat RAG Tester 是否具备演进为真正 Agent 系统的基础，并给出后续路线。

当前判断：

> 项目已经具备很强的 Agent 底座，尤其是 `uchat`、RAG 图编排、Harness 工具体系和 execution trace。但它还不是完整 Agent Runtime，因为目标状态、计划状态、长期记忆、审批门禁和长任务编排还不是一等公民。

## 评估依据

已阅读文档：

- `docs/concepts/CONCEPT_AGENT.md`
- `docs/architecture/README.md`
- `docs/uchat.md`
- `docs/chat/chat-tool-integration-poc.md`
- `docs/chat/chat-execution-trace-design.md`
- `docs/tooling-runtime/harness-runtime-design.md`
- `docs/architecture/rag-langgraph-flow.md`
- `docs/knowledge-base/README.md`

抽样代码：

- `server/src/routes/proxy-provider/chat-tool-loop.ts`
- `server/src/routes/proxy-provider/chat-tool-surface.ts`
- `server/src/mcp/harness/registry.ts`
- `server/src/mcp/harness/invocations.ts`
- `server/src/services/chat-stream-events.ts`
- `desktop/src/shared/uchat/ui/UChatExecutionTrace.tsx`

## 当前成熟度快照

| Agent 能力 | 当前状态 | 依据 |
| --- | --- | --- |
| 目标接收 | 部分具备 | 普通 chat 能接收用户消息，但没有一等公民的 `AgentGoal` 模型。 |
| 上下文感知 | 部分具备 | 已有 chat history、RAG、thread context、role context、knowledge base，但还没有统一的 Agent context 对象。 |
| 规划 | 较弱 | RAG 有 graph nodes，tool loop 有有限循环，但没有显式 plan 对象和 plan 生命周期。 |
| 工具行动 | 基础较强 | Harness registry 和 invocation 路径已存在，chat 可以暴露 Harness-backed tools。 |
| 观察反馈 | 部分具备 | tool result 和 execution node 已能进入流式观察，但还没有跨目标的通用 evaluator。 |
| 记忆 | 较弱 | thread persistence 和 knowledge base 已存在，但还没有带写入策略的 durable agent memory。 |
| 自主边界 | 部分具备 | Harness 文档讨论了 scope 和 approval，但 chat agent mode 当前还没有完整审批工作流。 |
| 可追踪性 | 基础较强 | RAG trace、tool event、`data-execution-node` 已构成可信的统一执行轨迹基础。 |

## SWOT

### Strengths 优势

1. 运行时边界清晰

当前架构已经区分 renderer、preload、backend 和 desktop shell。真正 Agent 需要把工具执行、权限和策略门禁放在 backend/runtime 层，而不是 React 组件里；这一点项目基础是对的。

相关锚点：

- `docs/architecture/README.md`
- `runtime.config.cjs`
- `server/src/routes/proxy-provider/*`

2. `uchat` 已经被定义为运行时，而不只是 UI

chat 层已经明确分成 core、ui、integration。Agent 可以接入这条分层，而不需要把消息组件树变成编排引擎。

相关锚点：

- `docs/uchat.md`
- `desktop/src/shared/uchat/core/runtime.ts`
- `desktop/src/shared/uchat/core/types.ts`

3. Harness 是合适的工具执行底座

Harness 已经拥有 capability 注册、调用、trace、environment snapshot 和 tool definition。它很接近真正 Agent 需要的工具控制平面。

相关锚点：

- `docs/tooling-runtime/harness-runtime-design.md`
- `server/src/mcp/harness/registry.ts`
- `server/src/mcp/harness/invocations.ts`

4. 普通 chat 已经有工具循环路径

`executeDefaultChatToolLoop` 已经可以向 OpenAI-compatible provider 暴露工具、执行 Harness invocation、把结果反馈给模型，并合成最终回答。这不是纯概念，已经是可用基础。

相关锚点：

- `server/src/routes/proxy-provider/chat-tool-loop.ts`
- `server/src/routes/proxy-provider/chat-tool-surface.ts`

5. RAG graph 已经证明图式编排可行

RAG 链路已有 rewrite、embed、retrieve、rerank、generate 等离散节点。这可以作为 Agent plan / execution node 的先例。

相关锚点：

- `docs/architecture/rag-langgraph-flow.md`
- `server/src/services/rag-graph.ts`
- `server/src/services/rag-nodes/*.ts`

6. Execution trace 正在成为共享语言

从 RAG 专属 trace 走向 `data-execution-node` 是正确方向。Agent 需要的可观察性可以自然复用这条路径。

相关锚点：

- `docs/chat/chat-execution-trace-design.md`
- `server/src/services/chat-stream-events.ts`
- `desktop/src/shared/uchat/ui/UChatExecutionTrace.tsx`

### Weaknesses 劣势

1. 当前 Agent mode 更像 tool-enabled chat，不是真正 agency

`agentEnabled` 会扩展工具面并启用有限 tool loop，但它不会创建持久目标、计划、evaluator、审批状态或记忆写入策略。

风险：

- 产品表面上像有 Agent，内部实际上只是工具调用。

2. 规划是隐式的

当前系统可以运行 RAG graph 和 tool loop，但 plan 不是一等对象。没有 plan model，就很难可靠地检查、暂停、恢复、审批、重放或调试多步任务。

3. 审批和风险策略还没有端到端落地

Harness 文档正确地把 scope、root 和 approval 归到 Harness。但 agent mode 启用后，chat tool surface 可以暴露较宽的内置工具面。如果在审批产品化之前暴露 edit / terminal 类能力，会形成架构风险。

4. 记忆还不是 Agent memory

Thread messages、knowledge base、summary 都是有价值的上下文存储，但它们不等于 Agent memory。真正 Agent 需要明确：什么可以记、为什么记、记多久、用户如何查看或删除。

5. Tool loop 仍是 request-local 且同步的

当前 chat tool loop 在一次请求内完成，并有较小 loop guard。这适合早期工具调用，但真正 Agent 任务通常需要暂停/恢复、等待审批、后台执行、重试，以及应用重启后的进度恢复。

6. RAG 和工具仍有各自的编排中心

RAG 使用 LangGraph 风格编排，普通 chat 工具使用自定义 loop。既然项目已经嵌入 LangChain / LangGraph，真正 Agent 层应优先复用这套编排基建，而不是再发明一套并行 workflow。

### Opportunities 机会

1. 在不重写 chat 的前提下引入 `AgentRun`

可以先增加 backend 层模型：

- goal
- plan
- steps
- 当前状态
- observations
- approval requests
- memory writes
- trace node ids

它可以包住现有 chat、RAG 和 Harness 路径，而不是替换它们。

2. 把 `data-execution-node` 提升为 Agent trace 主干

现有 execution trace 设计可以成为 Agent plan 的可视层：

- `plan` node
- `retrieve` node
- `tool` node
- `memory` node
- `approval` node
- `generate` node

这样 UI 可以展示更丰富的 Agent 行为，而不需要发明第二套过程视图。

3. 把 RAG retrieval 视为 Agent 的感知工具

RAG 可以继续作为产品功能存在，同时也成为 Agent run 内部的一种 perception capability。未来 Agent 可以自行判断何时检索、何时读文件、何时追问用户。

4. 使用 Harness metadata 做安全和工具选择

Harness tool definitions 已经包含 domain、mode、tags、schema 以及接近风险元数据的字段。这些可以发展为 Agent policy：

- read-only tools 可以自动执行
- write tools 需要审批
- terminal tools 需要更严格 scope
- external tools 需要明确展示给用户

5. 评测可以围绕 trace，而不只看最终答案

Evaluation workbench 未来可以评估：

- Agent 是否选择了合适工具
- 是否在回答前做了检索
- 是否在正确时机请求审批
- 是否在成功条件满足后停止

6. 本地桌面架构是战略优势

项目拥有本地 backend 和 SQLite，可以支持本地 trace、本地 memory、本地文档和受控本地工具，而不完全依赖远程 Agent 平台。

### Threats 威胁

1. 工具扩张可能快于策略治理

如果在 approval、scope、audit 完成前继续暴露更多工具，Agent mode 会变得难以信任。

2. “Agent” 这个名字可能掩盖架构债务

如果 Agent 只是 tool calling 外面的一层 UI 开关，后续功能可能不断堆进 `chat-tool-loop.ts`，最终变成藏在 route 文件里的第二套 runtime。

3. 长任务会突破当前请求模型

需要审批、等待、后台进度或应用重启恢复的 Agent 任务，不适合塞进一次同步 provider 请求。

4. 记忆会带来产品和安全歧义

如果没有用户可见的 memory 控制，durable memory 可能让用户意外，也可能保存本应只存在于当前请求里的事实。

5. Provider 差异会泄漏到 Agent 行为

当前 tool loop 面向 OpenAI-compatible provider 和 Ollama 兼容路径。不同 provider 的 tool-call 格式、streaming 行为和上下文长度不同，如果不在 Agent 边界归一，会造成行为不一致。

6. Execution trace 可能过度噪音化

真正 Agent 会产生很多节点。没有摘要、折叠和过滤，trace UI 可能从“可信”变成“吵”。

## 推荐路线图

### Phase 1: 先诚实命名当前层

目标：

- 在 `AgentRun` 存在之前，把当前 `agentEnabled` 定义为 “tool-enabled chat mode”。

行动：

- 保持 `chat-tool-loop.ts` 只负责 request-local 工具调用。
- 在文档中明确说明这个模式不是完整 Agent Runtime。
- 不要把长任务审批或 memory 行为直接加进 route 文件。

完成信号：

- 产品和文档能区分 “tool-enabled chat” 与 “Agent runtime”。

### Phase 2: 增加 AgentRun schema 和 trace contract

目标：

- 建立真正 Agent 执行的第一版 backend contract。

建议形状：

```ts
type AgentRun = {
  id: string;
  threadId: string;
  userId: number;
  goal: AgentGoal;
  status: "running" | "waiting_approval" | "waiting_user" | "completed" | "failed" | "blocked";
  plan: AgentPlan;
  observations: AgentObservation[];
  traceId: string;
  createdAt: string;
  updatedAt: string;
};
```

行动：

- 实现前先补一份设计文档。
- 将 AgentRun events 映射到 `data-execution-node`。
- 决定持久化边界：第一版直接 SQLite，还是先内存态、后续再持久化 trace。

完成信号：

- 一个 run 可以脱离最终 assistant message 被独立检查。

### Phase 3: 集中策略和审批

目标：

- 确保每个 Agent action 都经过同一个 policy gate。

行动：

- 为 Harness tools 定义 risk level。
- 给 execution trace 增加 approval event 类型。
- write / terminal / external side-effect tools 在没有审批时必须被阻断。
- 审批状态不能只存在于模型 prompt 里。

完成信号：

- 模型可以请求高风险工具，但 runtime 能在执行前暂停。

### Phase 4: 引入 AgentGraph、Planner 和 Evaluator

目标：

- 从隐式 tool loop 进化到显式计划执行，并用 LangGraph 承载 Agent 主链编排。

行动：

- 增加 `AgentGraph`，用 `@langchain/langgraph` 的 `StateGraph` 承载最小主链。
- 增加 planner node，用于创建明确 plan steps。
- 增加 evaluator node，用于决定 continue / replan / finish / ask。
- 第一版 planner/evaluator 可以规则化，但应作为 graph node 存在，方便后续替换成 model-driven 节点。

完成信号：

- 一个 run 可以在执行前或执行中展示自己的 plan。

### Phase 5: 明确定义 Memory

目标：

- 区分 thread history、knowledge base、summary 和 Agent memory。

行动：

- 新增 memory design doc。
- 定义 memory 写入策略和用户控制。
- 将 memory writes 表达为 trace nodes。
- 不要静默持久化 durable memory。

完成信号：

- Agent memory 有可检查记录和明确写入规则。

## 架构建议

最稳妥的方向：

> 把 Agent 建成 backend orchestration layer：复用 `uchat` 做交互，复用 Harness 做工具，复用 RAG graph 的检索/生成模式，复用 execution trace 做可观察性。

应避免的方向：

- 不要把 `chat-tool-loop.ts` 变成 Agent runtime。
- 不要把 Agent planning 放进 renderer state。
- 不要在没有集中审批策略的情况下把所有工具暴露给模型。
- 不要把 knowledge base 或 thread history 直接当成 durable memory。

## 需要决策的问题

实现前需要项目 owner 决定：

1. Agent 是否应该成为 `server/src/agent/` 下的独立 backend module？
2. `AgentRun` 是否从第一版就持久化到 SQLite？
3. 第一版真正 Agent 是只支持 read/search/RAG 工具，还是允许 write/terminal 但必须审批？
4. AgentGraph 第一版只做最小 read/search/RAG/generate 图，还是同时引入复杂 replan / interrupt？

## 建议下一份文档

如果这份计划被接受，下一步建议写：

- `docs/agent-runtime-design.md`

该文档应定义具体 backend module 边界、API routes、persistence schema、event protocol，以及从当前 tool-enabled chat 迁移到 Agent runtime 的路径。
