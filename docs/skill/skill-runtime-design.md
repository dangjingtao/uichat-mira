# Stateful Skill Runtime 设计

Status: Planned
Owner: chat / runtime
Last verified: 2026-07-23
Layer: raw-source
Module: SKILL
Feature: StatefulSkillRuntime
Doc Type: design
Canonical: true
Related:
  - ./README.md
  - ./skill-context-design.md
  - ./skill-package-runtime-contract.md
  - ../harness/agentgraph-harness-protocol.md
  - ../tooling-runtime/harness-runtime-design.md
  - ../tooling-runtime/tools-protocol.md
  - ../development/agent-observability.md

## Purpose

这页定义 Mira **可选 Stateful Skill Runtime** 的运行时边界。

它不是所有 Skill 的最低实现门槛。

基础 Skill 的正式定义见 `README.md` 与 `skill-context-design.md`：

> **Skill 本体 = 渐进式披露的动态上下文能力包。**

当某个 Skill 的真实业务需要跨多步执行维护内部状态、阶段、恢复、Evidence reduction 或 stage-specific tool constraints 时，才接入本页定义的 Stateful Skill Runtime。

因此：

```text
Base Skill
= Manifest + SKILL.md + Resources + Dynamic SkillContext

Optional Stateful Skill Runtime
= SkillDefinition + SkillInstance + State/Stage + Reducer + Lifecycle
```

这不是两种互斥架构，而是同一 Skill 体系的基础层与高级层。

---

## When To Use Stateful Runtime

适合：

- 任务跨多个 Agent / Tool turn 才能完成；
- 必须可靠记住当前业务阶段；
- 某些阶段允许的工具不同；
- 需要从 accepted Evidence 推进业务状态；
- 需要 checkpoint / resume / cancel；
- 需要强 completion criteria，不能仅靠模型一句“完成了”；
- 失败后需要明确恢复点。

不适合为了“让一个东西叫 Skill”而强行引入。

以下通常只需要基础 SkillContext：

- DOCX 使用说明；
- PDF 路由规则；
- Excel 建模规范；
- PPT 设计规范；
- Web Search 方法；
- 简单代码审查策略。

---

## Current Runtime Constraints

Stateful Skill Runtime 必须建立在当前 AgentGraph / Harness 合同上，而不是重新设计 Agent 主循环。

当前稳定主线：

```text
AgentRun
  -> AgentGraph facade
  -> Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
```

必须保持：

1. Planner 仍只输出现有 `nextAction`，不新增 `use_skill` action；
2. `state.toolExposure` 仍是 Planner 可见工具面的唯一运行时真相源；
3. 真实工具执行仍从 frozen `pendingToolCall` 开始；
4. Policy / ToolNode / Harness 不因 Stateful Skill Runtime 改写；
5. Tool / Retrieve 的真实结果必须先进入 Evidence；
6. Skill reducer 只消费 accepted Evidence；
7. Stateful Skill Runtime 不拥有第二 Agent Loop；
8. Skill 不得恢复旧 `capabilityIntent.selectedToolIds` 等执行入口。

---

## Core Model

```text
Base SkillContext
  ↓ provides domain semantics

Optional Stateful Skill Runtime
  ↓ adds deterministic business state/lifecycle

Parent Agent
  ↓ decides nextAction

Harness / ToolExposure
  ↓ real eligible capabilities

Tool / MCP / Runtime
  ↓ execution

Evidence
  ↓ accepted result

Stateful Skill reducer
  ↓ update state/stage

Next Planner turn
```

Stateful Runtime 增加的是：

```text
可靠业务状态
+ 合法阶段边界
+ Evidence 驱动的状态推进
+ completion truth
+ recovery truth
```

它不增加第二套 Agent。

---

## Core Objects

### 1. SkillDefinition

`SkillDefinition` 是版本化的高级运行定义。

概念合同：

```ts
type SkillDefinition = {
  id: string
  version: string
  name: string
  description: string

  inputSchema: unknown
  outputSchema: unknown
  stateSchema: unknown

  semantics: {
    purpose: string
    usageGuidance: string
    decisionPolicy: string
    qualityCriteria: string
    completionCriteria: string
  }

  toolPolicy: {
    allowedToolIds: string[]
  }

  permissionRequirements?: unknown
}
```

注意：

- 这是概念合同，不提前拍死最终数据库 schema；
- `allowedToolIds` 只表达 Skill 最大工具边界；
- 不复制 Harness Registry；
- Tool 参数 schema 仍以 Tool / Harness 为真相源；
- MCP 连接、鉴权、执行协议不放进 SkillDefinition。

### 2. SkillRuntimeAdapter

```ts
type SkillRuntimeAdapter<State, Input, Output> = {
  initialize(input: Input): State

  getRuntimeFrame(state: State): {
    stage?: string
    semanticContext: string
    allowedToolIds: string[]
    completionCriteria: string
  }

  reduceEvidence(state: State, evidence: unknown): State

  evaluate(state: State):
    | { status: "running" }
    | { status: "waiting"; reason: string }
    | { status: "completed"; output: Output }
    | { status: "failed"; reason: string }
}
```

职责：

- 初始化业务状态；
- 生成当前阶段的确定性运行边界；
- 消费 accepted Evidence；
- 更新状态；
- 判断 running / waiting / completed / failed。

不负责：

- 直接调用 LLM 形成独立循环；
- 直接执行 Tool；
- 生成 frozen `pendingToolCall`；
- 绕过 Planner / Policy / ToolNode。

### 3. SkillInstance

一次有状态业务执行产生一个实例：

```ts
type SkillInstance = {
  id: string
  skillId: string
  skillVersion: string

  status:
    | "created"
    | "running"
    | "waiting"
    | "completed"
    | "failed"
    | "cancelled"

  stage?: string

  input: unknown
  state: unknown
  output?: unknown

  artifactRefs: string[]
  checkpointRef?: string
  error?: unknown
}
```

State 只保存恢复业务执行真正需要的最小真相：

- 当前 stage；
- 输入 / resource refs；
- 已确认关键中间结果；
- pending changes；
- artifact refs；
- retry / recovery marker；
- checkpoint。

不复制：

- 完整聊天历史；
- 全量 Tool Result；
- 全量 trace；
- 大文件正文。

---

## SkillRegistry / Runtime Registry

基础 Skill Manifest Registry 与 Stateful Runtime Definition Registry 可以共享发现入口，但概念上要区分：

```text
Skill Manifest
= 基础 Skill 可发现信息

SkillDefinition
= Stateful Runtime 的版本化执行合同
```

不是每个 Manifest 都必须存在 SkillDefinition。

最小 Definition Registry 职责：

```text
register
get(skillId, version?)
listAvailable
resolveVersion
```

它不管理 Tool，也不复制 Harness Registry。

---

## Activation

基础 SkillContext 可以先被命中并注入。

只有当前业务确实需要 Stateful Runtime，并且该 Skill 存在已注册 Definition / Adapter 时，才创建或恢复 SkillInstance。

概念链路：

```text
Prepare Context
  -> match Base Skill
  -> load SKILL.md / SkillContext
  -> decide whether stateful runtime is required
  -> optional load/create SkillInstance
  -> optional runtime frame
  -> tool constraint participates in exposure construction
  -> final state.toolExposure
  -> Planner
```

Stateful Runtime 激活不是 Planner 的新 action。

V1 建议同一时刻最多一个 active SkillInstance。

跨 Skill 任务由 Parent Agent 顺序协调，不支持 nested Skill calling Skill。

---

## Tool Exposure Integration

Stateful Skill Runtime 不拥有第二套 ToolExposure。

逻辑关系：

```text
Harness eligible tools
  ∩ active Skill current allowedToolIds
  ∩ Policy / environment
  -> Harness exposure resolver
  -> state.toolExposure
  -> Planner
```

必须保持：

- Planner 只读 `state.toolExposure`；
- Skill toolPolicy 只能收窄，不能扩大；
- Skill 不把自己的 tool list 直接塞给 Planner；
- Runtime Pack 安装不自动注册 Tool；
- SkillDefinition 声明某 Tool 不代表该 Tool 当前真实可用。

如果 Skill 需要 MCP Tool：

- 仍由现有 MCP / Harness Registry 提供；
- Skill 只引用稳定 capability / tool id；
- 不复制连接、鉴权和执行协议。

---

## Evidence-Driven State Reduction

唯一正确顺序：

```text
Tool / Retrieve
  ↓
Evidence
  ↓ accepted
SkillRuntimeAdapter.reduceEvidence()
  ↓
SkillInstance state/stage
  ↓
next Planner turn
```

禁止：

```text
Tool
  -> Skill 私下消费结果
  -> 再决定要不要写 Evidence
```

原因：

> Evidence 是真实结果进入 Agent 业务判断的公共真相层。

Stateful Skill 只能基于 accepted Evidence 推进。

---

## Runtime Frame

`getRuntimeFrame()` 输出的是当前阶段约束，不是第二 System Prompt。

概念：

```ts
type SkillRuntimeFrame = {
  stage?: string
  semanticContext: string
  allowedToolIds: string[]
  completionCriteria: string
}
```

它应与基础 `SkillContext` 合并进入 `currentTaskFrame` 的语义上下文，而不是让 Harness 负责 Prompt 拼接。

```text
Base SkillContext
+ optional Stateful Runtime Frame
        ↓
currentTaskFrame
        ↓
Planner
```

工具面仍单独走 Harness exposure。

---

## Completion

基础 Skill 的 Completion Criteria 可以只是语义指导。

Stateful Runtime 则可以把关键完成条件提升为确定性业务真相。

例如：

```text
contract_review
stage=verify

must have:
- output artifact exists
- requested comments present
- requested revisions present
- source preserved
```

`evaluate(state)` 决定业务实例是否：

```text
running
waiting
completed
failed
```

但最终 Agent Generate / Finalize 仍走现有主链。

---

## Checkpoint / Resume / Cancel

只有真实需要恢复语义的 Skill 才实现。

最小持久化接口可以是：

```text
create
get
update
checkpoint
complete
fail
cancel
```

规则：

- SkillInstance 绑定明确 skillVersion；
- resume 不自动升级 Definition 版本；
- checkpoint 保存恢复所需最小状态和引用；
- cancel 不绕过既有 Tool / process 清理合同；
- 大文件和完整 trace 不复制进 checkpoint。

---

## Permission / Approval / Sandbox

Stateful Skill Runtime 不拥有权限提升能力。

```text
Skill says operation is needed
≠
operation is permitted
```

真实权限仍由：

```text
Harness capability eligibility
Policy
Approval
Sandbox / workspace boundary
Environment
```

决定。

Skill 可以声明 `permissionRequirements` 作为业务需求元数据，但不能自行授予。

---

## Observability

Stateful Skill trace 建议附加：

```text
skillId
skillVersion
skillInstanceId
skillStage
```

用于解释：

- 为什么当前 ToolExposure 被收窄；
- 当前业务处于哪个阶段；
- 哪条 Evidence 推进了 state；
- 为什么 completed / waiting / failed。

不要为 Skill 重做一套独立 trace runtime。

---

## Example: Contract Review

基础层：

```text
docx Manifest
  ↓
docx/SKILL.md
  ↓
Routing / review rules / completion guidance
```

如果只是一次简单批注任务，可能完全不需要 Stateful Runtime。

复杂长合同审阅才可能升级：

```text
SkillInstance
stage=inspect
  ↓
read / inspect
  ↓ Evidence
stage=analyze
  ↓
analysis / reference disclosure
  ↓
stage=edit
  ↓
office_document / runtime
  ↓ Evidence
stage=verify
  ↓
read back / artifact verification
  ↓ Evidence
completed
```

这说明：

> Stateful Runtime 是按业务复杂度升级，而不是因为文件扩展名叫 `.docx` 就自动创建状态机。

---

## Example: Finance Model

`xlsx` 基础 Skill 可以直接提供：

- formula-linked rules；
- source citation rules；
- DCF / three-statement reference URI；
- validation guidance。

只有当任务需要长时间、多阶段、可恢复建模时，再创建 Stateful Runtime：

```text
collect-data
→ normalize
→ historical-reconcile
→ forecast
→ valuation
→ verify
→ deliver
```

每个阶段可以收窄 allowedToolIds，并由 Evidence 推进。

---

## V1 Scope

Stateful Skill Runtime V1 不应先做成“大而全框架”。

建议只有在基础 Skill Context V1 跑通后，再选择一个真实复杂业务做最小验证：

```text
1 SkillDefinition
1 SkillRuntimeAdapter
1 active SkillInstance
minimal persistence
Evidence reducer
stage-specific tool narrowing
completion evaluation
```

先证明：

```text
stateful layer 确实解决了基础 SkillContext 解决不了的问题
```

再扩展 marketplace / nesting / orchestration 等能力。

---

## Hard Rules

1. Stateful Skill Runtime 是可选高级层，不是 Skill 的最低定义。
2. 基础 SkillContext 可以独立成立并工作。
3. 不新增第二 Agent Loop。
4. 不新增 `use_skill` Planner action。
5. `state.toolExposure` 始终是 Planner 工具面的唯一真相。
6. Stateful Skill tool constraints 只能收窄，不能扩大 Harness 能力。
7. Tool / Retrieve 结果必须先进入 Evidence，再推进 Skill state。
8. SkillInstance 只保存业务恢复所需最小状态与引用。
9. Runtime Pack 安装、SkillContext 激活、SkillInstance 激活是三个不同概念。
10. Permission / Approval / Sandbox / Tool Registry 继续复用现有体系。
11. Parent Agent 始终负责总目标和跨 Skill 协调。
12. 只有真实业务复杂度需要时才引入 state / stage / reducer / checkpoint。
