---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: EvidenceGroundedFinalAnswer
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T009-evidence-summary-answer-stop-rule.md
  - docs/project-control/tasks/agent_node_T010-next-action-planner-json-contract-hardening.md
  - docs/project-control/tasks/agent_node_T011-workspace-path-argument-contract.md
  - docs/project-control/tasks/agent_node_T012-repeated-tool-guard.md
  - docs/chat/agent-frontend-workspace-smoke-method.md
  - server/src/agent/nodes.ts
  - server/src/agent/graph.test.ts
  - server/src/agent/nodes.test.ts
task_state: DONE
---

# agent_node_T013 evidence grounded final answer

## Target

T013 是 `Agent V1.5 final answer grounding` 任务。

它不是 `T009 / T010 / T011 / T012` 的补丁返工，也不是前端 UI、Provider Gateway 或 ToolNode 直答改造。

本次文档回填对应的是 `T013` 评审结论 `REVISE` 之后的最小整改，不是新任务。

本任务只处理一件事：

- 当 Agent 已拿到 completed tool evidence 或 retrieval evidence 后，`generate` 阶段必须产出面向用户的自然语言最终回答，而不是工具样式文本、trace 样式文本、JSON、`nextAction` JSON、`pendingToolCall` 文本或“我将调用工具”的伪执行话术。

## Allowed Changes

- `server/src/agent/nodes.ts`
- `server/src/agent/nodes.test.ts`
- 如需回归验证，可补 `server/src/agent/graph.test.ts`
- `docs/project-control/tasks/agent_node_T013-evidence-grounded-final-answer.md`
- `docs/project-control/agent-nodes-workboard.md`

## Forbidden Changes

- Agent V2
- DAG / 并发 / 多智能体 / 长期记忆
- 前端 trace UI
- Provider Gateway
- MCP registry
- workspace path normalize
- approval resume 大改
- 让 ToolNode 直接 answer
- 重写 Planner / Normalize / Policy / ToolNode 边界

## Invariants

以下边界保持不变：

1. Planner 只输出 `state.nextAction`
2. Normalize 只冻结 `nextAction.use_tool` 成 `pendingToolCall`
3. Policy 只审批 frozen `pendingToolCall`
4. ToolNode 只执行 approved frozen `pendingToolCall`
5. ToolNode 不直接返回最终回答
6. `selectedToolId` 不是执行入口
7. `capabilityIntent.selectedToolIds` 不是执行入口
8. `pendingApproval` 不得被伪装成“已执行完成”
9. 没有 completed evidence 时，不得声称已经查看过文件、目录、网页或终端结果

## Defect Layer

这是 `generate` 阶段的后端回答组织缺陷，不是 Planner、ToolNode 或前端展示层缺陷。

真实问题有两层：

1. `generate` 还在吃完整工具 `result` JSON，缺少“最终回答阶段”的强约束
2. 模型一旦吐出 `<function_calls>`、工具 JSON、`toolId/args` 文本或伪执行话术，当前后端没有最小输出防护

## Implementation Result

本次实现把收口点放在 `generate` 阶段本身，没有改 Graph 主路由。

完成内容：

1. `buildGenerateMessages(...)` 现在优先注入“最终回答阶段”指令，而不是把 generate 当成下一轮 Planner
2. tool evidence 不再把完整 `result` JSON 原样塞进回答上下文，改成面向回答的稳定 evidence 摘要块
3. retrieval evidence 改成受控的 chunk 摘要块，而不是让模型自己从原始协议里猜回答格式
4. 新增 generate 输出防护：
   - 拦截 `<function_calls>`
   - 拦截 `nextAction` / tool JSON
   - 拦截 `pendingToolCall` / `toolId` / `args` 协议文本
   - 拦截“我将调用工具”“下一步我会”之类伪执行话术
5. 新增最小保底回答：
   - `read_list` 用目录摘要直接回答
   - `read_open` 用文件内容预览直接概括
   - retrieval 现在优先使用最新 chunk content 预览回答，而不是只说“命中了某个文档”
   - `pendingApproval` 时明确说明等待审批，当前没有真实执行结果
   - 没有 completed evidence 时明确说明证据不足，不编造“已查看”
6. 这次没有改前端 UI，没有改 Provider Gateway，也没有让 ToolNode 直接 answer

### REVISE Minimal Fixes

本轮针对评审意见补了 2 个最小修订点和 1 个可选补强：

1. retrieval fallback 不再优先停在 `latestSummary.source === "retrieval"` 的文档命中摘要，而是优先读取最新 retrieval 的前 1-3 个 chunk 内容，并以“根据当前检索证据”组织自然语言回答
2. no-evidence guard 新增“直接编造 workspace / 文件结果”的防护，不再只依赖“我已经查看了”这一类显式自述
3. 补了裸 `toolId` 泄漏回归测试，覆盖 `read_open completed, README.md says ...` 这类输出

## Test Coverage

新增 `server/src/agent/nodes.test.ts`，覆盖：

1. `read_list evidence -> natural answer`
2. `read_open evidence -> natural answer`
3. `retrieval evidence -> grounded answer from chunk content`
4. `no completed evidence -> do not claim already checked`
5. `no completed evidence -> block direct fabricated workspace results`
6. `pendingApproval -> waiting approval answer`
7. `read_open completed -> block bare toolId leakage`

并复跑：

- `server/src/agent/graph.test.ts`
- `server/src/agent/next-action-planner.test.ts`

确保：

- repeated guard 仍能把重复动作收口到 answer
- answer stop rule 仍保持原边界

## Frontend Smoke

本轮按 `docs/chat/agent-frontend-workspace-smoke-method.md` 复核了手测入口和绑定要求。

### Smoke Method

- 入口文档：`docs/chat/agent-frontend-workspace-smoke-method.md`
- 关键要求：
  - 必须通过当前线程输入框左侧 `+ -> Workspace -> Add to workspace` 绑定 workspace
  - 不能只看左侧 workspace 选中态
  - 不能把直调 API 当成前台绑定证据

### Smoke Result

- 本轮没有伪造 smoke
- 当前整改轮次没有重跑前台黑盒 smoke
- 原因：本次派发只要求做 T013 最小整改并回交评审线程；当前没有把前台结果误报成已通过
- 当前已知前台 smoke 阻塞仍沿用上轮记录，是否仍存在需要评审线程或后续黑盒复测确认

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/nodes.test.ts src/agent/graph.test.ts src/agent/next-action-planner.test.ts`
  - 结果：通过，`63 passed`
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过

本轮没有重跑 `pnpm package:electron:win`。如后续评审要求打包或前台 smoke，需要单独追加，不在这次最小整改里伪造结果。

## Review Outcome

`2026-07-04` 评审整改已通过，`T013` 状态更新为 `DONE`。

本轮确认的事实是：

1. retrieval fallback 已从“只说命中文档”改成优先基于 chunk 内容回答
2. no-evidence 下已补“直接编造 workspace / 文件结果”的防护测试
3. 裸 `toolId` 泄漏场景已补最小回归测试
4. 没有改 Graph 主路由
5. 没有改 ToolNode 直答
6. 没有改 Planner parser / repeated guard / path normalize
7. 没有改前端 UI / Provider Gateway

仍保留但不阻断 `T013 DONE` 的事项：

- 打包链路仍被仓库现有非 T013 缺陷阻断
- 前台完整黑盒 smoke 还需要在这些既有阻塞清理后继续跑
