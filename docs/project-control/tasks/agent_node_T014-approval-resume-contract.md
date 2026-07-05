---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: ApprovalResumeContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T012-repeated-tool-guard.md
  - docs/project-control/tasks/agent_node_T013-evidence-grounded-final-answer.md
  - docs/chat/agent-frontend-workspace-smoke-method.md
  - server/src/agent/policy-node.ts
  - server/src/agent/tool-node.ts
  - server/src/agent/resume.ts
  - server/src/agent/routes.ts
  - server/src/agent/types.ts
  - desktop/src/shared/api/thread.ts
task_state: DONE
---

# agent_node_T014 approval resume contract

## T014R Scope

`T014R` 是 `T014` 的补充修复，不重做 resume 对象对齐。

`T014` 已经证明：

- approve 恢复的是原 frozen `pendingToolCall`
- `toolId + inputHash + toolCallId` 对齐校验成立
- ToolNode 能真实执行
- evidence 能写回
- reject 后不会执行工具

`T014R` 只补 approve / reject 之后的 state finalization：

- 不再残留会误导前台的 `pendingApproval`
- 不再残留会误导前台的 `pendingToolCall`
- `currentStepId` 不再停在 approval
- assistant message metadata 不再继续保留旧的 `waiting_approval`

本任务不处理：

- terminal stdout 乱码
- final answer 质量
- 前端审批 UI 大改
- Provider Gateway / MCP / Agent V2

## Target

`T014` 是 `Agent V1.5 approval resume contract` 任务。

它只处理一条链路：

- `pendingApproval -> 用户批准或拒绝 -> 恢复或终止原 frozen pendingToolCall -> ToolNode -> evidence`

它可以和 `T013` 并行，但不覆盖 `T013` 的 final answer grounding，也不改前端审批 UI、Provider Gateway、工具选择策略或 Agent V2 话题。

## Allowed Changes

- `server/src/agent/types.ts`
- `server/src/agent/policy-node.ts`
- `server/src/agent/tool-node.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/resume.ts`
- `server/src/agent/routes.ts`
- `desktop/src/shared/api/thread.ts`
- `server/src/agent/policy.test.ts`
- `server/src/agent/tool-node.test.ts`
- `server/src/agent/resume.test.ts`
- `server/src/agent/routes.test.ts`
- `server/src/agent/persistence.test.ts`
- `server/src/agent/graph.test.ts`
- `docs/project-control/tasks/agent_node_T014-approval-resume-contract.md`
- `docs/project-control/agent-nodes-workboard.md`

## Forbidden Changes

- `T013 final answer grounding`
- 前端审批 UI 大改
- Provider Gateway
- workspace path normalize
- repeated tool guard 设计重写
- Planner JSON parser
- Agent V2
- DAG / 并发 / 多智能体 / 长期记忆
- 让 `ToolNode` 直接 answer

## Invariants

本次完成后仍保持下面这些边界：

1. Planner 只输出 `state.nextAction`
2. Normalize 只冻结 `nextAction.use_tool` 为 `pendingToolCall`
3. Policy 只审批 frozen `pendingToolCall`
4. ToolNode 只执行 approved frozen `pendingToolCall`
5. `selectedToolId` 不是执行入口
6. `capabilityIntent.selectedToolIds` 不是执行入口
7. 审批恢复必须校验审批对象与 frozen 调用对象一致
8. 用户拒绝后不得执行工具
9. 已审批执行结果必须写入 evidence
10. 执行后必须清理 `pendingApproval / pendingToolCall`

## Defect Layer

这是后端运行时合同缺陷，不是前端按钮样式问题。

原始缺陷有两层：

1. 批准后虽然离开了 `pendingApproval`，但恢复链路没有稳定绑定回原 frozen `pendingToolCall`
2. Agent 侧保存的审批哈希和 Harness 执行前校验使用的哈希口径不一致，导致前台第一次批准后又在 Harness 层重新卡回审批

第二层的根因已经定位为：

- Agent 侧 `pendingToolCall.inputHash` 使用 `toolId + args + source`
- Harness 侧 `approvedInvocations` 校验使用 `args` 本身的哈希

如果不桥接这两个口径，前台会出现“审批看起来通过了，但真正执行时又被 Harness 当成没批准”的假恢复。

## Implementation Result

本次实现保持了现有节点边界，没有重写 Graph 主链路。

完成内容：

1. `AgentApprovalRequest` 补齐 `toolCallId`
2. `policy-node.ts` 与 `tool-node.ts` 创建 `pendingApproval` 时都带上 `toolCallId`
3. 审批 trace 与节点 details 增补 `toolCallId`
4. `resume.ts` 新增严格恢复校验：
   - `toolId` 不一致时阻断
   - `inputHash` 不一致时阻断
   - `toolCallId` 存在且不一致时阻断
5. 恢复校验失败时，run 会被明确标记为 `blocked`
   - `terminalReason = approval_resume_mismatch`
   - 清理 `pendingApproval`
   - 清理 `pendingToolCall`
   - 清理 `selectedToolId`
6. `/agent/runs/:id/approve`、`reject`、`cancel` 路由都收紧了审批状态语义
7. `reject` 和 `cancel` 会清理 `pendingApproval / pendingToolCall / selectedToolId`
8. `tool-node.ts` 增加 Agent -> Harness 审批哈希桥接
   - Agent 保留自己的 frozen hash 用于恢复合同校验
   - 真正调用 Harness 前，把 `approvedInvocations` 改写成 Harness 认得的 `args` 哈希
9. 因此批准后不再让 Harness 二次误判成未审批，而是直接进入真实工具执行
10. `resume.ts` 新增 `persistAgentAssistantState`
   - approve 继续沿用已有 assistant message 回写逻辑
   - approval mismatch 现在会把 assistant message 明确回写成 `blocked`
   - 不再让前台继续读到旧的 `waiting_approval`
11. `/agent/runs/:id/reject` 现在会同步回写 assistant message
   - 文案明确表达“已拒绝，工具没有执行”
   - metadata.status = `blocked`
   - `pendingApproval / pendingToolCall` 不再通过旧 metadata 继续把前台留在等待审批

## Test Coverage

本次定向覆盖了 T014 要求的关键场景：

1. `require approval pauses before ToolNode`
2. `approve resumes original pendingToolCall`
3. `approval mismatch blocks execution`
4. `deny does not execute`
5. `clears approval state after execution`
6. `selectedToolId cannot bypass approval resume`
7. `pendingApproval is not repeated duplicate`
8. `graph continues after approved execution`
9. `approvedInvocations` 会在进入 Harness 前转换成 Harness 所需哈希
10. reject 路由会把 assistant metadata 从 `waiting_approval` 改成明确终态
11. approval mismatch 会同步回写 assistant metadata，避免前台继续显示等待审批

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/tool-node.test.ts src/agent/graph.test.ts src/agent/resume.test.ts`
  - 结果：通过，`33 passed`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/policy.test.ts src/agent/tool-node.test.ts src/agent/resume.test.ts src/agent/routes.test.ts src/agent/persistence.test.ts src/agent/graph.test.ts`
  - 结果：通过，`54 passed`
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

本次没有重跑：

- `pnpm check`
- `pnpm package:electron:win`

原因是 `T014` 当前任务只涉及 approval resume contract 定向修复与 smoke 复核，本轮没有做打包或运行时网络契约变更。

## Frontend Smoke

项目 owner 已在真实前台线程完成 `P0-4 / P0-5 / P0-6` 终态 smoke，并明确确认下面这些结果：

- `terminal_session` 会先进入等待审批，不会在未批准前执行
- approve 后等待审批 UI 消失，工具继续执行
- reject 后页面明确显示“已拒绝 / 未执行”，不再显示 approve / reject 按钮
- 刷新线程后，等待审批状态不会复活

这次前台 smoke 结论与后端定向验证一致，说明本轮修复不仅清掉了内存态，也清掉了会在 DB reload 后复活的审批残留状态。

当前任务卡不重复附截图文件路径，直接以项目 owner 本轮验收结论作为人工验收证据来源。

## Conclusion

当前结论是：`T014` 的 resume 对齐与 `T014R` 的 state finalization 都已完成闭环，本任务可以更新为 `DONE`。

理由：

1. approve 后原 frozen `pendingToolCall` 会继续执行并写回 evidence
2. approve / reject / mismatch 后，`pendingApproval / pendingToolCall / currentStepId` 不会再以等待审批态残留到 repository reload 之后
3. reject 后不会执行工具，页面会明确表达“已拒绝 / 未执行”
4. approval mismatch 仍会阻断执行，同时清理审批残留状态
5. 定向后端测试、typecheck 和项目 owner 真实前台 smoke 都已通过

## Review Outcome

`2026-07-05` 当前评审结论：`PASS`

本次评审只收口 `pendingApproval -> 用户审批 -> 恢复原 frozen pendingToolCall -> ToolNode -> evidence -> 回到 Planner / Generate` 这一条链路。

本次 `PASS` 明确确认了下面这些事实：

1. `pendingApproval` 已绑定原 frozen `pendingToolCall`
2. 审批恢复前会校验 `toolId + inputHash + toolCallId`
3. mismatch 时会阻断，不会进入 graph / ToolNode
4. reject / cancel 后不会执行工具，并会清理审批状态
5. 批准后恢复的是原 frozen 调用，不是重新让 Planner 生成一次工具调用
6. `ToolNode` 仍只执行 frozen `pendingToolCall`，不会从 `selectedToolId` 或 `capabilityIntent.selectedToolIds` 绕过
7. completed tool execution 会真实写入 evidence，并保留 `toolCallId / toolId / inputHash / args / invocationId / status / result`
8. Agent 审批 hash 与 Harness args hash 的口径差异已经通过桥接处理，不会再在批准后被 Harness 二次误判成未审批

本次 `PASS` 不覆盖：

- `T013 final answer grounding`
- generate 阶段空回答
- 前端审批 UI 展示残留
- Provider Gateway
- MCP registry
- Agent V2
- DAG / 并发 / 多智能体 / 长期记忆

## Follow-up Candidates

下面一项仍单独跟踪，不混入 `T014R` 结论：

1. 批准后 `generate` 阶段可能返回空回答，页面显示 `Model returned empty answer`
