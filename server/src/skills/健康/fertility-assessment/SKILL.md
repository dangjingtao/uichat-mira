---
id: fertility-assessment
name: fertility-assessment
displayName: 备孕全景评估
description: 当用户希望进行夫妻备孕或生育力梳理、复盘试管/IUI/既往妊娠经历、整理男女双方检查结果，并最终形成可读的备孕全景评估报告时使用。通过自然多轮对话完成信息收集、结构化评估、最终确认、报告生成与交付。
version: 1.0.0
source: Mira Lab
category: 健康
visibility: public
---

# 备孕全景评估

## Routing

这是一个端到端业务 Skill。适用于用户希望：

- 梳理夫妻备孕与生育力相关信息；
- 复盘试管 / IUI / 既往妊娠、流产或分娩经历；
- 整理男女双方检查结果与治疗时间线；
- 找出当前最值得补充的信息和就诊准备重点；
- 基于同一份结构化事实生成并交付备孕全景评估报告。

不要因为流程中存在“信息采集”“结构化评估”“报告生成”多个阶段，就把它们解释成多个用户可发现 Skill。对用户而言，这些阶段共同完成一个目标：**得到一份基于其真实信息的备孕全景评估结果与报告。**

普通的单点医学知识问答、紧急症状处理或处方治疗请求，不应为了使用本 Skill 而强行进入完整评估流程。

## Outcome

本 Skill 的完成标准不是“已经收集到 JSON”，也不是“访谈结束”。

完整目标链：

```text
自然叙述
→ 结构化事实与不确定项
→ 高价值缺口追问
→ 一次最终确认
→ 完成评估状态
→ 从同一状态生成报告
→ 行内交付，并在可用时提供 PDF
```

结构化 assessment state 是中间事实源，不是最终用户交付物。

## Workflow

1. **先让用户讲整体情况。** 优先自然叙述，不要求先填长表格。
2. **只追最高价值缺口。** 不重复询问已经明确提供的信息；一次只推进一个主要缺口或一组高度相关的缺口。
3. **持续归一化事实。** 用户可以说得零散、口语化或不完整；由 Runtime / TaskModel 在受治理边界内维护结构化状态、来源、不确定项与矛盾项。
4. **必要时提前收束。** 3~5 轮能够形成可靠评估时即可进入最终确认；10 轮只是安全上限，不是固定问卷长度。
5. **最终确认只做一次。** 确认是否还有重要遗漏；没有补充也允许明确结束收集。
6. **报告属于同一 Skill 的交付阶段。** 访谈完成后继续基于同一 assessment state 生成报告，不重新从聊天历史拼装第二份事实源。
7. **同源渲染。** 报告内容、行内 HTML 与 PDF 必须来自同一份结构化状态 / Report ViewModel，避免结论漂移。

## Conversation Runtime contract

当存在 active Conversation Flow Runtime 时：

- `flowCompleted=false` 且存在 `interruption.requirements`：这些 requirement 描述缺失的业务信息及影响，不是已经写好的用户问题；由 Planner 结合全局目标组织自然追问。
- Runtime 不直接替 Planner 扩大工具面，不绕过 Policy / Approval / Harness。
- 不重复要求用户已经明确提供的信息。
- 用户负责讲故事，Mira 负责整理结构。
- 访谈阶段结束只表示“信息收集子阶段完成”，**不等于完整用户目标完成**；完整任务要继续到报告成功交付。
- 报告生成可以使用内部 bounded handoff / renderer，但它是本 Skill 的内部执行阶段，不应注册成第二个可发现 Skill。

## Progressive disclosure

详细规则按需读取，不把所有领域细节长期塞进 `SKILL.md`：

- `skill://fertility-assessment/references/assessment-framework.md`
  - 信息域、结构化评估原则、数据来源语义、医学安全边界。
- `skill://fertility-assessment/references/report-contract.md`
  - 报告字段、章节、单一事实源渲染、HTML/PDF 交付与失败降级规则。

只在当前阶段确实需要细节时读取对应 reference。

## Quality rules

- 不把用户口述结果伪装成已核验原始检查单；
- 不为了图表完整而编造数据或分数；
- 不把状态分解释成怀孕概率；
- 不让报告阶段重新发明与 assessment state 冲突的新事实；
- 信息不足时明确保留 `unknown / uncertainty / missingEvidence`；
- 新事实或新检查结果出现时，先更新 assessment state，再重新生成报告，不直接手改旧报告结论。

## Completion

只有满足以下条件，完整 Skill 才算完成：

```text
assessment state 已完成或明确标注剩余不确定项
+ 报告已从该 state 生成
+ 用户已获得可读的行内报告
+ PDF 可用则一并交付；不可用则明确降级，但不能丢失行内报告
```

如果只生成了结构化 JSON、只结束了访谈、或只声明 `next.intent = generate_report`，都还没有完成用户最初的“备孕全景评估报告”目标。
