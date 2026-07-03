Status: Planned
Owner: chat / runtime
Last verified: 2026-07-02
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
- 有限步迭代执行主链。
- 目标拆解、上下文收集、动作执行、校验收口等 Agent 主链能力。
- 高风险工具只进入 blocked / approval-required trace，不执行。
- `data-execution-node` 作为唯一过程展示主通道。

## Current Progress

> 记录当前已经落地的 Phase 1 关键节点，不等于 Phase 1 全部完成。

### 已完成

- 当前主链已拆成 `capabilitySelectStep -> toolGuardStep`：
  - `capabilitySelectStep` 负责获取 Harness 候选并完成本轮候选选择
  - `toolGuardStep` 只负责本地格式/合法性守卫，不再承担第二套主识别
- `approval` 已作为独立 LangGraph 节点接入主链。
- `tool` 已作为独立 LangGraph 节点接入主链，并负责选择低风险能力、交由 Harness 执行。
- `error` 已作为独立 LangGraph 节点接入主链。
- `toolNode` 已不再是占位节点，而是通过 Harness invocation 真实执行兼容能力调用。
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
- `AgentRunStore` 已验证可回环保存 `pendingApproval`、`approvedInvocations`、`contextBudget`。
- `AgentRunStore` 已验证可完成收尾状态更新（`complete`）。
- `resumeApprovedAgentRun` 已验证会在批准后恢复运行，并保留 `approvedInvocations` 与 `contextBudget`。
- approve 后恢复完成的 Agent 结果已能回写原 assistant 消息，不再只改变 `AgentRun` 状态。
- `AgentRun` 已显式记录审批挂起消息落点（assistant message id / parent id），保证 resume 后仍能续写同一轮消息。
- `AgentRun` 已完成 SQLite 持久化读写闭环；运行态读取采用“内存优先，缺失后查 repository”，恢复后仍可继续推进状态。
- approve 后恢复阶段新增的 execution trace 已能回写到原 assistant 消息；刷新线程后，后续执行节点不会丢失或退回旧审批态。
- `AgentPolicy` 已验证允许 `read` / `web_search`，并拦截 `edit` / `terminal` / `external_mcp`。
- `AgentTraceEmitter` 已验证可正确生成 `data-execution-node` payload。
- `approvalNode` 已验证在缺少 pending approval 时会直接发 error trace。
- `AgentGraph` happy path 已验证可跑到 `evaluate` 并输出最终回答。
- `AgentGraph` 高风险工具 path 已验证会进入审批等待，不会执行 Harness。
- `Harness` 统一 approval gate 已覆盖 Agent path、direct MCP invocation 和普通 chat tool loop。
- `chat route` 已验证 `agentEnabled = true` 会进入 AgentRun 路径。
- `chat route` 已验证普通发送不会误触发 AgentRun。
- `approve / reject / cancel` 已验证审批态边界：非等待审批时 approve 幂等返回、reject / cancel 会清掉 `pendingApproval` 与 `currentStepId`。
- `executionParsers` 已补齐 `plan` / `reason` 的 Agent trace 映射。
- `UChatExecutionTrace` 已验证可渲染 Agent `plan` / `approval` 节点，并保持展开后详情可见。
- `UChatThreadView` 已验证可显示 `blocked` Agent 状态提示。

### 当前口径

- 一期主链已收口到可交付状态。
- 当前仍保留的未完成项，不再属于一期阻断项，而是后续增强项。
- 剩余需继续推进的内容，统一以下方 `Phase 1 Remaining` 为准。

### Bug List

- [x] `AgentGraph` 已补上显式 `routeStep` 迭代节点；工具后“回看一次”的行为不再只依赖布尔状态拐弯，而是走清晰可见的有限步迭代路由。

### 真相结论

- `chat.routes` 的 Agent 分支必须保持兼容，`agentEnabled` 只能是增量开关，不能改坏普通 chat。
- `Harness` 是执行边界，Agent 只做编排和决策，不接管工具执行本身。
- `run-store` 不应该在模块加载时强依赖真实 DB，否则单测和本地开发会被一起拖垮。
- `AgentRun` 不是 assistant message metadata 的别名，metadata 只能做可见提示，不是状态真相。
- `approve / continue / resume` 语义要以后端运行态为准，不要只在 UI 文案里解释。
- 错误优先策略成立：拿不到必要上下文时应进入错误节点或失败状态，不做静默降级。
- `read/search/RAG` 不是 Agent 的唯一叙事，它们只是当前产品里可复用的能力节点。
- `AgentRun` 持久化不能只做写入；只要支持 resume，就必须保证读取、恢复、后续状态推进是同一套契约。
- 审批恢复如果不绑定原 assistant 消息，就会出现“运行态已完成，但会话没续上”的假闭环；这层绑定必须由后端维护。
- `data-execution-node -> uchat message.parts.data -> executionParsers -> UChatExecutionTrace` 这条展示链已经打通，并有前端 runtime / view 自动化测试覆盖。
- `AgentGraph` 当前真实形态已经是有限步迭代执行；Phase 1 剩下的是把联调边界继续压稳，而不是再补主链骨架。
- Phase 1 当前已通过 `pnpm check`、关键 server tests、关键 desktop tests，主线代码已经收口到可继续联调的状态。
- `approve -> resume` 的真实前端链路已手测通过：批准后会继续执行、生成最终回答，刷新线程后 trace 与正文都能保留。
- `Capability / Tool` 执行态分层已在 graph、resume、持久化与 trace 中收口；执行层以 `toolId` 为主，不再依赖旧的 capability/tool 混用语义。
- Harness 的 schema 校验与 workspace boundary contract 已在真实 `POST /mcp/invocations` 接口层手测生效。
- 守卫链路现已明确分层：候选选择和调用前守卫是两个独立节点；守卫节点不再继续调用 embedding。

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
- [x] 阅读 `server/src/services/rag-graph.ts`。
- [x] 阅读 `server/src/services/rag-runables.ts`。
- [x] 阅读 `server/src/mcp/harness/invocations.ts`。
- [x] 阅读 `server/src/routes/proxy-provider/chat.routes.ts`。
- [x] 阅读 `desktop/src/features/chat/core/protocol.ts`。
- [x] 阅读 `desktop/src/shared/uchat/ui/executionParsers.ts`。

### 2. Backend Agent Module

- [x] 新增 `server/src/agent/types.ts`。
- [x] 定义 `AgentRun`、`AgentGoal`、`AgentPlan`、`AgentPlanStep`、`AgentObservation`。
- [x] 新增 `server/src/agent/run-store.ts`。
- [x] 第一版使用内存态 store，但接口设计要能替换为 SQLite store。
- [x] 新增 `server/src/agent/trace.ts`。
- [x] 将 Agent events 统一映射为 `AssistantExecutionNodeEvent`。
- [x] 新增 `server/src/agent/policy.ts`。
- [x] 默认允许工程任务所需的低风险动作与上下文收集。
- [x] 默认阻断 edit / terminal / external side-effect。
- [x] 复用 `server/src/services/context-budget/` 作为 Agent 输入前的统一 token budget packer。
- [x] 当前主链已拆成 `capabilitySelectStep -> toolGuardStep`，候选选择与调用前守卫职责已分离。

### 3. LangGraph AgentGraph

- [x] 新增 `server/src/agent/graph.ts`。
- [x] 使用 `@langchain/langgraph` 的 `Annotation.Root` 定义 `AgentGraphState`。
- [x] 使用 `StateGraph` 定义最小主链。
- [x] 节点包含 `prepareContext`、`plan`、`routeStep`、`retrieve`、`tool`、`generate`、`approvalRequired`、`evaluate`。
- [x] `AgentGraph` 改为有限步迭代执行，而不是单程图。
- [x] 至少支持一次 `capabilityIntent / policy / toolResult` 回流再决策。
- [x] 增加 loop guard，限制单轮自动执行步数。
- [x] 每轮继续执行必须消费真实 `observation / tool result`，不允许空证据继续冒充已执行。
- [x] 新增 `server/src/agent/nodes.ts`。
- [x] 新增 `server/src/agent/runnables.ts`。
- [x] 复用 `ragRunnableSequence` 或 `retrieveOnlyRunnable`，不复制 RAG 节点逻辑。
- [x] Agent `prepareContext` / `generate` 前复用现成 `contextBudgetService.pack`。
- [x] Agent 侧已通过 graph node 完成工具选择与路由，执行仍由 Harness 负责。
- [x] Agent graph 节点 start / done / error 都要发 execution node。
- [x] `approval` 已作为独立节点接入主链。
- [x] `tool` 已作为独立节点接入主链，并负责选择低风险能力、交由 Harness 执行。
- [x] `error` 已作为独立节点接入主链。
- [x] 关键节点失败会路由到 `error` 节点收口。

### 4. Chat Route Integration

- [x] 在现有 chat 请求协议中确认 `agentEnabled` 的来源和语义。
- [x] 当 `agentEnabled = true` 时创建 `AgentRun`。
- [x] 将 AgentRun 执行结果写回现有 assistant message。
- [x] 保持普通发送路径不变。
- [x] 保持 RAG-enabled thread 的既有行为不回退。
- [x] 不把 AgentRun 状态塞进 assistant message metadata 当作唯一真相。
- [x] `waiting_approval` 已写入 Agent run 状态。
- [x] assistant 消息可携带 `metadata.agent.pendingApproval`。
- [x] 前端已能显示“等待审批”提示。
- [x] approve 后完成态会回写原 assistant 消息，而不是额外追加一条新 assistant 回复。

### 5. UI Entry

- [x] 在 composer 发送区域加入 Agent 按钮。
- [x] Agent 按钮与普通发送按钮视觉上清晰区分。
- [x] Agent 按钮触发本轮 `agentEnabled = true`。
- [x] Agent running 时按钮状态可见。
- [x] Agent failed / blocked 时按钮或 trace 有明确反馈。
- [x] 不在第一期加入复杂工具选择面板。
- [x] 等待审批消息已可在前端执行 approve / reject。
- [x] 审批按钮处理中会禁点，并显示处理中状态文案。
- [x] 审批失败会保留错误反馈，不只依赖全局 toast。
- [x] Agent 运行中消息已区分普通回复与 Agent 执行中文案。
- [x] Agent waiting_approval / blocked / failed 已统一基础产品文案。

### 6. Trace UI

- [x] 确认 `data-execution-node` 能进入 `message.parts.data`。
- [x] 确认 `plan`、`retrieve`、`tool`、`generate`、`evaluate` 节点能被解析。
- [x] 高风险工具被阻断时显示 approval-required / blocked trace。
- [x] 最终 assistant answer 与 execution trace 共存。

## Unit Test Checklist

### Backend

- [x] `AgentRunStore` create / get / update / complete。
- [x] `AgentRunStore` 可回环保存 `pendingApproval`、`approvedInvocations`、`contextBudget`。
- [x] `resumeApprovedAgentRun` 会在批准后恢复运行，并保留 `approvedInvocations` 与 `contextBudget`。
- [x] `AgentRun` 持久化已覆盖读取、恢复和后续状态推进，且不会破坏内存态单测。
- [x] `AgentRun` 可在内存态丢失后从 repository 读回。
- [x] `AgentRun` 缺 `runtimeInput` 时会按错误优先策略直接失败，不做降级。
- [x] 审批态 `approve / reject / cancel` 边界已覆盖测试。
- [x] 审批恢复后会把完成结果续写回原 assistant 消息；reject 不会误写恢复消息。
- [x] 审批恢复后新增的 execution trace 会续写回原 assistant 消息，刷新线程后仍可读。
- [x] `AgentPolicy` 允许 `read` / `web_search`。
- [x] `AgentPolicy` 阻断 `edit` / `terminal` / `external_mcp`。
- [x] `AgentTraceEmitter` 正确生成 `data-execution-node` payload。
- [x] `context-budget` audit 能进入 Agent 相关 execution / observation。
- [x] `context-budget` audit 能回写到 `AgentRun`。
- [x] `AgentGraph` happy path：plan -> retrieve/tool -> generate -> evaluate。
- [x] `AgentGraph` low-risk tool path：意图识别 -> policy -> tool -> generate -> evaluate（执行由 Harness 负责）。
- [x] `AgentGraph` 高风险工具 path：进入 approvalRequired，不执行 Harness。
- [x] `AgentGraph` 有限步迭代 path：tool result 会回流到后续判断，而不是一次 tool 后直接结束语义。
- [x] `AgentGraph` loop guard：超过最大步数时会停止并给出明确状态。
- [x] 无真实工具结果 / 检索证据时，不会伪造“已查看目录/文件/网页”的执行结论。
- [x] 执行态 capability/tool 分层：`selectedToolId / pendingToolCall.toolId / lastToolExecution.toolId` 已独立收口。
- [x] Harness 统一 schema / boundary contract：高风险工具缺参会报校验错误，workspace 越界会给出明确 boundary 审批原因。
- [x] chat route：普通发送不受影响。
- [x] chat route：`agentEnabled = true` 创建 AgentRun 并返回最终回答。
- [x] graph node error 能产生 error trace，且不静默降级。

### Frontend

- [x] Agent 按钮点击后请求包含 `agentEnabled = true`。
- [x] 普通发送不带 Agent 模式。
- [x] execution parser 能解析 Agent node。
- [x] execution parser 能解析 Agent node。
- [x] trace UI 能显示 plan / approval / retrieve / tool / generate / evaluate。
- [x] blocked / approval-required 节点有可见状态。
- [x] final answer 仍正常显示。
- [x] 等待审批消息可触发 approve / reject，失败时有可见错误反馈。

## Developer Verification

- [x] 运行 `pnpm check`。
- [x] 如有新增后端测试，运行相关 server test。
- [x] 如有新增前端测试，运行相关 desktop test。
- [x] 本地启动开发流程，验证普通 chat。
- [x] 本地启动开发流程，验证 Agent 按钮请求。
- [ ] 本地验证 RAG thread 不回退。
- [x] 本地验证高风险工具不会自动执行。
- [x] 本地验证审批恢复后 trace 刷新不丢。
- [x] 本地验证 Harness 缺参 / 越界 contract 生效。

## Owner Manual Test List

项目 owner 需要手测的内容应尽量少，集中在产品体验判断：

- [ ] Agent 按钮放在输入框旁边是否符合预期。
- [ ] Agent 按钮和普通发送的心智是否清楚。
- [ ] Agent 执行过程 trace 是否足够可信。
- [ ] 被阻断的高风险动作提示是否清楚。
- [ ] 最终回答质量是否满足第一期 MVP 预期。

## Latest Manual Verification

- [x] Agent 线程内发送高风险文件删除请求，会进入审批等待。
- [x] 点击 `批准` 后，Agent 会继续执行，而不是停留在审批态。
- [x] 批准后可看到后续节点：`工具选择`、`下一步判断`、`组织最终回答`、`检查结果`。
- [x] 刷新线程后，恢复阶段的 execution trace 与最终正文仍然可见。

## Completion Criteria

- [x] Agent 按钮能触发 AgentRun。
- [x] AgentRun 能通过 LangGraph 最小图执行。
- [x] AgentRun 能通过有限步迭代图执行。
- [x] 工程任务主链跑通。
- [x] 高风险工具不会自动执行。
- [x] execution trace 全链路可见。
- [x] 普通 chat 不回退。
- [x] `pnpm check` 通过。

## Phase 1 Remaining

- 当前仍未明确做完、但也不再阻断一期收尾的，只剩这几项后续增强：
  - 工具 + RAG 自然组合
  - 更强的 observation-aware 回看升级
  - `blockedReason / terminal reason` 可观测性增强
  - `evaluate` 节点语义升级
- 另外还有一项验证缺口尚未补票据：
  - 本地验证 RAG thread 不回退
- 除以上项目外，一期主链按当前文档口径视为已收口。
