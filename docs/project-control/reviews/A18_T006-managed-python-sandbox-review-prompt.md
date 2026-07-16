# A18_T006 独立评审提示词

请评审任务 `A18_T006 — 受管 Python Sandbox`。

只评审第一版 Python 执行，不扩展 Notebook、pip 平台、GPU、远程容器或多 runtime 编排。

重点检查：

1. runtime 是否默认关闭，health check 通过后才暴露。
2. 模型是否只能提交 code/cwd/timeout/artifact。
3. 解释器与预装包是否来自受管配置，不在 Planner/Graph 硬编码。
4. cwd、artifact、timeout、output、approval 是否复用 A18_T005 合同。
5. code/cwd/timeout/artifact 变化后旧审批是否失效。
6. pip/conda/uv/poetry 是否不可达或明确阻止。
7. 敏感宿主 env 是否不继承。
8. 结果是否通过通用 `McpToolEvidence` 回 Evidence。
9. syntax error、非零退出、timeout 是否为 recoverable execution result。
10. 是否新增 python 专属 Graph 分支。
11. 是否虚假宣称网络、CPU、内存、子进程或 hostile-code 强隔离。
12. 是否偷偷实现 Notebook、长驻 kernel、任意包安装或大前端。
13. 是否有真实 smoke 与安全负例测试。

输出必须严格为：

## 评审结论

通过 / 不通过

## 阻断问题

如无，写“无”。

## 按任务划分的独立整改提示词

通过写“无需整改”；不通过仅给本任务整改提示词。
