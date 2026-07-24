# 备孕全景评估 — Report Contract

本 reference 定义 `fertility-assessment` 的最终报告阶段。

报告是同一个 Skill 的交付物，不是第二个可发现 Skill。

## 1. 唯一事实源

报告必须基于已经形成的结构化 assessment state。

禁止在报告阶段重新从聊天历史临时拼装一套新的事实源。

```text
assessment state
→ 补全允许补全的维度分析
→ Report ViewModel
→ deterministic inline HTML
→ 同一 HTML 打印为 PDF
```

同一份结构化状态是内容真相；同一份 HTML 是最终视觉真相。

## 2. 报告至少包含

1. 说明与数据来源；
2. 夫妻整体摘要；
3. 当前优势；
4. 当前优先事项；
5. 女方十维画像；
6. 男方十维画像；
7. 资料缺口与不确定项；
8. 就诊准备问题；
9. 生活方式优先级；
10. 医疗免责声明。

## 3. 维度字段一致性

男女双方每个维度保持一致字段：

```text
id
score | null
confidence
数据完整度
evidence
strengths
concerns
missingEvidence
interpretation
actions.selfCare
actions.discussWithClinician
actions.testsToConsider
```

规则：

- 数据不足时允许 `score = null`；
- 不为了图表完整而编分数；
- `score` 不是怀孕概率；
- evidence 必须来自结构化状态中的已知事实；
- 用户口述而未核验的结果必须保留 `user_reported` 语义；
- 需要医疗决策的内容进入 `discussWithClinician`；
- 不输出处方药方案或个体化药物 / 补充剂剂量。

## 4. 生成策略

允许使用 bounded TaskModel 对缺失维度做受限分析或生成汇总，但必须满足：

- 输入受限于当前 assessment state；
- 不补造检查结果；
- 不形成自治 Agent loop；
- 不绕过 Planner / Policy / Evidence / Harness 去调用外部能力；
- TaskModel 结果先进入结构化状态，再由确定性 renderer 输出最终报告。

报告正文、HTML 和 PDF 不允许分别让 LLM 独立生成三套内容。

## 5. 行内 HTML

行内 HTML 是主要可读交付：

- 在聊天中以 sandboxed iframe 或等价安全容器展示；
- 章节、维度字段和结论必须与 assessment state 一致；
- HTML 负责最终视觉布局，不再从 Markdown 二次推断结论；
- HTML 生成成功即应保留并可交付，不应因 PDF 环境失败而丢弃。

## 6. PDF

PDF 必须直接从同一份最终 HTML 打印 / 转换：

```text
final HTML
→ Chromium / Edge print-to-PDF
→ PDF artifact
```

禁止让 LLM 再独立写一次 PDF 内容。

如果本机 PDF 转换环境不可用：

- 行内 HTML 仍必须正常交付；
- 明确标记 PDF 暂不可用；
- 不得把整个报告任务错误标记为“没有结果”。

## 7. 完成语义

以下状态都不能单独视为完整用户任务完成：

```text
只完成访谈
只得到 assessment JSON
只得到 flowCompleted=true
只产生 next.intent=generate_report
```

完整交付至少要求：

```text
assessment state ready
+ report generated
+ inline HTML available to user
```

PDF 是可用时的附加交付；PDF 失败允许降级，但必须留下明确失败信息。

## 8. 增量更新

当用户后来提供新的事实、检查结果或治疗信息：

```text
新信息
→ 更新 assessment state
→ 重新计算受影响维度 / summary
→ 从新 state 重新渲染报告
```

不要直接在旧报告文字上手工改结论，否则结构化状态与报告会失去一致性。