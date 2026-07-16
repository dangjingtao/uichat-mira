---
status: current
priority: P0
owner: microapp / mcp / runtime / harness
last_verified: 2026-07-15
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T122-computer-use-integration-and-acceptance.md
  - docs/project-control/tasks/microapp_T122-fix-computer-use-runtime-and-agent-entry.md
  - docs/project-control/tasks/microapp_T119-computer-use-browser-session-and-tools.md
  - docs/project-control/tasks/microapp_T120-computer-use-mcp-model-governance.md
task_state: READY_FOR_REVIEW
---

# microapp_T122-hotFix Computer Use Tool Session Lifecycle

## Problem

T122 前台烟测发现，通用 Agent 入口暴露了 `browser_observe`、`browser_act`、`browser_assert` 三个工具，但三个 MCP schema 都把内部 `sessionId` 设为模型必填参数。该入口没有把请求绑定到已有浏览器 Session，也没有在工具调用前创建 Session，导致模型向用户索要 `sessionId`，无法直接执行“打开 URL 并读取页面”的任务。

这不是用户缺少配置，也不是 AgentGraph 应该承担的业务职责。`sessionId` 是浏览器工具运行时上下文，应由工具执行层管理。当前 Computer Use 专用 model loop 已经能创建 Session，但通用 Agent 的 MCP 调用路径没有复用这段生命周期，形成两条不一致的执行路径。

## Target

修复 Computer Use 工具侧的 Session 生命周期，使 Agent 只提交目标和浏览器动作，工具运行时负责复用或创建 Session，并把内部 `sessionId` 注入实际的 `browser_*` 调用。用户和模型都不得被要求手动填写内部 `sessionId`。

## Allowed Changes

- `server/src/mcp/tools/browser-tools.tool.ts`
- `server/src/mcp/core/**`（仅 Computer Use invocation context、参数注入和 schema 合同）
- `server/src/agent/types.ts`、`server/src/agent/nodes/tool-node.ts`、`server/src/agent/evidence.ts`（仅接入通用 MCP evidence 合同；不得出现任何 Computer Use/toolId 特判）
- `server/src/mcp/**/__tests__/**`（仅 Computer Use 工具 Session 生命周期回归测试）
- `server/src/microapps/computer-use/browser/**`（仅提供工具侧创建、复用所需的已有 Browser Service 能力）
- `server/src/microapps/computer-use/session/**`（仅复用已有 Session Manager 的创建、查找和停止能力）
- `server/src/harness/**`（仅 Computer Use 工具上下文绑定和 invocation 适配）
- `server/src/agent/computer-use/**`（仅统一专用 model loop 与通用工具执行层的 Session 合同和模型描述）
- `server/src/index.ts`（仅 Computer Use 工具组合与上下文依赖注入）
- 上述目录中的 Computer Use 定向测试
- `.test-artifact/computer-use-acceptance/**`
- 本任务卡和 `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/agent/graph/**`
- `server/src/agent/graph.ts`
- AgentGraph 节点、边、state、planner、policy、审批恢复和终态语义
- `ToolNode` 只允许透传通用 MCP evidence 字段；不得增加工具判断、改变路由或改变审批/终态语义
- 不得在通用 Agent evidence 代码中按 `browser_*`、`web_search` 或任何具体工具 ID 写分支
- 不得把 `sessionId` 继续作为模型必须生成的工具参数
- 不新增要求用户手输 `sessionId` 的前台字段、聊天提示或调试入口
- 不新增第四个面向模型的浏览器工具来绕过 Session 生命周期问题
- 不修改 Computer Use 三工具之外的 MCP 工具和其他 MicroAPP
- 不扩展到宿主桌面控制、浏览器插件接管、凭据托管或 CAPTCHA 绕过
- 不修改 Playwright 动作集合、snapshot/ref 审批合同和 artifact 读取边界
- 不修改已有 Debugger HTTP route 的显式 `session/:id` 合同；手动调试仍可使用前台创建的 Session

## Construction Boundaries

- 工具执行层首次处理 Computer Use 请求时，优先复用当前任务/线程已绑定且仍有效的浏览器 Session。
- 没有可复用 Session 时，由工具侧使用已有 Browser Session Manager 创建受控 Session；创建所需的 URL、域名范围和运行时配置必须来自已存在的任务上下文或显式工具执行上下文，不能从模型输出中猜测。
- `sessionId` 只存在于工具执行上下文、Browser Service 调用、trace/evidence 和持久化记录中；模型可见 schema 和用户界面不要求该字段。
- `browser_observe` 建立或确认 Session 后，`browser_act` 与 `browser_assert` 在同一任务上下文中复用该 Session。
- 工具无法创建或恢复 Session 时，返回明确的 Computer Use 终态和错误码；不得向用户转嫁内部 ID，也不得静默切换到 terminal 或其他工具。
- 现有审批、snapshot hash、element ref、域名限制、trace、artifact 和 evidence 合同保持不变。
- Computer Use 专用 model loop 与通用 Agent 工具路径必须共享同一 Session 生命周期规则，不能保留一条需要模型生成 `sessionId` 的旁路。

## Acceptance Criteria

1. 通用 Agent 只提供目标 URL/任务和自然语言动作意图时，工具侧能创建或复用 Browser Session，不再向用户索要 `sessionId`。
2. 首次 `browser_observe`、后续 `browser_act`、`browser_assert` 使用同一个内部 Session，调用记录中的 Session 绑定一致。
3. 已绑定有效用户浏览器环境时优先复用；没有可复用环境时，按现有受管 Chromium 策略创建受控 Session。
4. Session 创建失败、Session 已停止或上下文过期时，返回可诊断的失败结果，不调用 terminal，不伪造成功。
5. `browser_act` 继续遵守现有审批、snapshot/ref 绑定、域名边界和拒绝终态。
6. Debugger 手动流程的显式 Session route 合同保持不变。
7. AgentGraph 源码、节点和状态语义无变更；Harness 其他 capability 的暴露集合无变化。
8. 新增回归测试覆盖：无 `sessionId` 的首次工具调用、Session 复用、创建失败、已停止 Session 和审批恢复。

## Verification

- MCP Computer Use tool schema / invocation 定向测试
- Browser Session Manager / Browser Service 定向测试
- Harness Computer Use invocation 适配测试
- Agent-to-browser fake provider tool-loop 测试
- 配置真实 AgentTaskModel 后，Chrome 前台复测：只提供 URL 和任务，产生真实 `browser_observe` invocation，不出现 `sessionId` 询问
- `pnpm check`
- `git diff --check`

## Evidence

- `server/src/mcp/tools/browser-tools.tool.ts`
  - Agent-facing `browser_observe`、`browser_act`、`browser_assert` schema 不再要求 `sessionId`。
  - 首次 `browser_observe` 由工具侧使用 URL 创建受管 Session；后续调用按 `threadId` 复用。
  - 显式传入的已有 `sessionId` 会绑定到当前工具上下文，兼容 Debugger 和专用 model loop。
- `server/src/agent/computer-use/model-loop.ts`
  - 模型可见参数不再要求 `sessionId`；执行器仍在内部注入已创建的 Session ID。
- `server/src/mcp/core/definitions.ts`、`server/src/agent/types.ts`、`server/src/agent/nodes/tool-node.ts`、`server/src/agent/evidence.ts`
  - 增加通用 MCP evidence 透传合同；Agent 只消费标准 evidence 字段，不识别具体工具。
- `server/src/mcp/tools/browser-tools.tool.ts`、`server/src/agent/computer-use/model-loop.ts`
  - 工具描述已明确 Session 由工具内部管理、observe 返回的页面字段、act 的 7 个动作变体（navigate/click/type/select/press/scroll/wait）和 assert 的 5 个断言变体（title/url/text/visible/value）。
- `server/src/mcp/tools/browser-tools.test.ts`
  - 覆盖 Agent-facing schema、首次创建、线程内复用和 invocation 参数绑定。
- 定向测试：4 个文件、12 个测试通过。
- `pnpm check`：workspace typecheck 全部通过。
- `git diff --check`：通过。

### Remaining Conditional Verification

- 需要配置当前 `AgentTaskModel` 后进行一次 Chrome 前台复测：只提供 URL 和任务，确认不再出现“请提供 sessionId”，并产生真实 `browser_observe` invocation。
- 2026-07-15 Chrome 前台回归结果：`FAIL`。截图显示 `browser_observe` 已执行完成并进入后续 Agent 流程，但最终回答仍表示没有取得页面标题，并重复推进 `browser_observe`。
- 失败根因已定位到通用 evidence 透传缺失：Computer Use 返回的页面字段没有进入 Agent evidence summary，最终只保留 `toolId` 和 `status`，丢失 `page.title`、URL、visibleText 和 snapshot。
- 修复采用通用 MCP evidence 合同：工具适配器生成标准 evidence，Agent 只透传和消费标准字段，不按工具 ID 写特例。
- 当前未把该项标记为已通过，也未修改 AgentGraph。
