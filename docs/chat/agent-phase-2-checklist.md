Status: Planned
Owner: chat / runtime
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: AgentRuntime
Doc Type: checklist
Related:
  - agent-runtime-design.md
  - agent-phase-1-checklist.md
  - chat-execution-trace-design.md
  - ../tooling-runtime/harness-runtime-design.md

# Agent Phase 2 Checklist

## Phase Goal

Phase 2 的目标是把 Phase 1 的 Agent MVP 升级为可审批、可恢复、可接入高风险工具的受控 Agent Runtime。

重点不是让 Agent 更“放飞”，而是让它更可控：

- 高风险工具可以请求，但必须暂停等待审批。
- `AgentRun` 从内存态升级到可持久化。
- approval、resume、cancel、audit 进入主链。
- `edit_file`、`terminal_session`、企业微信等能力可以在显式授权后接入。

## Global Principles

1. 充分复用当前基建。实现前必须先读文档和已有代码。
   - 必读：`agent-runtime-design.md`
   - 必读：`agent-phase-1-checklist.md`
   - 必读：`../tooling-runtime/harness-runtime-design.md`
   - 必读：`../tooling-runtime/terminal-capability-checklist.md`
   - 必读：`../integrations/wecom-chat-tool-integration-plan.md`
   - 先读 Harness risk / invocation / workspace / approval 相关代码，再接入高风险能力。

2. 架构层不允许轻易打兜底，也不允许不明真相。
   - 不允许高风险工具失败后悄悄改走普通回答。
   - 不允许 approval state 只存在 prompt 或前端状态里。
   - 不允许因为 provider 不支持某种 tool-call 格式就静默切换协议。
   - 任何权限、审批、持久化语义不清时，先停下确认设计。

3. 万物可插拔。
   - `AgentRunStore` 可从 memory store 替换为 SQLite store。
   - `AgentPolicy` 可替换策略源。
   - approval UI 可替换。
   - 高风险工具通过 Harness capability 接入，不直连具体实现。

4. 严格执行单元测试，并提供项目 owner 手测清单。
   - approval / reject / resume / cancel 必须覆盖测试。
   - 高风险工具必须有“不会绕过审批”的测试。
   - owner 手测只验证产品语义和关键风险体验。

## Scope

本期主链：

- `AgentRun` SQLite 持久化。
- `AgentApprovalRequest`。
- approve / reject / cancel API。
- waiting_approval run 可恢复。
- 高风险工具接入 approval path。
- execution trace 展示审批节点。
- 最小 approval UI。

本期可接入但必须审批：

- `edit_file`
- `terminal_session`
- 企业微信发送等外部副作用工具

本期仍不做：

- 无限制后台自治。
- 多 Agent 协作。
- durable memory 自动写入。
- 完整复杂 LangGraph checkpoint 人机中断体系，除非 Phase 1/2 代码已经自然支撑。

## Implementation Checklist

### 1. Pre-Read

- [x] 阅读 Phase 1 已完成代码和测试。
- [x] 阅读 `server/src/agent/*`。
- [x] 阅读 `server/src/mcp/tools/edit-file.tool.ts`。
- [x] 阅读 `server/src/mcp/tools/terminal-session.tool.ts`。
- [x] 阅读企业微信相关 tool / integration 代码。
- [x] 阅读 `server/src/mcp/core/invocations.ts`。
- [x] 阅读 `server/src/mcp/harness/environment.ts`。
- [x] 阅读现有 DB schema 和 repository 约定。
- [x] 阅读前端 uchat trace 和 composer 代码。

### 2. Persistence

- [ ] 新增 SQLite schema：`agent_runs`。
- [ ] 新增 SQLite schema：`agent_run_steps`。
- [ ] 新增 SQLite schema：`agent_observations`。
- [ ] 新增 SQLite schema：`agent_approvals`。
- [ ] 新增 repository：`agent-runs.repository.ts`。
- [ ] `AgentRunStore` 改为 interface + SQLite implementation。
- [ ] 保留 memory implementation 作为测试替身，不作为生产兜底。
- [ ] completed / failed / blocked / waiting_approval 都可持久化。

### 3. Approval Runtime

- [ ] 定义 `AgentApprovalRequest`。
- [ ] `AgentPolicy` 返回 allow / requireApproval / deny。
- [ ] 高风险工具进入 `waiting_approval`。
- [ ] graph 节点写入 approval request。
- [ ] approval request 进入 execution trace。
- [ ] approve 后恢复执行。
- [ ] reject 后进入 replan 或生成解释。
- [ ] cancel 后停止 run。

### 4. API

- [ ] `GET /agent/runs/:runId`。
- [ ] `POST /agent/runs/:runId/approve`。
- [ ] `POST /agent/runs/:runId/reject`。
- [ ] `POST /agent/runs/:runId/cancel`。
- [ ] 明确 API response schema。
- [ ] 明确鉴权和 thread ownership。
- [ ] 不给 route 写静默 fallback。

### 5. High-Risk Tool Integration

- [ ] 给 Harness capabilities 补齐 risk metadata。
- [ ] `edit_file` 只在 approval 后执行。
- [ ] `terminal_session` 只在 approval 后执行。
- [ ] 企业微信发送类工具只在 approval 后执行。
- [ ] external side-effect tool trace 必须显示目标、输入摘要和风险说明。
- [ ] 工具执行结果进入 observation。
- [ ] 工具失败进入 failed observation，不静默改写成成功。

### 6. UI Approval

- [ ] trace 中展示 approval node。
- [ ] approval node 展示 tool name、风险、输入摘要。
- [ ] 提供 approve / reject 操作。
- [ ] approve 后状态变为 running / completed。
- [ ] reject 后状态变为 rejected / replanned / blocked。
- [ ] cancel run 有明确反馈。

### 7. Resume

- [ ] app 刷新后能读取 waiting_approval run。
- [ ] 后端重启后 waiting_approval run 不丢。
- [ ] completed run 可审计。
- [ ] in-progress run 的恢复策略明确：resume / mark failed / require user action。

## Unit Test Checklist

### Backend

- [ ] SQLite repository create / update / list / get。
- [ ] `AgentRunStore` interface test。
- [ ] `AgentPolicy` low-risk allow。
- [ ] `AgentPolicy` high-risk require approval。
- [ ] `AgentPolicy` deny path。
- [ ] approve API 权限校验。
- [ ] reject API 权限校验。
- [ ] cancel API 权限校验。
- [ ] approval 后 graph 能继续执行。
- [ ] reject 后 graph 不执行高风险工具。
- [ ] edit / terminal / external side-effect 未审批时不会执行。
- [ ] server restart simulation 下 waiting_approval 可读取。

### Frontend

- [ ] approval node 渲染。
- [ ] approve click 调用正确 API。
- [ ] reject click 调用正确 API。
- [ ] cancel click 调用正确 API。
- [ ] 刷新后 pending approval 可见。
- [ ] tool input summary 不撑破 UI。
- [ ] final answer 和 approval trace 共存。

## Developer Verification

- [ ] 运行 `pnpm check`。
- [ ] 运行新增后端 repository / route / agent tests。
- [ ] 运行新增前端 approval UI tests。
- [ ] 本地验证低风险动作自动执行。
- [ ] 本地验证 edit 请求暂停审批。
- [ ] 本地验证 terminal 请求暂停审批。
- [ ] 本地验证企业微信发送请求暂停审批。
- [ ] 本地验证 approve 后执行。
- [ ] 本地验证 reject 后不执行。
- [ ] 本地验证刷新后 approval 状态还在。

## Owner Manual Test List

- [ ] 审批文案是否足够让人理解风险。
- [ ] approve / reject 交互是否符合产品预期。
- [ ] 高风险工具的输入摘要是否足够透明。
- [ ] Agent 被拒绝后给用户的解释是否自然。
- [ ] Agent 按钮在 waiting_approval 状态下是否清楚。

## Completion Criteria

- [ ] `AgentRun` 可持久化。
- [ ] waiting_approval 可恢复。
- [ ] 高风险工具必须审批。
- [ ] approve / reject / cancel 可用。
- [ ] trace 显示完整审批过程。
- [ ] 高风险工具无审批不会执行。
- [ ] `pnpm check` 通过。
