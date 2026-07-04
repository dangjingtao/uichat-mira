---
status: current
priority: P0
owner: agent-runtime
last_verified: 2026-07-05
layer: project-control
module: ProjectControl
feature: LocalToolRoutingAndSchemaGuard
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/agent-nodes-V1.5 终审.md
  - docs/project-control/agent-nodes-V1.5 全新线程复测.md
  - docs/chat/agent-frontend-workspace-smoke-method.md
  - server/src/agent/next-action-planner.ts
  - server/src/agent/tool-call-normalize.ts
  - server/src/agent/graph.ts
  - server/src/agent/nodes.ts
  - server/src/agent/evidence.ts
  - server/src/agent/types.ts
  - server/src/agent/tool-node.ts
task_state: TODO
---

# agent_node_T016 local tool routing and schema guard

## Target

`T016` 是 `Agent V1.5 P0` 修复任务。

它只处理弱 task model 条件下暴露出来的三类前台阻断：

1. workspace local intent 误走外部 `web_search`
2. tool args 不符合 schema 时，在 Normalize 阶段直接 failed
3. `generate` 返回空回答时，工具已执行但前台没有可交付结果

这张卡只补最小硬防线。

它不是：

- 工具选择大改
- Agent V2
- DAG / 并发 / 多智能体
- 长期记忆
- Provider Gateway
- Phoenix UI 大改
- 前端大改
- 单纯依赖“换更强模型”过验收

## Source Trigger

本任务直接来自两份 `V1.5 Final Acceptance Gate` 报告的共同 blocker：

- `P0-8`：workspace retrieve / 本地文件复杂问题仍可能误走 `web_search`
- `P0-9`：本地 `README.md` 内容问题会在 Normalize 阶段触发 schema invalid
- 新线程复测与终审都看到 `generate` 可能在工具执行后返回空回答

两份报告共同说明：

1. 当前 task model 是 `ollama / qwen2.5:1.5b`
2. `read_list / read_open` 主链路可以跑通
3. 真正的缺陷是 workspace local intent guard、tool schema contract 和 generate empty fallback 缺少最小防线

## Allowed Changes

- `server/src/agent/next-action-planner.ts`
- `server/src/agent/tool-call-normalize.ts`
- `server/src/agent/graph.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- `server/src/agent/tool-node.ts`
- `server/src/agent/retrieve*.ts`
- `server/src/agent/web*.ts`
- `server/src/agent/next-action-planner.test.ts`
- `server/src/agent/tool-call-normalize.test.ts`
- `server/src/agent/graph.test.ts`
- `server/src/agent/nodes.test.ts`
- `docs/project-control/agent-nodes-workboard.md`
- `docs/project-control/tasks/agent_node_T016-local-tool-routing-and-schema-guard.md`

## Forbidden Changes

- Agent V2
- 复杂工具选择策略重写
- DAG / 并发 / 多智能体
- 长期记忆
- Provider Gateway
- MCP registry
- Phoenix UI 大改
- terminal stdout 编码修复
- `T014` approval state cleanup
- 前端大改
- RAG 排序大优化
- 把“更强 task model”当成唯一修复

## Invariants

本任务完成后仍必须保持：

1. Planner 只输出 `state.nextAction`
2. Normalize 只冻结合法 `pendingToolCall`
3. Policy 只审批 frozen `pendingToolCall`
4. ToolNode 只执行 approved frozen `pendingToolCall`
5. ToolNode 不得直接 answer
6. `selectedToolId` 不是执行入口
7. `capabilityIntent.selectedToolIds` 不是执行入口
8. `pendingApproval` 不得被当成 completed evidence
9. 明确联网 / 外部信息问题仍可使用 `web_search`
10. workspace / local 文件问题优先走本地 `read` / `retrieve`
11. schema invalid 的工具调用不得执行
12. bounded replan 最多一次，不得循环

## Defect Layer

这是后端运行时合同与路由硬化问题，不是前端显示问题，也不是单纯的提示词文案问题。

缺陷影响面分三层：

1. 本地 workspace 意图没有硬边界，导致 planner 在弱模型下会把本地问题送去外网搜索
2. 工具 schema 契约没有最小兜住策略，导致错误参数直接在 Normalize 阶段把前台 run 打死
3. 最终回答阶段没有空回答 fallback，导致工具明明已经执行，用户却拿不到 grounded 结果

## Required Scope

### 1. Workspace Local Intent Guard

当用户明确提到下面这类本地问题，而且当前线程已绑定 workspace 时：

- workspace
- 当前 workspace
- 本地项目
- `README.md`
- 文件内容
- 某一节 / section
- 目录 / 文件
- 基于文件内容回答

不得优先选择外部 `web_search`。

如果 Planner 仍输出 `web_search`，但 query 明显属于 workspace local intent，进入 ToolNode 前必须拦截，并改成以下之一：

- `read_open`
- `read_locate`
- workspace `retrieve`
- 明确 safe error，说明需要本地文件工具证据，不能用外部 `web_search` 代替

不能简单禁用 `web_search`。只拦截本地 workspace 意图误路由。

### 2. Tool Schema Guard And Bounded Replan

Normalize 遇到 schema invalid 时，不得直接把前台 run 打死。

最小要求：

1. 记录 `schemaError`
2. 保留 invalid action diagnostics
3. 最多执行一次 bounded replan
4. replan prompt 只包含：
   - 用户最后一条请求
   - 当前 workspace 已绑定
   - 允许工具列表与精简 schema
   - 上一次错误，例如 `args.limit is not allowed`
   - 要求返回合法 `nextAction` JSON
5. replan 成功时，继续正常 `Normalize -> Policy -> ToolNode`
6. replan 后仍 invalid 时，safe error 收口，不执行工具，不伪造 evidence

禁止无限 replan。

### 3. Generate Empty Answer Fallback

如果 `generate` 模型返回空回答：

1. 不得直接让 run 因空回答 failed
2. 如果有 completed evidence，返回最小 deterministic fallback
3. fallback 要明确说明模型没有生成有效回答，并给出可用证据摘要
4. 如果没有 evidence，要明确说明当前没有可用证据
5. diagnostics 里要记录 `generatedAnswerEmptyFallback=true`

这不是 `T013` 大改，只是防止空回答把前台打死。

## Acceptance Criteria

`T016` 只有在下面条件都有证据时才能标记 `DONE`：

1. `P0-8` 不再把 workspace 检索误走外部 `web_search`
2. `P0-9` 不再因 invalid tool args 在 Normalize 直接 failed
3. invalid tool args 不会执行
4. schema invalid 后最多 replan 一次，不会循环
5. replan 失败时能 safe error 收口
6. generate 空回答有 fallback
7. 明确外部联网问题仍能走 `web_search`
8. 后端测试通过
9. 前台 `P0-8 / P0-9 / P0-10` 通过，或有明确非阻断解释

## Required Tests

至少覆盖下面这些测试场景：

1. 用户明确要求 workspace 检索时，不得选择或执行 `web_search`
2. `README.md` 文件内容问题优先 `read_open / retrieve`，不是 `terminal_session` 或 `web_search`
3. Planner 输出 `web_search` 但用户意图是 workspace local 时，被 guard 拦截
4. Planner 输出 invalid args 时，例如 `read_open` 带 `limit` 或 `terminal_session` 缺 `command`，不得执行工具
5. schema invalid 后最多 replan 一次
6. replan 成功时继续正常 `Normalize / Policy / ToolNode`
7. replan 失败时 safe error 收口，不伪造 evidence
8. generate 空回答且有 evidence 时，返回 deterministic fallback
9. generate 空回答且无 evidence 时，明确无证据
10. 明确联网问题仍可走 `web_search`，不被 workspace guard 误伤
11. repeated guard 不受影响
12. approval resume 不受影响

## Frontend Smoke

修复后必须重跑：

- `P0-8 repeated retrieve guard / workspace retrieve intent`
- `P0-9 no evidence guard / README Runtime section`

同时复核：

- `P0-1 workspace list`
- `P0-2 read_open README`
- `P0-3 README intent`
- `P0-10 final answer shape`

smoke 记录必须明确写出：

- 是否误走 `web_search`
- 是否进入 `retrieve / read_open`
- 是否出现 Normalize schema error
- 是否发生 bounded replan
- 是否执行工具
- 是否写 evidence
- generate 是否空回答
- fallback 是否触发
- 最终回答是否自然、grounded、无伪造

不要伪造 smoke。

## Verification Plan

实现完成前，至少需要补下面这些验证证据：

- `pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts src/agent/tool-call-normalize.test.ts src/agent/graph.test.ts src/agent/nodes.test.ts`
- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm check`

如果任务实现触及打包、运行边界或 owner 要求的完整验收，还需要补：

- `pnpm package:electron:win`
- `curl http://<backend-host>:<backend-port>/health`

host 和 port 必须来自 `runtime.config.cjs`。

## Evidence Requirements

任务卡提交评审时必须附上：

1. changed files
2. diff summary
3. 测试命令与结果
4. 前台 smoke 过程和结果
5. 未完成项
6. 风险或非阻断解释

如果没有执行某项验证，必须明确说明原因。

## Current State

当前只完成立项和任务卡创建。

还没有开始：

- 代码实现
- 后端测试
- 前台 smoke
- 打包验证

## Conclusion

`T016 = TODO`
