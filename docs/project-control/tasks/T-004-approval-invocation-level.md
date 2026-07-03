---
status: current
priority: P0
owner: agent-remediation
last_verified: 2026-06-30
layer: project-control
module: ProjectControl
feature: ApprovalInvocationLevel
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
task_state: DONE
---

# T-004 Approval Invocation Level

## Target

把高风险工具审批从 `tool-level` 升级为 `invocation-level`。

问题本体：

- 当前审批批准的是 `toolId`
- 不是某次具体 `invocation`
- `resume` 后也没有强绑定、复用或校验原始 `args`
- `policyNode` 与 `toolNode` 现在存在两条分裂的审批路径：
  - `policyNode` 前置审批对象只带 `toolId` 和 `reason`
  - `toolNode` 运行时 `awaiting_approval` 才附带 `input: pendingToolCall.args`
- 这意味着“前置审批”和“运行时审批”不是同一个 invocation 对象模型，审批语义当前不统一

适用范围只针对高风险工具：

- `sideEffect !== "none"`
- `requiresApproval = true`
- 外部 MCP 写操作
- 消息发送
- 文件修改
- 终端执行

## Allowed Changes

- `AgentApprovalRequest`、`resume`、`toolNode`、`policyNode` 相关实现
- 与审批对象、已批准调用对象、恢复执行契约直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把所有低风险工具都强行纳入参数级审批
- 未获确认地扩大审批 UI 或消息协议范围
- 以兼容为名保留无约束的 `approvedToolIds` 旧路径

## Acceptance Criteria

1. 高风险审批对象至少绑定：
   - `toolId`
   - `input/args`
   - `inputHash` 或等价调用指纹
2. `policyNode` 前置审批与 `toolNode` 运行时审批必须收敛到同一审批对象语义：
   - 不能再出现一条路径只审批 `toolId`
   - 另一条路径才审批 `toolId + input`
3. `resume` 时只能复用或校验同一份已批准调用参数
4. 不允许“批准了工具 A，恢复后执行了另一组参数”的路径继续存在
5. 低风险只读工具不被误拉入复杂审批
6. 台账回填：
   - 对应 `GR-P0-2`
   - 对应原始评审点 `R11` `R13` `R14` `R19`

## Verification

- `pnpm vitest run src/agent/resume.test.ts src/agent/tool-node.test.ts src/agent/graph.test.ts src/mcp/core/invocations.test.ts`
  - workdir: `server/`
  - result: passed (`4` files, `28` tests)
- `pnpm tsc -p tsconfig.json --noEmit`
  - workdir: `server/`
  - result: passed

## Evidence

- Changed files:
  - `server/src/agent/approval-fingerprint.ts`
  - `server/src/agent/types.ts`
  - `server/src/agent/nodes.ts`
  - `server/src/agent/graph.ts`
  - `server/src/agent/index.ts`
  - `server/src/agent/run-store.ts`
  - `server/src/agent/resume.ts`
  - `server/src/agent/routes.ts`
  - `server/src/agent/resume.test.ts`
  - `server/src/agent/tool-node.test.ts`
  - `server/src/agent/graph.test.ts`
  - `server/src/mcp/core/permissions.ts`
  - `server/src/mcp/core/invocations.ts`
  - `server/src/mcp/core/invocations.test.ts`
  - `server/src/db/schema.ts`
  - `server/src/db/thread.db.ts`
  - `server/src/db/repositories/agent-run.repository.ts`
  - `desktop/src/shared/api/thread.ts`
- Diff summary:
  - Replaced `approvedToolIds` approval memory with `approvedInvocations`, binding approval to `toolId + input + inputHash`.
  - Unified `policyNode` pre-approval and `toolNode` runtime approval to emit the same invocation-shaped `AgentApprovalRequest`.
  - Froze high-risk invocation args in `pendingToolCall`, carried `inputHash`, and reused the same frozen invocation on resume.
  - Rejected resume when approval object and frozen invocation do not match by `toolId` / `inputHash`.
  - Updated harness preflight approval to validate exact approved invocation fingerprints instead of bare tool ids.
  - Added persisted `approved_invocations_json` run-state storage and runtime DB column bootstrap.
  - Extended direct tests for resume, tool execution, graph flow, and core invocation approval.
- Acceptance criteria evidence:
  - AC1: `AgentApprovalRequest` now carries `input` and `inputHash`; `AgentToolCallRequest` carries the same `inputHash`.
  - AC2: `policyNode` and `toolNode` both construct invocation-shaped approval objects from frozen args.
  - AC3: `resumeApprovedAgentRun` now requires `pendingApproval + pendingToolCall`, validates `toolId` / `inputHash`, and resumes with the frozen call.
  - AC4: Harness approval now matches `approvedInvocations` by exact `toolId + inputHash`, preventing parameter drift after approval.
  - AC5: Low-risk read path still executes without approval, covered by `graph.test.ts` and `invocations.test.ts`.
  - AC6: This task addresses `GR-P0-2` and raw findings `R11` `R13` `R14` `R19`.

## Unfinished / Risks

- `pnpm check` and `pnpm package:electron:win` were not run in this task package because this task only changed Agent/backend approval flow and there are extensive unrelated workspace changes already present.
- The DB bootstrap adds `approved_invocations_json` forward-only. Existing historical `approved_tool_ids_json` data is intentionally not reused, matching the task requirement to avoid preserving the unconstrained old approval path.

## Review Outcome

- 评审结论：通过
- 当前状态：`DONE`
- 结论依据：
  - 审批对象已绑定 `toolId + input + inputHash`
  - `policyNode` 前置审批与 `toolNode` 运行时审批已统一为 invocation 语义
  - `resume` 与 Harness 放行都基于同一份冻结调用参数校验
- 对应实现证据：
  - [server/src/agent/types.ts](D:/workspace/rag-demo/server/src/agent/types.ts:75)
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts:584)
  - [server/src/agent/resume.ts](D:/workspace/rag-demo/server/src/agent/resume.ts:72)
  - [server/src/mcp/core/invocations.ts](D:/workspace/rag-demo/server/src/mcp/core/invocations.ts:157)
