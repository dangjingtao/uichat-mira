---
status: current
owner: skill-runtime
last_verified: 2026-08-06
layer: wiki
module: SKILL
feature: SkillSystem
doc_type: current-contract
canonical: true
related:
  - ../AGENT_CURRENT_TRUTH.md
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-runtime-design.md
  - skill-package-runtime-contract.md
  - ../harness/agentgraph-harness-protocol.md
---

# Skill 模块当前合同

> 本页记录当前代码真相，并指向目标治理规范。当前实现与目标规范存在的差距不能靠文档措辞掩盖，统一记录在 `skill-contract-audit-20260806.md`。

## 1. Skill 本体

Skill 是可复用的领域能力包：

```text
Manifest
+ SKILL.md
+ optional Resources
+ execution responsibility declaration
+ completion contract
+ optional capability requirements
+ optional Conversation Flow binding
```

它表达：

- 什么时候应命中；
- 该领域应该怎么做；
- 哪些行为禁止；
- 需要什么能力；
- 什么才算完成。

Skill 不是 Tool、权限、Runtime Pack、任意脚本执行许可、第二个 Agent 系统或自动获得的长期状态。

## 2. 当前实现与目标规范

### 当前代码行为

当前兼容实现中：

```text
普通 matched Skill
-> forked Skill-owned SubAgent

Flow-backed Skill
-> deterministic Conversation Flow controller
```

`resolveSubAgentExecutionProfile()` 当前会把普通 Skill 统一归一为 forked subAgent。该行为是**当前代码事实**，不是新 Skill 的目标 authoring 规范。

### 目标规范

目标执行责任分为：

```text
context-only
  Parent 直接使用 SkillContext

delegated-worker
  一个有边界的 Skill Worker 负责工具、产物与任务内验收

stateful-flow
  确定性 Flow / Reducer 负责结构化多轮业务状态
```

完整约束见：

```text
docs/skill/skill-authoring-and-governance-contract.md
```

当前把所有普通 Skill 一律 fork 已经被审计为过度统一。以下 Skill 应迁移回 `context-only`：

```text
black-mirror-writer
product-critic
deep-interview
```

MiraDocs 已经提出 durable phase/checkpoint 需求，应评估迁移到 `stateful-flow`，而不是继续依赖普通临时 Worker。

## 3. 必须分开的真相源

```text
Package / Routing
= Skill 是谁、何时命中

SkillContext
= 当前任务应掌握的领域知识与约束

Execution responsibility
= Parent context、delegated Worker 或 Stateful Flow

Capability request
= Skill 声明它需要什么

Capability grant + environment readiness
= 产品允许且当前真实可用什么

Policy / Approval
= 本次 exact invocation 是否允许

Completion evaluator
= 当前 route 是否真的完成
```

因此：

```text
Skill match
!= capability grant
!= runtime ready
!= permission granted
!= task completed
```

当前 Capability grant 仍分散在 built-in Registry、legacy Office profile 和 adapter map 中，尚未形成独立真相源；这是已确认的 P0 迁移项。

## 4. Progressive Disclosure

```text
L0 Manifest
  -> match
L1 SKILL.md
  -> routing / rules / completion
L2 Resource
  -> reference / template / example / script metadata
Execution Boundary
  -> governed Tool / managed Runtime / Flow
```

Scanner 启动时只读取有限 frontmatter，不预加载全部正文和 resources。V1 自动激活最多一个 primary Skill；L2 默认按需读取。

当前 frontmatter parser 仍是兼容性 flat parser，不是完整 YAML parser。正式目标为真实 YAML + schema validation；嵌套字段、生命周期和未知字段当前可能被忽略，不能把“写进文件”当成“系统已经识别”。

## 5. Routing

当前 Matcher 支持：

- explicit trigger；
- attachment extension / MIME；
- id / name；
- 少量硬编码 semantic hints；
- continuation 由上下文层补充。

当前不足：

- 逐 Skill semantic hints 仍在核心代码；
- 新 Skill 不能完整声明 package-level routing intents；
- `embedding` 存在于类型但当前没有执行路径；
- duplicate id 当前静默 first-wins。

目标规则：routing metadata 属于 Package；Matcher 只实现通用算法；duplicate id fail closed。

## 6. 当前 Skill Worker

普通 matched Skill 当前进入：

```text
SkillContext + current goal
-> one forked Worker
-> Tool / private Runtime loop
-> Evidence / Artifact / Requirement
-> Parent finalization
```

Parent 保留：

- global goal；
- Policy / Approval；
- terminal contract；
- Evidence 接收；
- 用户最终交付。

Worker 负责：

- task-local planning；
- concrete execution；
- tool observation；
- repair；
- Artifact construction；
- task-local terminal result。

当前已知限制：

- 首次 Worker goal 主要是本轮用户输入，不等同于完整 anchored task frame；
- 普通 `needs_input` 没有与 approval checkpoint 等价的 resume contract；
- completion envelope 没有正式长文本 deliverable；
- Child requirement 当前可能直接成为用户问题；
- malformed completion 可能被弱 Evidence 归一为 completed。

这些限制说明 Worker 只适合真正的 delegated work，不适合所有 Context Skill。

## 7. Stateful Flow

Stateful Flow 是可选的确定性业务控制器：

```text
Parent user turn
-> Flow / Reducer
-> state projection / requirements / delivery
-> Parent asks or delivers
```

当前 Flow Registry 只登记：

```text
fertility-assessment
```

其 report handoff 是内部阶段，不是第二个 public Skill。Flow 上禁止再叠自由 Skill Worker。

## 8. Tool、Runtime 与 Grant

### 当前 private binding 状态标签

```text
office_document            ready
office_pdf                 ready
office_presentation        ready
office_spreadsheet         ready
wenshu_xlsx_xml_runtime    pending
```

注意：当前 `ready` 主要是 profile/adapter 登记状态，不等于所有环境依赖健康。目标实现必须拆分：

```text
declared
granted
adapter registered
environment healthy
route eligible
```

### 当前高风险缺口

`user` Skill 的 Tool/Runtime 声明会被清空；但 `external` Skill 仍可能保留 runtimeBindings，已知 private Runtime id 又可能被解析成 ready adapter。这意味着 package origin 与执行 trust 没有彻底分开。

在 Capability Grant Registry 落地前：

```text
external / user private Runtime binding
= deny by default
```

不能因为 id 是 `office_document` 就认为该 Skill 有权使用。

## 9. Route eligibility

复杂 Skill 不能只声明一张 flat capability list。

例如 XLSX：

```text
inspect / verify
-> office_spreadsheet

create / edit / fix
-> wenshu_xlsx_xml_runtime
```

当前 XML Runtime pending，因此：

```text
READ / INSPECT / VERIFY = conditional available
CREATE / EDIT / FIX = unavailable
```

`office_spreadsheet` ready 不能证明 create/edit route ready。

目标合同使用 route-specific `requiredAll / requiredAny / optional`，缺少当前 route 的能力必须在 Worker 启动前阻断。

## 10. User interaction

目标边界：

```text
Worker / Flow
-> neutral business requirement

Parent
-> global relevance judgment
-> safe, natural user-facing question
```

当前 generic Worker requirement 仍可能被直接拼成 `ask_user.question`，这是已知越界，不能作为新 Skill 范例。

## 11. Completion

目标 `completed` 必须经过 route-specific evaluator。

禁止：

- 发生过任意 Tool call 就算完成；
- 任意 Evidence/Artifact 都能覆盖 malformed completion；
- 只有 summary 没有交付物，却声称内容创作完成；
- 仅在 SKILL.md 写“必须验证”，Runtime 却没有验收门槛。

当前审计结论：Office 的 deterministic artifact 路线相对成熟；GitHub readback、MiraDocs 阶段交付和 Context Skill 用户内容仍需要统一 completion contract。

## 12. Resource / Script

```text
reference / template / example
= read-only context resource

script
= package resource, not execution permission
```

Script materialize 不等于可以执行。目标应使用 managed Script Runtime：

```text
skill id + resource URI + digest + args
-> governed launcher
```

通用 `terminal_session` 不应成为 packaged script 的默认执行器。

## 13. Workspace

```text
skillRoot != runtimeRoot != workspaceRoot
```

- Skill package 只读；
- Runtime 依赖受管；
- 用户任务输入、输出和 staging 在 workspace；
- workspace-bound Skill 没有 workspace 时执行前阻断；
- staging 任务隔离、可追踪、显式清理。

## 14. Approval

- exact tool id / tool call id / input hash / frozen input；
- approval 一次一用；
- resume 必须验证 Skill id/version 与 checkpoint；
- 远程或破坏性写入前读取当前事实；
- 写入后回读；
- 不从原始目标重新启动已冻结调用。

当前 approval checkpoint 是 Skill Worker 中最成熟的合同之一，应保留。

## 15. 当前 Skill 分类

| Skill | 目标责任类型 | 当前判断 |
| --- | --- | --- |
| docx | delegated-worker | 可用，需移除 legacy 真相分裂 |
| pdf | delegated-worker | 可用，需 Grant / completion 收紧 |
| pptx | delegated-worker | 可用，需 package inventory / provenance |
| xlsx | delegated-worker | inspect 条件可用；create/edit/fix blocked |
| github-collaboration | delegated-worker | 方向正确，需 remote Evidence evaluator |
| wechat-article-layout | delegated-worker + managed script | package 闭环未验证，blocked |
| miradocs | stateful-flow / durable workflow | 当前普通 Worker 越载，review |
| fertility-assessment | stateful-flow | 当前最成熟，需 high-stakes 加固 |
| deep-interview | context-only | 当前 fork 不规范 |
| black-mirror-writer | context-only | 当前 fork 不规范 |
| product-critic | context-only | 当前 fork 过度工程化 |

详细依据见 `skill-contract-audit-20260806.md`。

## 16. Hard Rules

1. Skill Package 声明需求，不授予能力。
2. package origin 与 execution trust 必须分离。
3. 自动激活最多一个 primary Skill。
4. Resource 默认按需披露。
5. execution responsibility 必须显式为 context-only / delegated-worker / stateful-flow。
6. 当前“一律 fork”只是兼容实现，不是目标 authoring contract。
7. Parent 是唯一用户对话与 global goal 所有者。
8. Worker 只拥有 task-local execution。
9. Flow 是确定性业务 controller，不叠自由 Worker。
10. private Runtime 必须由独立 Grant 授权，已知 id 不代表有权使用。
11. route capability 缺失必须 fail closed。
12. completed 必须由 route-specific completion proof 支持。
13. Script resource 不是 Terminal 执行许可。
14. duplicate Skill id 必须 fail closed。
15. review / blocked lifecycle 必须影响 Matcher，而不是装饰字段。
16. 文档、Manifest 与代码冲突时，当前行为如实记录，并立即进入审计；不得把目标状态写成已完成。
