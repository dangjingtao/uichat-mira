---
status: current
priority: P0
owner: agent-remediation
last_verified: 2026-06-30
layer: project-control
module: ProjectControl
feature: CommandSafety
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
  - docs/project-control/decisions/TD-T003-01-managed-workspace-tool-not-implemented.md
task_state: DONE
---

# T-003 Terminal Command Safety

## Target

消除 Agent 自动拼 `terminal command` 的高风险路径。

本任务允许分阶段交付：

- 第一阶段：先阻断危险自动路径，禁止 Agent 自动为 `terminal_session` 构造任意 `command`
- 第二阶段：再落地 `managed workspace tool` 这类结构化受控操作替代

如果当前交付只完成第一阶段，则可以进入评审，但不得表述为整张卡已完全闭环。

问题本体：

- Agent 不该把自然语言直接翻译成 shell command
- 尤其不该用 `terminal_session` 承载删除、移动、修改等文件操作
- 当前更合理的方向是引入 `managed workspace tool`

这里的 `managed workspace tool` 指不接受任意 shell command，而是接受结构化操作参数的受控工具，例如：

```ts
{
  operation: "delete",
  targetPath: "...",
  recursive: true,
  dryRun: false,
}
```

## Allowed Changes

- `buildCapabilityArgs`、`terminal_session` 接入边界、受控 workspace 操作相关实现
- 与危险命令构造移除、结构化参数改造直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 保留 Agent 自动拼 command 的默认主路径
- 用新的任意 command 包装替代旧的任意 command 包装
- 未获确认地扩大终端执行权限
- 未经批准新增兼容 fallback

## Acceptance Criteria

1. Agent 主流程不再自动把自然语言转成 `terminal_session.command`
2. 删除 / 移动 / 写入类高风险动作改为结构化受控操作，或在未实现前明确阻断
3. workspace boundary 针对结构化目标参数校验，而不是依赖解析任意 command 字符串
4. 本地测试或最小验证能证明：
   - 原危险路径已被移除或阻断
   - 受控参数路径可验证
5. 台账回填：
   - 对应 `GR-P0-1`
   - 对应原始评审点 `R15` `R16` `R19`

## Verification

已执行验证：

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/policy.test.ts src/agent/tool-node.test.ts src/agent/graph.test.ts src/mcp/tools/workspace-mutation.tool.test.ts`
  - 结果：`4` 个测试文件，`36` 个测试全部通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过

本轮验证覆盖：

- Agent 不再为 `terminal_session` 自动构造 `command`
- 删除类请求可走结构化 `workspace_mutation` 参数路径
- `terminal_session` 仍会阻断未审查的自动终端执行
- workspace boundary 会拒绝越界路径和未结构化的高风险请求

## Current Delivery Scope

当前提交已完成阶段二受控替代落地：

- 已完成：
  - 阻断 Agent 自动构造 `terminal_session.command` 的主路径
  - 阻断删除 / 移动 / 写入类高风险动作通过自动终端命令直接落地
  - 新增 `workspace_mutation` 结构化受控工具，覆盖 `delete` / `move` / `write`
  - `workspace_edit` 能力优先路由到结构化受控工具，而不是 `terminal_session`
  - Agent 可为可解析的高风险工作区请求冻结结构化参数，无法解析时明确阻断
  - workspace mutation 路径具备 workspace boundary 校验与直接测试覆盖
- 未完成：
  - `pnpm check`
  - `pnpm package:electron:win`
  - 打包后 `/health` 手动验证

因此本卡当前实现已经完成闭环交付，并已在本轮评审后转为 `DONE`。

## Technical Debt

- [TD-T003-01-managed-workspace-tool-not-implemented.md](D:/workspace/rag-demo/docs/project-control/decisions/TD-T003-01-managed-workspace-tool-not-implemented.md)
  - 本轮评审确认后该债务关闭

## Review Outcome

- 当前提交结论：评审通过
- 当前状态：`DONE`
- 评审结论：
  - `AC1` 已满足：`policyNode` 对 `terminal_session` 只保留受审查参数入口，不再自动生成 `command`
  - `AC2` 已满足：删除 / 移动 / 写入 已切到 `workspace_mutation` 结构化受控路径
  - `AC3` 已满足：workspace boundary 基于结构化 `targetPath / destinationPath` 生效，不再依赖解析任意 command
  - `AC4` 已满足：对应本地测试与 typecheck 已覆盖关键路径
- 非阻断说明：
  - 本卡要求的是主线风险收口，不包含打包验证；`pnpm check` / `pnpm package:electron:win` 仍可在后续整体验证批次执行
- 对应实现证据：
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts:195)
  - [server/src/agent/intent/task-capability-selector.ts](D:/workspace/rag-demo/server/src/agent/intent/task-capability-selector.ts:1)
  - [server/src/mcp/tools/workspace-mutation.tool.ts](D:/workspace/rag-demo/server/src/mcp/tools/workspace-mutation.tool.ts:1)
  - [server/src/mcp/harness/runtime.ts](D:/workspace/rag-demo/server/src/mcp/harness/runtime.ts:1)
  - [server/src/mcp/harness/capability-profiles.ts](D:/workspace/rag-demo/server/src/mcp/harness/capability-profiles.ts:1)
  - [server/src/mcp/tools/workspace-mutation.tool.test.ts](D:/workspace/rag-demo/server/src/mcp/tools/workspace-mutation.tool.test.ts:1)
  - [server/src/agent/policy.test.ts](D:/workspace/rag-demo/server/src/agent/policy.test.ts:1)
  - [server/src/agent/tool-node.test.ts](D:/workspace/rag-demo/server/src/agent/tool-node.test.ts:1)
  - [server/src/agent/graph.test.ts](D:/workspace/rag-demo/server/src/agent/graph.test.ts:1)
