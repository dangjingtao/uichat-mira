---
status: current
priority: P1
owner: microapp / desktop
last_verified: 2026-07-14
layer: project-control
module: MicroAPP
feature: ComputerUse
doc_type: task-card
canonical: true
related:
  - docs/microapp/computer-use-feature-design.md
  - docs/project-control/tasks/microapp_T119-computer-use-browser-session-and-tools.md
  - docs/project-control/tasks/microapp_T120-computer-use-mcp-model-governance.md
task_state: DONE
---

# microapp_T121 Computer Use Debugger Rebuild

## Target

从零实现 `Computer Use Debugger`，只提供结构化参数调试和真实反馈展示。

当前仓库中的 `Computer Use Studio` 页面不是设计参考，不得复用其布局、文案、状态表达、浏览器画布或 `Goal / Create Plan / Start Task` 交互。只能复用项目级纯 UI 组件和 design token。

## Allowed Changes

- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/**`
- `desktop/src/shared/api/computerUse.ts`
- `desktop/src/shared/api/__tests__/computerUse.test.ts`
- `desktop/src/app/routes/settingsRoutes.tsx`（仅 computer-use route）
- `desktop/src/app/routes/settingsRoutes.test.tsx`（仅 computer-use route）
- `desktop/src/features/Settings/i18n/en-US.ts`（仅 computer-use 文案）
- `desktop/src/features/Settings/i18n/zh-CN.ts`（仅 computer-use 文案）
- `desktop/src/features/Settings/pages/MicroApps/ComputerUse/__tests__/**`
- `docs/project-control/tasks/microapp_T121-computer-use-debugger-rebuild.md`

## Forbidden Changes

- `desktop/src/features/Settings/pages/MicroApps/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/Detail.tsx`
- `server/**`
- `electron/**`
- `tauri/**`
- 当前页面的布局复制、局部修补或文案延续
- 聊天页面、浏览器插件入口、宿主桌面控制入口

## Required UX

页面必须从空白信息架构开始，至少包含：

- Run Config：runtime、session、URL、allowed domains、limits、approval policy
- Browser State：URL、title、snapshot、visible text、screenshot
- Execution Feedback：tool calls、approval、evidence、result、raw JSON
- 操作：New Session、Inspect、Execute Action、Assert、Stop、Reset
- `Manual Debug` 和 `Model Run` 明确分开

没有真实模型连接时：

- 显示 `Model: Not connected`
- 禁用 Model Run
- 不显示 planning、AI thinking 或自然语言任务成功状态

## Acceptance Criteria

1. 页面没有自然语言 Goal 输入框。
2. 页面不出现 `Create Plan`、`Start Task` 作为主流程按钮。
3. 用户可以创建 session、observe、执行 action、assert 并查看真实结果。
4. 页面显示真实 invocation id、tool args、状态、错误和 artifact。
5. 页面明确区分手动调试和模型运行。
6. 页面能表达 runtime 缺失、session 失败、等待审批、工具失败、断言失败和模型未连接。
7. 页面不直接访问 Node、Electron、Tauri 或 Playwright 对象。

## Verification

- desktop 定向页面测试
- shared API 请求映射测试
- Manual Debug 状态流测试
- Model Run 未连接时的禁用和提示测试
- approval、failure、assertion mismatch 和 artifact 展示测试

## Owned Test Scope

- 空 session
- ready session
- runtime missing
- inspect result
- action result
- assertion result
- waiting approval
- model unavailable
- failed invocation

## Dependencies

- T119 提供 browser session API。
- T120 提供 MCP/model/invocation API。
- 本卡不反向修改 server 来迁就旧页面结构。

## Evidence

- 重建 `desktop/src/features/Settings/pages/MicroApps/ComputerUse/index.tsx`，页面只提供 Run Config、Browser State、Execution Feedback、Manual Debug 和独立的 Model Run 区域。
- `desktop/src/shared/api/computerUse.ts` 提供结构化 session、observe、action、assert、stop 请求映射；不再暴露旧 Goal/Plan/Task 主路径。
- T120 依赖通过 `model.status = "unavailable"` 和明确提示接入；Model Run 按该状态禁用，未执行真实模型联调。
- 保留既有 `/settings/micro-apps/computer-use-studio` route 作为入口兼容层，但其页面实现已替换为 Debugger；未修改旧微应用入口、server、Electron 或 Tauri。
- 定向测试：3 个文件、23 条测试通过；覆盖空 session、结构化动作映射、visible text、screenshot、approval、artifact、result 和失败 invocation；desktop `tsc --noEmit` 通过。
- `pnpm check` 和 `git diff --check` 作为最终交付验证。
