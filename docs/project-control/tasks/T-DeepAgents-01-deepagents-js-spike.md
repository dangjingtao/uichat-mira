---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-08
layer: project-control
module: AgentRuntime
feature: DeepAgentsJsSpike
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/harness-runtime-design.md
  - docs/development/agent-observability.md
  - packages/deepagents-spike/package.json
  - packages/deepagents-spike/src/run-spike.ts
  - packages/deepagents-spike/deepagents-spike-report.md
task_state: READY_FOR_REVIEW
---

# T-DeepAgents-01 Deep Agents JS Spike

## Target

验证 `deepagents` 在 `Windows + Node 22 + 本项目 Provider Gateway` 约束下的最小可集成性。

本任务是独立 spike，不是把 `deepagents` 接进现有 Harness 主执行链，也不是替换现有 AgentGraph。

本任务只回答下面 7 件事：

1. `createDeepAgent` 最小 demo 能不能跑通
2. 能不能接一个假的 LangChain tool
3. 能不能接一个本地 MCP server tool
4. filesystem tools 能不能禁用或限制
5. streaming event 能不能映射成现有 trace 可消费的结构
6. todo / subagent / offload 状态能不能被外部观测
7. 基于真实代码和实测结果，是否建议继续第二阶段

## Allowed Changes

- `docs/project-control/tasks/T-DeepAgents-01-deepagents-js-spike.md`
- `docs/project-control/project-control-ledger.md`
- `packages/deepagents-spike/**`
- `.test-artifact/deepagents-spike/**`

允许在以上范围内新增：

- 独立 spike package
- 验证脚本
- 本地 MCP mock server
- 产物目录说明
- spike report
- 验证期临时产物目录

## Forbidden Changes

- `server/src/agent/**`
- `server/src/harness/**`
- `server/src/routes/proxy-provider/**`
- `desktop/src/**`
- `electron/**`
- `tauri/**`
- 现有 Harness registry、审批链、trace UI、状态映射主链
- `pnpm-lock.yaml` 手工编辑

## Acceptance Criteria

1. 新建独立 spike，不污染现有 Harness 主线。
2. 使用 `createDeepAgent` 跑通最小 demo。
3. 接入一个假的 LangChain tool。
4. 接入一个本地 MCP server tool。
5. 验证 filesystem tools 是否能禁用或限制。
6. 验证 streaming event 是否能映射到现有 trace。
7. 验证 todo / subagent / offload 状态能否被外部观测。
8. 输出 `packages/deepagents-spike/deepagents-spike-report.md`，至少包含：
   - 能复用什么
   - 不能复用什么
   - 和现有 Harness 冲突点
   - 安全风险
   - 是否建议继续第二阶段

## Verification

1. 确认本机 Node 版本为 `22.x`。
2. 安装并运行独立 spike package。
3. 运行最小 demo、LangChain tool、MCP tool、filesystem 限制、event 观测脚本。
4. 记录关键输出到 spike report。
5. 运行 `pnpm check`。

## Risks

- `deepagents` 依赖的 `langchain`、`@langchain/core`、`zod` 版本高于仓库当前主线，直接并入 `server` 会放大依赖冲突面。
- `deepagents` 自带 filesystem / subagent / todo middleware，默认能力面比当前 Harness 更宽，若未来接主线，安全与审批边界必须重做映射，不能直接裸接。
- 若 `deepagents` 的 streaming event 语义与现有 trace node contract 不同，第二阶段需要单独做事件适配层，而不是强塞进当前 AgentGraph span 结构。

## Implementation Summary

- 新建独立 workspace package：`packages/deepagents-spike`
- 新增正式 runner：`packages/deepagents-spike/src/run-spike.ts`
- 新增本地 MCP mock server：`packages/deepagents-spike/src/local-mcp-server.ts`
- 新增本地 openai-compatible 假网关：`packages/deepagents-spike/src/fake-openai-compatible-server.ts`
- 生成 spike 报告：`packages/deepagents-spike/deepagents-spike-report.md`
- 生成验证期临时产物：`.test-artifact/deepagents-spike/last-run.json`

## Verification Evidence

1. `pnpm --filter @ui-chat-mira/deepagents-spike typecheck`
   - 结果：通过
2. `pnpm --filter @ui-chat-mira/deepagents-spike spike`
   - 结果：通过
   - 关键证据：
     - `createDeepAgent` 最小 demo 跑通
     - fake LangChain tool 跑通，tool 输出 `lookup:deepagents`
     - 本地 MCP tool 跑通，tool 输出 `mcp:deepagents-mcp`
     - openai-compatible 假网关收到 `2` 次请求，tool flow 完整闭环
     - filesystem permission 允许 `/allowed/**`，拒绝 `/blocked/**`
     - `streamEvents(v2)` 已采到 graph / middleware / model / tool 事件
     - `todos` 状态可从结果状态直接观测，`task`/general-purpose subagent 可从事件流观测
3. `packages/deepagents-spike/deepagents-spike-report.md`
   - 结果：已生成

## Remaining Gaps

- 本机缺少 `DATABASE_URL`，所以这次没有验证项目当前 DB 驱动的 Provider Gateway provider 解析链。
- history summarization/offload 状态类型已确认存在，但本次 spike 没拿到稳定可复现的外部观测证据。
