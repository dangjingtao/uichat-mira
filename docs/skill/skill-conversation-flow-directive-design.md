# Skill Conversation Flow / Directive 设计

Status: Implemented V1 / Verification Pending
Owner: chat / runtime / docs
Last verified: 2026-07-23
Layer: raw-source
Module: SKILL
Feature: SkillConversationFlow
Doc Type: design extension
Canonical: true
Related:
  - ./README.md
  - ./skill-context-design.md
  - ./skill-runtime-design.md
  - ./skill-package-runtime-contract.md
  - ../harness/agentgraph-harness-protocol.md

## Purpose

某些 Skill 不是一次性注入说明后就结束，而是要在多轮自然对话中持续收集信息、用代码和 TaskModel 分析用户回答、维护结构化状态，并在条件满足后把下一阶段交给 Mira 环境继续执行。

典型场景：

```text
生育力 / 备孕评估
深度访谈
需求澄清
商业诊断
职业画像
```

本页定义一个可选的 **Conversation Flow + SkillDirective** 增强层。

它不改变 Base Skill 的定义：

> **Skill 本体仍是通过渐进式披露向 Agent 动态注入领域知识、执行策略和能力使用说明的上下文能力包。**

---

## 1. 单点真相

> **会话型 Skill 自己负责领域流程是否完成、已经收集了什么、下一轮最值得问什么；Planner 仍保留全局 Agent nextAction 语义位置，并忠实执行有效 SkillDirective。**

职责分离：

```text
Skill Runtime
= 领域状态 + bounded TaskModel 分析 + 下一步领域指令

Planner semantic step
= 全局 nextAction 位置；对确定性 SkillDirective 可直接执行，不必重复调用 Planner TaskModel

Harness / ToolExposure
= 当前真正可调用的外部执行能力真相
```

Skill 代码、TaskModel、state 都不等于 Tool。

---

## 2. V1 实际链路

```text
Chat / Agent request
   ↓
SkillFlowCoordinator            ← AgentGraph 外层宿主扩展点
   ├─ 恢复 active Skill session
   ├─ userMessageId 幂等检查
   ├─ active Conversation Runtime
   │    ├─ bounded TaskModel
   │    ├─ patch structured state
   │    └─ produce SkillDirective
   └─ optional one-shot handoff
        └─ target Skill Runtime，例如 fertility-report
   ↓
compact SkillDirective
   ↓ requestContextMessages
AgentGraph / Pi loop（原拓扑不变）
   ↓
PrepareContext
   └─ 只匹配 / 披露 SkillContext，不执行业务副作用
   ↓
Planner semantic step
   ├─ collecting/final_confirmation -> deterministic ask_user
   ├─ ready + prepared delivery -> deterministic answer handoff
   └─ no valid directive -> 原 Planner TaskModel 路径
   ↓
Generate / Finalize
```

关键点：

- AgentGraph 拓扑不新增节点；
- 不新增 `use_skill` Planner action；
- 不新增第二 Agent Loop；
- 普通 Base Skill 完全不经过 Conversation Flow Runtime；
- 没有 active directive 时，Planner 行为保持原样。

---

## 3. 为什么 Runtime 不放进 PrepareContext

PrepareContext / SkillContext 必须保持可重复、轻量、无隐藏业务副作用。

禁止在普通 PrepareContext 中：

```text
调用多次 TaskModel
写 assessment state
推进 round
生成报告
执行 Skill handoff
```

否则 Graph retry / resume / re-entry 会产生重复分析和重复状态推进。

V1 把 Conversation Flow 放在 `createAndRunAgent` 进入 Agent runtime 之前的宿主协调层，并用稳定用户消息 id 做幂等。

PrepareContext 只读取已经准备好的 directive，用它固定当前 active Skill 的语义披露；不重新执行 Runtime。

---

## 4. SkillDirective 合同

概念结构：

```ts
type SkillDirective = {
  skillId: string
  sessionId: string
  phase: "collecting" | "final_confirmation" | "ready"
  flowCompleted: boolean

  round?: number
  maxRounds?: number

  requiredAction?: "ask_user"
  question?: string

  next?: {
    intent: string
    targetSkillId?: string
    args?: Record<string, unknown>
  }

  stateRef?: string

  // internal delivery payload，不进入 Planner TaskModel prompt
  delivery?: {
    kind: "markdown" | "inline_html"
    content: string
  }
}
```

完整业务 JSON 不进入 Planner。

---

## 5. collecting

示例：

```json
{
  "skillId": "fertility-assessment",
  "phase": "collecting",
  "flowCompleted": false,
  "round": 3,
  "maxRounds": 10,
  "requiredAction": "ask_user",
  "question": "你之前那次试管最后形成了几个可用胚胎？记不清精确数字也没关系。"
}
```

此时下一动作已经是确定性的：

```text
ask_user(question)
```

V1 的 Planner semantic wrapper 直接执行该动作，**不再花一次 Planner TaskModel token 去重新决定同一件事**。

这不是绕过 AgentGraph，而是 Planner 语义步骤对一个已验证、无外部副作用的 directive 使用 deterministic path。

没有 directive 时仍调用原 Planner TaskModel。

---

## 6. final_confirmation

当继续追问的边际价值已经较低，或达到最大轮次：

```json
{
  "skillId": "fertility-assessment",
  "phase": "final_confirmation",
  "flowCompleted": false,
  "requiredAction": "ask_user",
  "question": "我基本了解完整了。还有什么你觉得很重要、但我一直没问到的吗？没有的话直接告诉我‘没有了’就可以。"
}
```

最终开放确认只执行一次。

`maxRounds=10` 是安全上限，不是固定问卷长度。

3~5 轮足够时可以提前进入 final confirmation。

---

## 7. ready 与 bounded handoff

访谈完成后，评估 Skill 只声明下一步，不自己偷偷承担报告 Skill 的职责：

```json
{
  "skillId": "fertility-assessment",
  "phase": "ready",
  "flowCompleted": true,
  "next": {
    "intent": "generate_report",
    "targetSkillId": "fertility-report",
    "args": {
      "assessmentRef": "skill-flow:...",
      "reportType": "couple",
      "format": "markdown",
      "includeFemale": true,
      "includeMale": true
    }
  }
}
```

V1 不发明 `use_skill` action。

对于已经注册在 Mira Skill Host 内的纯内部 Context-Skill Runtime，`SkillFlowCoordinator` 允许一次 **bounded one-shot handoff**：

```text
fertility-assessment READY
   ↓ next.targetSkillId + args
SkillFlowCoordinator
   ↓ resolve registered handoff runtime
fertility-report Runtime
   ↓
prepared report delivery
   ↓
Planner semantic step -> answer
```

约束：

- 只允许已注册的 Skill handoff runtime；
- target 不存在时 fail closed，不假装执行成功；
- handoff 不获得任何 Tool 权限；
- handoff 不调用 Harness Tool；
- 不允许 nested / recursive autonomous Skill loop；
- V1 一次 Conversation turn 最多做一次 target handoff。

这是 Mira 宿主内部的上下文 Skill 执行，不是 Tool execution。

如果未来 Skill handoff 需要真实 Tool / MCP / 文件副作用，则必须回到 canonical Planner → Normalize → Policy → Tool → Evidence 路径，不能用本机制偷跑。

---

## 8. TaskModel 的角色

TaskModel 是 Skill Runtime 可以使用的 bounded brain service。

允许：

```text
用户自由叙述
→ factsPatch
→ missing / uncertainty / contradiction
→ 每次最多分析 1~2 个维度
→ nextQuestion
```

报告阶段也可以：

```text
每次 1~2 个缺失维度
→ 写入结构化 JSON
→ 最后小型 summary call
→ deterministic renderer
```

禁止：

```text
Skill Runtime
→ 自己形成自治 Agent loop
→ 无限调用模型
→ 自己调用所有 Tool
→ 绕过 Planner / Policy / Evidence
```

---

## 9. State 真相

会话历史不是业务数据库。

Conversation Flow 使用最小结构化 state：

```json
{
  "facts": {},
  "dimensions": {},
  "missingCriticalFields": [],
  "uncertainties": [],
  "contradictions": [],
  "summary": {},
  "report": {}
}
```

每轮 TaskModel 返回 patch，不重写全部 state。

用户口述的检查结果必须保留 provenance 语义：

```text
source = user_reported
```

不得伪装成已读取原始化验单。

V1 session 按 `userId + threadId` 本地持久化；同一 `userMessageId` 已处理时复用上次 directive，避免 retry 重复推进。

显式取消流程或显式切换到另一个 Skill 时，active flow 可以退出。

---

## 10. SkillDirective 不是 Evidence

禁止把：

```text
流程还没结束
下一题请问 XXX
```

伪装成 Evidence。

Evidence 继续表示：

```text
Tool / Retrieve / Policy / execution facts
```

如果 Skill 真正使用 Tool / Retrieve：

```text
Tool / Retrieve
→ Evidence
→ accepted
→ Skill state reduction（如需要）
```

现有 Evidence 合同不变。

---

## 11. Report rendering

报告内容来自统一结构化 state：

```text
assessment JSON
→ dimensions / summary
→ one Report ViewModel truth
→ Markdown delivery
→ HTML print view
→ optional future PDF
```

HTML 与后续 PDF 不允许分别让 LLM 重新写两套结论。

字段保持一致：

```text
id
score | null
confidence
dataCompleteness
evidence
strengths
concerns
missingEvidence
interpretation
actions.selfCare
actions.discussWithClinician
actions.testsToConsider
```

信息不足允许 `score=null`。

维度分数不是怀孕概率。

---

## 12. 生育力评估产品原则

```text
用户对话轮数 != 维度数量 != TaskModel 调用次数
```

前台：

```text
第1轮：自由讲整体情况
第2轮起：只追最高价值缺口
3~5轮能完成就提前结束
最多10轮
最后一次：还有什么重要但没问到？
```

后台可以慢：

```text
每轮 facts patch
+ 最多1~2维分析
+ READY 后按1~2维批次补齐
+ summary
+ renderer
```

核心体验：

> **用户负责讲故事，Mira 负责偷偷填表。**

---

## 13. Medical safety

首个 fertility Skill 必须遵守：

- 用于健康教育、信息整理、就诊准备，不替代诊断与治疗；
- 不根据单一 AMH / AFC 直接推出“卵子质量”或自然受孕概率；
- 不把报告维度分数描述成怀孕概率；
- 不提供处方药调整；
- 不输出个体化药物或补充剂剂量方案；
- 不把免疫、凝血、精子 DNA 碎片等检查写成所有人的常规必查项；
- 需要医疗决策的内容归入“与生殖科 / 男科医生讨论”；
- 原始报告未上传时，所有实验室数据明确按 user_reported 处理。

---

## 14. V1 实现位置

```text
server/src/skills/flow/types.ts
server/src/skills/flow/context.ts
server/src/skills/flow/state-store.ts
server/src/skills/flow/registry.ts
server/src/skills/flow/coordinator.ts

server/src/skills/fertility-assessment/SKILL.md
server/src/skills/fertility-assessment/runtime.ts

server/src/skills/fertility-report/SKILL.md
server/src/skills/fertility-report/runtime.ts

server/src/agent/index.ts
server/src/agent/nodes/next-action-planner.ts
server/src/agent/nodes/prepare-context.ts
server/src/agent/nodes/harness-generate-context.ts
```

实现保持：

```text
AgentGraph topology unchanged
ToolExposure truth unchanged
Policy unchanged
Approval unchanged
Harness unchanged
```

---

## 15. Hard Rules

1. Skill 本体仍是渐进式披露的动态上下文能力包。
2. Conversation Flow 是 optional 增强，不把所有 Skill 状态机化。
3. Skill 不是 Tool；内部代码、TaskModel、state 不进入 ToolExposure。
4. 不新增 `use_skill` Planner action。
5. 不新增第二 Agent Loop。
6. PrepareContext 不执行 Conversation Runtime 副作用。
7. 同一用户消息必须幂等，retry 不重复推进业务 round。
8. Active Skill 未完成时，领域 completion truth 归 Skill Runtime。
9. 对确定性的 `ask_user` directive，Planner semantic step可以 deterministic 执行，不重复消耗 Planner TaskModel。
10. SkillDirective 不是 Evidence。
11. Tool / Retrieve 的真实结果仍必须先进入 Evidence。
12. `state.toolExposure` 仍是 Planner 工具面的唯一真相。
13. SkillDirective 不授予权限、不扩大 ToolExposure、不绕过 Policy / Approval / Sandbox。
14. 完整 Skill state 不反复注入 Planner，只传紧凑 directive。
15. TaskModel 只做 bounded domain work，不形成自治 Agent loop。
16. Context-Skill handoff 只允许已注册、无外部副作用的 bounded runtime；真实副作用必须回 canonical Agent execution path。
17. 最大轮次是上限，不是问卷长度。
18. 报告必须由统一结构化数据驱动，不允许不同格式各写一套结论。
