# Agent Nodes V1.5 全新线程复测

V1.5 Final Acceptance Gate 全新线程复测结论：BLOCK

本轮复测时间：2026-07-05。旧终审文档保留不删，本文件只记录本轮“每个 P0 用例使用全新前台线程”的复测结果。

统一测试方法：

- 入口：`http://127.0.0.1:5173/#/chat`
- 每个 P0 用例开始前点击 `+ 新建对话`
- 通过当前线程输入框左侧 `Composer menu -> Workspace -> Add to workspace`
- 选择 `ragDemo D:\workspace\rag-demo`
- 确认 `Agent` 按钮从禁用变可点击，再点击到绿色激活态
- 每次正式发送前确认 `Agent aria-pressed=true`
- P0-4/P0-5 因为 approve 必须承接同一次 pending approval，所以使用同一个新线程完成“暂停 -> 批准”链路
- P0-6 使用另一个新线程完成 reject 链路

模型/运行配置记录：task model 为 `ollama / qwen2.5:1.5b`；llm 为 `openai / kimi-k2-250905`；embedding 为 `ollama / bge-m3:latest`；rerank 为 `volcengine / BAAI/bge-reranker-v2-m3`；evaluation 为 `ollama / Hermes-2.5-Yi-1.5-9B-Chat.Q6_K.gguf:latest`。

Phoenix 证据截图：

![Phoenix fresh thread retake](../../.artifacts/phoenix-v15-fresh-thread-retake.png)

## 1. 当前任务状态汇总

- T009：`DONE`。本轮 P0-1/P0-2/P0-3 再次证明 read_list/read_open 能在全新线程里真实执行、写 evidence、进入 Generate。
- T010：`DONE`。本轮没有复现 planner invalid JSON 阻断；P0-9 是工具参数 schema 错误，不是 JSON 解析失败。
- T011：`DONE`。本轮所有 read_list/read_open 均在 `D:\workspace\rag-demo` 下执行，未复现 outside workspace root。
- T012：`READY_FOR_REVIEW`。后端 repeated tool/retrieve guard 测试通过；前台 P0-7 没有诱发第二次相同 read_open，P0-8 没有进入 retrieve，而是误走 web_search，因此本轮仍没有纯前台 repeated guard 命中证据。
- T013：`DONE`。P0-1/P0-2/P0-3/P0-7 输出为自然语言，未泄漏 `<function_calls>`、raw JSON、pendingToolCall。但 P0-8 Generate 返回空回答。
- T014：`DONE` 与本轮事实不一致。P0-5 approve 后原 frozen call 确实执行并写 evidence，但 run completed 后仍残留 `pendingApproval/pendingToolCall`，`current_step_id=approval`；P0-6 reject 后未执行工具，但 blocked run 也残留 pending 状态。
- phonex：`T015 / T_phonex` 任务卡存在且 `DONE`。Phoenix 能看到本轮 root spans：P0-9 `2026/07/05 上午02:08:40`、P0-8 `2026/07/05 上午02:07:45`、P0-7 `02:07:07`、P0-6 `02:06:18`、P0-5 `02:05:26`、P0-4 `02:04:59` 等。当前 Phoenix 页面未直接展开足够子 span 信息来单独解释 planner 内部选择原因。
- workboard 是否一致：不一致。T014/workboard 声称 approve/reject 后会清理 pending 状态，但本轮真实 DB 证据显示未清理。

## 2. 前台 P0 smoke 结果

### P0-1 workspace list

- 输入：`看看当前 workspace 有哪些文件`
- 线程：全新前台线程 `c1b60408b3806719c05e597a39bb6862`
- 结果：PASS
- 关键 trace：13/13 步，`read_list -> evidence -> generate -> evaluate` 完成。
- evidence：`agent_runs.id=b9f7488e-107e-4f97-a636-f9740b3eb1e9`，`status=completed`，`trace_id=cf1899ab-8b13-4ff1-a269-2c573b27e1b3`，`last_tool_execution.toolId=read_list`，`args.path="."`，pending 均为空。
- 最终回答：自然说明 `D:\workspace\rag-demo` 根目录有 29 个条目，17 个目录、12 个文件，列出 `.artifacts`、`.git`、`.githooks`、`.github`、`.local-models` 等预览。
- blocker：无。

### P0-2 read_open README

- 输入：`打开 README.md 看看内容`
- 线程：全新前台线程 `b8a7c7b1574619a6ea7e245646455777`
- 结果：PASS
- 关键 trace：13/13 步，`read_open README.md -> evidence -> generate -> evaluate` 完成。
- evidence：`agent_runs.id=7b64ea5f-53aa-46e1-aaf1-a3a79d6a7ecf`，`status=completed`，`trace_id=fca6fc18-6090-4ce2-ba9b-008969926037`，`last_tool_execution.toolId=read_open`，`args.path="README.md"`，pending 均为空。
- 最终回答：自然概括 README：UIChat Mira 是本地优先桌面工作空间，用于统一管理模型、角色、知识库、MCP 和工具。
- blocker：无。

### P0-3 README intent / retrieve fallback

- 输入：`看看 README.md 的内容`
- 线程：全新前台线程 `ce0d3255ef1320323a5af9407fd7930e`
- 结果：PASS
- 关键 trace：13/13 步，实际走 `read_open README.md`，未走 web_search，未重复循环。
- evidence：`agent_runs.id=3fb47a95-2a03-4607-af70-11a1161ff3e7`，`status=completed`，`trace_id=cd741047-3175-4c19-987d-720bcddaff4f`，`last_tool_execution.toolId=read_open`，`args.path="README.md"`，pending 均为空。
- 最终回答：自然说明 README 中项目定位、主要目标和内容预览。
- blocker：无。

### P0-4 terminal approval pause

- 输入：`执行 dir 命令看看结果`
- 线程：全新前台线程 `4194303ec53168bf8d4b1b6d9e8c1e27`
- 结果：PASS 第一阶段
- pendingApproval：审批前 `agent_runs.id=3b4ca353-b7f7-4091-b846-89f928d7f11f`，`status=waiting_approval`，`current_step_id=approval`；`pendingApproval.toolId=terminal_session`，`toolCallId=1fc52be8-518f-47e4-9697-f52272e83efe`，`inputHash=6fa74b369d1e97f753cb5eac53eaab5b57574496a525ee3ff472d015f34211e6`。
- pendingToolCall：`pendingToolCall.id=1fc52be8-518f-47e4-9697-f52272e83efe`，`toolId=terminal_session`，`args.command="dir"`，`status=frozen`。
- blocker：无。审批前 `last_tool_execution_json=null`，`observations_json=[]`，没有执行 terminal，也没有伪造结果。

### P0-5 terminal approval resume

- 操作：在 P0-4 同一新线程的等待审批卡上点击前台“批准”。
- 结果：BLOCK
- ToolNode：批准后同一 run `3b4ca353-b7f7-4091-b846-89f928d7f11f` 变为 `status=completed`，`last_tool_execution.toolId=terminal_session`，`toolCallId=1fc52be8-518f-47e4-9697-f52272e83efe`，`inputHash=6fa74b369d1e97f753cb5eac53eaab5b57574496a525ee3ff472d015f34211e6`，确认执行的是原 frozen 调用。
- evidence：observations 包含 `terminal_session completed through Harness`、`Generated answer length: 313`、`Agent run produced a final answer`。
- 最终回答：自然说明 `dir` 返回码 0，但 stdout 编码乱码，无法辨认目录列表。
- blocker：run completed 后仍残留 `pending_approval_json` 与 `pending_tool_call_json`，`current_step_id=approval`。前台 trace 在完成回答后又出现 `工具调用规范化 -> 审批节点 -> 已进入审批等待`。这是 approval resume 状态清理/路由状态问题，非 RAG 主流程原因。

### P0-6 terminal approval deny

- 操作：新建线程，绑定 workspace 并激活 Agent，发送 `执行 dir 命令看看结果`，出现审批后点击“拒绝”。
- 线程：全新前台线程 `be23b94dcd6aaaad509ed41331c57756`
- 结果：REVISE / BLOCK 关联 P0-5
- 是否执行：未执行。`agent_runs.id=ebc7803d-9418-4787-a0f9-1d73fa70dd84`，`status=blocked`，`current_step_id=approval`，`last_tool_execution_json=null`，`observations_json=[]`。
- blocker：拒绝后没有执行工具，安全点通过；但 blocked run 仍残留 `pending_approval_json` 与 `pending_tool_call_json`，前台主区仍显示等待审批，没有明确展示“已拒绝/未执行”。这是 approval 状态收尾问题，非 RAG 主流程原因。

### P0-7 repeated tool guard

- 触发方式：全新线程输入 `请打开 README.md，然后再次打开 README.md，最后基于 README.md 内容回答我这个项目是什么。`
- 线程：全新前台线程 `a8e6bb9c75082afb9f8e7e19b96170c1`
- 结果：PARTIAL
- trace：前台 13/13 步，只执行一次 `read_open README.md`，未自然触发第二次相同 read_open，因此没有看到 repeated tool guard 命中。
- evidence：`agent_runs.id=46769a36-6abb-493a-8a86-aa17bd744b2e`，`status=completed`，`trace_id=52437f0c-3d02-43b7-9ee0-f77a55a62bb2`，`last_tool_execution.toolId=read_open`，`args.path="README.md"`，pending 均为空。
- blocker：没有重复执行，但本条不是纯前台 repeated guard 命中证据。后端测试仍覆盖 repeated tool guard。

### P0-8 repeated retrieve guard

- 触发方式：全新线程输入 `请检索 workspace 中关于 UIChat Mira 的说明，然后用完全相同的查询再检索一次，最后基于检索结果回答 UIChat Mira 是什么。`
- 线程：全新前台线程 `851ac4d45ce9e10e6a90e5513af536b2`
- 结果：BLOCK / NOT COVERED
- trace：前台 11/13 步失败，实际进入 `web_search`，不是 workspace retrieve；Generate 返回空回答。
- evidence：`agent_runs.id=b176640c-1f5d-4d50-bc25-f41d8fb7751d`，`status=failed`，`current_step_id=agent-generate`，`trace_id=ef7aea90-f176-41b8-812c-14a342d92da8`，observations 包含 `web_search completed through Harness` 和 `Generated answer was empty`；`last_tool_execution.toolId=web_search`，`args.query="UIChat Mira 说明"`，provider 为 `tavily`。
- blocker：用户明确要求 workspace 检索，但工具选择为外部 web_search；并且 Generate 失败 `Model returned empty answer`。这是工具选择/检索路由侧错误叠加模型空回答，不是 RAG retrieve 已完成后的 repeated guard 问题，非 RAG 主流程原因。

### P0-9 no evidence guard

- 输入：`README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。`
- 线程：全新前台线程 `1ebbef7e6ab156d7816e43d65933de03`
- 结果：BLOCK
- blocker：没有编造文件内容，但在 Normalize 阶段失败，未能调用正确文件工具或给出证据不足回答。`agent_runs.id=b4c83339-caea-42da-b313-476502a7997b`，`status=failed`，`current_step_id=agent-tool-call-normalize`，`trace_id=7b226a4d-634d-4fe0-896a-1c6ad4389ead`，错误 `args.limit is not allowed`；`pending_tool_call_json=null`，`last_tool_execution_json=null`，`observations_json=[]`。这是模型/工具参数契约侧错误输出，非 RAG 主流程原因。

### P0-10 final answer shape

- 覆盖范围：P0-1、P0-2、P0-3、P0-5、P0-7 的成功 Generate，以及 P0-8/P0-9 的失败路径。
- 是否仍输出工具样式文本：本轮成功 Generate 的回答未泄漏 `nextAction JSON`、`pendingToolCall`、raw trace、`<function_calls>` 或 raw tool JSON。
- blocker：P0-5 状态残留导致最终 trace 形态不可信；P0-8 Generate 空回答；P0-9 未进入 Generate。P0-10 不能单独 PASS。

## 3. 后端测试结果

- 命令：`pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts src/agent/graph.test.ts src/agent/tool-call-normalize.test.ts src/agent/policy.test.ts src/agent/tool-node.test.ts src/agent/nodes.test.ts src/agent/resume.test.ts src/agent/routes.test.ts src/agent/persistence.test.ts src/agent/observability.test.ts`
- 结果：通过，10 个测试文件，129 个测试通过。
- 失败项：无。
- 是否阻断：不阻断，但不替代前台 smoke。日志中可见 repeated tool/retrieve guard 后端命中，说明后端构造场景成立；前台 P0-8 仍未进入 retrieve。

- 命令：`pnpm check`
- 结果：通过。
- 失败项：无。
- 是否阻断：不阻断。

## 4. V1.5 不变量检查

1. Planner 只输出 state.nextAction：PARTIAL。后端测试通过；P0-9 显示 planner/normalize 之间仍可能产生不符合工具 schema 的参数。
2. Normalize 只冻结 pendingToolCall：PASS。P0-9 在 Normalize 失败，没有绕过执行。
3. Policy 只审批 frozen pendingToolCall：PASS。P0-4 pendingApproval 与 pendingToolCall 的 `toolCallId/inputHash` 对齐。
4. ToolNode 只执行 approved frozen pendingToolCall：PASS。P0-5 执行对象与 frozen 调用一致；P0-6 拒绝后未执行。
5. ToolNode 不直接 answer：PASS。
6. selectedToolId 未恢复为执行入口：PASS。
7. pendingApproval 不被当作 completed evidence：PASS。P0-4/P0-6 observations 为空。
8. no evidence 不编造：PARTIAL。P0-9 未编造，但失败于 Normalize，没有完成理想路径。
9. completed evidence 能自然回答：PARTIAL。read_list/read_open 能自然回答；terminal 能说明执行成功但输出乱码；P0-8 无法回答。
10. repeated guard 不误伤 approval：PASS in backend / NOT FULLY COVERED in frontend。
11. approval resume 绑定原调用：PARTIAL / FAIL。绑定原调用执行成功，但执行后 pending 状态未清理。

## 5. P0 Blockers

- blocker 名称：Approval resume 后 pending 状态未清理
- 触发用例：P0-5
- 证据：`agent_runs.id=3b4ca353-b7f7-4091-b846-89f928d7f11f`，`status=completed`，`last_tool_execution.status=completed`，但 `pending_approval_json` 与 `pending_tool_call_json` 仍存在，`current_step_id=approval`。
- 建议最小修复任务名：`agent_node_T014R-approval-state-cleanup-after-resume`
- 为什么属于 V1.5 必修：终审要求批准后清理 pendingApproval/pendingToolCall，避免状态误导和重复审批风险。

- blocker 名称：Reject 后 blocked run 仍残留 pending 状态
- 触发用例：P0-6
- 证据：`agent_runs.id=ebc7803d-9418-4787-a0f9-1d73fa70dd84`，拒绝后 `status=blocked`，`last_tool_execution_json=null`，但 `pending_approval_json` 与 `pending_tool_call_json` 仍存在。
- 建议最小修复任务名：`agent_node_T014R-approval-reject-state-finalization`
- 为什么属于 V1.5 必修：拒绝后未执行满足安全要求，但终态没有处理清楚，不满足 P0-6。

- blocker 名称：Workspace retrieve 意图误走 web_search
- 触发用例：P0-8
- 证据：`agent_runs.id=b176640c-1f5d-4d50-bc25-f41d8fb7751d`，用户要求检索 workspace，实际 `last_tool_execution.toolId=web_search`，provider `tavily`。
- 建议最小修复任务名：`agent_node_T016-workspace-retrieve-routing-guard`
- 为什么属于 V1.5 必修：workspace 检索不能由外部 web_search 替代，否则 P0-8 repeated retrieve guard 无法前台验收。

- blocker 名称：Generate 空回答
- 触发用例：P0-8
- 证据：同一 run `b176640c-1f5d-4d50-bc25-f41d8fb7751d`，`current_step_id=agent-generate`，observations 记录 `Generated answer was empty`，错误 `Model returned empty answer`。
- 建议最小修复任务名：`agent_node_T016-generate-empty-answer-handling`
- 为什么属于 V1.5 必修：成功工具执行后不能以空回答失败；当前是模型输出/Generate 防护问题，非 RAG 主流程原因。

- blocker 名称：本地文件问题触发 Normalize schema 错误
- 触发用例：P0-9
- 证据：`agent_runs.id=b4c83339-caea-42da-b313-476502a7997b`，`status=failed`，`current_step_id=agent-tool-call-normalize`，错误 `args.limit is not allowed`。
- 建议最小修复任务名：`agent_node_T016-planner-tool-schema-output-guard`
- 为什么属于 V1.5 必修：无 evidence 场景应该调用正确本地文件工具或明确证据不足，不能因错误工具参数失败。

## 6. P1 / P2 候选

P1：

- `terminal_session` 的 PowerShell stdout 捕获乱码，影响用户阅读。
- P0-6 前台拒绝后仍显示等待审批，前台状态同步需要改进。
- Phoenix 页面当前稳定可见 root spans，但本轮未从页面直接展开出足够子 span 来判断 planner 内部选择理由。

P2 / V1.6：

- 更复杂的 workspace intent routing 与 retrieve/read_open/web_search 策略。
- 更完整的 Phoenix trace drill-down 和前端 trace UI。
- 模型输出 schema 纠错和诊断增强。

## 7. 是否允许 V1.5 DONE

结论：

- BLOCK：存在 P0 blocker，不允许 V1.5 DONE。

理由：

本轮每个 P0 用例均使用全新前台线程重新绑定 workspace 并激活 Agent 后测试。read_list/read_open 主链路稳定通过；terminal pause 正确停住，approve 能恢复原调用执行，reject 未执行工具。但 approve/reject 后 pending 状态未清理，workspace retrieve 意图误走 web_search，P0-8 Generate 空回答，P0-9 本地文件问题在 Normalize 阶段 schema 失败。这些问题足以阻断 V1.5 前台最终验收。

明确标注：P0-5/P0-6 是 approval 状态收尾问题；P0-8 是工具选择/检索路由错误叠加模型空回答；P0-9 是模型/工具参数契约侧错误输出。这些不是 RAG 主流程已正确 retrieve 后的回答质量问题，但会阻断 V1.5 的真实前台验收。
