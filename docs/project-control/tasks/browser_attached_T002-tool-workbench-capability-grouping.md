---
status: current
priority: P0
owner: harness / desktop
last_verified: 2026-07-22
layer: project-control
module: ToolWorkbench
feature: CapabilityOwnershipGrouping
doc_type: task-card
canonical: true
task_state: READY_FOR_REVIEW
related:
  - docs/project-control/tasks/browser_attached_T001-harness-capability-integration.md
  - server/src/harness/profiles/resolver.ts
  - server/src/mcp/workbench-metadata.ts
  - desktop/src/features/Settings/pages/Tools/hooks/useToolsWorkbench.ts
---

# browser_attached_T002 Tool Workbench Capability Ownership Grouping

## Source And Verified Cause

项目 owner 指出 Tool Workbench 把两套同属 `browser_action` domain 的浏览器能力错误合并为一个 `Browser Action` 工具组。

2026-07-22 本地代码核验：

- `server/src/mcp/workbench-metadata.ts` 的 `withWorkbenchMetadata()` 只按 `definition.domain` 生成 Workbench metadata。
- `desktop/src/features/Settings/pages/Tools/hooks/useToolsWorkbench.ts` 直接按 `tool.domain` 建组、筛选和切换。
- `browser_computer_use` 与 `browser_attached` 已在 `server/src/harness/profiles/resolver.ts` 中作为两个独立 Capability Profile 存在，并拥有互不重叠的工具面。
- 实际 Tool Workbench 因 `domain: browser_action` 相同显示为一个 7 工具组；这是产品展示归属缺陷，不是工具执行或 Browser Runtime 缺陷。

## Target

让 Tool Workbench 按 Capability ownership / 显式 Workbench group metadata 进行产品分组，而不是直接把 runtime domain 当作产品分组。

目标展示：

```text
Computer Use
├─ browser_observe
├─ browser_act
└─ browser_assert

触界
├─ browser_attached_look
├─ browser_attached_browse
├─ browser_attached_act
└─ browser_attached_transfer
```

两组工具继续保留：

```text
domain: "browser_action"
```

## Problem Layer

- business / UI data projection
- `domain` 是 risk / approval / exposure / runtime policy 的治理分类
- Capability Profile / owner 是 Tool Workbench 的产品能力归属
- 不改变运行时边界、状态所有权、审批、工具合同或 Browser Provider

## Allowed Changes

- `server/src/harness/profiles/types.ts`，仅限可选 Workbench presentation metadata
- `server/src/harness/profiles/resolver.ts`，仅限两个 Browser Capability Profile 的显式 Workbench presentation / ownership metadata
- `server/src/harness/capability-profiles.test.ts`
- `server/src/mcp/core/definitions.ts`，仅限 Workbench metadata response type
- `server/src/mcp/workbench-metadata.ts`
- `server/src/mcp/workbench-metadata.test.ts`（可新增）
- `server/src/mcp/routes.ts`，仅限 `/mcp/tools` 使用 capability-aware Workbench projection
- `server/src/mcp/routes.test.ts`
- `desktop/src/shared/api/tools.ts`，仅限 Workbench response type
- `desktop/src/features/Settings/pages/Tools/types.ts`
- `desktop/src/features/Settings/pages/Tools/utils.ts`
- `desktop/src/features/Settings/pages/Tools/utils.test.ts`
- `desktop/src/features/Settings/pages/Tools/hooks/useToolsWorkbench.ts`
- `desktop/src/features/Settings/pages/Tools/__tests__/useToolsWorkbench.test.tsx`
- `desktop/src/features/Settings/pages/Tools/components/ToolsSidebar.tsx` 和 `index.tsx`，仅限 domain 命名改为 group 命名所需的 props/wiring
- `desktop/src/features/Settings/i18n/zh-CN.ts` 和 `desktop/src/features/Settings/i18n/en-US.ts`，仅限 Tools Workbench 中把产品组误称为 capability domain 的现有文案
- 本任务卡与 `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- 修改或删除 `browser_action` domain 及其 risk / approval / exposure / runtime policy 语义
- 修改任何工具的 ID、schema、执行合同、side effect 或 approval metadata
- 修改 AgentGraph、Planner、Policy、ToolNode、Evidence 或恢复语义
- 修改 Playwright Computer Use Runtime 或触界 WebBridge Runtime
- 把 `browser_computer_use` 与 `browser_attached` 合并为一个 Browser Provider / Session / Capability
- 把 Attached Browser 工具塞入 Computer Use，或把 Playwright 工具塞入触界
- 在前端按 tool ID 编写 browser 专用 if/else 或复制第二份 ownership 映射表
- 为 UI 修复重构整个 Harness Registry、candidate、exposure 或 invocation 主链
- 修改共享 UI 组件库、其它 Settings 页面、Tools Workbench 以外的 i18n 文案或 `pnpm-lock.yaml`
- 新增 hardcoded local path/env、mock 默认值、fallback 或兼容旁路

## Implementation Contract

数据关系必须是：

```text
Harness Registry
→ Capability Profiles
→ capability-aware Workbench group projection
→ Tool Workbench UI
```

不得继续使用：

```text
Tool Workbench
→ switch(domain)
→ 猜产品能力归属
```

推荐最小合同：

- Capability Profile 可选携带 Workbench presentation metadata，例如 label / description / order / icon。
- `/mcp/tools` 的 Workbench projection 为每个工具附加稳定 `groupId` 和 group presentation metadata。
- `browser_computer_use` 的 `groupId` 固定为 `browser_computer_use`。
- `browser_attached` 的 `groupId` 固定为 `browser_attached`。
- 前端按 `workbench.groupId` 建组、筛选和切换；`tool.domain` 只用于诊断展示或运行时语义。
- 没有显式 Workbench ownership 的既有工具可以使用当前 domain presentation 作为后端 projection 的默认组，但该默认行为不得覆盖两个 Browser Profile 的显式 ownership。

## Acceptance Criteria

1. Tool Workbench 左侧显示独立 `Computer Use` 和 `触界` 产品组，不再显示合并的 `Browser Action` 七工具组。
2. `Computer Use` 恰好包含 `browser_observe / browser_act / browser_assert`，数量为 3。
3. `触界` 恰好包含四个 `browser_attached_*` 工具，数量为 4。
4. 两组工具的 `domain` 仍全部为 `browser_action`。
5. 后端 Workbench projection 从现有 Capability Profiles 获得 Browser ownership，不在前端复制 Tool ID 映射。
6. 前端分组、筛选、默认选择和组切换均使用显式 group ID，不直接使用 domain 作为产品组 ID。
7. 工具 schema、invocation、approval、Agent exposure、Computer Use Runtime 和 WebBridge Runtime 均不受影响。
8. 回归测试明确证明“相同 domain 不代表相同产品分组”。
9. Server / desktop 定向测试、两端 typecheck 和根 `pnpm check` 通过。
10. Electron Tool Workbench 真实 UI smoke 显示 `Computer Use 3` 与 `触界 4`，切换后 tab 工具集合正确。

## Required Verification

### Unit / Contract

至少覆盖：

- Workbench projection 将 3 个 Playwright 工具映射到 `browser_computer_use`
- Workbench projection 将 4 个 Attached Browser 工具映射到 `browser_attached`
- 七个工具仍为 `domain: browser_action`
- `/mcp/tools` 返回显式 group metadata
- 前端 helper / hook 按 group ID 而不是 domain 分组和筛选
- 两个相同 domain、不同 group ID 的 fixture 必须形成两个产品组
- invocation 和 Agent exposure 定向回归不变

执行实际路径对应的定向 Vitest，并至少运行：

```bash
pnpm --filter @ui-chat-mira/server typecheck
pnpm --filter @ui-chat-mira/desktop typecheck
pnpm check
```

### Black-Box Smoke

在已运行 Electron 的 Settings → Tools 页面：

1. 左侧可见 `Computer Use`，徽标为 `3`。
2. 左侧可见 `触界`，徽标为 `4`。
3. 选择 `Computer Use` 后只显示 `browser_observe / browser_act / browser_assert`。
4. 选择 `触界` 后只显示四个 `browser_attached_*`。
5. 参数配置仍显示工具原始 `domain: browser_action`。
6. 不要求执行真实浏览器动作；本卡只验产品分组，不替代 T001 的真实 Chrome smoke。

## Environment Contract

- 不新增 env、端口、workspace、Provider 或本地路径配置。
- 使用当前开发命令和 `runtime.config.cjs`；不改 backend route path。
- 测试临时产物只放 `.test-artifact/`。

## Mock / Fixture Policy

- Unit 测试可使用 flat tool definitions 和 Capability Profile fixtures。
- 前端 hook 测试可 mock `/mcp/tools` response，但 fixture 必须包含同 domain、不同 group ID 的两套 Browser 工具。
- Electron UI smoke 必须使用真实 backend response，不得用 mock 工具列表。

## Evidence Requirements

提交评审时必须附上：

1. 修改文件、完整 diff summary 与 scope 审计
2. Browser Capability ownership projection 证据
3. 后端 `/mcp/tools` group metadata 证据
4. 前端不按 domain 分组的代码和测试证据
5. Server / desktop 定向测试、两端 typecheck 与 `pnpm check`
6. Electron UI 的 `Computer Use 3 / 触界 4` 手测记录
7. invocation / exposure / Playwright / Attached Browser 回归结果
8. env / mock / hardcode 说明
9. 未完成项、风险和独立提交 SHA

## Implementation Evidence

2026-07-22 已完成任务卡允许范围内的实现，当前状态为 `READY_FOR_REVIEW`：

- `HarnessCapabilityProfile` 增加可选 Workbench presentation metadata；`browser_computer_use` 和 `browser_attached` 分别声明独立展示信息。
- `/mcp/tools` 从完整 internal registry 解析 Capability Profiles，再为返回工具投影 `groupId / groupLabel / groupDescription / groupOrder / icon`；没有显式展示 ownership 的其它工具继续使用后端 domain metadata 默认组。
- Desktop Tool Workbench 的建组、筛选、默认选择和组切换均使用 `workbench.groupId`；前端没有新增 browser tool ID 映射或 browser 专用分支。
- Tools Workbench 的中英文说明与空态统一使用“产品能力组 / product capability group”，不再把产品展示组称为 capability domain；Workspace Root 中真实 domain 范围语义保持不变。
- 七个浏览器工具的 `domain` 仍全部为 `browser_action`；工具 schema、invocation、approval、exposure、AgentGraph、Playwright Runtime 和 WebBridge Runtime 未因 T002 修改。

变更范围：

- Server：Capability Profile 类型/两个 Browser profile、Workbench projection、`/mcp/tools` 接线和合同测试。
- Desktop：工具 API Workbench metadata 类型、Tools 页面 group 状态/工具函数/侧栏 props、Tools 专属产品组文案和回归测试。
- 新增 `server/src/mcp/workbench-metadata.test.ts`。
- 未修改 Forbidden Changes 所列运行时、AgentGraph、共享 UI、i18n、lockfile 或其它 Settings 页面。

自动验证：

- Supervisor 复跑 Server 核心定向测试：5 files / 29 tests passed，覆盖 Workbench projection、`/mcp/tools`、Capability Profiles、Computer Use 工具和 Attached Browser 工具。
- Supervisor 复跑 Desktop 定向测试：2 files / 17 tests passed，覆盖相同 domain 的两个 group、3/4 数量、筛选和组切换。
- 施工线程扩展回归：Server 8 files / 55 tests passed；Desktop 2 files / 17 tests passed；两端 typecheck passed。
- 根 `pnpm check` passed。
- `git diff --check` passed。
- 补充产品组文案与变量命名后再次运行 Desktop 定向测试 2 files / 17 tests、Desktop typecheck 和根 `pnpm check`，均 passed。
- 既有 `server/src/harness/__tests__/computer-use-exposure.test.ts` 单独运行仍有当前分支原有的 2 个失败；失败断言涉及 `chat_surface` browser 暴露和 browser intent 同时暴露 terminal。本卡未修改 exposure 实现或该测试，其余相关 exposure / candidate / invocation 回归通过。

Electron UI smoke：

- 真实 Settings → Tools 页面已观察到 `Computer Use 3` 与 `触界 4`，不再显示合并的 `Browser Action 7`。
- 当前 `Computer Use` 面板只显示 `Browser Act / Browser Assert / Browser Observe` 三个 tab。
- 尝试切换 `触界` 时检测到项目 owner 正在操作同一窗口，Supervisor 未抢占输入；四个 Attached Browser tab 的切换行为已由 hook 回归通过，但这一步仍缺独立 Electron 可见实测记录。

环境与提交：

- 未新增 env、端口、本地路径、生产 mock、fallback 或兼容旁路。
- 测试只使用显式 definition/profile/UI fixture。
- 当前工作树包含其它任务的既有改动；T002 未提交、未推送、无独立提交 SHA。

## Review Prompt

你正在评审 `browser_attached_T002 Tool Workbench Capability Ownership Grouping`。

从 `/mcp/tools` 数据投影到 Electron Tool Workbench 完整审查产品分组。重点核验：

1. `domain` 是否仍只是 runtime governance 分类
2. Browser ownership 是否来自现有 Capability Profiles 或其显式 presentation metadata
3. 前端是否仍按 `tool.domain` 建组、筛选或选择
4. 是否出现 Tool ID browser 专用 if/else 或第二份 ownership 映射表
5. `Computer Use` 是否严格为 3 个 Playwright 工具
6. `触界` 是否严格为 4 个 Attached Browser 工具
7. 相同 `browser_action` domain 是否仍能形成两个产品组
8. invocation、approval、exposure、AgentGraph、Computer Use Runtime 与 WebBridge Runtime 是否未改变
9. 自动测试与 Electron UI smoke 是否都有证据
10. 是否存在任务外重构、hardcode、fallback 或兼容旁路

输出：PASS / BLOCKED、阻断项、非阻断项、数据投影核验、前端分组核验、runtime 回归、UI smoke、最小修复建议。
