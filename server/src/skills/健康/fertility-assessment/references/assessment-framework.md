# 备孕全景评估 — Assessment Framework

本 reference 为 `fertility-assessment` 提供按需披露的领域评估细则。

它不是独立 Skill，不负责路由，也不授予任何 Tool / MCP / Runtime 权限。

## 1. 数据来源与可信度

结构化状态必须区分事实来源与可信度：

- 用户在对话中口述的化验、影像、诊断或治疗结果标记为 `user_reported`；
- 未读取原始报告时，不得写成“已核验”；
- 记不清、时间不确定、单位不确定或前后不一致的内容进入 `uncertainties` / `contradictions`；
- 缺失信息进入 `missingCriticalFields` 或各维度的 `missingEvidence`；
- 不为了形成完整画像而补造事实。

## 2. 信息域

优先理解以下信息域，但不要机械逐项审问：

- 双方年龄、身高体重、备孕时长和当前目标；
- 女方月经、排卵、妊娠 / 流产 / 分娩史；
- AMH / AFC / FSH / E2 等卵巢储备与激素背景；
- 促排、取卵、成熟卵、受精、囊胚、PGT、移植等 ART 时间线；
- 子宫、内膜、宫腔、输卵管、盆腔、内异症和手术史；
- 甲状腺、代谢、贫血、维生素 D、慢性疾病和长期用药背景；
- 男方精液量、浓度、总数、PR、总活力、形态、DFI（如有）、精索静脉曲张等；
- 双方饮食、运动、烟酒、咖啡因、久坐、高温 / 职业暴露、补充剂；
- 睡眠、压力、性生活、伴侣支持和最想解决的问题。

这些是理解框架，不是固定问卷。Runtime 应根据当前事实判断下一项最高价值缺口。

## 3. 维度结构

当前评估采用男女双方一致的结构化字段表达，每个维度允许信息不足：

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

女方维度：

```text
female_endometrium
female_hormonal_balance
female_oocyte_context
female_ovarian_reserve
female_metabolic_health
female_immune_context
female_pelvic_environment
female_nutrition
female_lifestyle
female_sleep_stress
```

男方维度：

```text
male_dna_integrity
male_morphology
male_motility
male_concentration
male_semen_volume
male_hormonal_balance
male_inflammation
male_nutrition
male_lifestyle
male_sleep_stress
```

## 4. 评分与解释边界

- `score` 是帮助阅读与排序的启发式状态表达，不是怀孕概率；
- 证据不足时必须允许 `score = null`；
- `confidence` 与数据完整度必须独立表达，不用一个精确分数掩盖证据不足；
- evidence、concerns、missingEvidence 必须区分；
- AMH / AFC 主要用于理解卵巢储备与促排反应背景，不得单独等同卵子质量或自然受孕概率；
- 不根据单个指标直接给出个体自然受孕概率。

## 5. 医学安全边界

本 Skill 用于健康教育、信息整理和就诊准备，不替代生殖医学专科诊断与治疗。

硬规则：

- 不凭空诊断 PCOS、免疫性不孕、男性不育等疾病；
- 不提供处方药调整方案；
- 不输出个体化药物或补充剂剂量方案；
- 不把免疫、凝血、精子 DNA 碎片等项目写成所有人的常规必查项；
- 需要医疗决策的内容统一表达为“建议与生殖科 / 男科医生讨论”；
- 紧急症状或妊娠相关急症不进入常规评估流程，应优先提示及时线下就医。

## 6. 多轮采集原则

- 第一轮尽量邀请用户自由讲整体情况；
- 后续只追当前最高价值缺口；
- 不显示“第 N / 10 轮”式问卷进度；
- 3~5 轮能够形成可靠状态时即可提前收束；
- 10 轮只是安全上限；
- 最终开放确认只做一次；
- 已经明确提供的信息不重复询问。

核心体验：

> 用户负责讲故事，Mira 负责整理结构。
