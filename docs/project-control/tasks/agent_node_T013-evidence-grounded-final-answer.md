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
   - retrieval 用检索摘要 / chunk 预览直接回答
   - `pendingApproval` 时明确说明等待审批，当前没有真实执行结果
   - 没有 completed evidence 时明确说明证据不足，不编造“已查看”
6. 这次没有改前端 UI，没有改 Provider Gateway，也没有让 ToolNode 直接 answer

## Test Coverage

新增 `server/src/agent/nodes.test.ts`，覆盖：

1. `read_list evidence -> natural answer`
2. `read_open evidence -> natural answer`
3. `retrieval evidence -> grounded answer`
4. `no completed evidence -> do not claim already checked`
5. `pendingApproval -> waiting approval answer`

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
- 当前仓库没有现成的稳定前台 smoke 自动化
- `pnpm package:electron:win` 本轮未能产出可继续手测的打包结果
- 阻塞原因不是 T013 改动，而是仓库当前已有非本任务失败项：
  - `desktop/src/shared/uchat/ui/UChatSidebarView.test.tsx` 仍有 1 个失败用例
  - `server` 侧仍有多组既有测试 / 依赖缺口，例如 `xlsx` 缺失、若干历史测试 import 失败
- 因此本轮前台 smoke 证据仍以“手测方法已检索并按该 runbook 准备”为准，没有把未跑通的黑盒结果误报成已通过

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/nodes.test.ts src/agent/graph.test.ts src/agent/next-action-planner.test.ts`
  - 结果：通过，`61 passed`
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过
- `pnpm package:electron:win`
  - 结果：失败
  - 失败原因：
    - 打包流程会带出仓库当前已有的 desktop / server 非本任务失败项
    - 本轮没有修改这些模块，也没有顺手把无关缺陷混入 T013

## Acceptance Outcome

T013 当前可标记 `DONE` 的依据是：

1. completed `read_list` evidence 可收口成自然语言目录回答
2. completed `read_open` evidence 可收口成自然语言文件内容概括
3. retrieval evidence 可收口成 grounded answer
4. `pendingApproval` 不会被伪装成“已执行”
5. 无 completed evidence 时不会编造“已查看”
6. generate 最终回答不再直接暴露 tool JSON / `pendingToolCall` / `nextAction` JSON / `<function_calls>`
7. 没有破坏 Planner / Normalize / Policy / ToolNode 边界
8. 后端定向测试通过

未完成项和风险单独记录，不混入 T013 结论：

- 打包链路仍被仓库现有非 T013 缺陷阻断
- 前台完整黑盒 smoke 还需要在这些既有阻塞清理后继续跑
