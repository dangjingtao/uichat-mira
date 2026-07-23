# Skill Conversation Flow / Directive 设计

Status: Current Design Decision
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

这页记录一种真实需要：某些 Skill 不是一次性注入说明后就结束，而是需要在多轮自然对话中持续收集信息、用代码和 TaskModel 分析用户回答、维护结构化状态，并在条件满足后把下一阶段明确交还给 Planner。

典型例子：

```text
生育力 / 备孕评估
深度访谈
需求澄清
商业诊断
职业画像
```

本设计的目标不是新增第二 Agent，也不是把 Skill 伪装成 Tool，而是在现有 SkillContext 与 Planner 之间增加一个很薄的、可选的 **SkillDirective** 合同。

---

## 1. 单点真相

> **当一个有状态的会话型 Skill 正在进行时，领域流程是否完成、下一轮最应该问什么，由 Skill 自己负责；Planner 仍是全局 Agent 动作控制器，并忠实执行 Skill 提供的当前流程指令。**

因此：

```text
Skill Runtime
= 领域流程状态 + 用户回答分析 + 下一步领域指令

Planner
= 全局 nextAction 控制 + 跨能力协调

ToolExposure / Harness
= 当前真正可执行的能力真相
```

三者不能混成一个东西。

---

## 2. 不采用的方案

### 不把 Skill 伪装成 Tool

禁止为了让 Skill 能维护流程而创建一个假的业务 Tool：

```text
fertility_assessment Tool
```

如果它本质只是 Mira 环境赋予 Agent 的上下文技能，就应保持 Skill 身份。

Skill 内部代码、状态和 TaskModel 调用不等于 Tool。

### 不拦截 / 替换 Planner

不新增：

```text
Skill Router -> bypass Planner
```

也不在 Planner 节点里写 fertility 等业务特判。

Planner 继续存在，Skill 通过结构化 directive 告诉 Planner：

```text
流程还没完
下一步问这句
```

或：

```text
流程已完成
可以进入报告生成
这里是参数
```

### 不在 PrepareContext 里偷偷执行副作用

PrepareContext / SkillContext 匹配与披露必须保持可重复、轻量、无隐藏业务副作用。

禁止把以下动作偷偷塞进普通 SkillContext prepare：

```text
TaskModel 大量调用
写 assessment.json
推进业务 round
重复触发外部执行
```

具体 Skill Runtime Host hook 的代码落点可以后续实现时确定，但合同上必须保证：

- 不因 Graph retry / re-entry 重复消费同一用户消息；
- 不把普通 SkillContext prepare 变成隐藏业务执行器；
- 进入 Planner 前可以得到当前 active Skill 的紧凑 directive。

---

## 3. Conversation Flow 总体链路

```text
用户回答
   ↓
Active Skill Runtime
   ├─ 读取当前 Skill state
   ├─ bounded TaskModel 分析本轮回答
   ├─ 更新结构化 JSON state
   ├─ 判断信息完整度 / 缺口 / 冲突
   └─ 由代码生成当前 SkillDirective
   ↓
SkillDirective
   ↓
Planner
   ├─ collecting -> ask_user
   ├─ final_confirmation -> ask_user
   └─ ready -> 恢复正常全局规划，进入报告生成等后续动作
```

这里没有第二 Agent Loop。

TaskModel 是 Skill Runtime 可以使用的 Mira 宿主脑力服务，不拥有全局 nextAction 控制权。

---

## 4. SkillDirective 概念合同

V1 先保持极小，不把完整业务 JSON 塞给 Planner。

概念结构：

```ts
type SkillDirective = {
  skillId: string
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
}
```

这只是概念合同，不提前拍死数据库 schema 或最终 TypeScript 字段名。

### collecting

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

Planner 不需要重新分析“下一题应该问什么”。

它只需要忠实把当前领域流程推进为：

```text
ask_user(question)
```

### final_confirmation

当信息已经基本足够，或达到最大轮次后，Skill 进入一次最终开放确认：

```json
{
  "skillId": "fertility-assessment",
  "phase": "final_confirmation",
  "flowCompleted": false,
  "requiredAction": "ask_user",
  "question": "我基本了解完整了。还有什么你觉得很重要、但我一直没问到的吗？"
}
```

这是最后一次补充机会，不进入无限问卷。

### ready

最终补充被分析并合并后：

```json
{
  "skillId": "fertility-assessment",
  "phase": "ready",
  "flowCompleted": true,
  "next": {
    "intent": "generate_report",
    "targetSkillId": "fertility-report",
    "args": {
      "assessmentRef": "...",
      "reportType": "couple",
      "format": "html"
    }
  }
}
```

这时 Skill 不再要求 Planner 继续提问。

Planner 恢复正常全局规划，基于当前真实环境、Skill 可用性与 canonical ToolExposure / Policy 决定如何完成后续动作。

`next` 是执行意图和推荐参数，不授予权限，也不能凭空制造一个未注册 Tool。

---

## 5. Planner 合同

当存在 active SkillDirective 时：

### flowCompleted = false

Planner 必须理解：

```text
当前领域流程尚未完成
```

规则：

1. 不得自行宣布该 Skill 的领域流程已经完成；
2. `requiredAction=ask_user` 且存在明确 `question` 时，优先忠实输出该 ask_user；
3. 不要再次用 Planner 自己重新设计同一轮领域问题；
4. 用户明确取消 / 切换任务，或更高优先级安全 / Policy 条件出现时，仍按全局 Agent 合同处理；
5. SkillDirective 不扩大 ToolExposure，不绕过 Normalize / Policy / Approval。

### flowCompleted = true

Skill 已完成自己的领域阶段。

Planner 可以读取 `next.intent / targetSkillId / args` 作为后续执行上下文，但仍必须通过现有合法路径执行。

因此：

> **Skill 决定自己的领域流程什么时候完成；Planner 决定整个 Agent 任务下一步怎么执行。**

---

## 6. TaskModel 在这里的角色

TaskModel 可以被 active Skill Runtime 以 bounded subcall 使用，例如：

```text
用户回答
→ 抽取事实 patch
→ 更新 JSON
→ 分析 1~2 个维度
→ 找最高价值缺口
→ 代码决定下一问
```

允许：

- 用户自然语言 -> 结构化 facts patch；
- 小范围归一化 / 冲突识别；
- 每次生成 1~2 个维度；
- gap analysis；
- 最终小块综合。

不允许把它变成：

```text
Skill 内部另起一个自治 Agent
→ 自己无限循环
→ 自己调用所有 Tool
→ 自己决定全局任务完成
```

TaskModel 输出应小而结构化。

完整业务状态留在 Skill Runtime / state storage，不进入每轮 Planner prompt。

---

## 7. State 与上下文预算

会话历史不是业务数据库。

复杂会话 Skill 应维护自己的最小结构化状态，例如：

```json
{
  "profile": {},
  "facts": {},
  "dimensions": {},
  "missing": [],
  "uncertainties": [],
  "redFlags": [],
  "recommendations": [],
  "meta": {}
}
```

每轮 TaskModel 只返回 patch，不重写全量 JSON。

Planner 只看到紧凑 SkillDirective，例如几十到几百 token：

```json
{
  "phase": "collecting",
  "flowCompleted": false,
  "requiredAction": "ask_user",
  "question": "..."
}
```

不要把整个 `assessment.json` 反复注入 Planner。

---

## 8. Evidence 边界

SkillDirective 不是 Evidence。

禁止为了“让 Planner 相信流程没结束”把以下内容伪装成 Evidence：

```text
请继续问用户这个问题
当前 Skill 还没结束
```

Evidence 继续表示真实执行 / 检索 / Policy 事实。

用户直接告诉 Mira 的内容属于 conversation-derived state，可以带 provenance：

```text
source = user_reported
```

如果 Skill 使用真实 Tool / Retrieve 获得数据，则仍必须：

```text
Tool / Retrieve
→ Evidence
→ accepted
→ Skill state reduction
```

现有 Evidence 真相合同不改。

---

## 9. 生育力评估首个验证场景

### 产品原则

```text
用户对话轮数 != 维度数量 != TaskModel 调用次数
```

不做固定十轮问卷体验。

推荐前台体验：

```text
第一轮：用户自由讲整体情况，Mira 偷偷结构化
第二轮：追最高价值缺口
第三轮：生活方式 / 个性化目标等缺口
后续：按信息完整度自适应
最多 10 轮
最后固定一次开放确认：还有什么重要信息我没问到？
```

3~5 轮能完成就提前结束，不强制问满 10 轮。

10 轮是安全上限，不是产品进度条。

### 内部处理

```text
每轮用户回答
→ TaskModel 抽 facts patch
→ 可选分析 1~2 维
→ merge assessment JSON
→ 计算 missing / uncertainties / contradictions
→ 代码选择下一问
→ SkillDirective.collecting
```

达到信息充分或 round 上限：

```text
SkillDirective.final_confirmation
→ “还有什么你觉得很重要、但我一直没问到的吗？”
```

最后一次回答处理完：

```text
SkillDirective.ready
→ 给 Planner 报告生成 intent + args
→ Planner 继续正常 Agent 流程
```

报告字段应由统一结构化数据模型驱动：

```text
assessment JSON
→ Report ViewModel
→ inline HTML
→ optional PDF
```

HTML / PDF 不应分别让 LLM 重新生成两套内容。

---

## 10. Token / Cost Tradeoff

这套设计会比直接绕过 Planner 多一次模型控制成本：

```text
TaskModel 分析用户回答
→ SkillDirective
→ Planner 再输出 nextAction
```

V1 接受这笔 token 税，优先换取：

- 不改 AgentGraph 拓扑；
- Planner 始终保留全局控制；
- 中途跑题 / 工具 / 其他能力仍能被 Agent 接住；
- Skill 流程状态可解释、可观察。

不要为了省这几百 token 立即增加特殊 fast path。

未来若真实成本证明值得优化，可以考虑：

```text
requiredAction = ask_user
+ 无跨能力需求
→ deterministic fast path
```

但这不是 V1 当前合同。

---

## 11. 与 Base Skill / Stateful Runtime 的关系

```text
Base Skill
= Progressive Disclosure + SkillContext

Optional Conversation Flow
= state + bounded TaskModel analysis + SkillDirective

Full Stateful Skill Runtime
= 更强的 stage / checkpoint / resume / Evidence reducer / tool narrowing / lifecycle
```

Conversation Flow 是按需增强，不是所有 Skill 的最低要求。

纯 Markdown Skill 仍然完全合法：

```text
my-skill/
└── SKILL.md
```

只有真实需要多轮结构化收集、领域 completion truth 和代码控制下一问时，才需要 state / directive。

---

## 12. Hard Rules

1. Skill 本体仍是渐进式披露的动态上下文能力包。
2. Conversation Flow 是 optional 增强，不把所有 Skill 强行状态机化。
3. Skill 不是 Tool；内部代码 / TaskModel / state 不等于 ToolExposure。
4. 不新增 `use_skill` Planner action。
5. 不新增第二 Agent Loop。
6. 不在 PrepareContext 偷偷做不可幂等的业务副作用。
7. Active Skill 未完成时，领域 completion truth 归 Skill Runtime。
8. Planner 仍是全局 nextAction 控制器，并应忠实执行有效 SkillDirective。
9. SkillDirective 不是 Evidence，不污染 Evidence 语义。
10. Tool / Retrieve 真实结果仍必须先进入 Evidence。
11. `state.toolExposure` 仍是 Planner 可调用工具面的唯一真相。
12. SkillDirective 不授予权限、不扩大 ToolExposure、不绕过 Policy / Approval / Sandbox。
13. 完整 Skill state 不反复注入 Planner，只注入最小 directive。
14. TaskModel 只做 bounded domain analysis，不在 Skill 内形成自治 Agent loop。
15. 对话型调查应自适应完成；最大轮次是上限，不是强制问卷长度。
16. 最终 handoff 应携带明确 next intent / args，但真实执行仍服从当前 Agent / Harness 合同。
