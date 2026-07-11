---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-11
layer: project-control
module: ProjectControl
feature: CodeGraphMicroAppControlledCapabilityWiring
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/tasks/code_T015-codegraph-external-index-root-repo-pollution-control.md
  - docs/project-control/tasks/code_T016-codegraph-studio-desktop-ux-polish.md
task_state: DONE
---

# code_T017 CodeGraph MicroApp Controlled Capability Wiring

## Target

把 `CodeGraph Studio`、持久化配置、owner 显式授权、Harness capability 注册和现有 `codebase_explore` 受控执行路径串成一条可验证闭环。

本卡完成后：

- `CodeGraph` 默认仍不暴露给智能体
- 真实 `CodeGraph 1.3.0` 仍保持 blocked
- 只有 Fake Provider ready 且 owner 显式开启时，Harness 才注册 `codebase_explore`
- 查询结果仍必须经过现有 verification / Evidence 路径

## Allowed Changes

- `server/src/microapps/apps/codegraph.microapp.ts`
- `server/src/microapps/codegraph/**`
- `server/src/mcp/managed-codegraph/**`
- `server/src/harness/**`
- `server/src/routes/microapps/codegraph/**`
- `server/src/routes/microapps/index.test.ts`
- `server/src/index.ts`
- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/**`
- `desktop/src/features/Settings/i18n/en-US.ts`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `desktop/src/shared/api/codegraphStudio.ts`
- `docs/project-control/tasks/code_T017-codegraph-microapp-controlled-capability-wiring.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- 不解除真实 `CodeGraph 1.3.0` blocked
- 不默认启用 `codebase_explore`
- 不把 CodeGraph 原生命令暴露给 Planner
- 不修改 Planner / Normalize / Policy / ToolNode / Evidence / Generate 主链
- 不新增 Agent action type
- 不放宽 verification / Evidence gate
- 不修改 `electron/**`
- 不修改 `tauri/**`
- 不修改 `pnpm-lock.yaml`

## Acceptance Summary

1. 默认状态下，`codebase_explore` 不注册、不执行、不暴露。
2. `CodeGraph Studio` 持久化保存：
   - `microAppEnabled`
   - `agentCapabilityEnabled`
   - `command`
   - `startArgs`
   - `versionProbeArgs`
   - `telemetryProbeArgs`
   - `appDataRoot`
   - `timeoutMs`
   - `maxResults`
   - `queryLimit`
3. Fake Provider ready 且 owner 显式授权后，Harness 注册 `codebase_explore`。
4. 关闭 owner 开关后，`codebase_explore` 立即从可用能力集合移除。
5. `codebase_explore` 仍只输出受控 capability，结果继续经过 verification bridge。
6. 真实 provider blocked 时，开关不会把能力伪装成可用。

## Completion Evidence

### Changed Areas

- `server/src/microapps/codegraph/index.ts`
- `server/src/harness/codegraph-capability.ts`
- `server/src/harness/runtime.ts`
- `server/src/harness/runtime.test.ts`
- `server/src/mcp/managed-codegraph/codebase-explore.tool.ts`
- `server/src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts`
- `server/src/routes/microapps/codegraph/index.ts`
- `server/src/routes/microapps/codegraph/index.test.ts`
- `server/src/routes/microapps/index.test.ts`
- `desktop/src/shared/api/codegraphStudio.ts`
- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/CodeGraph/__tests__/index.test.tsx`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `desktop/src/features/Settings/i18n/en-US.ts`

### Capability Ready Gate

当前注册 gate 固定要求同时满足：

1. `microAppEnabled = true`
2. `agentCapabilityEnabled = true`
3. runtime status = `ready`
4. telemetry status = `verified_off`
5. workspace 匹配
6. repo pollution guard = safe
7. App Data Root 合法
8. Harness reconcile 注册成功

任一条件不满足：

- `codebase_explore` 不注册
- 已注册状态会被立即撤销
- tool 执行返回明确 unavailable / blocked 提示
- 不再把 unavailable 伪装成 empty result

### Scenario A: Real Provider

- provider: `CodeGraph 1.3.0`
- Studio status: `blocked`
- `agentCapabilityEnabled`: 即使保存为 `true` 也不会让 capability 可执行
- Harness `codebase_explore`: `unavailable`
- repo-root `.codegraph`: 不创建

### Scenario B: Fake Provider

- provider: fake fixture
- Studio status: `ready`
- owner 显式开启 `允许智能体使用 CodeGraph`
- Harness 注册 `codebase_explore`
- query 结果继续走 verification bridge
- 关闭开关后 capability 立即移除

## Verification Results

- `pnpm --dir server test -- src/microapps/codegraph/__tests__/studio.service.test.ts`
- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/codebase-explore.tool.test.ts`
- `pnpm --dir server test -- src/harness/runtime.test.ts`
- `pnpm --dir server test -- src/routes/microapps/codegraph/index.test.ts`
- `pnpm --dir server test -- src/routes/microapps/index.test.ts`
- `pnpm --filter @ui-chat-mira/desktop test -- src/features/Settings/pages/MicroApps/CodeGraph/__tests__/index.test.tsx`
- `pnpm check`

## Final Conclusion

- `CodeGraph` 已作为可选内置微应用能力接入 Harness
- 默认不启用
- 真实 `CodeGraph 1.3.0` 仍 blocked
- Fake Provider 只用于端到端验证
- Agent 主链未改变
