---
id: fertility-assessment
name: fertility-assessment
displayName: 备孕全景评估
description: 当用户希望进行个人或夫妻备孕/生育力梳理、复盘试管/IUI/既往妊娠经历、整理相关检查结果，并最终形成可读的专属备孕全景评估报告时使用。通过自然多轮对话完成服务建档、信息收集、结构化评估、最终确认、量化评分、报告生成与交付。
version: 1.0.0
source: Mira Lab
category: 健康
visibility: public
---

# 备孕全景评估

## Routing

这是一个端到端业务 Skill。适用于用户希望：

- 梳理个人或夫妻备孕与生育力相关信息；
- 复盘试管 / IUI / 既往妊娠、流产或分娩经历；
- 整理女方、男方或双方检查结果与治疗时间线；
- 找出当前最值得补充的信息和就诊准备重点；
- 基于同一份结构化事实生成并交付专属备孕全景评估报告。

不要因为流程中存在“服务建档”“信息采集”“结构化评估”“量化评分”“报告生成”多个阶段，就把它们解释成多个用户可发现 Skill。对用户而言，这些阶段共同完成一个目标：**得到一份基于其真实信息、以专属服务团队口径交付的备孕全景评估结果与报告。**

普通的单点医学知识问答、紧急症状处理或处方治疗请求，不应为了使用本 Skill 而强行进入完整评估流程。

## Outcome

本 Skill 的完成标准不是“已经收集到 JSON”，也不是“访谈结束”。

完整目标链：

```text
服务建档（称呼 / 评估对象 / 当前目标）
→ 自然叙述
→ 结构化事实与不确定项
→ 高价值缺口追问
→ 一次最终确认
→ 完成评估状态
→ 固定规则量化评分
→ 应用已启用的服务 / 评分 Source Profile
→ 从同一状态生成专属报告
→ 行内交付，并在可用时提供 PDF
```

结构化 assessment state 是中间事实源，不是最终用户交付物。

## Workflow

1. **先完成轻量服务建档。** 首先确认报告称呼、评估对象（女方个人 / 男方个人 / 夫妻双方）和当前目标（自然备孕 / 辅助生殖 / 失败经历复盘 / 其他）。这一步只建立服务档案，不展开长问卷。
2. **只运行相关维度。** 女方个人只运行女性维度，男方个人只运行男性维度，夫妻双方才运行男女双维；不得默认消耗男女双向 TaskModel 调用。
3. **再让用户讲整体情况。** 优先自然叙述，不要求先填长表格。
4. **只追最高价值缺口。** 不重复询问已经明确提供的信息；一次只推进一个主要缺口或一组高度相关的缺口。
5. **持续归一化事实。** 用户可以说得零散、口语化或不完整；由 Runtime / TaskModel 在受治理边界内维护结构化状态、来源、不确定项与矛盾项。
6. **必要时提前收束。** 3~5 轮能够形成可靠评估时即可进入最终确认；10 轮只是安全上限，不是固定问卷长度。
7. **用户明确不再补充时及时收束。** 不为了凑满轮次继续追问。
8. **最终确认只做一次。** 确认是否还有重要遗漏；没有补充也允许明确结束收集。
9. **报告评分由固定规则完成。** TaskModel 只归类已提供证据，不直接决定最终分数；确定性评分引擎计算 0~10 分、置信度和资料完整度。
10. **信息不足仍形成结果。** 最终报告不得因为资料不足输出空白维度或 `score=null`；应输出向中性基准收缩的低置信度参考分，并列明缺失依据。
11. **Source Profile 在报告交付阶段应用。** 品牌身份、配色和经批准的评分校准只改变交付表现或已明确配置的维度，不重新解释用户事实。
12. **报告属于同一 Skill 的交付阶段。** 访谈完成后继续基于同一 assessment state 生成报告，不重新从聊天历史拼装第二份事实源。
13. **同源渲染。** 报告内容、雷达图、评分条、行内 HTML 与 PDF 必须来自同一份结构化状态 / Report ViewModel，避免结论漂移。

## Scoring contract

- 每个已选择的女性或男性维度都必须输出 `0~10` 数值分、`low|medium|high` 置信度、资料完整度、已有依据和缺失依据。
- 无直接证据时使用 `5.0 / low` 作为中性基准附近参考值，而不是假装正常或输出空白。
- 资料越少，极端结果越应向中性基准收缩；明确、直接且高关注的证据仍保留较高影响。
- 分数只用于形成当前画像和排序，不代表自然受孕率、临床妊娠率或活产率。
- AMH/AFC 不直接用于卵子质量评分；单一精液参数不构成男性不育诊断。
- 无指征时，免疫、凝血、DFI、NK、封闭抗体等未检测不扣分，也不应列为人人必查。
- 内置医学规则以 `scoring-rules.yaml` 记录；运行时可启用 `scoring-profiles.json` 对已列出的维度做受限校准。
- 默认 `clinical-default` 必须保持 `preserve_builtin`；只有经过专业审阅的 profile 才可启用重新计算模式。

## Service delivery contract

- 对话开场应像专业顾问接待，不像固定问卷。
- 报告必须显示服务对象称呼、评估类型、评估范围、生成日期、评分规则版本和服务团队。
- 用户只提供个人信息时，不得在报告中生成另一性别的空白十维页面。
- 报告先展示十维雷达图和评分条，再进入“核心判断 / 已有依据 / 当前关注 / 建议补充 / 下一步计划”。
- 图表必须由最终数值状态直接生成静态 SVG / HTML，不依赖打印时临时脚本执行。
- 页眉、页脚、品牌色、服务团队名称由 `report-profiles.json` 的 active profile 管理；修改后由 Runtime 按文件更新时间重新读取。

## Source runtime contract

- `report-profiles.json` 可以保存多个客户模板，通过 `activeProfileId` 选择当前服务品牌。
- `scoring-profiles.json` 可以保存多个专业评分校准方案，通过 `activeProfileId` 选择当前方案。
- Source 文件解析失败、字段越界或文件缺失时必须安全降级到内置默认值，并写入结构化日志；不得使整份报告失败。
- Runtime 按文件修改时间缓存 Source；技能修改页保存文件后，下一份新报告应读取新配置，不要求修改 TypeScript。
- Source Profile 不得改变 Conversation Flow、轮次上限、最终确认、assessment state 或内部 report handoff。

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
- `skill://fertility-assessment/references/report-profiles.json`
  - 多客户服务身份、品牌色、页眉页脚和交付文案；这是运行时生效的报告 Profile Source。
- `skill://fertility-assessment/references/scoring-rules.yaml`
  - 十维内置评分方法、证据字段、医学边界和依据来源。
- `skill://fertility-assessment/references/scoring-profiles.json`
  - 医生 / 顾问可审阅的评分校准 Profile；默认不覆盖内置规则。
- `skill://fertility-assessment/references/service-report-source.yaml`
  - 第一、二轮设计期兼容说明；运行时配置以 JSON Profile Source 为准。

只在当前阶段确实需要细节时读取对应 reference。

## Quality rules

- 不把用户口述结果伪装成已核验原始检查单；
- 不为了图表完整而编造事实；
- 不把状态分解释成怀孕概率；
- 不让报告阶段重新发明与 assessment state 冲突的新事实；
- 信息不足时输出低置信度参考分，同时保留 `uncertainty / missingEvidence` 和建议补充项；
- 新事实或新检查结果出现时，先更新 assessment state，再重新计算评分并生成报告，不直接手改旧报告结论。

## Completion

只有满足以下条件，完整 Skill 才算完成：

```text
服务档案已确认
+ assessment state 已完成或明确标注剩余不确定项
+ 所选全部维度已得到数值分与置信度
+ 当前 Source Profile 已应用或安全降级
+ 报告已从该 state 生成
+ 用户已获得可读的行内报告
+ PDF 可用则一并交付；不可用则明确降级，但不能丢失行内报告
```

如果只生成了结构化 JSON、只结束了访谈、只计算了分数，或只声明 `next.intent = generate_report`，都还没有完成用户最初的“备孕全景评估报告”目标。
