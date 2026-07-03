---
status: current
priority: P0
owner: agent-remediation
last_verified: 2026-06-30
layer: project-control
module: ProjectControl
feature: ToolExecutionFreeze
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
task_state: DONE
---

# T-002 ToolNode No Fallback

## Target

收紧执行契约，确保执行层只消费策略层已经冻结的调用对象。

问题本体：

- `policyNode` 会冻结 `pendingToolCall`
- 但 `toolNode` 在缺少 `pendingToolCall` 时仍可能重新 `build args`
- 这会破坏“策略层决定调用，执行层只负责执行”的边界

## Allowed Changes

- `toolNode`、`policyNode`、执行调用相关类型
- 与调用冻结、参数重建阻断直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 未审批的协议扩展
- 借修复名义引入兼容分支或静默 fallback
- 把本任务扩大成 approval 模型全面重构
- 变更无关模块

## Acceptance Criteria

1. `toolNode` 不再在缺少 `pendingToolCall` 时重建危险参数
2. 执行层只接受已冻结的调用对象，缺对象时中断并报错
3. 本地测试或最小验证能覆盖：
   - 正常冻结后执行
   - 缺失 `pendingToolCall` 时阻断
4. 风险和边界回填：
   - 对应 `GR-P0-3`
   - 对应原始评审点 `R10` `R18`

## Verification

- 由具体执行任务补充命令和结果

## Review Outcome

- 评审结论：通过
- 当前状态：`DONE`
- 结论依据：
  - `toolNode` 已不再在缺少 `pendingToolCall` 时重建参数
  - 执行层缺少冻结调用对象时会直接阻断并报错
- 对应实现证据：
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts:803)
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts:806)
