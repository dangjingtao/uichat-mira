# A18_T002 独立评审提示词

请评审任务 `A18_T002 — 通用结构化 Tool Result 回流 Evidence`。

只评审结果回流合同，不重新设计 Planner 完成度、Sandbox 或 Graph 拓扑。

重点检查：

1. 是否复用 `McpToolEvidence` 统一合同。
2. 结构化结果是否进入 Agent Evidence、Planner observation 和 Generate。
3. generic fallback 是否保留有界结构，而非只写 `toolId/status`。
4. 是否有文本、数组、深度、总大小限制。
5. 空结果、失败、截断、非空结果是否区分。
6. 是否泄露完整正文、DOM、token、header、env。
7. 是否按具体 toolId 写 AgentGraph / Evidence 特判。
8. 是否用至少三个虚构工具验证通用性。
9. 非空 items / 页面字段是否能被最终回答消费。
10. Graph 主链是否未变。
11. 是否夹带完成度重构或无关修改。

输出必须严格为：

## 评审结论

通过 / 不通过

## 阻断问题

如无，写“无”。

## 按任务划分的独立整改提示词

通过写“无需整改”；不通过仅给本任务整改提示词。
