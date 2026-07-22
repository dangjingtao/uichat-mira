# Harness 模块

Status: Current
Owner: runtime
Last verified: 2026-07-22
Layer: wiki
Module: Harness
Feature: Overview
Doc Type: overview
Canonical: true
Related:
  - agentgraph-harness-protocol.md
  - ../tooling-runtime/tools-protocol.md
  - harness-assessment-2026-06-28.md
  - harness-phase-1-implementation-checklist.md

## 单点真相范围

这页是 Harness 模块入口。

Agent Runtime 的完整主线以：

- [AgentGraph 与 Harness 当前协议](agentgraph-harness-protocol.md)

为准。

## 当前定位

Harness 不是全局编排器，也不是最终回答器。

它负责：

- capability / tool registry
- 工具定义与 exposure schema
- eligible tool surface
- invocation 执行
- risk / approval boundary
- workspace boundary
- external MCP projection
- invocation trace / audit
- Harness result 到 LLM content 的统一投影

它不负责：

- 决定一个多步任务下一步做什么
- 生成工具参数
- 维护 Agent task completion
- 决定何时回答用户
- 组织最终自然语言答案

这些属于 Agent Runtime / Planner / Generate。

## 当前三层合同

### 1. Capability

Harness 内部用于描述能力与治理信息，例如：

- read
- web search
- terminal
- external MCP
- codebase understanding

Capability 可以参与诊断、治理、可见性与排序，但不能直接进入执行。

### 2. Tool Exposure

Tool Exposure 是本轮 Planner 可以看见的工具面：

- tool id
- title / description
- input schema
- capability metadata
- approval / side-effect metadata

Tool Exposure 只提供候选，不产生执行对象。

### 3. Invocation

Invocation 是具体执行：

```ts
executeHarnessInvocation({
  toolId,
  args,
  inputHash,
  approvedInvocations,
  environment,
})
```

只有 frozen `pendingToolCall` 才能进入 Agent 的 Invocation 路径。

## 与 Agent Runtime 的当前边界

当前应用默认主链：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool
  -> Evidence
  -> Planner
```

Harness 参与其中的方式：

| Agent 步骤 | Harness 角色 |
| --- | --- |
| Planner | 提供 exposed tool definitions；不替 Planner 选最终工具 |
| Normalize | 提供 schema 与 metadata；不重建参数 |
| Policy | 提供 side effect、approval、workspace boundary 信息 |
| Tool | 执行 frozen `pendingToolCall` |
| Evidence | 接收 Invocation 的真实结果与 `llmContent` |
| Generate | 提供 bounded result projection，不直接生成回答 |

## 不得恢复的旧入口

以下内容不得重新变成执行入口：

- capability id
- capability match
- preferredToolId
- `capabilityIntent.selectedToolIds`
- `selectedToolId`
- query keyword rule
- UI 选中状态

`selectedToolId` 可以保留给 UI、trace、diagnostics 与兼容读取，但真实执行必须由 frozen `pendingToolCall` 驱动。

## 当前 Tool Exposure 真相

完整合同以 [AgentGraph 与 Harness 当前协议：Tool Exposure 与真实执行入口](agentgraph-harness-protocol.md#tool-exposure-与真实执行入口) 为准。

`resolveHarnessToolCandidatesForTurn(...)` 返回的是：

- `toolCandidates`
- `toolExposure.exposedToolIds`
- `toolExposure.exposedDefinitions`

当前 eligible 工具面不会因为用户措辞弱或 recall 失败就被静默缩成一个“选中工具”。

当前暴露规则：

- eligible concrete tools 不超过 `20`：全部暴露，不运行语义排名。
- eligible concrete tools 超过 `20`：先按 capability profile 做 embedding 全量召回，再由 reranker 决定最终顺序；rerank 同分时才使用 embedding 排序。
- capability 展开为具体 tool id、去重后取前 `20`，写入 `state.toolExposure`。
- Planner 不计算排名、不暴露工具，只消费 `state.toolExposure` 并决定下一步。
- reranker 失败时保留 embedding 顺序；embedding 失败或查询为空时按稳定顺序取前 `20`。
- 当前没有核心工具固定名额，也没有 `minScore` 阈值淘汰。

Recall 与 rerank 只服务 Planner 上下文压缩和排序，不能建立独立于 Planner 的执行决定。

## Approval 与 Workspace Boundary

Harness invocation 在执行前会验证：

- 工具是否要求审批
- exact `toolId / inputHash` 是否已获批准
- workspace-bound 参数是否越界
- 外部 MCP 是否满足 eligible allowlist

审批通过只授权当前 exact invocation。

参数、cwd、env、timeout 或命令发生变化时，hash 变化，必须重新判断。

## Harness Result 与 Generate

成功 Invocation 会投影为 `llmContent`：

- 真实结果正文
- 截断标记
- original / included char count
- 结构化工具结果文本

Agent ToolNode 把它附加到 execution，Evidence 统一累计。

Generate 当前有正式的大结果边界：

- Harness Generate context 总字符预算 `48_000`
- 只消费 completed executions
- 明确标记 truncated
- 超预算只截断上下文，不停止工具进程
- 模型必须依据已展示结果回答

因此，“Generate 仍无边界拼接 tool result”已经过期。

## Terminal Runtime 边界

`terminal_session` 仍通过 Harness 注册、Exposure、Policy 与 Invocation。

当前执行 Runtime 是：

- `host_spawn`
- persistent PTY
- Windows Job Object / taskkill tree fallback
- POSIX process group

它不再要求旧 command sandbox。

`requiresApproval` 仍保留；Host Runtime 放开执行能力，不等于绕开 Policy。

## External MCP

External MCP 必须：

- 先成为 eligible capability
- 进入显式 allowlist
- 投影为具体 tool definition
- 由 Planner 生成具体 `use_tool`
- 经过 Normalize / Policy / Invocation
- 将结果进入 Evidence

Agent 不得直接调用 provider 私有命令，也不得让 capability id 穿透成 invocation tool id。

## 当前判断

Harness 当前是：

> **Agent 的工具控制平面，而不是 Agent 的大脑。**

Planner 决定下一步；Harness 保证候选、审批、边界、执行、结果和审计可信。
