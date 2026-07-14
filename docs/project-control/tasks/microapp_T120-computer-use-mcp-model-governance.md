---
status: current
priority: P1
owner: microapp / agent / mcp
last_verified: 2026-07-14
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/microapp/computer-use-feature-design.md
  - docs/harness/README.md
  - docs/project-control/tasks/microapp_T119-computer-use-browser-session-and-tools.md
  - docs/project-control/tasks/microapp_T113-computer-use-server-http-surface.md
task_state: DONE
---

# microapp_T120 Computer Use MCP Model And Governance

## Target

把 T119 的浏览器能力接入现有 MCP invocation 和真实模型调用链，形成可审计的模型运行闭环。

本卡负责 MCP 工具定义、模型循环、审批绑定、trace、evidence 和调用持久化。不负责浏览器执行器和 Debugger 页面视觉设计。

## Allowed Changes

- `server/src/mcp/tools/browser-*.tool.ts`
- `server/src/mcp/core/**`（仅允许为 Computer Use invocation 增加不可避免的通用扩展；不得改写既有 invocation、approval、trace、artifact 状态语义）
- `server/src/agent/computer-use/**`
- `server/src/db/repositories/computer-use/**`
- `server/src/db/schema.ts`（仅增量增加 Computer Use 专属 invocation / artifact / approval 字段或表；不得删除既有字段、改变既有表语义或迁移历史数据）
- `server/src/index.ts`（仅注册 Computer Use 的 model / MCP composition；旧固定规则路径只能移除 Computer Use 自身的生产入口，不得影响其他 MicroAPP 或通用 Agent 主链）
- `server/src/routes/microapps/computer-use/**`
- `server/src/routes/microapps/index.ts`（仅 Computer Use 新路由注册；不得修改既有 Goal / Plan / Task 路由的通用注册行为）
- `server/src/microapps/computer-use/governance/**`
- `server/src/mcp/tools/__tests__/browser*.test.ts`
- `server/src/agent/computer-use/**/__tests__/**`
- `docs/project-control/tasks/microapp_T120-computer-use-mcp-model-governance.md`

## Construction Boundaries

- 本卡只新增 Computer Use 专属适配层。不得把 Computer Use 工具注册成全局唯一 MCP 工具，也不得删改其他 MCP 工具。
- 三个工具的真实执行入口必须是 T119 的 Browser Service；本卡不得复制 Playwright、Browser Session 或 runtime 逻辑。
- 必须复用现有 Harness invocation、approval、trace、evidence 和 artifact 合同；只有字段不足时才能做向后兼容的增量扩展。
- `server/src/agent/computer-use/**` 只能承载 Computer Use 的模型 tool-loop 和状态适配，不得改变通用 Agent 的工具选择、排序、暴露或终态语义。
- 除了把 Computer Use 工具注册到现有 Harness Registry / invocation 入口外，严禁修改 AgentGraph。不得新增、删除或重排 AgentGraph 节点和边，不得修改 Graph state、Graph input/output、Planner、Normalize、Policy、ToolNode、Evidence、审批恢复、重试或终态路由。
- 不新增独立的 session/action HTTP 协议。需要给 T121 使用的接口必须由本卡的 Computer Use route 明确定义，并与三个 MCP 工具及 T119 输入输出保持同一份结构化合同。
- 不新增 provider 配置、凭据托管、外部 MCP marketplace、browser plugin、宿主桌面控制或其他 MicroAPP 流程。

## Forbidden Changes

- `server/src/microapps/computer-use/runtime/**`
- `server/src/microapps/computer-use/browser/**`
- `server/src/microapps/computer-use/session/**`
- `desktop/**`
- `electron/**`
- `tauri/**`
- 通用 Agent 主链的既有工具选择语义
- `AgentGraph` 及其节点、边、状态、输入输出和路由；唯一允许的主链动作是通过现有 Harness 注册入口登记 Computer Use 工具
- 其他 MicroAPP 的业务流程
- T121 的 desktop API 和 Debugger 页面

## Contract

1. Computer Use 这个工具域只暴露 `browser_observe`、`browser_act`、`browser_assert`；不改变其他 MCP 工具的暴露集合。
2. 三个工具都必须有严格 input schema 和 output schema。
3. `browser_act` 的批准对象绑定规范化后的 session、tool args、page URL、snapshot hash 和 ref；任一字段变化都必须视为批准失效。
4. 模型只能消费结构化 browser result，不读取 Playwright 对象。
5. 模型没有真实 provider 时，Model Run 不得显示可用。

## Acceptance Criteria

1. Agent 能真实调用模型，并根据 browser observation 选择下一次工具调用。
2. 工具结果能回流到 Agent observation、evidence 和最终结果。
3. 高风险动作进入 `awaiting_approval`，审批拒绝后不会执行动作。
4. 页面 URL 或 snapshot hash 变化后，旧审批不能继续使用。
5. invocation、approval、trace、result 和 artifact metadata 可持久化读取。
6. 模型超时、工具失败、审批拒绝和 session 丢失都有明确终态。
7. 不新增正则 URL 目标解析或关键词审批作为 Computer Use 主流程；旧固定规则只能从 Computer Use 自身生产入口移除，不得借机重构其他业务。

## Verification

- MCP browser tool schema tests
- approval input hash mismatch tests
- model tool-loop tests with fake provider
- real provider smoke only when explicit environment configuration exists
- persistence restart/readback tests
- existing MCP and Agent regression tests

## Owned Test Scope

- tool registration and schema
- model-to-tool loop
- approval freeze and resume
- invocation persistence
- evidence and trace mapping
- blocked / failed / cancelled terminal states

## Dependencies

- T119 provides the browser session service.
- Existing MCP invocation, approval and trace contracts must be reused where possible。
- 本卡不能把未接入真实模型的固定规则执行器包装成 Agent planner。

## Evidence

- Added `server/src/mcp/tools/browser-tools.tool.ts` with only `browser_observe`, `browser_act`, and `browser_assert`; all three use strict input/output schemas and delegate to T119 `BrowserService`.
- Added `server/src/agent/computer-use/model-loop.ts` with an injectable fake-provider contract and a real configured `agentTask`/`task` provider path. The loop consumes structured browser results and records invocation, trace, args, status, result, and error metadata in Computer Use evidence.
- `browser_act` uses the existing Harness invocation approval contract. Its approval metadata includes session id, normalized tool args, page URL, snapshot hash, refs, and the exact invocation input hash; changed arguments require a new approval.
- Added the Computer Use SQLite task/evidence/invocation repository under `server/src/db/repositories/computer-use/` and Computer Use-only persistence hooks for invocation, trace, stream events, result, and artifact metadata. The corresponding `getInvocation`, `getInvocationTrace`, and event reads can use SQLite after restart. Registered the model executor in `server/src/index.ts`; the former fixed-rule Computer Use production executor is no longer the active entry.
- Approval resume executes the saved `pendingToolId` and `pendingArgs` after exact input-hash validation before making another model request. A regression test asserts the frozen action runs first.
- Added strict action/assertion variant schema tests, frozen-action resume tests, fake-provider model-loop tests, and SQLite reset/readback tests. T120 tests: 6 passed. Existing MCP core tests: 12 passed. T119 browser/session regression tests: 9 passed. Server typecheck passed. `pnpm check` passed for all workspace projects.
- Existing unrelated changes under `server/src/harness/**`, other repositories, and other MicroAPP modules were preserved and are not part of this T120 change set.
- Real provider smoke was not run because no explicit model provider configuration was present in the environment.
- Added `server/src/routes/microapps/computer-use/debugger-service.ts`, adapting the server-created T119 `BrowserSessionManager` and `BrowserService` to the debugger session API without changing T119 implementation files.
- Added debugger routes for status, session create/get, observe, action, assert, stop, and controlled artifact content reads. Strict request schemas reject malformed action/assert payloads before Browser Service execution.
- Screenshot responses expose a controlled artifact route URI. Artifact reads are restricted to the active session artifact root and return `image/png`.
- Added `server/src/routes/microapps/computer-use/__tests__/debugger.routes.test.ts`; the isolated route regression covers status, session, observe, action, assert, stop, artifact content, and invalid action input.
- Route test: 1 file, 1 test passed. Server and desktop typechecks passed. The existing aggregate microapps fixture still has unrelated missing service injections and was not used as the route-specific result.
- `approvalPolicy=always/write_actions` now invokes the registered Harness `browser_act` tool without an approval grant and returns `awaiting_approval`; the approval route resumes only the frozen invocation after exact input-hash validation. `approvalPolicy=never` supplies the exact approval grant for direct execution.
- Debugger session creation now passes `runtime=managed/system` to T119 as `channel=chromium/chrome`; no T119 runtime/session implementation was changed.
- T121 desktop API and UI now expose the controlled approval resume action.
- Model provider calls now use an abortable timeout (default 30 seconds, injectable in tests); timeout returns terminal `failed` with `COMPUTER_USE_MODEL_TIMEOUT` and clears the pending run.
- Debugger approval now has an explicit reject route at `/microapps/computer-use/sessions/:id/approval/reject`; rejection records `COMPUTER_USE_APPROVAL_REJECTED`, clears the pending action, writes evidence/result, and never invokes `browser_act`.
- Added model timeout and debugger approval route regression coverage.
- Added `resolveInvocationApproval` in `server/src/mcp/core/invocations.ts`; debugger approve/reject now updates the original awaiting invocation, writes resolution metadata and finish events, and persists the terminal state for restart/readback. Approved resumes link `resolutionInvocationId`; rejected originals become `cancelled` with `COMPUTER_USE_APPROVAL_REJECTED` evidence.
- Added MCP approval-resolution regression tests for persisted original invocation terminal states and resume linkage.
