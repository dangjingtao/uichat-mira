# Skill Runtime 设计

Status: Planned
Owner: chat / runtime
Last verified: 2026-07-22
Layer: raw-source
Module: SKILL
Feature: SkillRuntime
Doc Type: design
Canonical: true
Related:
  - README.md
  - ../harness/agentgraph-harness-protocol.md
  - ../tooling-runtime/harness-runtime-design.md
  - ../tooling-runtime/tools-protocol.md
  - ../development/agent-observability.md

## Purpose

这页定义 Mira 新一代 `Skill` 的运行时边界和 V1 设计。

核心定义：

> `Skill = 内部状态 + 多工具编排 + 业务语义封装`。

这份设计替代旧的“记忆型工作动作 / skill-driven memory”方向。旧设计不再作为实现依据。

## When To Read

在这些场景先读这页：

- 新增或实现 Skill Runtime
- 判断一个能力应该做成 Tool、Skill 还是 Agent 行为
- 设计多工具业务能力，例如 Office 文档处理
- 设计 Skill 的状态、恢复、取消、trace、权限和版本
- 修改 Agent / Planner 与 Skill 的接入方式

## Current Runtime Constraints

Skill 必须建立在当前 AgentGraph / Harness 合同上，而不是重新设计 Agent 主循环。

当前稳定主线是：

```text
AgentRun
  -> AgentGraph facade
  -> Pi Loop（默认）
  -> Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
```

因此 Skill V1 必须保持这些不变量：

1. Planner 仍只输出现有 `nextAction`，V1 不新增 `use_skill` action。
2. `toolExposure` 仍是 Planner 可见工具面的唯一运行时真相源。
3. 真实工具执行仍从 frozen `pendingToolCall` 开始。
4. Policy / ToolNode / Harness 的现有合同不因 Skill 改写。
5. Tool / Retrieve 的真实结果必须先进入 Evidence，再参与后续 Skill 状态推进和 Planner 决策。
6. Evidence 仍是累计证据的单一写入者。
7. Skill 不得恢复 `capabilityIntent.selectedToolIds` 等旧执行入口。

Skill 是插入现有循环的“有状态业务约束层”，不是第二套循环。

## Core Definition

### 1. Skill 的层级

```text
Agent
  ↓ 目标理解、Skill 选择、跨能力协调
Skill
  ↓ 内部状态、业务语义、多工具编排约束
Tool / MCP / Runtime
  ↓ 原子执行
```

稳定边界：

- `Tool`：原子执行能力。
- `Skill`：有内部状态的业务能力单元，封装多工具编排和领域语义。
- `Agent`：理解用户总目标，选择能力，并负责跨 Skill / Tool 的整体任务协调。

### 2. Code 与 Prompt 的分工

Skill 同时包含确定性代码和概率性业务语义，但职责必须明确分开。

| 层 | 负责什么 | 特性 |
| --- | --- | --- |
| Code / Runtime | 能做什么、怎么执行、状态是否合法、参数校验、边界、权限、checkpoint、错误恢复、产物引用 | 确定性，必须精确 |
| Prompt / Semantic Policy | 什么时候做、为什么做、模糊目标如何理解、多个合法动作如何选择、怎样算做得好 | 概率性，允许灵活判断 |

原则：

> 必须正确的东西写代码；需要理解和判断的东西交给模型。

Prompt 不能承担：

- 数据一致性
- 状态迁移合法性
- 权限提升判断
- 参数 schema 校验
- checkpoint 真值

Code 也不应该把领域判断写成大量僵硬 if/else 来替代模型理解。

### 3. Skill 不是固定 Workflow

不应把 Skill 缩减为：

```text
A -> B -> C -> D
```

更准确的是：

```text
业务目标
  ↓
Skill State
  ↓
代码给出当前合法状态、硬约束、完成门槛
  ↓
Skill 业务语义进入 Agent 当前 task frame
  ↓
Harness 生成最终 toolExposure
  ↓
Planner 在现有 nextAction 合同内选择下一步
  ↓
Policy -> Tool -> Evidence
  ↓
Skill 根据已接受 Evidence 更新内部状态
  ↓
下一轮 Planner
```

确定性骨架可以存在，例如：

- 打开资源前必须先完成资源解析
- 保存产物后必须验证存在性
- 某阶段禁止写操作
- 某类修改必须经过 approval

但具体业务路径不应被写死成唯一顺序。

## Core Objects

### SkillDefinition

`SkillDefinition` 是版本化、可注册的静态定义。

V1 概念合同：

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

说明：

- 这是概念合同，不是已经批准的最终 TypeScript 类型或数据库 schema。
- `allowedToolIds` 只表达 Skill 的最大工具边界，不复制 Harness Registry。
- Tool 参数 schema 仍以 Tool / Harness 自身定义为真相源。
- Skill 不内嵌 MCP server 定义、连接信息或鉴权实现。

### SkillRuntimeAdapter

Skill 不是只有一张定义卡，还需要确定性的运行逻辑。

V1 可以抽象成：

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
    | { status: 'running' }
    | { status: 'waiting'; reason: string }
    | { status: 'completed'; output: Output }
    | { status: 'failed'; reason: string }
}
```

这个 Adapter 的职责是：

- 初始化状态
- 给当前阶段生成确定性运行边界
- 消费已经进入 Evidence 的真实结果
- 更新状态
- 判断 Skill 是否继续、等待、完成或失败

它不负责：

- 直接调用 LLM 形成独立循环
- 直接执行 Tool
- 生成 frozen `pendingToolCall`
- 绕过 Planner / Policy / ToolNode

### SkillInstance

一次实际业务执行产生一个 `SkillInstance`。

```ts
type SkillInstance = {
  id: string
  skillId: string
  skillVersion: string

  status: 'created' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'
  stage?: string

  input: unknown
  state: unknown
  output?: unknown

  artifactRefs: string[]
  checkpointRef?: string
  error?: unknown
}
```

内部状态至少应能表达：

- 当前任务阶段
- 输入与资源引用
- 已确认的关键中间结果
- 必要的已执行步骤摘要或引用
- 当前产物引用
- 错误 / 恢复状态
- 可恢复 checkpoint

不要默认把这些全部复制进 Skill State：

- 完整聊天历史
- 全量 Tool Result
- 全量 execution trace
- 大文件正文

大对象使用引用；trace、artifact、文件内容继续由现有体系承载。

## Skill Registry And Resolution

### SkillRegistry

SkillRegistry 只管理可用 Skill 定义和版本。

最小职责：

```text
register
get(skillId, version?)
listAvailable
resolveVersion
```

它不管理 Tool，也不复制 Harness Registry。

### SkillResolver

V1 需要能从用户目标和当前 task frame 中选择是否启用一个 Skill。

但为了不改 Planner `nextAction` 合同，Skill 激活不应设计成新的 `use_skill` 执行动作。

建议边界：

```text
Prepare Context / capability preparation
  -> resolve explicit or semantic Skill candidate
  -> load/create active SkillInstance
  -> inject Skill runtime frame into currentTaskFrame
  -> provide Skill tool constraint to Harness exposure construction
  -> final state.toolExposure
  -> Planner
```

关键规则：

- SkillResolver 只决定“当前业务上下文是否由某个 Skill 约束”。
- SkillResolver 不生成 `pendingToolCall`。
- Tool 的真实执行选择仍由 Planner 完成。
- 最终工具面仍只有一个真相：`state.toolExposure`。

V1 建议同一时刻只允许一个 active SkillInstance。
跨 Skill 任务由 Parent Agent 在前一个 Skill 完成或退出后继续协调，不支持嵌套 Skill 调 Skill。

具体 Resolver 放在哪个源码文件、是否复用现有 task model / embedding，在实现任务中再定，不在本设计提前拍死。

## Tool Exposure Integration

Skill 不拥有第二套 tool exposure。

逻辑关系：

```text
Harness eligible tools
  ∩ Skill 当前 allowedToolIds（若有 active Skill）
  ∩ Policy / environment 可用边界
  -> Harness exposure resolver
  -> state.toolExposure
  -> Planner
```

必须保持：

- Planner 只读 `state.toolExposure`
- Skill 不把自己的 tool list 直接塞给 Planner 形成第二真相
- Skill 不能通过声明扩大 Harness 原本不可用的工具
- Skill 可以收窄当前业务阶段允许使用的工具

如果 Skill 需要 MCP Tool：

- 仍由现有 MCP / Harness registry 提供
- Skill 只引用稳定 tool id / capability id
- 不复制连接、鉴权、执行协议

## Execution Model

### Parent Agent 驱动，不做 Nested Agent Loop

V1 的唯一控制循环仍是现有 Agent Runtime。

概念链路：

```text
Prepare Context
  -> resolve/load active Skill
  -> Skill runtime frame
  -> Harness toolExposure
  -> Planner
  -> Normalize
  -> Policy
  -> Tool
  -> Evidence
  -> Skill state reduction from accepted Evidence
  -> next Planner turn
```

注意：

`Skill state reduction` 是业务状态更新语义，不代表必须新增一个 AgentGraph 节点。

实现时可以作为：

- Evidence 接受真实结果后的受控 reducer
- 或下一轮 context preparation 前的受控 reducer

但必须保持外部控制合同仍然是：

```text
Tool -> Evidence -> Planner
```

不得改成：

```text
Tool -> Skill -> Evidence
```

因为 Skill 不能先于 Evidence 消费未经确认的 Tool result 作为业务真值。

### Step 状态

SkillInstance 至少有：

```text
running
waiting
completed
failed
cancelled
```

Tool 调用本身仍走：

```text
Planner(use_tool)
  -> Normalize
  -> Policy
  -> Tool
  -> Evidence
```

Skill 只负责：

- 让 Planner 理解当前业务阶段
- 收窄当前合法工具集合
- 用代码维护状态迁移
- 用 completion criteria 防止局部完成被误判为整个业务完成

## State And Persistence

### 运行状态与长期 Memory 分离

**Skill State** 服务于一次 Skill instance：

- stage
- resource refs
- pending changes
- verified sections
- generated artifact refs
- retry / recovery marker

**Memory** 是跨任务、跨实例可继续使用的长期信息对象。

因此不得再定义：

```text
Skill = Memory action
```

Skill 可以显式读取或写入 Memory，但 Memory 只是外部能力或依赖。

### Persistence V1

V1 只要求存在逻辑 `SkillInstanceStore`：

```text
create
get
update
checkpoint
complete
fail
cancel
```

具体使用 SQLite 表、JSON state 还是事件记录，不在本设计提前拍死。

原则：

- 只持久化恢复所需最小状态
- 大结果存 artifact / trace，只保存引用
- 状态变更由代码 reducer 控制
- 模型不能直接任意覆盖整个 state

## Cancel And Resume

### Cancel

取消必须：

- 停止后续 Skill 业务推进
- 不绕过 Harness 的长进程取消语义
- 保留已产生的 trace 和 artifact
- instance 状态进入 `cancelled`

### Resume

恢复必须基于 checkpoint，而不是让模型猜测上次进度。

V1 规则：

- instance 固定绑定 `skillVersion`
- 同版本允许按 checkpoint 恢复
- Skill 定义发生不兼容升级后，旧 instance 不自动迁移
- V1 不做通用 state migration framework

## Error Model

Skill 不重新定义 Tool 底层错误，也不覆盖 AgentGraph 现有 recoverable / terminal 合同。

链路：

```text
Tool Error
  -> Harness / Tool execution truth
  -> Evidence
  -> Skill Runtime 将证据解释为业务状态
  -> Planner 决定下一步
```

Skill 业务状态至少可解释为：

- `recoverable`：仍有合法业务路径可以继续
- `waiting`：需要用户、approval 或外部条件
- `terminal`：当前 Skill 无法继续

这些是业务解释，不得篡改真实 Tool execution truth。

## Observability

V1 不新建第二套 execution trace 协议。

在现有 trace / diagnostics 中携带 Skill metadata：

```text
skillId
skillVersion
skillInstanceId
skillStage
```

系统应能回答：

- 为什么当前激活这个 Skill
- Skill 当前在哪个 stage
- 某次 Tool invocation 属于哪个 Skill instance
- 哪条已接受 Evidence 导致了 Skill state 变化
- 最终 artifact 在哪里

Prompt、Tool input/output、latency、token、cost 等继续复用现有 observability 能力。

## Permission Contract

Skill 只声明业务需要，不能拥有最终授权权力。

规则：

1. Skill 不能提升 Tool 权限。
2. Tool 原本需要 approval，进入 Skill 后仍然需要。
3. Side effect 语义以 Tool 定义为准。
4. Workspace / Runtime 边界以 Harness 为准。
5. Skill 可以进一步收窄当前允许能力，但不能扩大能力。

## Versioning

V1 使用稳定 `skillId + version`。

规则：

- instance 创建后冻结版本
- semantic policy 的行为性修改也属于版本变化
- 运行中的 instance 不热切换 SkillDefinition
- 破坏性 state 变化使用新版本
- V1 不建设通用兼容迁移系统

## Planner Integration

Planner 的核心合同不变。

Planner 继续读取：

- 用户目标
- `currentTaskFrame`
- `state.toolExposure`
- observations
- Evidence
- 最近 Tool / Retrieve 结果
- recovery / approval 上下文

Skill 只通过受控上下文影响：

1. `currentTaskFrame` 中增加当前 Skill 的业务语义、stage、completion criteria。
2. Harness 构造 `state.toolExposure` 时应用当前 Skill 的工具约束。
3. Evidence 接受结果后，Skill reducer 更新 SkillInstance state。

Planner 不需要知道：

- Skill persistence 的数据库细节
- Skill checkpoint 存储细节
- MCP 连接细节
- Harness 内部执行实现

特别要求：

> Skill completion criteria 应帮助 Planner 区分“这一步有结果”和“整个 Skill 业务目标已完成”。

这与现有 Planner 必须区分 `evidence answerable` 和 `task completable` 的合同一致。

## Harness Integration

Harness 不理解 Skill 业务语义。

Harness 继续只负责：

- tool registry
- eligibility / exposure
- invocation
- approval / policy boundary
- result / error truth
- trace / artifact

Skill Runtime 只向 Harness 提供当前业务阶段的收窄约束，不创建平行 Harness。

## Office Skill Example

### `office_document_edit`

业务语义：

> 根据用户目标读取、分析、修改并验证 Office 文档，同时尽量保留原有结构和格式。

可能使用的底层工具：

```text
office.inspect_document
office.read_content
office.edit_content
office.render_preview
office.verify_document
office.save_document
```

示例内部状态：

```ts
{
  stage: 'inspect' | 'analyze' | 'edit' | 'verify' | 'save',
  sourceArtifactRef: '...',
  targetArtifactRef: '...',
  pendingChangeRefs: ['...'],
  verifiedSections: ['...'],
  lastCheckpointRef: '...'
}
```

确定性 Code 负责：

- 文件存在且类型可处理
- state 合法迁移
- 修改操作参数校验
- 产物路径和引用
- 保存后必须存在可验证产物
- permission / side effect 不被绕过

模型业务语义负责：

- “帮我变得专业一点”具体意味着什么
- 哪些段落应该改，哪些应该保持
- 风险内容适合直接修改还是加批注
- 当前结果是否达到用户要求
- 在多个合法工具动作中下一步选哪个

动态路径可能是：

```text
inspect
  ├─ 内容问题 -> read_content -> edit_content -> verify
  ├─ 格式问题 -> render_preview -> edit_content -> render_preview -> verify
  └─ 无需修改 -> verify -> complete
```

每个真实 Tool call 仍由 Planner -> Normalize -> Policy -> Tool -> Evidence 完成。
Skill 通过 stage、semantic policy、tool constraints 和 state reducer 形成多工具业务编排。

## V1 Scope

第一版只批准这些核心概念：

- SkillDefinition registry
- SkillResolver 的业务激活概念
- 单 active SkillInstance
- internal state
- SkillRuntimeAdapter / state reducer
- semantic policy
- stage-specific tool constraints
- Parent Agent 驱动的多步执行
- checkpoint / cancel / resume
- error business mapping
- existing trace metadata integration
- permission intersection
- version freeze

第一版明确不做：

- 新 `use_skill` Planner action
- Nested Agent / Skill Agent
- Skill 调 Skill
- Skill 自己直接调用 Tool 绕过 Planner
- Skill Marketplace
- 通用 Workflow DSL
- 通用 state migration framework
- Skill 自有长期 Memory 系统
- Skill 自有 Tool Registry
- Skill 自有 approval / sandbox / trace runtime

## Implementation Notes

本设计当前只批准边界，不批准具体源码目录、数据库表和 Graph 新节点。

实现任务应优先做最小接入验证：

1. 一个 SkillDefinition
2. 一个 SkillInstance
3. 一个确定性 state reducer
4. 一段 semantic policy 注入
5. stage-specific tool exposure 收窄
6. Evidence 后状态推进
7. completion criteria 验证

首个 POC 优先选择 Office 类 Skill，因为它天然能验证：

- 多工具协作
- 中间状态
- artifact
- 业务质量判断
- 修改 / 验证闭环

## Code Anchors

当前实现必须先对齐这些真相源：

- `docs/harness/agentgraph-harness-protocol.md`
- `docs/tooling-runtime/harness-runtime-design.md`
- `docs/tooling-runtime/tools-protocol.md`
- `docs/development/agent-observability.md`
- `server/src/agent/nodes/prepare-context.ts`
- `server/src/harness/exposure-core/resolver.ts`

Skill Runtime 最终源码目录在实现任务批准前不在本文拍死。

## Superseded Design

以下旧方向不再作为当前实现依据：

- `skill-memory-poc.md`
- `roadmap.md` 中以 memory skill card 为中心的旧路线
- `catalog/` 下旧 memory skill card
- `schema/skill-card.schema.md` 的旧 card 合同
- `eval/` 下针对旧 memory skill 的选择 / 边界用例

这些材料仅保留历史参考意义。

## Related Docs

- `README.md`
- `../harness/agentgraph-harness-protocol.md`
- `../tooling-runtime/harness-runtime-design.md`
- `../tooling-runtime/tools-protocol.md`
- `../development/agent-observability.md`
