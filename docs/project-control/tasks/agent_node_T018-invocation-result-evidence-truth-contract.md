---
status: done
task_state: DONE
owner: agent-runtime
last_verified: 2026-07-05
layer: project-control
module: AgentRuntime
feature: InvocationResultEvidenceTruthContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - server/src/agent/evidence.ts
  - server/src/agent/nodes/generate.ts
  - server/src/agent/nodes/policy-node.ts
  - server/src/agent/nodes/tool-node.ts
  - server/src/mcp/terminal/runtime.ts
---

# agent_node_T018：Invocation Result -> Evidence Truth Contract

## Target

把 tool / sandbox / policy 的结果稳定映射到 evidence 真值合同，避免 generate 把失败、拒绝、超时、截断、二进制输出或乱码输出伪装成“已经成功拿到自然语言证据”。

## Scope

Allowed:

- `server/src/agent/evidence.ts`
- `server/src/agent/nodes/generate.ts`
- `server/src/agent/nodes/policy-node.ts`
- `server/src/agent/types.ts`
- `server/src/mcp/terminal/runtime.ts`
- `server/src/agent/__tests__/policy.test.ts`
- `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
- `server/src/agent/__tests__/nodes.test.ts`
- `docs/project-control/agent-nodes-workboard.md`
- `docs/project-control/tasks/agent_node_T018-invocation-result-evidence-truth-contract.md`

Forbidden:

- Tool Exposure
- Sandbox Runner 实现
- UI
- Agent V2

## Acceptance Coverage

必须稳定区分这些 evidence 真值：

```txt
completed
failed
blocked
denied
timed_out
truncated
binaryDetected
```

本次验收关注点：

- `policy deny` 会写入 `denied` evidence，而不是只留下 error message。
- Harness `awaiting_approval` 会映射成 `blocked` summary，不再误当成完成证据。
- `terminal_session` 的 `timedOut / truncated / binaryDetected / stdoutEncoding / stderrEncoding / violations` 会进入 summary。
- `timed_out / blocked / denied / binaryDetected` 不 answer-ready。
- `truncated` 会进入 summary，并保留是否还能回答的显式判断。
- terminal 输出编码不可判定或出现明显乱码时，generate 不能假装自己读懂了内容。
- `read_list` 只能回答目录概览；当问题要文件内容时，fallback 只能如实说明“目前只有目录概览证据”。
- `read_locate` 只能回答定位结果；不能伪装成已经读取了文件内容。

## Implementation

完成项：

- `AgentEvidenceSummary.status` 扩展为 `blocked / denied / timed_out / truncated / binaryDetected`。
- `policyNode` 在策略拒绝时写入 synthetic denied tool evidence，并回填 `lastToolExecution`。
- `terminal runtime` 透传 sandbox 真值字段到 `terminal_session` 结果。
- `createToolExecutionEvidenceSummary` 现在会基于 terminal 真值字段判断 `timed_out / truncated / binaryDetected / blocked`，并把编码、违规信息和可读性结论写入 summary。
- `generateNode` 新增“不可用证据不能伪装成稳定结果”的输出防护，并在 read/tool fallback 中明确回答边界。

## Verification

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/policy.test.ts src/agent/__tests__/toolcall-loop-regression.test.ts src/agent/__tests__/nodes.test.ts
pnpm --filter @ui-chat-mira/server typecheck
pnpm check
```

Result:

```txt
36 passed
typecheck passed
pnpm check passed
```

## Review Result

结论：

- `PASS`。本次只补 evidence 真值合同和 generate 防伪回答，不改 Tool Exposure、不改 Sandbox Runner 实现、不改 UI。

剩余说明：

- 终端“乱码”识别目前依赖编码字段和明显异常字符模式，已经足够阻断“假装理解”，但还不是面向所有 mojibake 形式的完备分类器。
