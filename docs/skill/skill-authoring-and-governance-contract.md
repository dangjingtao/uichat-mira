---
status: required-target
owner: skill-runtime / agent-runtime / security
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillAuthoringGovernance
doc_type: normative-contract
canonical: true
related:
  - README.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-runtime-design.md
  - skill-package-runtime-contract.md
  - skill-contract-audit-20260806.md
---

# Skill 编写、执行与治理规范

> 本页定义 Mira Skill 的目标约束。它是新建、迁移、审查和验收 Skill 的规范，不代表当前代码已经全部满足；当前差距见 `skill-contract-audit-20260806.md`。

文中：

- **MUST / 必须**：违反即不能进入 public Registry 或不能执行对应路线；
- **MUST NOT / 禁止**：违反属于边界错误；
- **SHOULD / 应**：允许有明确理由的例外，但必须记录；
- **MAY / 可以**：可选能力。

---

## 1. Skill 的正式定义

Skill 是一个有稳定身份的领域能力包：

```text
Package identity
+ Routing metadata
+ Domain instruction
+ optional Resources
+ Execution responsibility declaration
+ Completion contract
+ optional Capability requirements
+ optional Stateful Flow binding
```

Skill 负责表达：

1. 什么时候应该命中；
2. 该领域如何做；
3. 哪些行为禁止；
4. 需要什么能力；
5. 什么才算完成。

Skill **不是** Tool、权限、Runtime、任意脚本执行许可、第二套 Agent 系统或自动获得的长期状态。

---

## 2. 三种执行责任类型

每个 public Skill 必须显式选择一种 `execution.mode`。禁止由运行时根据“有没有工具”猜测。

### 2.1 `context-only`

适用于：

- 写作风格、评审方法、思考框架；
- 需要完整主对话语境；
- 不需要独立工具循环、Artifact ownership 或审批恢复；
- 结果本来就是 Parent 的用户回答。

执行链：

```text
SkillContext
-> Parent Planner / Generate
-> user-facing answer
```

约束：

- MUST NOT 创建 Skill-owned SubAgent；
- `requestedTools`、`requestedRuntimes` 必须为空；
- `workspaceBound` 必须为 `false`；
- 用户对话、追问和完成判断都属于 Parent；
- 可以多轮 continuation，但继承的是任务上下文，不是隐藏状态机。

当前适配对象：

```text
black-mirror-writer
product-critic
deep-interview
```

`deep-interview` 默认仍是 context-only：它依赖 Parent 已有的相关对话历史做动态追问。只有未来需要结构化访谈档案、确定性阶段和跨会话恢复时，才升级为 `stateful-flow`。

### 2.2 `delegated-worker`

适用于：

- 有边界明确的专业工作包；
- 需要连续 Tool / Runtime 调用；
- 需要 Artifact、Evidence、审批、修复或任务内验收；
- Parent 不应亲自拼底层执行参数。

执行链：

```text
Parent goal + acceptance
-> one bounded Skill worker
-> governed capability loop
-> Evidence / Artifact / Requirement / Deliverable
-> Parent governance and delivery
```

约束：

- 最多一层 Worker，禁止 nested delegation；
- Worker 只拥有 task-local goal，不拥有 global goal；
- Worker MUST NOT 直接向用户说话；
- Worker MUST NOT 选择未经注册的 executable、shell、Provider、Runtime 或 MCP；
- `completed` 必须满足 route-specific completion evaluator；
- 内容型交付必须通过 `deliverables` 或 Artifact 返回，不能把完整产物挤进 `summary`；
- `summary` 只用于 Parent 理解执行结果，不是默认用户交付物。

当前适配对象：

```text
docx
pdf
pptx
xlsx（仅 ready 路线）
github-collaboration
```

### 2.3 `stateful-flow`

适用于：

- 多轮维护结构化业务状态；
- 有明确 phase / round / requirements；
- 需要 checkpoint / resume / cancel；
- 访谈结束不等于最终交付完成；
- 需要确定性 reducer、评分器或 renderer。

执行链：

```text
Parent user turn
-> deterministic Flow / Reducer
-> structured projection / requirements / delivery
-> Parent asks or delivers
```

约束：

- Flow 是该 Skill 的单一业务控制器；
- MUST NOT 再叠一个自由 Skill Worker loop；
- 完整 state 只存在于 Flow Store；
- Parent 只读取最小 projection；
- Flow 返回业务 requirement，不直接决定用户措辞；
- internal handoff 仍属于同一个 public Skill；
- 禁止注册影子 Skill 承担内部报告阶段。

当前适配对象：

```text
fertility-assessment
```

建议迁移对象：

```text
miradocs
```

MiraDocs 已经声明固定阶段、staging、checkpoint、审批恢复和部署验证；这超出了普通临时 Worker 的可靠状态能力。

---

## 3. Canonical Manifest

目标实现必须使用真实 YAML parser + schema validation。禁止继续把“看起来像 YAML”的文本用无诊断字符串切割长期承载正式合同。

推荐结构：

```yaml
id: product-critic
displayName: 产品批判官
description: 从用户价值、复杂度和失败路径评审产品方案
version: 1.0.0
publisher: Mira Lab
category: 工程研发
visibility: public
lifecycle: current
license: Proprietary

routing:
  aliases: [产品批判, 产品评审, MVP 评审]
  intents: [product_review, mvp_scope_review]
  negativeHints: [只查当前线上数据]

execution:
  mode: context-only
  workspaceBound: false
  requestedTools: []
  requestedRuntimes: []

completion:
  kind: parent-answer
  criteria:
    - 给出明确判断
    - 指出最大风险
    - 给出最小下一步
```

### 3.1 必需字段

- `id`：稳定、ASCII、`^[a-z0-9][a-z0-9_-]{1,63}$`；
- `displayName`；
- `description`；
- `version`：合法 SemVer；
- `publisher`；
- `category`；
- `visibility`；
- `lifecycle`；
- `execution.mode`；
- `completion.kind`。

### 3.2 Lifecycle

```text
review
current
deprecated
blocked
```

规则：

- `review`：Catalog 可在开发模式显示，生产 Matcher MUST NOT 自动命中；
- `current`：可公开匹配；
- `deprecated`：仅允许 continuation / explicit compatibility，不参与普通新匹配；
- `blocked`：不可发现、不可执行。

`status` 或 `lifecycle` 不能只是装饰字段。

### 3.3 未知字段与兼容字段

- 未知字段 SHOULD 产生诊断；
- execution / routing / identity 的无效字段 MUST fail closed；
- 兼容别名必须有迁移期限、trace 和测试；
- 运行时不得静默把一个合法枚举值改成另一个值。

---

## 4. Package 身份、来源与信任必须分离

当前目录来源不能同时承担权限信任语义。目标模型至少区分：

```text
origin
= built-in | bundled | user | external

trustTier
= system | signed-first-party | user-authored | untrusted-third-party
```

规则：

1. `publisher` 文本不能提升 trustTier；
2. user / external 包即使声明一个已知 Runtime id，也不能获得该 Runtime；
3. 同一个 Skill id + version 的执行授权必须绑定 publisher / package digest；
4. 源码目录中的 public Skill 不因“跟产品代码放在一起”自动拥有系统 Runtime；
5. 任何 package 内容变更导致 digest 改变时，签名或授权必须重新验证。

---

## 5. 声明需求不等于授予能力

Skill Package 中只能声明：

```text
requestedTools
requestedRuntimes
route requirements
```

真正的能力授予来自独立产品真相源：

```text
Skill Capability Grant Registry
(skill id + version + publisher/digest)
-> granted Harness tools
-> granted private Runtime bindings
-> route-specific limits
```

最终 Child 能力：

```text
trusted grant
∩ environment registered/healthy
∩ route requirement
∩ workspace boundary
∩ Policy / exact Approval
```

注意：

- Child capability envelope 可以由受信任 grant 独立构建，不要求修改 Parent `state.toolExposure`；
- 但它必须可追踪为 `childCapabilityGrant`，禁止伪装成 Skill Markdown 自己授予；
- user / untrusted package 默认 grant 为空；
- private Runtime 的“名字已知”不等于“该 Skill 有权使用”。

---

## 6. Route-specific Capability Contract

禁止用一个扁平列表表达复杂 Skill 的全部路线，然后采用“至少有一个能力 ready 就继续”的判断。

推荐：

```yaml
routes:
  inspect:
    requiredAll: [office_spreadsheet]
  create:
    requiredAll: [wenshu_xlsx_xml_runtime]
  edit:
    requiredAll: [wenshu_xlsx_xml_runtime]
  verify:
    requiredAny: [office_spreadsheet, wenshu_xlsx_xml_runtime]
```

规则：

- 路由确定后才计算 eligibility；
- 缺少当前路由 required capability 必须结构化阻断；
- 其它未使用路线的 capability 缺失不得阻断；
- partial readiness 必须出现在 Trace；
- 禁止把一个 read/inspect Runtime 当作 create/edit Runtime 的替代证明。

---

## 7. Routing Contract

路由元数据属于 Skill Package，Matcher 只实现通用算法。

Package 可声明：

- aliases；
- intent labels；
- file extensions / MIME；
- positive hints；
- negative hints；
- explicit trigger；
- conflict group。

禁止：

- 长期在 Matcher 代码里维护逐 Skill 关键词词典；
- 新 Skill 只能靠 id / displayName 才能命中；
- 类型声明支持 `embedding`，实现却没有对应路径且无诊断；
- 多个同分候选依赖文件系统或插入顺序决定 primary。

### 7.1 Duplicate id

发现重复 `id` 时 MUST fail closed 并输出冲突诊断。禁止静默 first-wins。

系统 Skill 优先级必须由显式 trust / registry 决定，不能依赖 `readdir()` 顺序。

### 7.2 一个 primary

V1 正常任务最多自动激活一个 primary Skill。冲突无法可靠消解时：

- 保留候选 Trace；
- 由 Parent 澄清或选择；
- 不同时注入多个完整 SKILL.md。

---

## 8. Continuation 与输入上下文

### Context-only

Parent 应获得：

- 当前用户消息；
- 最近相关对话；
- anchored global/current goal；
- 当前 completion criteria；
- primary SkillContext。

### Delegated-worker

Worker 首次输入必须包含：

```text
anchored goal
current subtask
acceptance criteria
relevant confirmed facts
current user delta
```

禁止只把本轮短回复当成完整 goal。

### Resume

- Approval resume 必须绑定 exact invocation + transcript checkpoint；
- 普通 `needs_input` 若要求继续同一个 Worker，也必须有明确 resume token/checkpoint；
- 没有 checkpoint 时应定义为“基于 Parent 重新委派”，不能假装恢复原 Worker；
- Stateful Flow 使用自己的 session / reducer state，不复用自由模型 transcript 充当业务数据库。

---

## 9. 用户对话边界

Parent 是唯一用户对话所有者。

Worker / Flow 返回：

```ts
{
  id: string
  kind: "user_input" | "evidence" | "resource" | "capability"
  description: string
  requiredFor: string
  acceptedFormats?: string[]
  sensitivity?: "normal" | "personal" | "health" | "financial"
}
```

规则：

- `description` 是业务缺口，不是最终用户问题；
- Child MUST NOT 通过 `question`、`userPrompt` 或 Markdown 指令直接控制用户界面；
- Parent 根据全局目标、已知信息、语气和安全政策组织问题；
- Parent 可以采用 Flow 提供的非强制 `suggestedPrompt`，但必须经过用户对话层处理；
- 用户已提供的信息不得重复询问。

---

## 10. Result 与 Completion Contract

### 10.1 Worker result

```ts
{
  status: "completed" | "insufficient_evidence" | "needs_input" | "failed"
  summary?: string
  deliverables: Array<
    | { kind: "text"; content: string }
    | { kind: "artifact"; artifactRef: string }
    | { kind: "structured"; data: unknown }
  >
  evidenceRefs: string[]
  requirements?: SkillRequirement[]
  missingEvidence?: string[]
  recoverable?: boolean
  checkpointRef?: string
}
```

### 10.2 Completion proof

`completed` 只有在 route-specific evaluator 通过时有效。

示例：

```text
DOCX create
-> requested artifact exists
-> artifact readable
-> requested structure present

GitHub write
-> approved invocation completed
-> current remote object was read back
-> resulting id/SHA/state matches intent

PPTX create
-> protocol valid
-> renderer success
-> .pptx artifact exists

Context-only critique
-> Parent answer covers declared criteria
```

禁止：

- 任意一个 Tool 产生过 Evidence 就自动视为整个任务完成；
- malformed completion envelope 因为存在中间 Artifact 而无条件升级为 completed；
- 只有 `summary`、没有完整 Deliverable，却宣称内容创作完成；
- Skill Markdown 自己写了“必须验证”，但 runtime 没有 evaluator 仍标记强完成。

---

## 11. Resource 与 Script Contract

Resources 分为：

```text
reference
template
example
script
```

规则：

- reference/template/example 默认只读；
- script 被读取或 materialize 不等于获得执行许可；
- packaged script 必须通过受管 Script Runtime，以 `skillId + resourceUri + digest + args` 调用；
- 禁止把通用 `terminal_session` 当作 packaged script 的默认 launcher；
- 禁止把脚本文本复制成行内 shell；
- script 依赖、license、digest 和入口必须进入 package manifest / build verification；
- untrusted script 默认不可执行。

---

## 12. Workspace Contract

```text
skillRoot != runtimeRoot != workspaceRoot
```

- 所有用户输入、输出和 staging 必须落在绑定 workspace 或受管 Artifact Store；
- `workspaceBound=true` 没有 workspace 时必须在执行前阻断；
- 不得写入 Skill package 自身；
- 不得污染用户全局 Python / Node / shell 配置；
- staging 必须任务隔离、可追踪、可恢复、显式清理。

---

## 13. Approval 与 Side Effect

- read/write 必须在 Tool 定义层区分；
- Side-effecting invocation 使用 exact input hash；
- Approval 一次一用，不可跨 invocation 复用；
- Skill 不得在 prompt 中自行声明“已获批准”；
- 远程写入前读取当前事实，执行后回读；
- 破坏性动作必须显示精确对象与影响；
- 重试必须满足幂等或先回读状态。

---

## 14. High-stakes Skill

健康、法律、金融等高风险 Skill 还必须声明：

- safety domain；
- 禁止输出范围；
- 紧急/不适用路由；
- 数据敏感级别；
- 来源版本；
- deterministic validator；
- 何时必须降级为一般信息或建议咨询专业人员。

医学评分、风险分层或建议不能只靠 SKILL.md prompt 自律；关键边界必须由 Runtime / Policy / validator 执行。

---

## 15. Trace 与诊断

至少记录：

- package id/version/publisher/digest/trustTier；
- lifecycle / routing source / candidate conflicts；
- execution.mode；
- capability request 与 actual grant；
- environment readiness；
- route eligibility；
- workspace；
- disclosed resources；
- requirements；
- Evidence / Artifact / Deliverable；
- approval / resume；
- completion evaluator result；
- terminal status。

任何兼容默认、别名迁移或静默降级都必须可见；正式合同字段不得无声忽略。

---

## 16. Public Skill 验收门槛

一个 Skill 进入 `visibility=public + lifecycle=current` 前必须通过：

1. Manifest schema validation；
2. duplicate id / trust precedence 测试；
3. positive、negative、conflict routing 测试；
4. execution.mode 合法性测试；
5. capability privilege-escalation 测试；
6. route-specific readiness 测试；
7. continuation / needs_input / resume 测试；
8. completion evaluator 测试；
9. approval one-shot 与回读验证测试；
10. package resource/build completeness 测试；
11. high-stakes safety tests（适用时）；
12. Trace acceptance。

任一 P0 失败：

```text
lifecycle = blocked
或
对应 route disabled
```

不能依赖 Markdown Hard Rules 代替执行约束。

---

## 17. 当前迁移原则

1. 先把纯上下文 Skill 从“一律 fork”中拆出；
2. 建立独立 Capability Grant Registry，堵住 Runtime ownership；
3. 用真实 YAML schema 取代兼容解析；
4. 把 routing truth 移回 Package；
5. 增加 route-specific eligibility 与 completion evaluator；
6. 再迁移 MiraDocs 的 durable Flow；
7. 最后删除 `LEGACY_OFFICE_EXECUTION`、旧 aliases 与不可达枚举。

迁移期间，当前实现行为与目标合同不一致的地方必须在审计文档中明确，不能把目标写成“已经完成”。
