---
status: current
priority: P1
owner: agent-remediation
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: CapabilityToolSeparation
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
task_state: DONE
---

# T-005 Capability Tool Separation

## Target

推进 Capability / Tool 分层收口，避免执行态继续混用 `capabilityId` 和 `toolId`。

问题本体：

- 底层 registry 是 `tool-first`
- 意图层临时抽象出 capability profile
- 但 state、trace、审批、执行并没有把两层概念真正拆开

当前已确认的污染点包括：

- `selectedCapabilityId` 实际经常承载 `toolId`
- `pendingToolCall.capabilityId` 实际经常承载 `toolId`
- `lastToolExecution.capabilityId` 实际经常承载 `toolId`

## Allowed Changes

- `AgentNodeState`、`AgentRun`、`AgentGraphOutput` 相关类型
- `policyNode / toolNode / graph / writeback / trace` 中与 capability/tool 字段直接相关的实现
- 与领域模型分层直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成完整 registry 重写
- 借命名清理之名改动无关业务行为
- 未经确认引入兼容 fallback 字段长期并存

## Acceptance Criteria

1. 执行态显式区分：
   - `selectedCapabilityId`
   - `selectedToolId`
   - `pendingToolCall.toolId`
   - `lastToolExecution.toolId`
2. capability 主要保留在意图层和能力解释层
3. tool 主要用于执行、审批、trace、防重复判断
4. 台账回填：
   - 对应 `GR-P1-1`
   - 对应原始评审点 `R03` `R07` `R08` `R09` `R28` `R29` `R30`

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/resume.test.ts src/agent/persistence.test.ts src/agent/routes.test.ts`
  - 结果：通过，`31 passed`
- `2026-07-02` 定向手测：
  - 读取真实线程 `Codex Resume Trace Handtest` 的最新 assistant 消息详情
  - execution trace 明确以 `toolId: workspace_mutation` 写回
  - `assistant.metadata.agent` 与 execution-node details 未再出现旧的执行态 capability/tool 混用问题
  - 结果：通过

## Implementation Evidence

- 执行态 contract 显式拆分：
  - `server/src/agent/types.ts`
  - `selectedToolId` 已加入 `AgentRun` / `AgentGraphInput` / `AgentGraphOutput`
  - `pendingToolCall` 与 `lastToolExecution` 统一以 `toolId` 为执行标识
- 恢复执行路径不再用 `toolId` 污染 capability 字段：
  - `server/src/agent/resume.ts`
  - resume 前写回：
    - `selectedCapabilityId: run.selectedCapabilityId`
    - `selectedToolId: pendingToolCall.toolId`
  - 重新进入 graph 时同样分开传入 capability/tool
- 执行节点保持 tool-first：
  - `server/src/agent/nodes.ts`
  - `policyNode` 只把 capability 保留为意图层选中结果，把执行冻结对象写入 `selectedToolId` / `pendingToolCall.toolId`
  - `toolNode` 只消费 `selectedToolId`
  - `lastToolExecution.toolId` 作为执行结果、trace 和生成证据输入
- graph / writeback / persistence 同步收口：
  - `server/src/agent/graph.ts`
  - `server/src/agent/index.ts`
  - `server/src/db/repositories/agent-run.repository.ts`
  - `server/src/db/schema.ts`
  - `server/src/db/thread.db.ts`
  - 运行态持久化新增 `selected_tool_id`
  - 旧库初始化升级逻辑已补 `selected_tool_id` 列
- 直接相关回归测试补齐：
  - `server/src/agent/graph.test.ts`
  - `server/src/agent/resume.test.ts`
  - `server/src/agent/persistence.test.ts`
  - `server/src/agent/routes.test.ts`

## Scope Notes

- 本任务没有做完整 registry 重写；底层 harness registry 仍是 tool-first，这一点和任务卡 `Forbidden Changes` 一致。
- 本任务的收口范围是：
  - capability 保留在意图识别和能力解释层
  - tool 用于执行、恢复、审批、trace 和持久化执行状态

## Remaining Risks

- `server/src/mcp/harness/registry.ts` 仍保留 capability 命名别名以兼容现有 harness 装配与外部接入；如果后续要彻底统一术语，需要单开任务处理 registry/exposure 层。
- 本次未运行全量 `pnpm check` 或打包命令；当前只验证了 T-005 直接影响的 `server` 类型检查与 agent 相关测试集。
