Status: Planned
Owner: chat / runtime
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: AgentRuntime
Doc Type: checklist
Related:
  - agent-runtime-design.md
  - agent-swot-plan.md
  - chat-execution-trace-design.md
  - ../architecture/rag-langgraph-flow.md
  - ../tooling-runtime/harness-runtime-design.md

# Agent Phase 1 Checklist

## Phase Goal

Phase 1 的目标是做出适合当前产品的 Agent MVP：

> 用户从 chat 输入框旁边的 Agent 按钮发起一次请求，后端创建 `AgentRun`，用 LangGraph 最小 `AgentGraph` 编排工程任务所需的目标拆解、上下文收集、动作执行与校验收口，过程进入 execution trace，最终结果回到现有 uchat 消息流。

这期要验证的是 Agent Runtime 骨架成立，而不是一次性做完全自治。

## Global Principles

1. 充分复用当前基建。实现前必须先读文档和已有代码。
   - 必读：`agent-runtime-design.md`
   - 必读：`../uchat.md`
   - 必读：`chat-execution-trace-design.md`
   - 必读：`../architecture/rag-langgraph-flow.md`
   - 必读：`../tooling-runtime/harness-runtime-design.md`
- [x] 阅读 `docs/chat/agent-runtime-design.md`。
- [x] 阅读 `docs/architecture/rag-langgraph-flow.md`。
- [x] 阅读 `docs/chat/chat-execution-trace-design.md`。
- [x] 阅读 `docs/tooling-runtime/harness-runtime-design.md`。
- [x] 阅读 `docs/uchat.md`。
- 先读现有 `ragGraph`、`rag-runables`、Harness invocation、chat stream event，再实现。
  - 还要复用现成 `server/src/services/context-budget/`，不要再给 Agent 自己造一套 token budget。

2. 架构层不允许轻易打兜底，也不允许不明真相。
   - 不允许在不理解 provider / route / graph / trace 真实行为时写兼容分支。
   - 不允许把 Agent 异常静默降级成普通 chat。
   - 如果涉及运行时边界、协议、持久化、权限、审批，必须先说明影响再改。

3. 万物可插拔。
   - `AgentGraph` 可替换节点。
   - `planner`、`evaluator`、`policy`、`runnables` 可替换。
   - RAG、Harness、provider 都通过 adapter / runnable 接入，不把具体实现焊死在 route 中。

4. 严格执行单元测试，并提供项目 owner 手测清单。
   - 后端 graph、policy、trace、route 必须有测试。
   - 前端 Agent 按钮、协议解析、trace 展示必须有测试。
   - 大部分基础验证由开发者自动化和本地手测完成；只把产品确认项交给 owner。

## Scope

本期主链：

- Agent 按钮入口。
- `AgentRun` 内存态 store。
- 最小 `AgentGraph`。
- 目标拆解、上下文收集、动作执行、校验收口等 Agent 主链能力。
- 高风险工具只进入 blocked / approval-required trace，不执行。
- `data-execution-node` 作为唯一过程展示主通道。

## Current Progress

> 记录当前已经落地的 Phase 1 关键节点，不等于 Phase 1 全部完成。

### 已完成

- `capabilityIntentStep` 已接入 embedding + cosine similarity 的通用能力召回节点。
- `approval` 已作为独立 LangGraph 节点接入主链。
- `error` 已作为独立 LangGraph 节点接入主链。
- `context-budget` 已作为 Agent 输入前的复用基建，进入 Phase 1 处理范围。
- Agent 生成前已复用现成 `contextBudgetService.pack`，不再额外造一套 Agent token budget。
- `context-budget` 审计已能回写到 `AgentRun` 运行态。
- `context-budget` 审计已加入 Agent graph 输出测试。
- 关键节点失败后会先进入 `error` 节点统一收口，而不是直接上抛出图。
- `waiting_approval` 已进入 `AgentRun` 运行态。
- assistant 消息已可携带 `metadata.agent.pendingApproval`，前端可见“等待审批”提示。
- 已新增 `GET /agent/runs/:runId`、`POST /agent/runs/:runId/approve`、`POST /agent/runs/:runId/reject`、`POST /agent/runs/:runId/cancel` 的 Agent 路由骨架。
- `AgentRun` 现在已经有单独的后端路由入口，审批状态不再只停留在消息 metadata。
- approve 现已把本轮批准的 tool id 写入运行态，并触发 resume helper 继续执行。
- `AgentRunStore` 已验证可回环保存 `pendingApproval`、`approvedToolIds`、`contextBudget`。
- `AgentRunStore` 已验证可完成收尾状态更新（`complete`）。
- `resumeApprovedAgentRun` 已验证会在批准后恢复运行，并保留 `approvedToolIds` 与 `contextBudget`。
- `AgentPolicy` 已验证允许 `read` / `web_search`，并拦截 `edit` / `terminal` / `external_mcp`。
- `AgentTraceEmitter` 已验证可正确生成 `data-execution-node` payload。
- `approvalNode` 已验证在缺少 pending approval 时会直接发 error trace。
- `AgentGraph` happy path 已验证可跑到 `evaluate` 并输出最终回答。
- `AgentGraph` 高风险工具 path 已验证会进入审批等待，不会执行 Harness。
- `chat route` 已验证 `agentEnabled = true` 会进入 AgentRun 路径。
- `chat route` 已验证普通发送不会误触发 AgentRun。
- `executionParsers` 已补齐 `plan` / `reason` 的 Agent trace 映射。
- `UChatExecutionTrace` 已验证可渲染 Agent `plan` / `approval` 节点，并保持展开后详情可见。
- `UChatThreadView` 已验证可显示 `blocked` Agent 状态提示。

### 进行中

- 审批通过后的 continue / resume 入口。
- `AgentRun` 的持久化落库。
- 审批通过后恢复原 Agent 流程的接口与事件契约。
- 审批 UI 还未接到新路由。

### 暂不做

- 自动编辑文件。
- 自动执行 terminal。
- 外部副作用工具自动发送。
- durable memory 默认写入。
- 多 Agent 协作主流程。
- 复杂审批 UI。
- 完整 checkpoint / interrupt / deep replan 主链。

本期不默认进入主链：

- 自动编辑文件。
- 自动执行 terminal。
- 自动发送企业微信或其它外部副作用动作。
- durable memory 写入。
- 多 Agent 协作。
- 复杂 LangGraph interrupt / checkpoint / deep replan。

这些不是停止建设，而是不默认进入 Agent 按钮后的自动主链。

## Implementation Checklist

### 1. Pre-Read

- [x] 阅读 `docs/chat/agent-runtime-design.md`。
- [x] 阅读 `docs/architecture/rag-langgraph-flow.md`。
- [x] 阅读 `docs/chat/chat-execution-trace-design.md`。
- [x] 阅读 `docs/tooling-runtime/harness-runtime-design.md`。
- [ ] 阅读 `server/src/services/rag-graph.ts`。
- [ ] 阅读 `server/src/services/rag-runables.ts`。
- [ ] 阅读 `server/src/mcp/harness/invocations.ts`。
- [ ] 阅读 `server/src/routes/proxy-provider/chat.routes.ts`。
- [ ] 阅读 `desktop/src/features/chat/core/protocol.ts`。
- [ ] 阅读 `desktop/src/shared/uchat/ui/executionParsers.ts`。

### 2. Backend Agent Module

- [ ] 新增 `server/src/agent/types.ts`。
- [ ] 定义 `AgentRun`、`AgentGoal`、`AgentPlan`、`AgentPlanStep`、`AgentObservation`。
- [ ] 新增 `server/src/agent/run-store.ts`。
- [ ] 第一版使用内存态 store，但接口设计要能替换为 SQLite store。
- [ ] 新增 `server/src/agent/trace.ts`。
- [ ] 将 Agent events 统一映射为 `AssistantExecutionNodeEvent`。
- [ ] 新增 `server/src/agent/policy.ts`。
- [ ] 默认允许工程任务所需的低风险动作与上下文收集。
- [ ] 默认阻断 edit / terminal / external side-effect。
- [x] 复用 `server/src/services/context-budget/` 作为 Agent 输入前的统一 token budget packer。
- [x] `capabilityIntentStep` 已接入 embedding + cosine similarity 的通用能力召回节点。

### 3. LangGraph AgentGraph

- [ ] 新增 `server/src/agent/graph.ts`。
- [ ] 使用 `@langchain/langgraph` 的 `Annotation.Root` 定义 `AgentGraphState`。
- [ ] 使用 `StateGraph` 定义最小主链。
- [ ] 节点包含 `prepareContext`、`plan`、`routeStep`、`retrieve`、`tool`、`generate`、`approvalRequired`、`evaluate`。
- [ ] 新增 `server/src/agent/nodes.ts`。
- [ ] 新增 `server/src/agent/runnables.ts`。
- [ ] 复用 `ragRunnableSequence` 或 `retrieveOnlyRunnable`，不复制 RAG 节点逻辑。
- [x] Agent `prepareContext` / `generate` 前复用现成 `contextBudgetService.pack`。
- [ ] 将 Harness invocation 包装成 graph node 或 LangChain runnable。
- [ ] Agent graph 节点 start / done / error 都要发 execution node。
- [x] `approval` 已作为独立节点接入主链。
- [x] `error` 已作为独立节点接入主链。
- [x] 关键节点失败会路由到 `error` 节点收口。

### 4. Chat Route Integration

- [ ] 在现有 chat 请求协议中确认 `agentEnabled` 的来源和语义。
- [ ] 当 `agentEnabled = true` 时创建 `AgentRun`。
- [ ] 将 AgentRun 执行结果写回现有 assistant message。
- [ ] 保持普通发送路径不变。
- [ ] 保持 RAG-enabled thread 的既有行为不回退。
- [ ] 不把 AgentRun 状态塞进 assistant message metadata 当作唯一真相。
- [x] `waiting_approval` 已写入 Agent run 状态。
- [x] assistant 消息可携带 `metadata.agent.pendingApproval`。
- [x] 前端已能显示“等待审批”提示。

### 5. UI Entry

- [ ] 在 composer 发送区域加入 Agent 按钮。
- [ ] Agent 按钮与普通发送按钮视觉上清晰区分。
- [ ] Agent 按钮触发本轮 `agentEnabled = true`。
- [ ] Agent running 时按钮状态可见。
- [ ] Agent failed / blocked 时按钮或 trace 有明确反馈。
- [ ] 不在第一期加入复杂工具选择面板。

### 6. Trace UI

- [ ] 确认 `data-execution-node` 能进入 `message.parts.data`。
- [ ] 确认 `plan`、`retrieve`、`tool`、`generate`、`evaluate` 节点能被解析。
- [ ] 高风险工具被阻断时显示 approval-required / blocked trace。
- [ ] 最终 assistant answer 与 execution trace 共存。

## Unit Test Checklist

### Backend

- [x] `AgentRunStore` create / get / update / complete。
- [x] `AgentRunStore` 可回环保存 `pendingApproval`、`approvedToolIds`、`contextBudget`。
- [x] `resumeApprovedAgentRun` 会在批准后恢复运行，并保留 `approvedToolIds` 与 `contextBudget`。
- [x] `AgentPolicy` 允许 `read` / `web_search`。
- [x] `AgentPolicy` 阻断 `edit` / `terminal` / `external_mcp`。
- [x] `AgentTraceEmitter` 正确生成 `data-execution-node` payload。
- [x] `context-budget` audit 能进入 Agent 相关 execution / observation。
- [x] `context-budget` audit 能回写到 `AgentRun`。
- [x] `AgentGraph` happy path：plan -> retrieve/tool -> generate -> evaluate。
- [x] `AgentGraph` 高风险工具 path：进入 approvalRequired，不执行 Harness。
- [x] chat route：普通发送不受影响。
- [x] chat route：`agentEnabled = true` 创建 AgentRun 并返回最终回答。
- [x] graph node error 能产生 error trace，且不静默降级。

### Frontend

- [ ] Agent 按钮点击后请求包含 `agentEnabled = true`。
- [ ] 普通发送不带 Agent 模式。
- [ ] execution parser 能解析 Agent node。
- [x] execution parser 能解析 Agent node。
- [x] trace UI 能显示 plan / approval / retrieve / tool / generate / evaluate。
- [ ] blocked / approval-required 节点有可见状态。
- [x] blocked / approval-required 节点有可见状态。
- [ ] final answer 仍正常显示。

## Developer Verification

- [ ] 运行 `pnpm check`。
- [ ] 如有新增后端测试，运行相关 server test。
- [ ] 如有新增前端测试，运行相关 desktop test。
- [ ] 本地启动开发流程，验证普通 chat。
- [ ] 本地启动开发流程，验证 Agent 按钮请求。
- [ ] 本地验证 RAG thread 不回退。
- [ ] 本地验证高风险工具不会自动执行。

## Owner Manual Test List

项目 owner 需要手测的内容应尽量少，集中在产品体验判断：

- [ ] Agent 按钮放在输入框旁边是否符合预期。
- [ ] Agent 按钮和普通发送的心智是否清楚。
- [ ] Agent 执行过程 trace 是否足够可信。
- [ ] 被阻断的高风险动作提示是否清楚。
- [ ] 最终回答质量是否满足第一期 MVP 预期。

## Completion Criteria

- [ ] Agent 按钮能触发 AgentRun。
- [ ] AgentRun 能通过 LangGraph 最小图执行。
- [ ] 工程任务主链跑通。
- [ ] 高风险工具不会自动执行。
- [ ] execution trace 全链路可见。
- [ ] 普通 chat 不回退。
- [ ] `pnpm check` 通过。
