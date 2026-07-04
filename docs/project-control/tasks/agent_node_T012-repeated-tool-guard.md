---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: RepeatedToolGuard
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T009-evidence-summary-answer-stop-rule.md
  - docs/project-control/tasks/agent_node_T010-next-action-planner-json-contract-hardening.md
  - docs/project-control/tasks/agent_node_T011-workspace-path-argument-contract.md
  - docs/chat/agent-frontend-workspace-smoke-method.md
  - server/src/agent/evidence.ts
  - server/src/agent/next-action-planner.ts
  - server/src/agent/next-action-planner.test.ts
  - server/src/agent/graph.test.ts
task_state: READY_FOR_REVIEW
---

# agent_node_T012 repeated tool guard

## Target

T012 是 `Agent V1.5 runtime hardening` 任务。

它不是 `T009 / T010 / T011` 的返工，也不是前端 trace UI 或工具选择策略改造任务。

本任务只处理一件事：

- 同一 run 内，如果 `use_tool` 或 `retrieve` 已经以相同输入执行完成，Planner 后续再次选择完全相同的动作时，系统不能再次执行同一个动作，而是要直接改成 `answer`，并明确记录诊断。

## Allowed Changes

- `server/src/agent/evidence.ts`
- `server/src/agent/next-action-planner.ts`
- `server/src/agent/types.ts`
- `server/src/agent/next-action-planner.test.ts`
- `server/src/agent/graph.test.ts`
- `docs/project-control/tasks/agent_node_T012-repeated-tool-guard.md`
- `docs/project-control/agent-nodes-workboard.md`

## Forbidden Changes

- Agent V2
- DAG / 并发 / 多智能体 / 长期记忆
- Provider Gateway 改造
- MCP registry 改造
- 前端 trace UI
- workspace path normalize
- approval resume 大改
- `Normalize -> Policy -> ToolNode` 执行入口边界改写

## Invariants

以下边界保持不变：

1. Planner 只输出 `state.nextAction`
2. Normalize 只冻结 `pendingToolCall`
3. Policy 只审批 frozen `pendingToolCall`
4. ToolNode 只执行 approved frozen `pendingToolCall`
5. ToolNode 不直接返回最终回答
6. `selectedToolId` 仍然不是执行入口
7. `capabilityIntent.selectedToolIds` 仍然不是执行入口
8. `pendingToolCall.inputHash / toolCallId` 继续用于审批和执行对齐
9. `pendingApproval` 不能被误判成“已完成的重复工具执行”
10. `maxIterations` 停止优先级不变

## Design Choice

T012 采用 Planner 输出后 guard，原因如下：

- 这样能同时覆盖 `use_tool` 和 `retrieve`
- 不需要把重复判定塞进 ToolNode
- 不会恢复旧执行入口

本轮没有把核心判断放进 Normalize。

原因：

- `retrieve` 不走 Normalize
- 当前任务重点是“不要再次执行”，而不是在执行入口之后再补救

## Duplicate Rules

### use_tool

同一 run 内满足以下条件时判定为重复：

- `toolId` 相同
- Planner 当前 `args` 经过稳定 JSON hash 后，与已有 completed `toolExecution.inputHash` 相同
- 已有 evidence 中存在 `status === "completed"` 的工具执行结果

补充约束：

- 为了与 `T011` 的 `/workspace` sentinel 契约对齐，重复判定只在 guard 比较时，把 workspace read 工具的 `{"path":"/workspace"}` 与 `{"path":"."}` 视为相同输入
- 这不是恢复通用 path normalize；`/README.md`、`/docs/README.md`、`/etc/passwd` 之类路径在 T012 里仍不做等价处理

以下情况不算重复：

- `args` 不同
- `status === "failed"`
- `status === "awaiting_approval"`

### retrieve

同一 run 内满足以下条件时判定为重复：

- retrieval query 经 `trim + collapse whitespace + lowercase` 归一化后相同
- evidence 中已存在同 query 的 retrieval 结果

## Implementation Result

本次实现落点如下：

1. 在 `server/src/agent/types.ts` 新增 `AgentRepeatedActionGuardResult`
2. 在 `server/src/agent/evidence.ts` 新增 `getRepeatedActionGuardResult(...)`
3. `use_tool` 重复判定复用稳定输入 hash
4. `retrieve` 重复判定复用归一化 query
5. 在 `server/src/agent/next-action-planner.ts` 的合法 action 校验后接入 repeated guard
6. guard 命中时，把下一步动作改成 `answer`
7. trace / structured log 新增以下诊断字段：
   - `repeatedToolGuardTriggered`
   - `repeatedToolGuardReason`
   - `guardedActionType`
   - `guardedToolId`
   - `guardedArgsHash`
   - `guardedQuery`
   - `matchedEvidenceIndex`
   - `matchedToolCallId`
8. `2026-07-04` 评审修订补充：
   - 在 `server/src/agent/evidence.ts` 为 repeated guard 新增最小参数归一化
   - 仅对 workspace read 工具识别 `/workspace` 与 `/workspace/` sentinel，并在比较 hash 时等价为 `.`
   - 不修改 Planner 原始 `nextAction.args`
   - 不改 `toolCallNormalizeNode`、`policyNode`、`toolNode` 的真实执行参数链路

## Test Coverage

本轮新增或确认以下场景：

1. same completed tool call is guarded
2. same completed `read_list` is guarded
3. different args are allowed
4. failed tool execution is not treated as completed duplicate
5. awaiting approval tool execution is not treated as completed duplicate
6. duplicate retrieve query is guarded
7. answer stop rule still short-circuits before task model
8. maxIterations still stops before another planning pass
9. old execution entry does not bypass `Planner -> Normalize -> Policy -> ToolNode`
10. graph-level repeated tool guard prevents a second Harness execution
11. graph-level repeated retrieval guard prevents a second RAG retrieval
12. planner-level `/workspace` vs `.` repeated `read_list` is guarded
13. graph-level `/workspace` vs `.` repeated `read_list` does not execute twice

## Changed Files

- `server/src/agent/types.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/next-action-planner.ts`
- `server/src/agent/next-action-planner.test.ts`
- `server/src/agent/graph.test.ts`
- `docs/project-control/tasks/agent_node_T012-repeated-tool-guard.md`
- `docs/project-control/agent-nodes-workboard.md`

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts src/agent/graph.test.ts`
  - 结果：通过，`56 passed`
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

## Frontend Smoke

按 `docs/chat/agent-frontend-workspace-smoke-method.md` 进行了真实前台绑定和 Agent 模式 smoke。

### Workspace binding evidence

- 入口：`http://127.0.0.1:5173/#/chat`
- 新线程通过输入框左侧 `Composer menu -> Workspace -> Add to workspace` 绑定
- 选择项：`ragDemo -> D:\workspace\rag-demo`
- 绑定后 `Agent` 按钮从禁用态变为可点击态，并成功切换到 Agent 模式

### Smoke 1

- 输入：`看看当前 workspace 有哪些文件`
- 结果：`PASS`
- 观察：
  - trace 显示 `read_list` 只执行 1 次
  - 链路进入 `工具调用规范化 -> 审批策略 -> 工具执行 -> 证据写回 -> 组织最终回答`
  - 没有看到第二次 `read_list`
  - 最终回答引用 `D:\workspace\rag-demo` 的目录结构

### Smoke 2

- 输入：`打开 README.md 看看内容`
- 结果：`PARTIAL / BLOCKED BY NON-T012 ISSUE`
- 观察：
  - trace 显示 `read_open` 只执行 1 次
  - 没有看到第二次 `read_open`
  - 但最终回答内容异常，页面展示为：
    - `我来查看当前 workspace 的文件列表，并展示 README.md 的内容。`
    - `<function_calls> . </function_calls>`
  - 这属于生成阶段或回答组织问题，不是重复工具执行问题

### Smoke 3

- 输入：`看看 README.md 的内容`
- 结果：`PARTIAL / BLOCKED BY NON-T012 ISSUE`
- 观察：
  - trace 显示 `read_open` 只执行 1 次
  - 没有看到第二次 `read_open`
  - 当前停在 `组织最终回答`，页面持续显示 `正在生成 Agent 最终回答`
  - 这属于生成阶段阻塞，不是 repeated guard 缺陷

### Smoke 4

- 输入：`执行 dir 命令看看结果`
- 结果：本轮未完成
- 原因：
  - 第 3 条请求已卡在非 T012 的生成阶段
  - 为避免混入新的人工干预，本轮没有继续在同一前台线程追加第 4 条请求

### Frontend Smoke Conclusion

- 已有前台证据证明：
  - `read_list` 没有重复执行
  - `read_open` 没有重复执行
  - 当前新增前台阻塞发生在生成阶段，不是 repeated guard 缺陷
- 但旧线程仍存在 `<function_calls> . </function_calls>` 的生成阶段 / 回答组织异常，前台完整 smoke 不能算通过
- 该异常不属于 T012 repeated guard 缺陷，因此不在 T012 内顺手修复，也不误报为已解决
- 因此前台完整 smoke 仍未通过，本任务状态保持 `READY_FOR_REVIEW`
- 本轮评审修订如果再次进行前台手测，仍需要继续关注生成阶段异常；这部分不属于 T012 的重复动作防护实现

### Review-revise smoke

- `2026-07-04` 新线程：`ragDemo` workspace 绑定后的新对话
- 输入：`看看当前 workspace 有哪些文件`
- 结果：`PASS`
- 观察：
  - 链路完整经过 `候选选择 -> 调用前守卫 -> 执行计划 -> 工具调用规范化 -> 审批策略 -> 工具执行 -> 证据写回 -> 组织最终回答`
  - 页面只看到 1 次 `工具执行`，对应 `read_list`
  - 最终回答正常展示 `D:\workspace\rag-demo` 根目录结构

## Current Status

- 后端重复执行防护已实现
- 本轮评审修订已补 `/workspace` sentinel 与 `.` 的重复判定等价逻辑
- 后端定向测试已复跑通过
- T012 repeated guard 后端实现与评审修订已通过复审
- 真实前台 smoke 已证明 `read_list / read_open` 没有重复执行
- 旧线程仍存在 `<function_calls> . </function_calls>` 生成阶段 / 回答组织异常；该异常不属于 T012 repeated guard 缺陷，但会影响前台完整 smoke 通过
- 当前状态：`READY_FOR_REVIEW`
