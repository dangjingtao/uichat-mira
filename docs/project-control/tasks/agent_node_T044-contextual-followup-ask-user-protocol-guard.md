---
status: current
priority: P0
owner: agent-runtime
last_verified: 2026-07-22
layer: project-control
module: AgentRuntime
feature: ContextualFollowupAskUserProtocolGuard
doc_type: task-card
canonical: true
task_state: READY_FOR_REVIEW
related:
  - docs/project-control/tasks/agent_v15_T08-strengthen-planner.md
  - docs/project-control/tasks/agent_node_T013-evidence-grounded-final-answer.md
  - docs/project-control/tasks/browser_attached_T001-harness-capability-integration.md
---

# agent_node_T044 Contextual Follow-up / ask_user / Protocol Leak Fix

## Source And Verified Cause

2026-07-22 前台 smoke `runId=069867dc-f1a8-45e3-b722-8bdd6e7db851` 复现：

- 四个 `browser_attached_*` 工具已经正常注册并进入本轮 20 个 exposed tools。
- Planner 合法解析出 `ask_user`，`selectedToolId=null`，没有产生 `pendingToolCall` 或真实工具 invocation。
- 本轮持久化 Goal 只包含最新 follow-up“你可以用 browser_attached 系列工具帮我搞”，没有由 Planner 把上一轮具体登录任务固化为本轮完整任务语义。
- Graph 将 `ask_user` 路由到 Generate，但 Generate 没有确定性使用 `nextAction.question`，而是再次调用普通回答模型。
- 回答模型输出 `<function_calls>...</function_calls>`；当前 Generate 只靠 prompt 禁止，没有最小协议泄漏拦截，因此原样落库并展示，run 最终显示 `completed`。
- 现有回归 `generateNode rewrites tool-style output...` 可稳定复现该泄漏：期望自然回答，实际收到 `<function_calls>{...}</function_calls>`。

缺陷层级：Agent 任务语义与 Planner → Generate 交接缺陷。项目 owner 已明确批准本卡最小整改，同时禁止重做 AgentGraph 或恢复旧整套 semantic generate guards。

## Target

只修三件事：

1. follow-up 进入 Planner 时，使用已有有限对话历史形成完整任务语义；不能把“继续 / 就按这个做 / 用这个工具帮我搞”之类当前请求脱离上一轮具体任务理解。
2. `nextAction.type === "ask_user"` 时，用户看到的内容确定性来自 `nextAction.question`，本轮不再次让 Generate 模型猜问题或尝试工具调用。
3. Generate 最终文本出现明确内部 tool-call envelope 时，禁止原样落库或展示；只做协议泄漏防护，不恢复 Evidence/成功判定/语义关键词裁判。

## Allowed Changes

- `server/src/agent/planner/prompt.ts`，仅限让现有 Planner 基于 bounded relevant history 解析 follow-up 完整任务语义，并要求同一 Planner 输出用 `planPatch` 固化 current goal / completion criteria
- `server/src/agent/planner/task-plan.ts`，仅在现有 `planPatch` 合同确需最小支持时修改
- `server/src/agent/planner/node.ts`，仅限现有 Planner 决策与 task frame 的最小接线或 trace 证据
- `server/src/agent/nodes/generate.ts`，仅限 `ask_user.question` 确定性交付和内部 tool-call envelope 最小拦截
- `server/src/agent/graph/routes.ts`，仅在不新增节点、不重构 Graph 的前提下做必要接线；优先保持现有路由
- `server/src/agent/nodes/goal-plan.ts`、`server/src/agent/index.ts`、`server/src/routes/proxy-provider/chat.routes.ts`，仅在传递现有 bounded conversation context 所必需时修改；不得增加第二个语义模型或 selector
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/agent/__tests__/nodes.test.ts`
- `server/src/agent/__tests__/pi-agent-loop-runtime.test.ts`，仅限本卡近黑盒回归，并保留当前工作树已有改动
- `server/src/routes/proxy-provider/chat.routes.test.ts`，仅在路由级持久化/回答合同需要时修改
- 本任务卡与 `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- 重构 AgentGraph、增加节点或增加第二个语义决策器 / selector / completion engine
- 修改 Browser Attached Runtime、WebBridge、Playwright Computer Use Runtime、浏览器工具 schema 或执行合同
- 增加 browser tool ID 特判、follow-up 关键词表、正则 follow-up 分类器或固定拼接上一条消息
- 恢复旧整套 Generate semantic guards、Evidence readiness 判断、成功/失败语义裁判或工具结果业务 fallback
- 修改 Evidence、Normalize、Policy、ToolNode、Harness exposure、approval、resume 或 persistence 语义
- 修改前端 UI、共享组件、i18n、网络/打包配置或 `pnpm-lock.yaml`
- 为 smoke 加 hardcoded 用户名、密码、本地路径、Provider、模型或 mock 默认值

## Implementation Contract

### Contextual Follow-up

- 当前用户消息仍作为原始请求保留，不能被隐藏改写。
- 复用 `buildRelevantConversationHistory` 和当前 Planner，不增加 Planner 前置模型调用。
- Planner prompt 必须明确：当前请求可能是对最近具体任务的授权、继续或方式修正；若有限历史已经唯一确定未完成任务，不得只因最新一句省略目标而重复 `ask_user`。
- 完整任务语义由同一个 Planner 通过现有 `planPatch` / currentTaskFrame 表达；不得使用 browser 特判、关键词或正则决定继承关系。
- 历史仍必须 bounded；不得把无限完整会话塞入 Planner。

### ask_user Delivery

- 当 `state.nextAction.type === "ask_user"` 时，Generate 不调用回答模型，直接返回非空 `nextAction.question`。
- trace / observation 必须能区分 deterministic ask-user delivery 与模型生成回答。
- 该路径不得产生 `pendingToolCall`、tool execution 或 tool Evidence。
- 用户下一条消息仍通过现有新一轮 Planner 流程处理；不新增 resume 状态机。

### Protocol Leak Guard

- 只拦截明确内部调用 envelope，例如 `<function_calls>...</function_calls>`、`<invoke ...>`、结构化 `pendingToolCall` 或明确 tool-call JSON envelope。
- 不以普通自然语言中的“工具、调用、下一步”等词做语义判断。
- 不重新判断 Evidence 是否充分、任务是否成功或模型回答业务内容是否正确。
- 命中时返回诚实、最小的无效输出说明，明确本轮没有因此执行工具；内部 envelope 不得进入最终 answer。

## Acceptance Criteria

1. 近黑盒 follow-up 场景中，Planner payload 同时包含当前请求和 bounded relevant history，并能用现有 Planner 输出 `planPatch + use_tool` 表达上一轮具体任务，不需要 browser 特判。
2. “上一轮具体登录任务 → 本轮授权使用 attached browser”场景，若参数已经齐备，Planner 可以直接选择暴露的 `browser_attached_*` 工具。
3. 真正缺信息时，Planner `ask_user.question` 原样成为最终 answer，Generate model invocation count 为 0。
4. `ask_user` 路径没有 `pendingToolCall`、tool execution、tool Evidence 或“工具已执行”表述。
5. Generate 模型输出 `<function_calls>`、`<invoke>`、`pendingToolCall` 或明确 tool-call envelope 时不会原样返回。
6. 协议拦截是 narrow guard；普通包含“工具/调用/下一步”的合法自然语言不被拦截。
7. 不修改 Browser Runtime、Harness、Evidence、Policy、Normalize、ToolNode、approval 或 resume。
8. 对应 Planner、Generate、Pi loop / route 回归通过，Server typecheck 和根 `pnpm check` 通过。

## Required Tests

- Planner prompt：相关历史中存在唯一具体未完成任务，当前 follow-up 只授权工具/继续；mock Planner 输出 `planPatch + use_tool` 后 currentTaskFrame 保留完整任务。
- Planner prompt：历史不明确时仍允许 `ask_user`，不硬编码 follow-up 词。
- Generate：`ask_user.question` 原样返回，回答模型不被调用。
- Generate：`ask_user` 不产生工具执行事实。
- Generate：至少覆盖 `<function_calls>`、`<invoke>`、`pendingToolCall`/明确 JSON envelope 的最小拦截。
- Generate：合法自然语言提及工具调用不会误拦截。
- 近黑盒：上下文 follow-up 进入 `browser_attached_*` use_tool 路径；若 mock 选择 ask_user，则页面最终文本等于 Planner question，且无工具 invocation。
- 复跑当前已失败的 `generateNode rewrites tool-style output...` 回归并使其通过；不得通过删除断言规避。

至少运行：

```bash
pnpm --filter @ui-chat-mira/server typecheck
pnpm check
```

并运行实际修改文件对应的定向 Vitest。

## Owner Smoke Cases

### Smoke A: Follow-up Inheritance And Attached Tool Call

前置：Chrome 触界扩展已连接，当前用户已登录 UIChat Mira，线程已开启 Agent 模式。

同一线程依次发送：

```text
1. 我要登录 http://localhost:5173/#/login。账号和密码我会在本轮提供。先只告诉我计划，不要执行。
2. 账号是 <TEST_USERNAME>，密码是 <TEST_PASSWORD>。就用 browser_attached 系列工具继续执行。
```

预期：

- 第二轮 Planner 的 current goal / plan 不再只是“用工具继续”，而是完整登录任务。
- 参数齐备时选择 `browser_attached_look / browse / act` 中的合适工具，不重复询问“具体想做什么”。
- 不出现 `<function_calls>` 文本。
- 实际填写/提交若触发 approval，按现有审批流程显示；本卡不改变审批。

### Smoke B: Real ask_user Delivery

新线程发送：

```text
请用触界帮我处理一下。
```

预期：

- Planner 可选择 `ask_user`。
- 最终 assistant 文本与 trace 中 `selectedToolTarget` / Planner question 一致。
- 本轮没有 tool node、invocation、tool Evidence，也不出现 `<function_calls>`。

### Smoke C: Protocol Text Must Not Leak

使用测试 Provider 或能稳定返回内部 envelope 的受控模型响应，让 Generate 返回：

```xml
<function_calls>
<invoke name="browser_attached_look"></invoke>
</function_calls>
```

预期：

- 最终 assistant 文本不包含 `<function_calls>` 或 `<invoke>`。
- 数据库 message content 也不包含该 envelope。
- trace 明确记录 protocol guard triggered。
- 本轮没有因为该文本产生工具 invocation。

## Evidence Requirements

- 完整 changed-files / diff summary / scope audit
- 复现 run 与修复后近黑盒对照
- Planner contextual follow-up payload 与 task frame 证据
- deterministic ask_user 模型调用次数与最终文本证据
- protocol guard 命中/不误伤测试证据
- Server 定向测试、typecheck、`pnpm check`
- owner smoke A/B 结果；Smoke C 可由受控集成测试提供
- env / mock / hardcode 说明
- 未完成项、风险、独立提交 SHA（若未提交则明确说明）

## Implementation Evidence

- Planner 继续保留原始 `currentUserRequest`，并通过已有 bounded recent conversation history 理解 follow-up；同一个 Planner 使用现有 `planPatch` 写出完整目标与完成条件，没有增加 browser tool ID 特判、关键词表、正则分类器或第二个语义模型。
- 仅在存在前序 user / assistant 对话时，将 Planner 新增的语义计划投影到 `currentTaskFrame.currentGoal` 与 `completionCriteria`；单轮请求不改变原有任务语义投影行为。
- Generate 在 `nextAction.type === "ask_user"` 时直接返回 `nextAction.question`，不调用回答模型；trace 标记 `answerSource=planner_ask_user_question`、`modelInvoked=false`。
- Generate 增加窄协议拦截，覆盖 `<function_calls>`、`<invoke>`、结构化 `pendingToolCall` 和明确 tool-call JSON envelope；合法自然语言提及工具使用不受影响。
- 近黑盒 Pi loop 覆盖 contextual attached-browser `use_tool` 路由，以及 `ask_user` 无 `pendingToolCall`、无 tool execution 的路径。

验证结果（2026-07-22，最新工作树）：

```text
PASS  T044 Generate 定向回归（function_calls、ask_user、协议 envelope、自然语言不误伤）
PASS  T044 Planner contextual follow-up 定向回归
PASS  pi-agent-loop-runtime.test.ts：7/7
PASS  @ui-chat-mira/server typecheck
PASS  pnpm check（6 个 workspace package typecheck）
PASS  git diff --check（T044 文件）
```

未完成项：

- Owner Smoke A / B 尚待项目 owner 在已连接触界扩展的真实线程中执行。
- Smoke C 已由受控模型返回值回归覆盖；仍可在测试 Provider 环境补做持久化层人工核对。
- 当前工作树包含多个其他任务的既有未提交改动；T044 未独立提交、未推送。

## Review Prompt

你正在评审 `agent_node_T044 Contextual Follow-up / ask_user / Protocol Leak Fix`。

只审查本次 smoke 暴露的三项问题：

1. follow-up 是否由现有 Planner 基于 bounded history 形成完整任务语义，而非关键词/正则/固定上一条拼接
2. `ask_user.question` 是否确定性交付，且不再调用 Generate 模型
3. 内部 tool-call envelope 是否被 narrow guard 阻止落库和展示
4. 是否新增 browser 特判、第二语义决策器、复杂节点或旧 semantic guards
5. 是否修改 Browser Runtime、Harness、Evidence、Policy、Normalize、ToolNode、approval 或 resume
6. 回归测试是否真实覆盖原失败，不以删断言或 mock 业务成功规避

输出：PASS / BLOCKED、阻断项、非阻断项、三条修复证据、scope audit、测试、owner smoke 和剩余风险。
