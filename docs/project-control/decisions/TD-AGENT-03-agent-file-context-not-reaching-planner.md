---
status: current
owner: runtime
last_verified: 2026-07-24
layer: project-control
module: AgentGraph
feature: AgentFileContext
doc_type: decision
canonical: true
related:
  - docs/project-control/decisions/TD-AGENT-01-hardcoded-user-input-routing-and-execution.md
  - docs/project-control/decisions/TD-AGENT-02-tool-result-answer-context-gap.md
  - server/src/services/chat-file-context.service.ts
  - server/src/routes/proxy-provider/chat.routes.ts
  - server/src/agent/nodes/next-action-planner.ts
  - server/src/agent/nodes/generate.ts
  - server/src/mcp/document-readers.ts
---

# TD-AGENT-03 Agent 附件上下文未进入 Planner

## Status

`OPEN`

## Problem

Agent 聊天中上传的文件已经成功保存，也可以由现有文档解析层读取，但解析结果没有在 Agent 入口进入 Planner。

已复现的线程表现：

- 用户上传一个 `xlsx` 文件，并要求检查工作表、有效范围和基本结构；
- 附件存在于本地 attachments 目录，文件本身可正常读取；
- Agent Planner 只看到用户文本，不看到附件的 `file` part 内容；
- Planner 随后把任务理解为“去当前工作区查找 xlsx 文件”；
- 最终回答错误地报告工作区没有目标文件。

当前代码边界：

- `chat-file-context.service.ts` 的完整文件解析只在 LLM generate 入口使用；
- Agent task model 使用的 Planner 读取 `NormalizedChatMessage.content`，没有读取当前用户消息的文件 part；
- Agent 最终 generate 又重新构造纯文本用户消息，导致附件上下文无法可靠进入最终回答阶段；
- 原始附件消息仍应保留用于消息持久化、展示和附件生命周期管理，不能用解析文本替换持久化事实。

## Secondary Gap

当前 xlsx CLI reader 在 Windows 下通过 Python stdout 返回内容时没有明确声明 UTF-8，中文 Sheet 名可能出现乱码。

截图线程中的实际文件可以被解析为：

- Sheet：`工作表1`
- 有效范围：`A1:B3`
- 内容：`Name / Score`、`Alice / 90`、`Bob / 85`

但当前解析输出中的 Sheet 名出现乱码，且没有直接输出有效范围。

## Impact

这会影响所有 Agent 文件分析任务，包括：

- xlsx 工作表和数据结构检查；
- docx、pptx、pdf、txt 等附件内容理解；
- Agent Planner 是否选择工具的判断；
- Agent 最终回答是否能够引用上传文件事实；
- 文件解析失败时是否能向用户报告真实失败原因。

这不是某个工作区工具或某个 xlsx 工具的业务问题，而是附件解析层到 Agent 上下文之间的通用传递缺口。

## Decision

后续修复必须遵守以下边界：

1. 在进入 `createAndRunAgent` 前，基于原始消息生成一份带完整文件上下文的 Agent runtime 消息副本；
2. Agent Planner、工具决策和最终 generate 使用同一份解析后的消息；
3. 原始消息继续用于持久化、展示和附件清理，不把解析文本写回用户原始消息；
4. 文件只解析一次，不在 Planner 和最终 generate 中重复解析；
5. 解析失败必须明确暴露为文件上下文失败，不得静默退回工作区搜索；
6. xlsx reader 必须明确使用 UTF-8 输出，并直接输出 Sheet 有效范围；
7. 不在本债务修复中引入 Map-Reduce、摘要策略或针对某个文件格式的上下文硬编码。

## Closure Criteria

关闭本债务前必须证明：

1. Agent Planner 输入包含上传文件的解析文本，而不是只有 `[File attachment: ...]` 摘要；
2. Agent Planner 能基于上传文件内容直接决定回答或调用必要工具，不把附件误判为工作区路径；
3. 最终 generate 能引用同一份文件上下文；
4. 持久化消息仍保留原始附件 part；
5. 同一文件在一轮 Agent 中只被解析一次；
6. 文件不存在、格式损坏和解析失败都有明确错误状态；
7. 中文 Sheet 名和有效范围在 xlsx 解析结果中正确显示；
8. 至少完成一条真实 xlsx Agent 回归和一条文本类附件 Agent 回归。

## Follow-up

后续应先补齐 Agent 入口的通用文件上下文传递，再补解析输出和回归测试。未完成前，不要通过提示词要求 Planner“猜测附件位置”，也不要通过增加工作区搜索工具描述掩盖附件上下文缺失。
