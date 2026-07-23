---
id: fertility-report
name: fertility-report
displayName: 备孕全景报告
description: 根据已完成的结构化备孕评估状态生成字段一致的夫妻报告；同一份结构化状态渲染为行内 HTML，并由该 HTML 打印转换为 PDF。
version: 1.0.0
source: Mira Lab
category: 健康
---

# 备孕全景报告

## Routing

仅在已经存在完成态 assessment state 时使用。

不要重新从聊天历史临时拼一份新报告；结构化 assessment 是报告事实源。

## Report contract

报告至少包含：

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

每个维度字段保持一致：

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

## Rendering

内容必须由同一份结构化数据驱动：

```text
assessment JSON
→ Report ViewModel
→ deterministic inline HTML
→ Chromium / Edge print-to-PDF
```

行内 HTML 是报告的视觉单点真相。

PDF 必须直接从同一份 HTML 转换，不允许让 LLM 再独立写一次 PDF 内容，以免字段、结论和版式语义漂移。

HTML 在聊天中以 sandboxed iframe 行内展示；PDF 作为同一报告的可下载打印版本。

如果本机 PDF 转换环境暂不可用，HTML 报告仍必须正常交付，并明确标记 PDF 暂不可用，不得因此丢失整份报告。

## Medical safety

- 报告不是诊断书；
- 分数不是怀孕概率；
- 用户口述值没有原始报告核验时必须明确说明；
- 不输出处方药方案或个体化药物 / 补充剂剂量；
- 需要医疗决策的项目放进“与医生讨论”；
- 数据不足的维度允许 `score=null`，不要为了图表完整而编分数。

## Completion

报告交付成功后，本 Skill 不再继续追问信息。

新的事实或检查结果出现时，应回到评估状态做增量更新，再重新渲染报告，而不是直接在旧报告文字上手工改结论。
