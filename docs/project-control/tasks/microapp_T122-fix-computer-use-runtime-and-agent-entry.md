---
status: current
priority: P0
owner: microapp / runtime / agent / mcp
last_verified: 2026-07-15
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T122-computer-use-integration-and-acceptance.md
  - docs/project-control/tasks/microapp_T120-computer-use-mcp-model-governance.md
  - docs/project-control/tasks/microapp_T119-computer-use-browser-session-and-tools.md
task_state: READY_FOR_REVIEW
---

# microapp_T122-fix Computer Use Runtime And Agent Entry

## Target

修复 T122 前台黑盒确认的两个真实问题：

1. Debugger 的 observe / stop 前台请求返回 HTTP 500，导致 session -> observe -> stop 不能完成。
2. 已绑定 workspace 的 Agent 发起 Computer Use 请求时选择 `terminal_session`，没有进入 `browser_observe / browser_act / browser_assert` 工具链。

本卡只修复上述问题，不重做 Debugger UI，不扩展 Computer Use 能力范围。

## Allowed Changes

- `server/src/routes/microapps/computer-use/**`
- `server/src/microapps/computer-use/browser/**`（仅修复已验证的 observe 结果映射或运行时错误）
- `server/src/microapps/computer-use/session/**`（仅修复 stop 生命周期和 session 状态一致性）
- `server/src/agent/computer-use/**`
- `server/src/harness/**`（仅 Computer Use capability 注册、暴露和候选工具适配）
- `server/src/index.ts`（仅 Computer Use composition / Harness 注册）
- `server/src/agent/**/__tests__/**`（仅 Computer Use 接入回归测试；不得修改 AgentGraph 实现）
- `server/src/harness/**/__tests__/**`（仅 Computer Use 暴露回归测试）
- `server/src/routes/microapps/computer-use/**/__tests__/**`
- `.test-artifact/computer-use-acceptance/**`
- `docs/project-control/tasks/microapp_T122-fix-computer-use-runtime-and-agent-entry.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/agent/graph/**`
- `server/src/agent/graph.ts`
- AgentGraph 节点、边、state、planner、policy、ToolNode、审批恢复和终态路由
- `server/src/harness/**` 中与 Computer Use 无关的 capability 语义
- `desktop/**`、`electron/**`、`tauri/**`
- `server/src/microapps/computer-use/runtime/**`
- 其他 MCP 工具和其他 MicroAPP
- 凭据托管、浏览器插件接管、宿主桌面控制、CAPTCHA 绕过

## Construction Boundaries

- Agent 接入只能通过现有 Harness Registry / exposure / invocation 合同完成。
- 不修改 AgentGraph；不得新增、删除、重排节点和边，也不得改变通用 Agent 的状态语义。
- Computer Use 只暴露 `browser_observe`、`browser_act`、`browser_assert`；不能因为修复 Agent 入口而开放 `terminal_session` 给 Computer Use 专属模型循环。
- Debugger route 必须把 Browser Service 的真实结果、invocation、trace、artifact 和 error 统一返回给前端；不能吞掉异常或把失败包装成 succeeded。
- stop 必须幂等，session、browser manager、Debugger record 三者状态必须一致。

## Acceptance Criteria

1. 前台创建 session 后，`observe` 返回真实 URL、title、snapshot、hash、visible text、screenshot 和 invocation/evidence。
2. 前台点击 Stop 返回 200，session 显示 stopped，后续 Inspect / Action / Assert 不再执行浏览器操作。
3. Agent workspace 绑定成功后，针对只读网页请求能产生真实 `browser_observe` invocation；不能以 `terminal_session` 代替。
4. Computer Use 的 `browser_act` 仍遵守现有审批、snapshot/ref 绑定和拒绝终态。
5. AgentGraph 既有回归测试无行为变化，Harness 其他 capability 暴露集合无变化。
6. 新增失败回归测试覆盖 observe、stop 和 Agent-to-browser tool selection。
7. 真实 provider 未配置时，真实 provider smoke 仍标记为 `SKIPPED`，不能伪造通过。

## Verification

- Computer Use route / browser / session 定向测试
- Harness Computer Use exposure 定向测试
- Agent-to-browser fake provider 或真实 provider 条件测试
- `pnpm check`
- `git diff --check`
- Chrome 前台黑盒复测 `CU-FE-004`、`CU-FE-009`、`CU-FE-016`、`CU-FE-019`

## Evidence

### Implemented

- `server/src/routes/microapps/computer-use/debugger-service.ts`
  - 按 `executeInvocation` 的真实直接结果结构读取 `record.result`，不再错误读取不存在的 `record.result.result`。
  - 只有 invocation 完成且 Browser result `ok: true` 才显示 `succeeded`。
  - Stop 幂等，清理 pending approval 并返回 stopped/cancelled result。
- `server/src/harness/candidates-core/resolver.ts`
  - Agent 明确提出网页/浏览器/URL 请求且 Computer Use 工具可用时，只向该轮暴露 `browser_observe`、`browser_act`、`browser_assert`，不把 `terminal_session` 交给模型选择。
- `server/src/harness/profiles/resolver.ts`、`server/src/harness/exposure-core/filters.ts`
  - 注册并允许 Computer Use 浏览器能力进入 Agent Harness。
- `server/src/routes/microapps/computer-use/__tests__/debugger-service-status.test.ts`
  - 覆盖直接 MCP result 解包和失败状态映射。
- `server/src/routes/microapps/computer-use/schemas.ts`
  - HTTP route 不再使用会删除 `browser_act.action.ref` 的嵌套 `oneOf` schema；保留原始 action 对象，由 MCP 严格 schema 做最终校验。
- `server/src/routes/microapps/computer-use/__tests__/debugger.routes.test.ts`
  - 回归验证 `ref: "e1"` 从 HTTP route 原样传入 `browser_act`。
- `server/src/harness/__tests__/computer-use-exposure.test.ts`
  - 覆盖浏览器意图下的三工具暴露和 terminal 排除。

### Verification

- 定向测试：5 个文件、14 个测试通过；追加 Harness 隔离测试后，2 个文件、5 个测试通过。
- `pnpm check`：workspace 6 个项目 typecheck 全部通过。
- `git diff --check`：通过。
- `browser_act` 参数丢失回归：定向测试 2 个文件、3 个测试通过，确认 `ref` 不再被 route schema 删除。
- Chrome 前台复测：
  - 新建 Session 后 `browser_observe` 显示 `succeeded`，真实回填 `https://example.com/`、`Example Domain`、snapshot hash、visible text 和截图 artifact。
  - Stop 返回 `Browser session stopped.`，未返回 HTTP 500。
  - 本次 invocation：`8c896634-1047-4b8f-8bcb-b9d140ed0192`；trace：`e1f3b0cc-73bc-44f5-8f08-033b627e8dba`；artifact：`eb3d836f-9576-46bf-ac3e-12ba15b214da`。
- AgentGraph 未修改：`server/src/agent/graph/**`、`server/src/agent/graph.ts` 本次无变更。

### Remaining Conditional Verification

- 当前 Chrome 环境模型状态为 `unavailable`，因此无法通过真实 provider 完成 CU-FE-019 的模型 tool-loop 前台复测；该项保持条件验证，不伪造为 PASS。
- Harness 单元回归已证明浏览器意图不会把 `terminal_session` 暴露给模型；配置真实 provider 后需按 T122 手测指引补一次前台 `browser_observe` invocation 证据。
