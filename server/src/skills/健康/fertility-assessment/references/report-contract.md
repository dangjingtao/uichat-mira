# 备孕全景评估 — Report Contract

本 reference 定义 `fertility-assessment` 的最终报告阶段。

报告是同一个 Skill 的交付物，不是第二个可发现 Skill。

## 1. 唯一事实源

报告必须基于已经形成的结构化 assessment state。

禁止在报告阶段重新从聊天历史临时拼装一套新的事实源。

```text
assessment state
→ TaskModel 按已发布规则归类证据（不打分）
→ 确定性评分引擎计算分数 / 置信度 / 完整度
→ Report ViewModel
→ deterministic inline HTML + static SVG charts
→ 同一 HTML 打印为 PDF
```

同一份结构化状态是内容真相；同一份 Report ViewModel 是评分真相；同一份 HTML 是最终视觉真相。

## 2. 报告至少包含

1. 专属服务封面、服务对象、评估类型与团队信息；
2. 评分规则版本与阅读说明；
3. 当前优势、优先事项、就诊准备与生活方式重点；
4. 所选评估对象对应的十维雷达图；
5. 所选评估对象对应的十维评分条与置信度；
6. 女性十维详细画像（仅 female / couple）；
7. 男性十维详细画像（仅 male / couple）；
8. 资料缺口与不确定项；
9. 医疗免责声明；
10. 页眉页脚与 PDF 分页保护。

## 3. 维度字段一致性

男女双方每个最终维度保持一致字段：

```text
id
score: number (0~10)
confidence: low | medium | high
dataCompleteness: 0~1
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

- 最终报告中的每个已选择维度必须有数值分，不允许空白维度或 `score = null`；
- 无直接证据时使用 `5.0 / low` 作为中性基准附近参考值，并明确说明需要补充资料后重算；
- 资料越少，极端结果越应向中性基准收缩；明确、直接且高关注的证据仍保留较高影响；
- `score` 不是怀孕概率、临床妊娠率或活产率；
- evidence 必须来自结构化状态中的已知事实；
- 用户口述而未核验的结果必须保留 `user_reported` 语义；
- 需要医疗决策的内容进入 `discussWithClinician`；
- 不输出处方药方案或个体化药物 / 补充剂剂量。

## 4. 评分责任边界

评分规则由 `references/scoring-rules.yaml` 发布并版本化。

TaskModel 的职责：

- 仅在指定维度内识别已知事实；
- 按已发布 `criterionId` 归类证据方向；
- 标记来源与是否为直接证据；
- 生成克制的核心判断与行动文字；
- 不输出最终 `score / confidence / dataCompleteness`。

确定性评分引擎的职责：

- 校验 criterionId；
- 依据基础分、权重、方向与完整度计算 `0~10` 分；
- 依据关键证据覆盖、加权完整度和直接证据数量计算置信度；
- 在资料不足时执行向 `5.0` 中性基准收缩；
- 为每条 evidence 记录评分规则版本。

## 5. 医学边界

- AMH/AFC 主要反映卵巢储备和促排反应，不直接衡量卵子质量或自然受孕概率；
- 女性年龄属于时间窗口与卵母细胞背景，不是疾病，也不单独代表最终结局；
- 单一精液参数不是男性不育诊断；WHO 参考下限用于实验室解释而非个人诊断分界；
- DFI、免疫、凝血、NK、封闭抗体等在无临床指征时不是人人必查，未检测不扣分；
- TSH 采用实验室参考区间和临床情境解释；备孕阶段 2.5–4.0 mIU/L 不自动扣分；
- 外周血炎症指标不得直接替代生殖道炎症证据。

## 6. 生成策略

允许使用 bounded TaskModel 做证据归类和汇总，但必须满足：

- 输入受限于当前 assessment state；
- 不补造检查结果；
- 不形成自治 Agent loop；
- 不绕过 Planner / Policy / Evidence / Harness 去调用外部能力；
- TaskModel 输出先经过评分规则校验与确定性计算，再进入报告状态。

报告正文、图表、HTML 和 PDF 不允许分别让 LLM 独立生成多套内容。

## 7. 行内 HTML 与图表

行内 HTML 是主要可读交付：

- 在聊天中以 sandboxed iframe 或等价安全容器展示；
- 章节、维度字段和结论必须与 assessment state 一致；
- 雷达图与评分条必须由最终数值状态在 renderer 中静态生成；
- 禁止依赖打印阶段临时执行脚本补图；
- HTML 负责最终视觉布局，不再从 Markdown 二次推断结论；
- HTML 生成成功即应保留并可交付，不应因 PDF 环境失败而丢弃。

图表展示规则：

- 雷达图显示十维当前分数；
- 每个标签同时显示置信度；
- 低置信度评分条使用弱化 / 纹理表达，但仍展示数值；
- 个人评估只显示对应性别图表；夫妻评估分别显示男女两套图表，不生成空白另一方页面。

## 8. PDF

PDF 必须直接从同一份最终 HTML 打印 / 转换：

```text
final HTML with inline SVG
→ Chromium / Edge print-to-PDF
→ PDF artifact
```

禁止让 LLM 再独立写一次 PDF 内容，也禁止在打印阶段重新计算评分或动态插图。

如果本机 PDF 转换环境不可用：

- 行内 HTML 仍必须正常交付；
- 明确标记 PDF 暂不可用；
- 不得把整个报告任务错误标记为“没有结果”。

## 9. 完成语义

以下状态都不能单独视为完整用户任务完成：

```text
只完成访谈
只得到 assessment JSON
只得到 flowCompleted=true
只产生 next.intent=generate_report
只计算出维度分数
```

完整交付至少要求：

```text
assessment state ready
+ 所选全部维度具有数值分与置信度
+ report generated
+ inline HTML available to user
```

PDF 是可用时的附加交付；PDF 失败允许降级，但必须留下明确失败信息。

## 10. 增量更新

当用户后来提供新的事实、检查结果或治疗信息：

```text
新信息
→ 更新 assessment state
→ 重新归类受影响证据
→ 确定性重算受影响维度 / summary
→ 从新 state 重新渲染图表与报告
```

不要直接在旧报告文字或 SVG 上手工改结论，否则结构化状态、评分和报告会失去一致性。
