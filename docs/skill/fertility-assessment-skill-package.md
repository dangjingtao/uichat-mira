# 生育力 / 备孕全景评估 Skill Package

Status: Current
Protocol: Skill V1 + optional Conversation Flow Runtime
Owner: skill / runtime / docs
Last verified: 2026-07-24
Layer: raw-source
Module: SKILL
Feature: FertilityAssessment
Doc Type: implementation note
Canonical: false
Related:
  - ./README.md
  - ./skill-context-design.md
  - ./skill-conversation-flow-directive-design.md
  - ../../server/src/skills/fertility-assessment/SKILL.md

## 当前边界

当前对用户可发现的业务 Skill 只有一个：

```text
fertility-assessment
= 备孕 / 生育力信息采集
+ 结构化评估
+ 最终确认
+ 报告生成
+ 行内 / PDF 交付
```

不再注册独立的 `fertility-report` Skill Manifest。

原因不是“阶段少”或“目标只能有一个”，而是 Skill 边界按一个可复用、可触发的用户任务能力划分；报告生成是该任务的内部交付阶段。Mira V1 又只自动注入一个 primary Skill，因此把同一任务的后半程做成第二个可发现 Skill 会制造不必要的匹配、handoff 和完成语义分裂。

## Package

```text
server/src/skills/fertility-assessment/
├─ SKILL.md
├─ references/
│  ├─ assessment-framework.md
│  └─ report-contract.md
├─ runtime.ts
└─ runtime/
   └─ report-handoff.ts
```

职责：

- `SKILL.md`：路由、端到端 workflow、核心约束、完成标准、reference 指针；
- `references/assessment-framework.md`：评估信息域、维度结构、数据来源语义、医学安全边界；
- `references/report-contract.md`：报告 schema、统一事实源、HTML/PDF 渲染与降级；
- `runtime.ts`：Conversation Flow 的结构化状态与多轮推进；
- `runtime/report-handoff.ts`：内部报告执行阶段适配，确保最终 directive / trace 仍归属 `fertility-assessment`。

## Progressive disclosure

```text
L0 Manifest metadata
    ↓ match
L1 fertility-assessment/SKILL.md
    ↓ details needed
L2 references/assessment-framework.md
   references/report-contract.md
    ↓ execute
Conversation Flow Runtime / bounded report renderer
```

Reference 是上下文资源，不是另一个 Skill。
Runtime 是执行边界，不是另一个 Skill。

## Completion truth

以下都不是完整用户任务完成：

```text
访谈结束
assessment JSON ready
flowCompleted=true（仅子流程语义）
next.intent=generate_report
```

完整产品目标至少要求：

```text
assessment state ready
→ report generated from same state
→ inline report delivered
→ PDF available 时附加交付
```

PDF 转换失败允许降级，但不能丢失已生成的行内报告。

## Legacy internal key

当前 `fertility-assessment/runtime.ts` 仍会发出内部 handoff key：

```text
targetSkillId = fertility-report
```

该 key 仅用于兼容现有 one-shot handoff registry，不再对应可发现的 `SKILL.md`。
`runtime/report-handoff.ts` 会把执行结果重新归一到公开 Skill ID：

```text
skillId = fertility-assessment
```

后续若清理内部协议，可把 `targetSkillId` 重命名为更准确的 runtime/stage target；这不是本次 Skill package 边界调整的前置条件。