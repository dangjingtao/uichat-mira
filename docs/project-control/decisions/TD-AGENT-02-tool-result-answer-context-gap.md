---
status: current
owner: runtime
last_verified: 2026-07-15
layer: project-control
module: AgentGraph
feature: ToolResultAnswerContext
doc_type: decision
canonical: true
related:
  - docs/project-control/tasks/microapp_info_mcp_003-harness-mcp-governance.md
  - docs/project-control/tasks/microapp_T122-hotFix-computer-use-tool-session-lifecycle.md
  - server/src/mcp/core/invocations.ts
  - server/src/mcp/tools/mail-query.tool.ts
---

# TD-AGENT-02 工具结果未可靠进入最终回答上下文

## Status

`OPEN`

## Problem

工具调用已经成功返回结构化结果，证据整理阶段也能看到邮件的主题、发件人、时间和正文摘要，但最终回答阶段仍可能只依据“工具已完成”或“信息不足”的状态摘要作答，忽略真实的 `result.items`。

已观察到的表现：

- `mail_query` 返回了 20 封邮件及其具体内容；
- 运行证据中的 `reason` 已包含这些邮件事实；
- 最终回答却声称没有获取到具体邮件内容。

## Impact

这会影响所有依赖结构化工具结果回答用户问题的能力，包括：

- 邮件查询结果整理；
- 搜索结果摘要；
- 结构化查询结果的列表、比较和统计；
- 工具成功但最终回答错误声称“未获取到信息”的场景。

## Computer Use 复现

T122 前台烟测补充了同一类问题：

- `browser_observe` 已真实执行完成；
- 浏览器工具返回了 `page.url`、`page.title`、`page.snapshotHash`、`observation.snapshot` 和 `observation.visibleText`；
- Agent 执行步骤显示工具已完成，但最终回答仍表示“未获取到页面标题”，并重复推进 `browser_observe`；
- 原因不是浏览器 Session、Playwright 执行或工具调用失败，而是结构化结果没有可靠进入下一阶段的可用证据上下文。

这证明该技术债不属于 `mail_query` 或 Computer Use 的业务逻辑，而是所有结构化工具共用的结果传递和最终回答上下文问题。

这不是工具领域逻辑错误，也不是模型是否“看懂”的问题，而是工具结果、Evidence 摘要和最终回答上下文之间的职责与传递合同不清晰。

## Constraints

- 本债务关闭前不得修改 AgentGraph 主链；
- 不通过修改具体业务工具来伪装修复通用结果传递问题；
- 不把“工具执行完成”当成“最终回答已经消费工具结果”；
- 业务工具可以继续补充清晰的 result schema 和结果解释说明，但这不替代主链修复。
- 工具可以提供通用 evidence 字段，但 AgentGraph 不得按具体 `toolId` 增加业务特判；Computer Use 的页面字段应由工具适配器填入统一 evidence 合同。

## Closure Criteria

关闭本债务前，必须用真实工具调用证明：

1. 原始结构化工具结果进入最终回答阶段，而不是只进入状态摘要；
2. 最终回答能够引用 `result.items` 中的事实字段；
3. `items` 非空时不会回答“没有获取到信息”；
4. `items` 为空时才报告没有匹配结果；
5. 分页、同步状态和正文可用性不会被错误摘要覆盖；
6. 至少完成一条 `mail_query` 和一条结构化搜索结果的黑盒回归。

Computer Use 作为追加回归场景，还必须证明：

7. `browser_observe` 返回的页面标题、URL 和可见文本能够进入最终回答上下文；
8. 最终回答能够直接引用页面标题，而不是只报告 `browser_observe` 已完成；
9. 工具描述补充不能单独作为通过证据，必须同时验证结构化结果的跨阶段传递。

## Follow-up

后续应先定位最终回答上下文的真实输入边界，再决定是补充现有 Evidence 回流合同、结果上下文构建合同，还是修复回答阶段的数据选择逻辑。未完成定位前，不得继续通过增加工具描述或重复调用工具来掩盖问题。

T122-hotFix 当前已补充通用 MCP evidence 透传合同，明确禁止在 AgentGraph 中增加 Computer Use 特判；该实现仍需通过最终回答阶段的真实黑盒回归后，才能作为本债务的关闭证据。
