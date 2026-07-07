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
task_state: DONE
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

## Delivery Evidence

### Changed Files

- `server/src/mcp/core/definitions.ts`
- `server/src/mcp/core/invocations.ts`
- `server/src/mcp/core/invocations.test.ts`
- `server/src/agent/types.ts`
- `server/src/agent/nodes/tool-node.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/__tests__/tool-node.test.ts`

### Diff Summary

- 给 Harness invocation failure 的 `record.error` 增加最小结构化 `failureCode`。
- 给 `AgentToolExecutionResult` 增加 `failureCode` 承载，并在 ToolNode failure record 中透传。
- `classifyHarnessFailure` 先按 `failureCode` 判定，再回退到旧 message pattern。
- failed tool evidence summary 追加 `failureCode=...`，让失败摘要可直接看见结构化分类结果。
- 补了 Harness 与 ToolNode 的定向单测，覆盖结构化优先、旧字符串 fallback 和 evidence 可见性。

### Acceptance Criteria Evidence

- `AC1` 已满足：
  - [tool-node.ts](D:/workspace/rag-demo/server/src/agent/nodes/tool-node.ts) 的 `classifyHarnessFailure` 现在先读取 `failureCode`。
- `AC2` 已满足：
  - 没有 `failureCode` 时，`TERMINAL_FAILURE_PATTERNS` 的旧字符串判定仍保留。
- `AC3` 已满足：
  - [evidence.ts](D:/workspace/rag-demo/server/src/agent/evidence.ts) failed summary 的 `keyFindings` 追加了 `failureCode=...`。
- `AC4` 已满足：
  - [tool-node.test.ts](D:/workspace/rag-demo/server/src/agent/__tests__/tool-node.test.ts) 覆盖了：
    - `failureCode` 优先于 terminal-looking message pattern
    - `workspace_escape` 的结构化 terminal 分类
    - 无 `failureCode` 的旧 fallback
  - [invocations.test.ts](D:/workspace/rag-demo/server/src/mcp/core/invocations.test.ts) 覆盖了 Harness 侧 `schema_invalid` 结构化记录。
- `AC5` 已满足：
  - 本轮只给 invocation error 增加最小字段，没有重写 Harness 或 MCP invocation 主流程。

### Verification Results

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/tool-node.test.ts src/mcp/core/invocations.test.ts`
  - 结果：`2` 个测试文件通过，`25` 个测试通过，`0` 失败
- `pnpm --filter @ui-chat-mira/server exec tsc --noEmit`
  - 结果：通过
- `pnpm check`
  - 结果：通过

### Review Evidence

- `server/src/mcp/core/definitions.ts` 只给 invocation error 增加了最小 `failureCode` 字段，没有扩成复杂异常体系。
- `server/src/mcp/core/invocations.ts` 会在 invocation failure 时写入结构化 `failureCode`，没有重写 Harness/MCP invocation 主流程。
- `server/src/agent/nodes/tool-node.ts` 的 `classifyHarnessFailure` 先按 `failureCode` 判定，再回退到旧 message pattern。
- `server/src/agent/evidence.ts` failed tool summary 会带出 `failureCode=...`。
- `server/src/agent/__tests__/tool-node.test.ts` 覆盖了：
  - `failureCode` 优先于 terminal-looking message pattern
  - `workspace_escape` 结构化 terminal 分类
  - 无 `failureCode` 的旧 fallback
- `server/src/mcp/core/invocations.test.ts` 覆盖了 Harness 侧 `schema_invalid` 结构化记录。

### Remaining Notes

- 本轮没有把所有历史错误都改成结构化 `failureCode`，旧 message pattern fallback 仍然保留，符合本卡“小补”边界。
- `policy_denied`、`command_exit_nonzero`、`timeout`、`unknown` 这几个 code 只完成了类型与分类入口，没有在本轮把所有调用源逐一补齐。
