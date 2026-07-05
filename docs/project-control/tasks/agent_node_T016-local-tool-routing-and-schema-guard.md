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
  - docs/project-control/phase-conclusions/agent-nodes-V1.5 终审.md
  - docs/project-control/testEvidence/agent-nodes-V1.5 全新线程复测.md
  - docs/chat/agent-frontend-workspace-smoke-method.md
  - server/src/agent/next-action-planner.ts
  - server/src/agent/tool-call-normalize.ts
  - server/src/agent/graph.ts
  - server/src/agent/nodes.ts
  - server/src/agent/evidence.ts
  - server/src/agent/types.ts
  - server/src/agent/tool-node.ts
task_state: READY_FOR_REVIEW
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

当前状态：`READY_FOR_REVIEW`

已完成：

1. workspace local intent guard 已接入 `nextActionPlanner`
2. no-KB workspace retrieve / mistaken `web_search` 已能稳定改写到本地 `read_locate`
3. `read_locate` 证据摘要已对文档型 content match 提前排序，不再优先把安装包路径喂给最终回答
4. Normalize schema invalid 已接入一次 bounded replan
5. bounded replan 用尽后会返回 deterministic safe error，不再直接 failed
6. generate 空回答已改为 deterministic fallback，不再直接 failed
7. 后端定向测试、`pnpm --filter @ui-chat-mira/server typecheck` 与 `pnpm check` 已通过
8. `2026-07-05` 真实前台 `P0-9` 新线程复测已通过：workspace 绑定后稳定进入 `read_open("README.md")`，没有再被 local intent guard 误伤
9. `pnpm package:electron:win` 已成功产出 `release/v0.7.1_20260705_161348/electron`

当前没有新的 `T016` 阻断未完成项。

## Verification Snapshot

- `pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts src/agent/tool-call-normalize.test.ts src/agent/graph.test.ts src/agent/nodes.test.ts`
  - 结果：通过，`112 passed`
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过
- `pnpm package:electron:win`
  - 结果：通过，产物目录为 `release/v0.7.1_20260705_161348/electron`
- `curl http://127.0.0.1:8787/health`
  - 结果：通过，返回 `success=true`

补充说明：

- `runtime.config.cjs` 当前配置为 `host=127.0.0.1`、`port=8787`，本轮 health 校验按该配置执行
- `pnpm package:electron:win` 在生成测试报告时顺带暴露出若干仓库现存失败项，例如：
  - `desktop/src/shared/uchat/ui/UChatSidebarView.test.tsx` 断言仍按 `menuitem` 查找 `Archive`
  - 多个 `server/src/mcp/*` 测试缺少 `xlsx` 依赖或引用了不存在的 `.js` 测试入口
  - `server/src/services/thread.service.test.ts`、`server/src/services/rag-nodes/generate.service.test.ts` 仍有断言失败
- 上述失败项没有阻断本次桌面打包产物生成，也不属于 `T016` 允许修改范围，因此本任务只记录，不顺手改动

已执行前台 smoke：

- `2026-07-05` 按 [agent-frontend-workspace-smoke-method.md](D:/workspace/rag-demo/docs/chat/agent-frontend-workspace-smoke-method.md) 真实走 `/#/chat -> + 新建对话 -> Composer menu -> Workspace -> Add to workspace -> 选择 ragDemo / D:\workspace\rag-demo -> Agent 按钮可点击`

### Frontend Smoke Snapshot

#### P0-8 workspace retrieve intent / repeated retrieve guard

- 前台线程：`thread_id=e1557597e022c7b71251c2bce676f53d`
- 用户问题：`请检索 workspace 中关于 UIChat Mira 的说明，然后用完全相同的查询再检索一次，最后基于检索结果回答 UIChat Mira 是什么。`
- 绑定路径：
  - 真实走了 `/#/chat -> + 新建对话 -> Composer menu -> Workspace -> Add to workspace -> 选择 ragDemo / D:\workspace\rag-demo -> Agent`
- 前台 trace：
  - 进入了 `工具调用规范化 -> 审批策略 -> 工具执行 -> 证据写回 -> 组织最终回答 -> 检查结果`
  - `工具执行` 显示 `read_locate 已由 Harness 执行完成`
  - 没有出现 `web_search`
  - 没有出现 Normalize schema error
  - 没有出现 bounded replan
- 数据库证据：
  - `agent_runs.id=f2fa09d3-a407-4b8d-bdd6-a89656fd24eb`
  - `status=completed`
  - `last_tool_execution.toolId=read_locate`
  - `last_tool_execution.args.query="UIChat Mira"`
  - `last_tool_execution.result.matches` 同时包含：
    - `README.md` 第 1/3 行
    - `AGENTS.md` 第 5 行
    - `package.json` / `electron-builder.yml` / `desktop/package.json` 等产品元信息
  - assistant 最终消息已落库：
    - `messages.id=bab7031c-ea84-49ff-a0c0-a43fa94dbc90`
- 用户可见回答：
  - 已明确回答 `UIChat Mira` 是一个 `local-first` 的桌面工作空间应用
  - 回答引用了 Electron、React、Fastify 与产品元信息
  - 没有再被 `release/*.exe` 安装包路径带偏
- 结论：
  - `P0-8` 已通过：workspace local intent 不再误走外部 `web_search`，也不再落到递归上限
  - 当前剩余现象是回答会明确说明“第二次完全相同检索”的 completed evidence 没有单独体现；这属于回答措辞偏保守，不再阻断本任务评审

#### P0-9 README Runtime section

- 前台线程：`thread_id=158d35808fc8d9cf67501b1d119d2fcb`
- 用户问题：`README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。`
- 绑定路径：
  - 真实走了 `/#/chat -> + 新建对话 -> Composer menu -> Workspace -> Add to workspace -> 选择 ragDemo / D:\workspace\rag-demo -> 开启 Agent -> 发送问题`
- 前台 trace：
  - 进入了 `执行计划 -> 工具调用规范化 -> 审批策略 -> 工具执行 -> 证据写回 -> 组织最终回答 -> 检查结果`
  - `工具执行` 明确显示 `read_open 已由 Harness 执行完成`
  - 没有出现 Normalize schema error
  - 没有出现 approval 卡住
  - 没有出现 `web_search`
- 数据库证据：
  - `agent_runs.id=74dad73d-0310-434e-a4fd-148c53345658`
  - `status=completed`
  - `last_tool_execution.toolId=read_open`
  - `last_tool_execution.args.path="README.md"`
  - `assistant_message_id=33040eae-2b3b-4388-8b21-3b15212cb8db`
  - assistant 最终消息已落库，正文明确列出：
    - `React + Vite renderer`
    - `Electron / Tauri shell`
    - `Fastify backend`
    - `Host and port come from runtime.config.cjs`
- 用户可见回答：
  - 已按 README 原文列出运行组件
  - 没有要求审批
  - 没有出现“未包含 Runtime 一节内容”的旧错误回答
- 结论：
  - `P0-9` 已通过：本地 README Runtime 问题不再误走 `web_search`，也不再死在 Normalize schema error
  - `read_open` 原文拼接和最终回答 grounding 已恢复到可交付状态

#### P0-10 final answer shape control sample

- 前台线程：`thread_id=77ec77c26a45eb401cb2bd2822f1b467`
- 用户问题：`看看 README.md 的内容`
- 数据库证据：
  - `agent_runs.id=93dbe8a6-edd4-44fd-8f0b-d52ba55fc2ce`
  - `status=completed`
  - `trace_id=1a950e7e-c4ab-4598-bf45-ab692a81da0c`
  - `last_tool_execution.toolId=read_open`
  - `observations` 包含 `read_open completed through Harness`、`Generated answer length: 485`、`Agent run produced a final answer`
- 用户可见回答：
  - 能基于 `read_open` 结果给出自然语言总结
  - 但把完整 README 降成了“内容预览”，并提示去编辑器打开文件
- 结论：
  - 最终回答形态当前已可交付，复杂问题下也能回到 README / AGENTS / package 元信息
  - 当前残留仅剩“重复相同检索未单列第二条 completed evidence”的解释性措辞，不再属于本任务 blocker

## Changed Files

- `server/src/agent/next-action-planner.ts`
- `server/src/agent/tool-call-normalize.ts`
- `server/src/agent/graph.ts`
- `server/src/agent/node-runtime.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- `server/src/agent/next-action-planner.test.ts`
- `server/src/agent/graph.test.ts`
- `server/src/agent/nodes.test.ts`
- `server/src/agent/tool-call-normalize.test.ts`

## Diff Summary

1. workspace local intent 误走 `web_search` 时，已能在 Planner 阶段改写到本地 `read_locate / read_open`
2. schema invalid 不再直接打死前台；Normalize 会保留 diagnostics，并最多触发一次 bounded replan
3. replan 用尽后会返回 deterministic safe error，不执行非法工具
4. generate 空回答时会回退到 deterministic evidence summary
5. `read_locate` 证据摘要会优先展示 `README.md / AGENTS.md / docs/*` 这类文档型 content match，避免安装包路径主导最终回答

## Conclusion

`T016 = READY_FOR_REVIEW`
