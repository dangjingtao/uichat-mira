# A18_T005 独立评审提示词

请评审任务 `A18_T005 — Sandbox 能力合同与 Runner 收口`。

只收口现有 L1 command runner，不允许顺手做 Python、Docker、网络沙盒或 Graph 重构。

重点检查：

1. command 与未实现 profiles 状态是否真实。
2. cwd、env、timeout、output、artifact、result 合同是否稳定。
3. command/cwd/env/timeout/artifact 变化是否重新审批。
4. Sandbox 是否只执行 Policy 通过的 frozen pendingToolCall。
5. result 是否通过通用 `McpToolEvidence` 进入 Evidence。
6. 是否新增 Graph 节点或 toolId 特判。
7. 是否按参数名猜测外部 MCP path/cwd。
8. remote path 与宿主 workspace path 是否分离。
9. 是否虚假宣称网络、文件系统、子进程或 hostile-code 隔离。
10. 是否引入超范围大施工。
11. 测试是否覆盖 blocked/timed_out/failed/completed。

输出必须严格为：

## 评审结论

通过 / 不通过

## 阻断问题

如无，写“无”。

## 按任务划分的独立整改提示词

通过写“无需整改”；不通过仅给本任务整改提示词。
