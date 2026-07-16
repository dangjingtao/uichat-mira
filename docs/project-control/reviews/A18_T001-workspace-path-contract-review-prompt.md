# A18_T001 独立评审提示词

请评审任务 `A18_T001 — 恢复 Workspace Path 参数合同`。

只评审本任务，不施工、不重构、不扩展到 Python、Sandbox、外部 MCP 或 AgentGraph 设计。

重点检查：

1. 是否只允许 `/workspace` 与 `/workspace/...` 转换为 workspace-relative。
2. `/README.md`、`/docs/README.md`、`/etc/passwd`、`/bin/sh`、`/usr/bin/env`、`/C:/...` 是否不再被剥离 leading slash。
3. Windows absolute / UNC 是否保持原始语义。
4. traversal 是否仍然拒绝。
5. `terminal_session.cwd` 独立合同是否未被破坏。
6. 原先保护错误行为的测试是否已反转。
7. 是否存在系统路径名单、toolId 特判或为了测试通过的硬编码。
8. 是否改动 AgentGraph、Planner、Policy、ToolNode 职责。
9. 测试是否同时验证 Normalize 语义和下游边界。
10. 是否夹带无关重构。

输出必须严格为：

## 评审结论

通过 / 不通过

## 阻断问题

如无，写“无”。

## 按任务划分的独立整改提示词

通过写“无需整改”；不通过仅给本任务可直接施工的整改提示词。
