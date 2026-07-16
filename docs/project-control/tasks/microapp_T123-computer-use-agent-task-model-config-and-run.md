---
status: current
priority: P0
owner: microapp / runtime / desktop
last_verified: 2026-07-15
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T122-fix-computer-use-runtime-and-agent-entry.md
task_state: DONE
---

# microapp_T123 Computer Use AgentTaskModel Configuration And Run Entry

## Target

让 Computer Use Debugger 明确显示当前 `AgentTaskModel`，并让“运行模型”按钮真实调用已有 Computer Use task API。

## Allowed Changes

- `desktop/src/shared/api/computerUse.ts`
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `desktop/src/features/Settings/i18n/en-US.ts`
- `server/src/index.ts`（仅 Computer Use debugger model status wiring）
- `server/src/routes/microapps/computer-use/**`（仅 task run/status contract if required）
- 本任务卡和 `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/agent/graph/**`
- `server/src/agent/graph.ts`
- AgentGraph 节点、边、state、planner、policy、ToolNode 和审批语义
- 通用模型配置页面的既有合同
- 其他 MicroAPP 和其他 MCP 工具

## Acceptance Criteria

1. Debugger 页面明确显示 `AgentTaskModel` 的 provider/model 或未配置状态。
2. 当前模型可用时“运行模型”按钮可点击，并调用 Computer Use task API。
3. 当前模型不可用时按钮保持禁用，并展示实际配置原因。
4. 运行结果在 Debugger 页面可见，不能伪造 invocation 或成功状态。
5. `pnpm check` 和 Computer Use 前端/后端定向测试通过。

## Evidence

- Debugger 页面显示：`AgentTaskModel: openai / kimi-k2-250711`。
- Chrome 前台点击“运行模型”后真实 task `cu_mrkxzgdr_5t4kgvxs` 状态为 `succeeded`。
- 模型结果：`The page title is **Example Domain**.`
- 真实 Computer Use 证据包含 `browser_observe` invocation `e28e35ec-0120-4764-bee5-0ee5ec5304f2`。
- 修正 OpenAI-compatible endpoint，复用项目既有 URL 规范，避免错误拼接 `/v1/v1/chat/completions`。
- `pnpm check`、Computer Use 前后端定向测试通过。
