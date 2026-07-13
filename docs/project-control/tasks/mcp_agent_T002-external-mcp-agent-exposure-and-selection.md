---
status: current
priority: P0
owner: agent-runtime
last_verified: 2026-07-14
layer: project-control
module: Agent
feature: ExternalMcpAgentExposureAndSelection
doc_type: task-card
canonical: true
task_state: DONE
related:
  - docs/project-control/tasks/mcp_agent_T001-external-mcp-agent-eligibility.md
  - server/src/mcp/harness/exposure.ts
  - server/src/agent/intent/embedding-capability-matcher.ts
---

# mcp_agent_T002 External MCP Agent Exposure And Selection

## Dependency

依赖 `mcp_agent_T001` 提供：

- Agent eligible external MCP capability ids
- 独立 Agent Access 状态
- 单点 eligibility resolver

## Target

让经过用户显式授权、且当前具备运行资格的外部 MCP tools 进入现有 Harness 候选解析与 Agent Tool Selection。

本任务只接通：

```text
Eligibility
→ Tool Exposure
→ Candidate Resolution
→ Task Model Selection
→ projected capability id
```

不执行远端 MCP，不修改 Agent Graph，不绕过 Harness。

## Source Trigger

当前 Agent matcher 调用 Harness candidate resolver 时未传 external allow 信息，Harness Exposure 又默认过滤：

```ts
definition.source === "external"
```

因此 external MCP 即使已 Discover 并注册进 Harness Registry，也无法进入 Agent candidates。

## Required Scope

### 1. 精确 External Allowlist

扩展 Harness Exposure 输入，支持精确白名单，例如：

```ts
allowedExternalToolIds?: string[]
```

可以保留：

```ts
allowExternal?: boolean
```

作为显式总开关，但 external capability 只有同时满足以下条件才可进入 Agent Exposure：

- `allowExternal === true`
- capability id 存在于 `allowedExternalToolIds`
- `definition.source === "external"`
- capability 当前仍存在于 Harness Registry

不得通过单独设置：

```ts
allowExternal: true
```

放开全部 external capabilities。

### 2. Agent Intent Integration

`matchToolCandidatesByEmbedding()` 或等价 Agent candidate 入口必须：

1. 从 T001 eligibility resolver 获取 eligible external capability ids
2. 将这些 ids 传入 Harness candidate resolver
3. 保持现有 source：

```ts
source: "agent_intent"
```

4. 保持现有 topK、minScore、rerank 与 task model selection 链路

不得为 external MCP 新建独立绕行 selector。

### 3. Capability Document Quality

外部 MCP capability definition 的以下字段必须正常进入候选文档与模型选择上下文：

- capability id
- title
- description
- tags
- input schema摘要
- server display name或稳定来源标识

不得只依靠 `"mcp"`、`"external"` 等泛化关键词命中。

必须避免把完整复杂 JSON Schema 无限制塞入 task model prompt。

### 4. Existing Guards

外部 MCP 必须继续经过现有：

- candidate topK
- minScore
- rerank
- task model selection
- Tool Guard
- schema validation

不得因为它来自 MCP 就获得更高优先级或绕过 schema guard。

### 5. Surface Boundaries

保持以下边界：

- `chat_surface` 默认仍不得暴露 external capability
- 普通闲聊不得出现 MCP candidates
- 未授权 MCP 不得进入 candidates
- disabled / stale MCP 不得进入 candidates
- Agent 不得自动安装、Connect 或 Discover MCP
- 内部 Read/Edit/Search/Terminal 候选行为不得退化
- 不得把全部 external tools 一次性塞进模型上下文

### 6. Diagnostics

扩展候选诊断，使其至少能够核验：

- eligible external capability ids
- registered but blocked external ids
- blocked reason
- 哪些 external ids进入 exposure
- 哪些进入最终 candidates
- task model最终是否选中 projected capability id

诊断接口不得泄露 secret、headers、env 或 bearer token。

## Allowed Changes

- Harness exposure input与filter
- Agent candidate resolver接线
- capability document builder的小范围适配
- candidate diagnostics
- 对应 tests
- MCP / Agent 接线文档

## Forbidden Changes

- 不修改 Agent Graph
- 不新增 nextAction 类型
- 不让 Planner直接读取完整 MCP server 列表
- 不绕过 Harness Registry
- 不新增第二套 MCP selector
- 不开放全部 external capability
- 不开放 chat_surface external tools
- 不改 internal Read/Edit/Search/Terminal 契约
- 不接 OAuth、resources、prompts
- 不执行远端 `tools/call`

## Invariants

1. Agent 只能看到 T001 eligibility resolver返回的 external capability
2. 未授权 MCP 对 Agent 不可见
3. external 与 internal 共用同一 candidate pipeline
4. `selectedToolId` / `selectedToolIds` 仍不是执行入口
5. Tool Guard 仍是 Planner前的合法性边界
6. external MCP 不得绕过 topK 和 schema guard
7. internal tools 行为不得退化

## Acceptance Criteria

1. 未授权 MCP 不进入 exposure
2. 已授权但 disabled / stale MCP 不进入 exposure
3. eligible MCP 能根据 title、description 与用户意图进入 candidates
4. task model 能选择 projected capability id
5. Tool Guard 接受合法且已注册的 projected capability
6. 与 MCP 无关的问题不会无故选中 MCP
7. 多个 eligible MCP 同时存在时仍受 topK / maxTools 限制
8. `chat_surface` 不会因此暴露 external capability
9. Read/Edit/Web Search/Terminal 既有测试不退化
10. Exposure、candidate、task-selection 定向测试通过
11. diagnostics 能解释 external tool为何进入或被拦截

## Required Tests

至少覆盖：

1. allowExternal=false + allowlist有值
2. allowExternal=true + allowlist为空
3. allowExternal=true + 单个eligible id
4. allowlist包含不存在Registry中的id
5. registered但未授权external tool
6. disabled / stale external tool
7. relevant external tool进入top candidates
8. irrelevant external tool不进入候选
9. multiple external tools受topK限制
10. internal tool candidates不退化
11. chat_surface仍屏蔽external
12. selected projected id仍经Tool Guard校验
13. diagnostics不泄露secret

## Verification Plan

至少执行：

```bash
pnpm --filter @ui-chat-mira/server test -- <exposure-and-agent-intent-tests>
pnpm --filter @ui-chat-mira/server typecheck
pnpm check
```

必须附带 existing internal tool routing 回归结果。

## Evidence Requirements

提交评审时必须附上：

1. changed files
2. exposure contract diff
3. Agent intent接线路径
4. 至少一个eligible external tool进入candidate的原始diagnostics
5. 至少一个blocked external tool的原始diagnostics
6. internal tool回归测试
7. 所有测试命令与结果
8. 未执行项及原因

## Review Prompt

你正在评审 `mcp_agent_T002 External MCP Agent Exposure And Selection`。

请只审查 T001 eligibility 到现有 Agent candidate / task model selection 的接线，不要扩展到 Agent Graph重构、远端 invocation、OAuth、resources/prompts 或多智能体。

重点核验：

1. 是否使用精确 `allowedExternalToolIds`
2. 是否错误地只传 `allowExternal=true` 放开全部第三方工具
3. allowlist是否来自 T001 单点 eligibility resolver
4. external capability是否仍经过现有 exposure、topK、rerank、task model和Tool Guard
5. 是否新造了绕开Harness的第二套MCP selector
6. capability title、description、tags和schema摘要是否足以支持语义匹配
7. 是否把完整复杂schema或全部MCP tools塞进模型上下文
8. chat_surface是否仍保持默认隐藏
9. internal Read/Edit/Search/Terminal候选是否出现退化
10. diagnostics是否能解释进入/被拦截原因且不泄露secret
11. selected projected capability id是否只是候选/计划结果，而非直接执行入口

输出格式：

- 结论：PASS / BLOCKED
- 阻断项
- 非阻断问题
- Exposure合同核验
- Agent选择链路核验
- 回归测试核验
- 建议的最小修复

## Review Evidence

- 结论：PASS
- T001 eligibility resolver 的真实结果已传入 `allowedExternalToolIds`，并进入现有 Harness exposure、candidate resolution 和 Agent intent 链路。
- 已覆盖未授权、disabled、stale、空 allowlist、不存在 allowlist、多 external topK/maxTools、task model 选择、Tool Guard/schema validation、chat_surface 隔离和 diagnostics 四态输出。
- server T002 定向测试：190/190 通过。
- `pnpm check`：通过。
- 未执行远端 MCP `tools/call`，未修改 Agent Graph、OAuth、resources/prompts 或多 MCP 编排。
