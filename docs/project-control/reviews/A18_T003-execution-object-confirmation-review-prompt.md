# A18_T003 独立评审提示词

请评审任务 `A18_T003 — 收紧执行对象确认边界`。

只判断是否切断“用户原话硬编码成执行对象”的链路，不讨论新 Planner 架构，不允许接回 coverage。

重点检查：

1. 动作分类与对象确认是否真正分离。
2. path/mutation regex 是否仍能直接产出 `requiredTargets`、`targetPath`、`command` 或 confirmed object。
3. candidate 是否不可执行，Normalize、Policy、ToolNode 是否不读取。
4. confirmed object 是否来自 Planner 基于明确输入或 evidence 的选择。
5. selectedToolIds、capabilityIntent、requiredTargets 是否可能绕过 Planner。
6. 是否只是把旧正则换成更复杂正则或词典。
7. coverage / completion transition 是否被偷偷连接。
8. 是否修改 Graph 拓扑或加对象解析节点。
9. 测试是否覆盖模糊自然语言、absolute path、多 locate 候选和正常 confirmed 执行。
10. 是否夹带无关重构。

输出必须严格为：

## 评审结论

通过 / 不通过

## 阻断问题

如无，写“无”。

## 按任务划分的独立整改提示词

通过写“无需整改”；不通过仅给本任务整改提示词。
