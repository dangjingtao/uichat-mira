Exit code: 0
Wall time: 1.5 seconds
Output:
---
status: current
priority: P0
owner: mcp-runtime
last_verified: 2026-07-14
layer: project-control
module: MCP
feature: ExternalMcpAgentEligibility
doc_type: task-card
canonical: true
task_state: DONE
related:
  - docs/architecture/external-mcp-marketplace.md
  - server/src/mcp/external.ts
  - server/src/mcp/exposure.ts
---

# mcp_agent_T001 External MCP Agent Eligibility

## Target

建立“已安装 MCP”和“允许 Agent 使用 MCP”之间的明确边界。

市场安装、Connect、Discover 不得自动等于 Agent 授权。用户必须显式允许某个 MCP server 进入 Agent 候选范围。

## Source Trigger

当前外部 MCP 在 Discover 后已能够投影为 Harness capability，但 Agent 默认看不到 external capability。

在正式接入 Agent 前，必须先解决两个问题：

1. 用户是否明确允许该 MCP 被 Agent 使用
2. 哪些已安装 MCP 在当前状态下仍具备有效调用资格

本任务只建立资格与授权合同，不修改 Agent 主循环。

## Required Scope

### 1. 独立 Agent Access 字段

为 `external_mcp_servers` 增加独立字段：

```ts
agentEnabled: boolean
```

数据库迁移默认值必须为 `false`。

已有安装记录不得因迁移、重启或默认值变化静默获得 Agent 权限。

### 2. Agent Access 更新接口

增加后端 Agent Access 更新接口。

Settings → MCP → 已安装列表中提供明确开关：

```text
允许 Agent 使用
```

该开关必须与以下状态分开展示：

- 已安装
- enabled
- configured / connected / failed
- Discover 是否完成
- Agent Access 是否开启

不得将 `enabled` 直接复用为 Agent Access。

### 3. 单点 Eligibility Resolver

提供单点资格解析函数，例如：

```ts
resolveAgentEligibleExternalMcpCapabilities()
```

只返回满足以下条件的 projected capability：

- server `enabled === true`
- server `agentEnabled === true`
- 已接受免责声明
- `discoveredTools.length > 0`
- projected capability 仍存在于当前 server 的 Discover 结果
- transport 基本配置完整
- capability 仍存在于 Harness Registry

不得仅凭：

```ts
definition.source === "external"
```

或全局：

```ts
allowExternal: true
```

直接放行。

### 4. 配置变化后的资格失效

修改 external MCP 配置导致 `discoveredTools` 清空时：

- 可以保留 `agentEnabled` 用户偏好
- 但该 server 必须立即退出 Agent eligibility
- 直到重新 Connect / Discover 后才能重新获得调用资格

### 5. 删除与禁用

- 删除 external MCP server 后，必须同步移除所有 projected capabilities
- `enabled === false` 时必须立即退出 Agent eligibility
- 禁用不得依赖应用重启才生效

### 6. Startup Registration Guard

修复启动阶段无条件重新注册全部 persisted external MCP capabilities 的问题。

启动恢复时只允许注册满足最小 runtime 条件的 capability，至少不得让以下 server 被恢复为 Agent 可用：

- disabled
- discoveredTools 为空
- 配置不完整
- 已删除或 stale projection

Agent Access 的最终过滤仍由 eligibility resolver 完成。

## Allowed Changes

- external MCP database schema / migration
- external MCP config / CRUD service
- external MCP Settings UI
- external MCP capability registration helper
- eligibility resolver
- 对应 unit / integration tests
- 外部 MCP 架构文档中与授权状态相关的小范围更新

## Forbidden Changes

- 不修改 Planner、Normalize、Policy、ToolNode、Evidence 主合同
- 不修改 Agent Graph 拓扑
- 不自动安装、Connect 或 Discover
- 不接 OAuth
- 不接 MCP resources / prompts
- 不新增通用权限平台
- 不把“已安装”直接解释为“Agent 可用”
- 不引入每工具细粒度权限
- 不重做 MCP Marketplace UI

## Invariants

1. 市场安装不等于 Agent 授权
2. Connect 不等于 Agent 授权
3. Discover 不等于 Agent 授权
4. Agent Access 必须由用户显式开启
5. 新安装与历史安装默认均不得静默开放给 Agent
6. `enabled` 与 `agentEnabled` 是不同语义
7. 资格判断必须有单一权威入口
8. 撤销授权必须立即生效

## Acceptance Criteria

1. 新安装 MCP 默认不允许 Agent 使用
2. 已 Connect、已 Discover但未开启 Agent Access 时，eligibility resolver 不返回对应工具
3. 开启 Agent Access 后，resolver 返回对应 projected capability id
4. 关闭开关后立即退出资格集合
5. server disabled 后立即退出资格集合
6. 配置修改清空 Discover 结果后立即退出资格集合
7. 删除 server 后相关 capability 不再注册或可解析
8. 数据库重启后授权状态正确恢复
9. 旧数据库迁移后 `agentEnabled` 默认为 false
10. UI 能明确区分安装、连接、Discover、enabled 和 Agent Access 状态
11. 定向测试、server typecheck、desktop typecheck 通过

## Required Tests

至少覆盖：

1. 新建 server 时 `agentEnabled=false`
2. legacy row migration 后 `agentEnabled=false`
3. connected + discovered + agent disabled
4. agent enabled + discovered tools available
5. server disabled
6. agent access revoked
7. config update clears discovered tools
8. server deletion unregisters projections
9. restart registration does not restore disabled/stale projections
10. multiple servers only return eligible capability ids

## Verification Plan

至少执行：

```bash
pnpm --filter @ui-chat-mira/server test -- <external-mcp-related-tests>
pnpm --filter @ui-chat-mira/server typecheck
pnpm --filter @ui-chat-mira/desktop typecheck
pnpm check
```

如实际 package 名称不同，以仓库现有命令为准并记录。

## Evidence Requirements

提交评审时必须附上：

1. changed files
2. database migration说明
3. eligibility truth table
4. API 与 UI 状态截图或调用证据
5. 测试命令与原始结果
6. 未执行项及原因
7. 已知风险

## Review Prompt

你正在评审 `mcp_agent_T001 External MCP Agent Eligibility`。

请严格按任务卡审查，不要扩大到 Agent Graph、Planner 重构、OAuth、resources/prompts 或通用权限平台。

重点核验：

1. `agentEnabled` 是否是独立字段，而不是复用 `enabled`
2. 新安装、旧数据迁移、重启恢复是否全部默认安全关闭
3. 是否存在安装、Connect 或 Discover 后自动获得 Agent 权限的路径
4. eligibility 是否有单一权威解析入口
5. resolver 是否同时检查 enabled、agentEnabled、Discover 结果、transport 配置和 Registry 存在性
6. 关闭开关、禁用、修改配置、删除 server 后是否立即失效
7. startup registration 是否仍会无条件恢复 disabled / stale capability
8. UI 是否清晰区分安装、连接、Discover 和 Agent Access
9. 测试是否覆盖迁移、重启、撤销授权和 stale projection
10. 是否出现任何“先全量 allowExternal，再靠下游补救”的实现

输出格式：

- 结论：PASS / BLOCKED
- 阻断项
- 非阻断问题
- 合同核验
- 测试证据核验
- 建议的最小修复

## Review Evidence

- 结论：PASS
- `agent_enabled` 独立字段、legacy migration 默认 `false`、资格解析和 startup registration guard 已实现。
- 已覆盖新建默认关闭、legacy migration、Agent Access 开关、配置失效、禁用失效、删除 projection、startup 恢复保护、多 server eligibility、HTTP route 和 Settings UI。
- server 外部 MCP 定向测试：20/20 通过。
- desktop MCP Settings 定向测试：9/9 通过。
- server typecheck：通过。
- desktop typecheck：通过。
- `pnpm check`：通过。
- T001 未修改 Agent Graph、Planner、Normalize、Policy、ToolNode、Evidence 主合同，也未接入 resources/prompts。

