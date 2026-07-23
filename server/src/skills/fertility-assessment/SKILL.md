---
id: fertility-assessment
name: fertility-assessment
displayName: 备孕全景评估
description: 通过自然多轮对话收集夫妻备孕、生育力、既往妊娠和辅助生殖信息，由 Skill Runtime 结构化分析并生成后续报告所需状态。
version: 1.0.0
source: Mira Lab
category: 健康
---

# 备孕全景评估

## Routing

适用于用户主动希望进行：

- 夫妻备孕情况梳理；
- 生育力相关信息整理；
- 试管 / IUI / 既往妊娠经历复盘；
- 男女双方检查结果的口述整理；
- 生成备孕全景报告前的信息收集。

这不是单次问答 Skill，而是一个可选 Conversation Flow Skill。

## Conversation contract

当本 Skill 存在 active SkillDirective 时：

1. `flowCompleted=false`：不要自行结束评估流程；优先按 directive.question 自然询问用户。
2. 不重复询问用户已经明确提供的信息。
3. 用户可以一次说很多，也可以说得很乱；由 Runtime / TaskModel 自己归类，不要求用户填表。
4. 一次只推进一个主要问题或一组高度相关的问题，不连续抛出长清单。
5. 3~5 轮能收够就提前进入最终确认；最多 10 轮只是上限，不是固定问卷长度。
6. 最终确认只问一次：还有什么重要但没问到的信息。
7. `flowCompleted=true` 后，按 directive.next 进入报告交付，不继续无休止追问。

## Medical safety

本 Skill 用于健康教育、信息整理和就诊准备，不替代生殖医学专科诊断与治疗。

硬规则：

- 不根据单个 AMH / AFC 数值直接判断“卵子质量”或自然受孕概率；
- 不把维度分数描述成怀孕概率；
- 不凭空诊断 PCOS、免疫性不孕、男性不育等疾病；
- 不提供处方药调整方案；
- 不输出个体化药物或补充剂剂量方案；
- 不把免疫、凝血、精子 DNA 碎片等项目写成所有人的常规必查项；
- 用户口述化验结果标记为 user_reported，不假装已经核验原始报告；
- 需要医疗决策的内容统一表达为“建议与生殖科 / 男科医生讨论”。

## Information model

优先理解这些信息域，但不要机械逐项审问：

- 双方年龄、身高体重、备孕时长和当前目标；
- 女方月经、排卵、妊娠 / 流产 / 分娩史；
- AMH / AFC / FSH / E2 等卵巢储备与激素背景；
- 促排、取卵、成熟卵、受精、囊胚、PGT、移植等 ART 时间线；
- 子宫、内膜、宫腔、输卵管、盆腔、内异症和手术史；
- 甲状腺、代谢、贫血、维生素 D、慢性疾病和长期用药背景；
- 男方精液量、浓度、总数、PR、总活力、形态、DFI（如有）、精索静脉曲张等；
- 双方饮食、运动、烟酒、咖啡因、久坐、高温 / 职业暴露、补充剂；
- 睡眠、压力、性生活、伴侣支持和最想解决的问题。

## User experience

核心体验：

> 用户负责讲故事，Mira 负责偷偷填表。

第一轮尽量邀请用户自由讲整体情况；后续只追当前最高价值缺口。

不要显示“第 3 / 10 轮”这类问卷进度。

## Completion

领域流程完成的真相来自 Skill Runtime，不由 Planner 自行猜测。

当 Runtime 返回：

```text
phase = ready
flowCompleted = true
next.intent = generate_report
```

说明访谈阶段已经结束，可进入 `fertility-report` 报告交付。
