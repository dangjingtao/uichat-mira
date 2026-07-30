---
status: current
owner: runtime
last_verified: 2026-07-30
layer: wiki
module: Harness
feature: Overview
doc_type: overview
canonical: true
related:
  - ../AGENT_CURRENT_TRUTH.md
  - agentgraph-harness-protocol.md
  - ../skill/README.md
  - ../tooling-runtime/tools-protocol.md
---

# Harness 模块

> Harness 是 Agent 的工具控制平面，不是 Agent 的大脑，也不是 SubAgent 编排器。

Agent 整体主线先读：

- [[AGENT_CURRENT_TRUTH]]
- [[harness/agentgraph-harness-protocol]]

## 1. Harness 负责什么

Harness 负责：

- capability / tool registry；
- concrete tool definition；
- eligible tool surface；
- schema 与 metadata；
- risk / approval boundary；
- workspace boundary；
- invocation；
- external MCP projection；
- trace / audit；
- result 到 `llmContent` 的统一投影。

Harness 不负责：

- 用户目标分解；
- 多步任务下一步决策；
- SubAgent task-local planning；
- 工具参数生成；
- 用户目标完成判断；
- 最终自然语言回答；
- Skill-private Runtime 的领域逻辑。

## 2. 三层合同

### Capability

用于描述能力、eligibility 与治理信息。Capability 可以参与诊断和排名，不能直接执行。

### Tool Exposure

`state.toolExposure` 是 Main Planner 当前可见 concrete tools 的运行时真相：

- tool id；
- title / description；
- input schema；
- domain / source；
- side effect；
- approval；
- workspace metadata。

Tool Exposure 只提供可选工具面，不产生 invocation。

### Invocation

具体执行必须有完整对象：

```ts
executeHarnessInvocation({
  toolId,
  args,
  inputHash,
  approvedInvocations,
  environment,
})
```

普通 Main Planner concrete tool 只有经过 Normalize 冻结成 `pendingToolCall`，才进入 Invocation。

## 3. 普通 concrete tool 路径

```text
Main Planner
  -> nextAction.use_tool(concrete tool)
  -> Normalize
  -> Policy
  -> Harness Invocation
  -> Evidence
  -> Main Planner
```

| Agent 步骤 | Harness 角色 |
| --- | --- |
| Prepare Context | 解析 eligible tools 和 exposure |
| Planner | 提供 tool definitions，不代替 Planner 选择 |
| Normalize | 提供 schema 与 metadata，不重建参数 |
| Policy | 提供 side effect、approval、workspace 信息 |
| Tool | 执行 frozen invocation |
| Evidence | 提供真实 result / `llmContent` |
| Generate | 提供 bounded result projection，不生成回答 |

## 4. delegate_task 不是 Harness Tool

`delegate_task` 是 Agent Runtime 加给 Main Planner 的委派协议。

它：

- 不来自 Harness capability ranking；
- 不对应外部 provider invocation；
- 不进入 Main Agent 普通 Normalize / Policy / ToolNode；
- 用于启动一个受控 Generic SubAgent；
- 不允许 Child 再次委派。

Child 内真正调用 concrete tools 时，仍然受：

- actual tool binding；
- profile allowed tools；
- Policy；
- approval；
- workspace；
- runtime environment；
- Evidence contract。

因此更准确的说法是：**委派属于 Agent Runtime，Child 的真实工具执行仍由受治理能力面完成。**

## 5. Skill-private Runtime 不是第二个 Harness

Skill 可以绑定 private runtime，例如 Office document / PDF / presentation / spreadsheet runtime。

Private Runtime：

- 不暴露给 Main Planner；
- 不注册成普通用户工具；
- 不参与 Main ToolExposure ranking；
- 由 Skill execution profile 与 managed adapter 解析；
- readiness、workspace、approval 和审计必须真实成立；
- pending binding 不得伪装为 ready。

它不是绕过治理的秘密工具，也不是 Harness 全局 Tool Registry 的复制品。

## 6. Tool Exposure 当前规则

```text
eligible concrete tools
  -> <= 20：全部暴露
  -> > 20：capability profile
           -> embedding recall
           -> rerank
           -> concrete tools
           -> toolId 去重
           -> 前 20
```

当前事实：

- 不超过 20 个时不运行语义排名；
- 超过 20 个时 rerank 决定主要顺序；
- 当前没有 `minScore` 淘汰；
- 当前没有核心工具固定名额；
- embedding / reranker 失败有稳定回退；
- Main Planner 不二次改写 Harness ranking。

Recall 与 rerank 只服务上下文压缩，不能建立独立执行决定。

## 7. 不得恢复的旧执行入口

以下对象不能变成 invocation：

- capability id；
- capability match；
- preferredToolId；
- `capabilityIntent.selectedToolIds`；
- `selectedToolId`；
- query keyword rule；
- UI 选中状态。

`selectedToolId` 可以用于 UI、trace、diagnostics 与兼容读取；真实执行必须来自 frozen invocation 或受控 SubAgent runtime binding。

## 8. Approval

普通 Harness invocation 审批绑定：

- `toolId`；
- `toolCallId`；
- `inputHash`。

命令、参数、cwd、env、timeout 或目标资源变化后必须重新判断。

SubAgent concrete invocation 还必须保存 transcript checkpoint，保证恢复同一 Child execution，而不是从目标重新猜一遍。

## 9. Result、Evidence 与 Generate

成功 Invocation 会投影为：

- 真实结果正文；
- 结构化摘要；
- `llmContent`；
- truncated 标记；
- original / included char count；
- tool execution metadata。

ToolNode 产生 pending execution，Evidence 统一累计。

Generate：

- 不调用 Harness；
- 不选择工具；
- 不重新判断完成；
- 只消费 finalization packet 引用的 Evidence；
- 使用 context budget；
- 阻断内部 tool-call protocol leak。

## 10. Terminal Runtime

`terminal_session` 仍通过 Harness registry、exposure、Policy 与 Invocation。

当前 Runtime 包括：

- `host_spawn`；
- persistent PTY；
- full shell；
- Python / Node / Git / package manager；
- watcher / dev server / REPL；
- Windows Job Object / taskkill fallback；
- POSIX process group。

旧 command sandbox 已退出主执行链。Host Runtime 释放执行能力，不等于绕过 `requiresApproval`。

## 11. External MCP

External MCP 必须：

- 成为 eligible capability；
- 进入显式 allowlist；
- 投影为 concrete tool；
- 进入 Main 或 Child 的受治理 surface；
- 形成 exact invocation；
- 经过 Policy / Approval；
- 结果进入 Evidence。

Capability id 不能穿透成 provider 私有命令。

## 12. 当前判断

Harness 当前是：

> **候选、边界、审批、执行、结果和审计的控制平面。**

Main Planner 决定全局下一步；SubAgent 决定被委派工作包的局部下一步；Harness 保证具体工具执行可信。