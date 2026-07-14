---
status: current
priority: P1
owner: microapp / runtime / desktop
last_verified: 2026-07-14
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/microapp/computer-use-feature-design.md
  - docs/project-control/tasks/microapp_T118-computer-use-runtime-and-managed-browser.md
  - docs/project-control/tasks/microapp_T119-computer-use-browser-session-and-tools.md
  - docs/project-control/tasks/microapp_T120-computer-use-mcp-model-governance.md
  - docs/project-control/tasks/microapp_T121-computer-use-debugger-rebuild.md
  - docs/project-control/tasks/microapp_T117-computer-use-browser-smoke.md
task_state: READY_FOR_REVIEW
---

# microapp_T122 Computer Use Integration And Acceptance

## Target

对新 Computer Use 链路做系统级集成验收，清理旧的固定规则主路径，并把真实运行时、浏览器工具、模型调用、审批、Debugger 和证据回放串成可验证闭环。

本卡是验收和必要的集成清理卡，不负责新增浏览器能力，不负责重做 UI，不负责扩大产品范围。

## Allowed Changes

- `.test-artifact/computer-use-acceptance/**`
- `server/src/microapps/computer-use/__tests__/acceptance*.test.ts`
- `server/src/mcp/tools/__tests__/browser-acceptance*.test.ts`
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/__tests__/acceptance*.test.ts`
- `docs/project-control/tasks/microapp_T122-computer-use-integration-and-acceptance.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/agent/**`（除非 T120 明确留下的集成适配点）
- `server/src/harness/**`
- `server/src/index.ts`
- `server/src/routes/microapps/computer-use/**`
- `desktop/src/shared/api/computerUse.ts`
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`（除 acceptance 测试文件）
- 其他 MCP 工具
- 其他 MicroAPP
- `electron/**`
- `tauri/**`
- 宿主桌面自动化
- 浏览器插件接管
- 凭据托管
- CAPTCHA 绕过

## Acceptance Criteria

1. 无浏览器环境时，产品能自动安装固定受管 Chromium，或给出明确、可操作的阻塞原因。
2. 手动调试链路真实完成：session -> observe -> act -> assert -> evidence。
3. 模型链路真实完成：model -> browser tool -> observation -> next decision。
4. 审批拒绝、超时、域名越界、ref 失效、session 丢失和浏览器启动失败都有真实终态。
5. 旧的 `Goal -> regex URL -> fixed navigate/capture` 路径不再作为生产主流程；移除动作归 T120 所有。
6. 页面不显示没有实际模型调用支撑的 planning 或成功状态。
7. 所有关键结果都有 invocation、trace 或 artifact 证据。
8. 旧 T110-T117 的历史证据与新 T118-T122 的验收口径明确区分。

## Verification

- `pnpm check`
- server / desktop computer-use 定向测试
- 无浏览器运行时安装验收
- 手动调试端到端验收
- fake provider 模型循环验收
- 明确配置真实 provider 后的真实模型 smoke；没有配置时标记 `SKIPPED`，不能写成通过
- `.test-artifact/computer-use-acceptance/**` 证据审查

## Owned Test Scope

- clean runtime installation
- existing browser reuse
- session and tool flow
- approval and resume
- model unavailable
- model loop with fake provider
- real provider conditional smoke
- UI evidence and final result

## Evidence

- `server/src/microapps/computer-use/__tests__/acceptance.e2e.test.ts`：T122 server acceptance `5/5`，覆盖运行时不可用、session -> observe -> act -> assert -> artifact，以及 stale snapshot 和域名越界终态。
- `server/src/mcp/tools/__tests__/browser-acceptance.evidence.test.ts`：MCP acceptance `2/2`，覆盖 fake provider tool-loop、Harness invocation、审批参数绑定和变更 snapshot 拒绝。
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/__tests__/acceptance.evidence.test.tsx`：desktop acceptance `1/1`，覆盖 invocation、artifact、截图结果展示，以及无模型时 Model Run 保持不可用。
- 定向回归：server Computer Use `28/28`，desktop Computer Use `9/9`。
- `pnpm check` 通过，`git diff --check` 通过；未修改 `server/src/agent/**` 或 AgentGraph。
- 证据目录：`.test-artifact/computer-use-acceptance/server/**`、`.test-artifact/computer-use-acceptance/mcp/**`、`.test-artifact/computer-use-acceptance/desktop/**`。
- 真实 provider 未配置，真实模型 smoke 按验收约定记为 `SKIPPED`；本轮手动链路使用注入的 mock Browser/launcher，未执行真实浏览器二进制端到端 smoke。

## Review Notes

T122 的验收测试和证据已经补齐，当前提交状态为 `READY_FOR_REVIEW`。真实 provider 和真实浏览器二进制 smoke 是外部运行条件，不在未配置时伪造为通过。

## Final Boundary

本卡完成后，只能声明：

> Computer Use Debugger 的受控浏览器工具链和真实模型接入已经按证据验收。

不能由本卡声明：

- 支持任意网站和任意任务
- 支持宿主桌面控制
- 支持凭据托管
- 支持浏览器插件接管
- 支持无人审批的高风险操作
