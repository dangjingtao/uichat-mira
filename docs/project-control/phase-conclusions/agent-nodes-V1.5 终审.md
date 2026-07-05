# Agent Nodes V1.5 终审

V1.5 Final Acceptance Gate 终审结论：BLOCK

本轮为 2026-07-05 重新前台验收，不复用旧 smoke 结论。测试入口为真实前台 `http://127.0.0.1:5173/#/chat`，按 `docs/chat/agent-frontend-workspace-smoke-method.md` 通过 `Composer menu -> Workspace -> Add to workspace -> ragDemo D:\workspace\rag-demo` 绑定线程，并在每次正式发送前确认 `Agent` 按钮已激活为绿色态，`aria-pressed=true`。

模型/运行配置记录：task model 为 `ollama / qwen2.5:1.5b`；llm 为 `openai / kimi-k2-250905`；embedding 为 `ollama / bge-m3:latest`；rerank 为 `volcengine / BAAI/bge-reranker-v2-m3`；evaluation 为 `ollama / Hermes-2.5-Yi-1.5-9B-Chat.Q6_K.gguf:latest`。

Phoenix 证据截图：

![Phoenix root spans after P0-9](../../.artifacts/phoenix-latest-root-spans-after-p0-9.png)

## 1. 当前任务状态汇总

- T009：任务卡 `DONE`。本轮 P0-1/P0-2/P0-3 证明 read_list/read_open 能真实执行、写 evidence、进入 Generate；但 P0-8/P0-9 暴露新的工具选择/Normalize 阻断，不改变 T009 已实现项，阻断 V1.5 终审。
- T010：任务卡 `DONE`。本轮没有复现 planner invalid JSON 阻断；P0-9 是合法 JSON 后的工具参数契约失败，不是 JSON 解析失败。
- T011：任务卡 `DONE`。本轮 P0-1/P0-2/P0-3 都在 `D:\workspace\rag-demo` 下执行，没有复现 outside workspace root。
- T012：任务卡 `READY_FOR_REVIEW`。后端 repeated tool/retrieve guard 单测通过；前台 P0-7 未自然触发重复调用，P0-8 未能进入 retrieve，而是误走 web_search，因此 repeated retrieve guard 没有获得纯前台覆盖。
- T013：任务卡 `DONE`。P0-1/P0-2/P0-3/P0-7 的最终回答不再泄漏 `<function_calls>` 或 raw tool JSON；但 P0-2/P0-3 回答存在跨 run evidence 误述，P0-5 terminal 最终回答截断，P0-8 基于 web_search 外部结果回答 workspace 问题，P0-9 未进入 Generate。
- T014：任务卡 `DONE`，但与本轮真实前台结果不一致。P0-5 approve 后确实恢复并执行原 frozen `pendingToolCall`，但 run completed 后 `pendingApproval/pendingToolCall` 仍残留，`current_step_id=approval`；P0-6 reject 后没有执行工具，但 run blocked 后 pending 状态也仍残留，前台仍显示等待审批。
- phonex：`agent_node_T015-phoenix-minimum-human-observability.md` 存在且 `DONE`。本轮 Phoenix 能看到 root span 列表，包含 P0-8 `2026/07/05 上午01:45:15` 与 P0-9 `2026/07/05 上午01:47:54`，但当前 Phoenix UI 未展开出足够子 span 内容来单独判断 planner 选择原因。
- workboard 是否一致：不一致。workboard/T014 仍写 approve 后会清理 pending 状态、T014 为 `DONE`；本轮 DB 证据显示 approve/reject 后 pending 状态未清理。T012 保持 `READY_FOR_REVIEW` 与本轮“不足以纯前台证明 repeated guard 命中”一致。

## 2. 前台 P0 smoke 结果

### P0-1 workspace list

- 输入：`看看当前 workspace 有哪些文件`
- 结果：PASS
- 关键 trace：前台显示 13/13 步，经过 `候选选择 -> 调用前守卫 -> 执行计划 -> 工具调用规范化 -> 审批策略 -> 工具执行 -> 证据写回 -> 组织最终回答 -> 检查结果`。
- evidence：`agent_runs.id=8b68ab68-7aab-44d4-bbdc-785892c012a8`，`status=completed`，`trace_id=fc7ab501-cf68-45a5-b21a-818ae8d50b16`，`last_tool_execution.toolId=read_list`，`args.path="."`，observations 包含 `read_list completed through Harness`、`Generated answer length: 256`、`Agent run produced a final answer`。
- 最终回答：自然列出 `D:\workspace\rag-demo` 共有 29 个条目，包含 `.artifacts`、`.git`、`.githooks`、`.github`、`.local-models` 等目录。
- blocker：无。

### P0-2 read_open README

- 输入：`打开 README.md 看看内容`
- 结果：PASS，带 P1/P0-10 风险
- 关键 trace：前台 13/13 步，`read_open` 被冻结、Policy 允许、ToolNode 执行、evidence 写回、Generate 完成。
- evidence：`agent_runs.id=053d9a03-5f2b-40ef-a31e-4f4ae1bcae7f`，`status=completed`，`trace_id=5819eedd-e649-4729-9dad-f874213a31bf`，`last_tool_execution.toolId=read_open`，`args.path="README.md"`，result 包含 `# UIChat Mira` 与 README 正文。
- 最终回答：概括 README：UIChat Mira 是 local-first 桌面工作空间，用于整合聊天、知识、工具和文档。
- blocker：无。回答额外说“尚未执行目录查看操作”，与同线程前一条 P0-1 已执行目录查看不一致；这是回答组织对跨 run evidence 的表述问题，不是 read_open 主链路 blocker。

### P0-3 README intent / retrieve fallback

- 输入：`看看 README.md 的内容`
- 结果：PASS，带 P1/P0-10 风险
- 关键 trace：前台 13/13 步，实际走 `read_open README.md`，未走 web_search，未重复循环。
- evidence：`agent_runs.id=4acf22a9-9153-49d2-b8c2-410048b19a04`，`status=completed`，`trace_id=e64cd0e9-4c37-470f-a2f9-db02aedbcd53`，`last_tool_execution.toolId=read_open`，`args.path="README.md"`。
- 最终回答：基于 README 说明项目名称、定位和主要用途。
- blocker：无。回答仍说“当前 workspace 的完整文件列表目前没有已执行的目录查询结果”，与同线程 P0-1 不一致，记录为回答组织风险。

### P0-4 terminal approval pause

- 输入：`执行 dir 命令看看结果`
- 结果：PASS 第一阶段
- pendingApproval：`agent_runs.id=a1f50dcb-e00d-445a-9ec0-86f5a4637310` 在审批前为 `status=waiting_approval`，`current_step_id=approval`；`pendingApproval.toolId=terminal_session`，`toolCallId=ec1b34f7-a7b9-44f5-acd4-4fc188ee96fc`，`inputHash=6fa74b369d1e97f753cb5eac53eaab5b57574496a525ee3ff472d015f34211e6`。
- pendingToolCall：同一 run 的 `pendingToolCall.id=ec1b34f7-a7b9-44f5-acd4-4fc188ee96fc`，`toolId=terminal_session`，`args.command="dir"`，`status=frozen`。
- blocker：无。审批前 `last_tool_execution_json=null`，observations 为 `[]`，没有执行 terminal，也没有伪造 stdout。

### P0-5 terminal approval resume

- 操作：在 P0-4 等待审批卡上点击前台“批准”。
- 结果：BLOCK
- ToolNode：同一 run `a1f50dcb-e00d-445a-9ec0-86f5a4637310` 批准后 `status=completed`，`last_tool_execution.toolId=terminal_session`，`toolCallId=ec1b34f7-a7b9-44f5-acd4-4fc188ee96fc`，`inputHash=6fa74b369d1e97f753cb5eac53eaab5b57574496a525ee3ff472d015f34211e6`，说明执行对象确实是原 frozen 调用。
- evidence：observations 包含 `terminal_session completed through Harness`、`Generated answer length: 56`、`Agent run produced a final answer`。
- 最终回答：前台/DB assistant message 只有截断内容：`根据已执行的工具证据，情况如下：... 已在当前目录（D:\workspace\r`。terminal 输出存在 Windows 编码乱码。
- blocker：run 已 `completed` 后仍保留 `pending_approval_json` 与 `pending_tool_call_json`，且 `current_step_id=approval`。前台 trace 在完成回答后又出现 `工具调用规范化 -> 审批节点 -> 已进入审批等待`。这是 approval resume 状态清理/路由状态问题，非 RAG 主流程原因。

### P0-6 terminal approval deny

- 操作：新建前台线程，重新通过 `Composer menu -> Workspace -> Add to workspace -> ragDemo D:\workspace\rag-demo` 绑定，确认 Agent 激活后发送 `执行 dir 命令看看结果`，等待审批后点击“拒绝”。
- 结果：REVISE / BLOCK 关联 P0-5
- 是否执行：未执行。`agent_runs.id=cf3017bb-ca71-4758-87d0-b996f6b95e2f`，`status=blocked`，`current_step_id=approval`，`last_tool_execution_json=null`，observations 为 `[]`。
- blocker：拒绝后没有执行 terminal，核心安全点通过；但 `pendingApproval/pendingToolCall` 仍保留，前台主区仍显示等待审批，没有明确替换成“已拒绝/未执行”状态。该问题与 P0-5 同属审批状态清理/前台同步风险，不是 RAG 主流程原因。

### P0-7 repeated tool guard

- 触发方式：前台构造输入 `请打开 README.md，然后再次打开 README.md，最后基于 README.md 内容回答我这个项目是什么。`
- 结果：PARTIAL
- trace：前台 13/13 步，只执行一次 `read_open README.md`，未自然触发第二次相同 `read_open`，因此没有看到 repeated tool guard 命中。
- evidence：`agent_runs.id=08e1288b-0be5-4e37-af56-43d77ad09a69`，`status=completed`，`trace_id=0b330bc0-5f5f-4392-820f-85b374fe2fc7`，`last_tool_execution.toolId=read_open`，`args.path="README.md"`，observations 只有一次 `read_open completed through Harness`。
- blocker：前台未证明 repeated guard 命中；但也未出现重复执行。后端测试 `next-action-planner.test.ts / graph.test.ts` 已覆盖 repeated tool guard 命中，包括 identical completed tool 不重复执行、different args 不误伤、pendingApproval 不误伤。本条不是纯黑盒通过。

### P0-8 repeated retrieve guard

- 触发方式：前台构造输入 `请检索 workspace 中关于 UIChat Mira 的说明，然后用完全相同的查询再检索一次，最后基于检索结果回答 UIChat Mira 是什么。`
- 结果：BLOCK / NOT COVERED
- trace：前台 13/13 步，但工具链路为 `web_search`，不是 workspace retrieve；没有 repeated retrieve guard 命中证据。
- evidence：`agent_runs.id=03ac8fcd-50f1-495a-a56e-ef86fe8231c1`，`status=completed`，`trace_id=6b91eaf5-c2c6-45b8-80ef-5cf50c87ef0b`，`last_tool_execution.toolId=web_search`，`args.query="UIChat Mira 说明"`，result provider 为 `tavily`，返回 App Store/Google Play/外部 Mira 结果。
- blocker：用户明确要求 workspace 检索，却误走外部 web_search；最终回答也承认没有 workspace 本地检索记录，并用外部搜索结果说明 UIChat/Mira。这是工具选择/检索路由侧错误，不是 RAG retrieve 已执行后的 repeated guard 问题。Phoenix 可见 root span `2026/07/05 上午01:45:15`，但 UI 未提供足够子 span 明细判定 planner 内部选择原因；结合 DB 可明确标注为工具选择侧错误输出，非 RAG 主流程原因。

### P0-9 no evidence guard

- 输入：新建干净前台线程绑定并激活 Agent 后发送 `README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。`
- 结果：BLOCK
- blocker：没有编造文件内容，但更早在 Normalize 阻断。`agent_runs.id=fd2657e2-f9bd-4bb7-b6aa-4f3449658553`，`status=failed`，`current_step_id=agent-tool-call-normalize`，错误为 `args.command must be a string`；`pending_tool_call_json=null`，`last_tool_execution_json=null`，observations 为 `[]`。runtime system prompt 明确要求本地文件优先，计划里有 retrieve 步，但实际进入 Normalize 时产生了需要 `command` 的工具参数错误。该失败属于模型/工具参数契约侧错误输出，非 RAG 主流程原因。

### P0-10 final answer shape

- 覆盖范围：P0-1、P0-2、P0-3、P0-5、P0-7、P0-8 中所有进入 Generate 的 run。
- 是否仍输出工具样式文本：未复现 `<function_calls>`、`pendingToolCall`、raw nextAction JSON 或 raw tool JSON 泄漏。
- blocker：P0-5 terminal 最终回答截断且 pending 状态残留；P0-8 基于错误 web_search evidence 回答 workspace 问题；P0-2/P0-3 回答出现跨 run evidence 误述。P0-10 不能单独 PASS。

## 3. 后端测试结果

- 命令：`pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts src/agent/graph.test.ts src/agent/tool-call-normalize.test.ts src/agent/policy.test.ts src/agent/tool-node.test.ts src/agent/nodes.test.ts src/agent/resume.test.ts src/agent/routes.test.ts src/agent/persistence.test.ts src/agent/observability.test.ts`
- 结果：通过，10 个测试文件，129 个测试通过。
- 失败项：无。
- 是否阻断：不阻断，但不替代前台 smoke。日志中有 repeated tool guard 与 repeated retrieve guard 命中证据，说明后端定向场景成立；前台 P0-8 仍因工具选择未进入 retrieve。
- 命令：`pnpm check`
- 结果：通过，workspace typecheck 全部完成。
- 失败项：无。
- 是否阻断：不阻断。

## 4. V1.5 不变量检查

1. Planner 只输出 state.nextAction：PARTIAL。后端测试通过；P0-9 显示 planner/normalize 之间仍可能产出不符合工具 schema 的动作并导致 Normalize 阻断。
2. Normalize 只冻结 pendingToolCall：PASS。P0-1/P0-2/P0-3/P0-4/P0-7 都显示 Normalize 后再 Policy/Tool；P0-9 在 Normalize 阶段失败，没有绕过执行。
3. Policy 只审批 frozen pendingToolCall：PASS。P0-4 `pendingApproval.toolCallId` 与 `pendingToolCall.id` 对齐。
4. ToolNode 只执行 approved frozen pendingToolCall：PASS。P0-5 执行对象与 P0-4 frozen `toolCallId/inputHash` 对齐；P0-6 拒绝后未执行。
5. ToolNode 不直接 answer：PASS。前台链路均由 Generate 输出回答。
6. selectedToolId 未恢复为执行入口：PASS。未发现 selectedToolId 绕过 Normalize/Policy/ToolNode。
7. pendingApproval 不被当作 completed evidence：PASS。P0-4/P0-6 pending/blocked 状态 observations 为空，未被当作 completed evidence。
8. no evidence 不编造：PARTIAL。P0-9 没有编造，但因 Normalize 错误未能完成“调用工具或明确证据不足”的理想路径。
9. completed evidence 能自然回答：PARTIAL。read_list/read_open 能自然回答；terminal answer 截断；web_search 错证据导致 workspace 问题回答不可信。
10. repeated guard 不误伤 approval：PASS in backend / NOT FULLY COVERED in frontend。后端测试覆盖 pendingApproval 不被 repeated guard 误伤；前台未复现误伤。
11. approval resume 绑定原调用：PARTIAL / FAIL。P0-5 执行绑定原调用成功，但执行后 pending 状态未清理，run completed 后仍停在 approval 状态。

## 5. P0 Blockers

- blocker 名称：Approval resume 后 pending 状态未清理
- 触发用例：P0-5 terminal approval resume
- 证据：`agent_runs.id=a1f50dcb-e00d-445a-9ec0-86f5a4637310`，批准后 `status=completed`，`last_tool_execution.status=completed`，但 `pending_approval_json` 与 `pending_tool_call_json` 仍存在，`current_step_id=approval`。
- 建议最小修复任务名：`agent_node_T014R-approval-state-cleanup-after-resume`
- 为什么属于 V1.5 必修：终审要求批准后必须清理 pendingApproval/pendingToolCall，避免重复审批、重复执行或状态误导；当前 workboard/T014 的 DONE 声明也与真实运行不一致。

- blocker 名称：Reject 后 blocked run 仍残留 pending 状态且前台不明确
- 触发用例：P0-6 terminal approval deny
- 证据：`agent_runs.id=cf3017bb-ca71-4758-87d0-b996f6b95e2f`，拒绝后 `status=blocked`，`last_tool_execution_json=null`，但 `pending_approval_json` 与 `pending_tool_call_json` 仍存在，前台仍显示等待审批。
- 建议最小修复任务名：`agent_node_T014R-approval-reject-state-finalization`
- 为什么属于 V1.5 必修：拒绝后不得执行已经满足，但状态没有处理清楚，不满足 P0-6 对 pending 状态清理和用户可见结果的要求。

- blocker 名称：Workspace 检索请求误走 web_search
- 触发用例：P0-8 repeated retrieve guard
- 证据：`agent_runs.id=03ac8fcd-50f1-495a-a56e-ef86fe8231c1`，用户要求检索 workspace，`last_tool_execution.toolId=web_search`，`args.query="UIChat Mira 说明"`，返回 Tavily 外部结果；最终回答没有本地 workspace 检索证据。
- 建议最小修复任务名：`agent_node_T016-workspace-retrieve-routing-guard`
- 为什么属于 V1.5 必修：P0-8 无法覆盖 repeated retrieve guard，且 workspace 本地检索意图被外部搜索替代，前台结果不可信。

- blocker 名称：本地文件问题触发 Normalize schema 错误
- 触发用例：P0-9 no evidence guard
- 证据：`agent_runs.id=fd2657e2-f9bd-4bb7-b6aa-4f3449658553`，`status=failed`，`current_step_id=agent-tool-call-normalize`，错误 `args.command must be a string`，没有 pendingToolCall、没有执行、没有 evidence、没有最终回答。
- 建议最小修复任务名：`agent_node_T016-planner-tool-schema-output-guard`
- 为什么属于 V1.5 必修：无 evidence 场景应该调用正确工具或明确证据不足，而不是因错误工具参数在 Normalize 阶段失败。

## 6. P1 / P2 候选

P1：

- P0-2/P0-3 read_open 回答中出现“没有执行目录查询”的误述，和同线程前文不一致。
- `terminal_session` 的 Windows PowerShell 输出存在编码乱码，影响可读性。
- P0-5 terminal 最终回答被截断，用户可读性不足。
- Phoenix UI 当前只能稳定看到 root span 列表，本轮未能从页面直接展开子 span 判断 planner 选择原因；需要改善开发态可观测性使用说明或默认视图。

P2 / V1.6：

- 更复杂的 workspace intent routing / retrieve-vs-read_open 策略优化。
- 大规模前端 trace UI、span drill-down 体验增强。
- 更细粒度的模型输出诊断与自动修复建议。

## 7. 是否允许 V1.5 DONE

结论：

- BLOCK：存在 P0 blocker，不允许 DONE。

理由：

本轮真实前台重测确认 read_list/read_open 主链路已经能在绑定 workspace 且 Agent 激活后跑通；terminal approval pause 也能正确停住，approve 能恢复原调用执行，reject 没有执行工具。但 V1.5 终审不能通过：approve/reject 后审批状态未清理，P0-8 workspace 检索误走 web_search，P0-9 no-evidence 场景在 Normalize 因工具参数错误失败，且 workboard/T014 的 DONE 状态与本轮 DB 证据不一致。

明确标注：P0-5/P0-6 是 approval resume/state cleanup 问题；P0-8 是工具选择/检索路由错误；P0-9 是模型/工具参数契约错误输出。这些不是“RAG 主流程已经正确 retrieve 后仍答错”的问题，但它们阻断 V1.5 前台真实验收。
