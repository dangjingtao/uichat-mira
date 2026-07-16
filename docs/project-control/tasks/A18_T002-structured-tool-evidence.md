# A18_T002 — 通用结构化 Tool Result 回流 Evidence

- 状态：READY
- 仓库：`dangjingtao/uichat-mira`
- 基线分支：`dev`
- 类型：P0 技术债 / Grounding
- 前置任务：无
- 合并顺序：第 2 张
- 可与 `A18_T001` 并行施工

## 背景

MCP / 微应用工具可返回完整结构化结果，例如邮件列表、浏览器页面状态、远端 MCP 对象。

现有统一合同已经存在：

- `AgentToolExecutionResult.evidence?: McpToolEvidence`
- `McpToolEvidence` 包含 `actionTaken / facts / gaps / status / data`
- `server/src/agent/evidence.ts` 优先消费 `execution.evidence`

当前缺口：

1. 部分工具只返回 `result`，未产出通用 evidence。
2. generic fallback 只保留 `toolId/status`，业务结果被丢弃。
3. Planner / Generate 因看不到事实而回答“没数据”或重复调用。

## 目标

建立统一链路：

`Tool Adapter / MCP Invocation → McpToolEvidence → Agent Evidence → Planner / Generate`

要求：

- 适配层负责业务结果到通用 evidence。
- AgentGraph 不识别任何具体工具。
- Evidence 保留有界结构化事实。
- Planner 与 Generate 能消费已经取得的结果。
- 非空结果不得被回答成“没有数据”。
- 不把无限原始 JSON 塞入上下文。

## 施工范围

优先检查：

- `server/src/mcp/core/definitions.ts`
- MCP invocation / adapter 到 `AgentToolExecutionResult` 的映射
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- Planner observation context / Generate evidence serialization
- `mail_query`、`browser_observe` 仅作为合同验证样本
- Evidence、ToolNode、Generate 相关测试

不得：

- 为具体 toolId 增加 AgentGraph 分支。
- 在 `evidence.ts` 继续堆具体工具名单来解决本卡。
- 新增结果解释节点。
- 引入大型 schema/serializer 框架。
- 放入完整邮件正文、完整 DOM、无限数组、超长 JSON 或敏感认证信息。

## 合同要求

### Tool Adapter

结构化工具应产出：

```ts
type McpToolEvidence = {
  actionTaken: string
  facts: string[]
  gaps?: string[]
  error?: string
  status?: EvidenceStatus
  data?: unknown
}
```

要求：

- `facts` 简短且可直接引用。
- `data` 有界，保留回答所需字段。
- 列表包含数量、截断状态和有限 preview。
- 空结果与失败区分。
- token、header、完整 env 等敏感字段不得进入 evidence。

### Generic fallback

没有显式 evidence、但返回结构化 result 时：

- 不得只保留 `toolId/status`。
- 生成安全、有界的 generic structured preview。
- 有统一文本长度、数组长度、对象深度和总大小限制。
- 标记 truncated。
- 不猜业务语义。
- 不可安全序列化时记录 gap，不得静默假装无结果。

### Planner / Generate

- Planner observation 能看到 `actionTaken / facts / gaps / status` 与有界 data。
- Generate 可用当前任务相关 evidence 作答。
- Planner 不直接吃 full raw result。
- 本卡不重写任务完成度逻辑。
- 已有 evidence 时不绕回具体工具读取 raw result。

## 必须覆盖的测试

至少三个虚构工具合同测试：

1. Generic list tool 返回 `{ items: [...], total: 20, nextCursor: "..." }`：
   - Evidence 保留 total、有限 preview、truncated/cursor。
   - Generate 不说“没有结果”。

2. Generic observation tool 返回 `{ title, url, visibleText, actions }`：
   - Evidence 保留有界关键字段。
   - Planner 可看到已观察事实。

3. Oversized/nested tool：
   - 超长文本、大数组、深对象或不可序列化对象被截断或记录 gap。
   - 不导致 prompt 爆炸或异常。

真实样本：

4. `mail_query` 非空 items 时，Evidence 明确反映非空结果。
5. `browser_observe` 有页面字段时，Evidence 能进入最终回答上下文。

## 验收标准

- 新工具遵守 `McpToolEvidence` 即可接入，不改 AgentGraph。
- Generic fallback 不再丢弃全部结构化结果。
- 有界限制可测试。
- 非空 items 不再回答成“没有数据”。
- Planner 不因看不到结果而重复调用。
- 不新增具体工具特判。
- 相关测试与 typecheck 通过。

## 施工红线

1. 不新增 AgentGraph 节点、旁路、循环或 `nextAction` 类型。
2. 不改变主链：`Planner → Normalize → Policy → ToolNode → Evidence → Planner`。
3. 不按具体 `toolId`、MCP 名称、微应用类型或 Python provider 写 AgentGraph 特判。
4. 不使用关键词、正则或字符串猜测，把自然语言直接转换为可执行的 `path / targetPath / destinationPath / command / code`。
5. 不绕过 `pendingToolCall`、Policy、ToolNode、Evidence。
6. 不为通过单个测试硬编码返回值、文件名、工具名、系统路径或分支。
7. 能力差异在 Tool Adapter、Harness、Sandbox、Evidence 合同内收敛，不塞进 Graph。
8. 如统一合同不足，停止施工并提交“合同缺口说明”，不得自行扩大架构。
9. 不顺手重构无关模块，不升级依赖，不改大前端。
10. 测试必须保护合同，不得继续保护已确认的错误行为。

## 交付要求

完成后必须提供：

- 改动文件清单。
- 行为变化说明。
- 新增或修改测试清单。
- 实际测试命令与结果。
- 是否影响现有黑盒、审批、Evidence、Trace。
- 已知限制。
- 一个独立提交；不得夹带全仓格式化、依赖升级或无关清理。
