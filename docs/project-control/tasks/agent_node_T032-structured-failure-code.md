---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-07
layer: project-control
module: AgentRuntime
feature: StructuredFailureCode
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/agent-runtime-t29-t33-ledger.md
  - server/src/agent/nodes/tool-node.ts
task_state: TODO
---

# agent_node_T032 Structured Failure Code

## Target

为 ToolNode 和 Harness invocation failure 增加最小结构化 `failureCode`，让 `classifyHarnessFailure` 优先消费结构化字段；没有该字段时，旧字符串 pattern 继续作为 fallback。

本任务是小补，不是重写错误系统。

## Source Task Pack

- External task id: `T32`
- External title: `结构化 failure code 小补`

## Allowed Changes

- `server/src/agent/nodes/tool-node.ts`
- Harness 或 MCP invocation 返回 error 的最小结构
- `AgentToolExecutionResult` 或 Evidence summary 中失败信息承载
- 相关最小单测

## Forbidden Changes

- 不大改 MCP error 体系
- 不重写所有工具错误
- 不引入复杂异常层级
- 不改变 Agent Graph 主链
- 不把 `T31` terminal 语义拆分混进来，除非只复用已存在字段
- 不删除旧 fallback

## Suggested Failure Codes

```ts
type HarnessFailureCode =
  | "approval_mismatch"
  | "policy_denied"
  | "schema_invalid"
  | "workspace_escape"
  | "tool_runtime_failed"
  | "command_exit_nonzero"
  | "timeout"
  | "cancelled"
  | "unknown";
```

## Acceptance Criteria

1. `classifyHarnessFailure` 优先使用结构化 `failureCode`。
2. 没有 `failureCode` 时，旧 pattern fallback 仍可工作。
3. Evidence summary 可看到 `failureCode`。
4. 至少有单测证明：
   - `failureCode` 优先级高于 message pattern
   - 无 `failureCode` 时 fallback 生效
   - `policy`、`workspace`、`schema`、`unknown` 至少覆盖两类
5. 没有重写 Harness 或 MCP invocation。

## Verification

- 运行与 `classifyHarnessFailure`、Harness failure summary、ToolNode failure 相关的最小测试集。
- 明确记录 `failureCode` 命中和字符串 fallback 命中的验证结果。
