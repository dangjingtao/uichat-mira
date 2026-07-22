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

核心定义只有一句：

> `Skill = 内部状态 + 多工具编排 + 业务语义封装`。

这份设计替代旧的“记忆型工作动作 / skill-driven memory”方向。旧设计不再作为实现依据。

## When To Read

在这些场景先读这页：

- 新增或实现 Skill Runtime
- 判断某个能力应该做成 Tool、Skill 还是 Agent 行为
- 设计多工具业务能力，例如 Office 文档处理
- 设计 Skill 的状态、恢复、取消、trace、权限和版本
- 修改 Agent / Planner 与 Skill 的接入方式

## Current Contract

### 1. Skill 的层级

```text
Agent
  ↓ 选择、激活、跨能力协调
Skill
  ↓ 维护业务状态、约束和组织多工具执行
Tool / MCP / Runtime
  ↓ 执行原子能力
```

稳定边界：

- `Tool`：原子执行能力。
- `Skill`：有内部状态的业务能力单元，封装多工具编排和领域语义。
- `Agent`：理解用户总目标，选择 Skill / Tool，并负责跨 Skill 的任务协调。

Skill 不替代 Planner，不拥有第二套 Agent Loop，也不重新实现 Harness。

### 2. Code 与 Prompt 的分工

Skill 同时包含确定性代码和概率性业务语义，但两者职责必须分开。

| 层 | 负责什么 | 特性 |
| --- | --- | --- |
| Code / Runtime | 能做什么、怎么执行、状态是否合法、边界检查、参数校验、权限、错误恢复、checkpoint、产物引用 | 确定性，必须精确 |
| Prompt / Semantic Policy | 什么时候做、为什么做、模糊业务目标怎么理解、多个合法动作如何选择、怎样算做得好 | 概率性，允许灵活判断 |

原则：

> 必须正确的东西写代码；需要理解和判断的东西交给模型。

Prompt 不能承担数据库一致性、权限、参数校验、状态迁移合法性等硬约束。
Code 也不应该把业务判断写成大量僵硬 if/else 来替代模型理解。

### 3. Skill 不是固定 Workflow

不应把 Skill 定义为：

```text
A -> B -> C -> D
```

更准确的是：

```text
业务目标
  ↓
当前 Skill State
  ↓
代码给出合法动作 / 工具边界 / 状态约束
  ↓
模型在业务语义内做局部判断
  ↓
Harness 执行 Tool
  ↓
代码更新 State / Checkpoint / Artifact
  ↓
继续、等待、完成或失败
```

确定性骨架可以存在，例如“打开文档前必须先解析资源”“保存后必须验证产物存在”，但具体业务路径不应被写死成单一路径。

## Core Model

### SkillDefinition

SkillDefinition 是版本化、可注册的静态定义。

V1 最小概念字段：

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

  allowedToolIds: string[]
  permissionRequirements?: unknown
}
```

说明：

- 这是概念合同，不是立即批准数据库字段或 TypeScript 最终类型。
- `allowedToolIds` 只限定 Skill 可使用的工具集合，不复制 Harness Registry。
- 工具参数 schema 仍以 Tool/Harness 自身定义为真相源。
- Skill 不内嵌 MCP server 定义。

### SkillInstance

每次实际执行产生一个 SkillInstance。

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
- 已执行步骤的必要摘要或引用
- 当前产物引用
- 错误 / 恢复状态
- 可恢复 checkpoint

不要默认把完整模型上下文、全部 Tool Result 或所有 trace 复制进 Skill State。
大对象应该使用引用，trace 仍由现有可观测体系承载。

## Runtime Responsibilities

Skill Runtime V1 负责：

1. 注册和解析 SkillDefinition
2. 创建、读取、更新 SkillInstance
3. 校验输入、状态和合法迁移
4. 给当前 Agent step 提供 Skill 业务语义和允许的 Tool surface
5. 在 Tool 执行前后维护 Skill state
6. 生成 checkpoint
7. 处理 cancel / resume / fail / complete
8. 将 skillId、instanceId、stage 等信息挂到现有 execution trace

Skill Runtime V1 不负责：

- 自己运行一套 Planner
- 自己维护独立模型对话循环
- 绕过 ToolNode 直接执行 Harness Tool
- 创建第二套 approval / permission 系统
- 创建第二套 trace / artifact 系统
- 自动维护长期个人记忆

## Execution Model

### 1. Parent Agent 驱动，不做 Nested Agent Loop

V1 应保持现有 Agent 主循环为唯一控制循环。

推荐关系：

```text
Planner / Agent
  ↓ activate or continue Skill
Skill Runtime
  ↓ expose current semantics + state + allowed actions
Planner / Agent
  ↓ choose next business action / tool call
Policy
  ↓
ToolNode
  ↓
Harness
  ↓ result / evidence
Skill Runtime reducer
  ↓ update state / checkpoint / completion
Planner / Agent
```

关键点：

- Skill 可以多步执行，但每一步仍由现有 Agent Loop 驱动。
- Skill Runtime 是有状态业务执行层，不是嵌套 Agent。
- ToolNode / Harness 的现有执行合同不因为 Skill 被重写。

### 2. Step 的最小语义

一次 Skill step 可以产生四类结果：

```text
continue   仍需继续业务处理
waiting    等待用户、审批或外部条件
completed  业务完成并输出结果
failed     当前 Skill 终止失败
```

具体 Tool 调用仍走现有 Planner -> Policy -> ToolNode -> Harness 路径。

Skill Runtime 只负责在 step 前提供约束，在 step 后消费结果并更新状态。

### 3. 工具访问

有效工具集合必须满足：

```text
Skill allowed tools
∩ 当前 Agent 可用 tools
∩ Harness / Policy 当前实际允许 tools
```

Skill 永远不能通过声明扩大权限。

如果 Skill 需要 MCP Tool：

- 仍由现有 MCP / Harness registry 提供
- Skill 只引用稳定 tool id / capability id
- 不复制连接、鉴权、执行协议

## State And Persistence

### 1. 状态分两类

**运行状态**：Skill 自己拥有。

例如：

- stage
- selected document
- pending changes
- verified pages
- generated artifact refs
- retry / recovery marker

**长期 Memory**：不属于 Skill 基础合同。

Skill 可以显式读写 Memory，但 Memory 是外部能力或依赖。

不得再定义：

```text
Skill = Memory action
```

### 2. Persistence V1

V1 只要求存在一个逻辑 `SkillInstanceStore` 能力：

```text
create
get
update
checkpoint
complete
fail
cancel
```

具体 SQLite 表结构、事件表还是 JSON state 不在本设计里提前拍死。

原则：

- 能恢复就保存最小必要状态
- 大结果存 artifact / trace，只保存引用
- 状态更新必须由代码控制，不允许模型直接任意覆盖整个 state

## Cancel And Resume

### Cancel

取消必须：

- 停止后续 Skill step
- 不绕过 Harness 的长进程取消语义
- 保留已产生的可审计 trace 和 artifact
- 将实例状态置为 `cancelled`

### Resume

恢复必须基于 checkpoint，而不是让模型“猜上次做到哪里”。

V1 规则：

- instance 固定绑定 `skillVersion`
- 同版本可按 checkpoint 恢复
- Skill 定义发生不兼容升级后，旧实例不自动迁移
- V1 不做通用 state migration framework

## Error Model

Skill 不重新定义 Tool 的底层错误。

分层：

```text
Tool Error
  ↓ 保留原始 execution truth
Harness / ToolNode
  ↓
Skill Runtime
  ↓ 转换为业务状态：可重试 / 可换路径 / 需用户 / 无法继续
Parent Agent
```

Skill 可以决定“下一步业务上怎么办”，但不能篡改 Tool execution truth。

V1 至少区分：

- recoverable：Skill 仍有合法动作可以继续
- waiting：需要用户 / approval / 外部条件
- terminal：当前 Skill 无法继续

这不替代 Agent Graph 已存在的 recoverable / terminal 总合同。

## Observability

V1 不新建第二套 execution trace 协议。

在现有 trace 上增加或携带 Skill metadata：

```text
skillId
skillVersion
skillInstanceId
skillStage
```

需要能够回答：

- 为什么选择了这个 Skill
- Skill 当前在哪个 stage
- 这一 Tool 调用属于哪个 Skill instance
- Tool result 如何改变了 Skill state
- 最终产物在哪里

详细模型 prompt、tool input/output、latency、token、cost 等继续复用现有 observability 能力。

## Permission Contract

Skill 只声明需求，不拥有最终授权权力。

最终权限仍由现有 Agent / Policy / Harness 决定。

规则：

1. Skill 不能提升 Tool 权限
2. Tool 原本需要 approval，放进 Skill 后仍然需要
3. Side effect 语义以 Tool 定义为准
4. Workspace / runtime 边界以 Harness 为准
5. Skill 可以进一步收窄能力，但不能扩大能力

## Versioning

V1 使用稳定 `skillId + version`。

规则：

- instance 创建后冻结版本
- prompt / semantic policy 的行为性修改也属于版本变化
- 运行中的 instance 不热切换 SkillDefinition
- 破坏性 state 变化新开版本
- V1 不建设通用兼容迁移系统

## Planner / Harness Integration

### Planner 最小集成点

Planner 需要知道：

- 当前有哪些 Skill 可被选择
- Skill 的业务描述和适用条件
- 是否已有 active SkillInstance
- active Skill 当前 stage / completion criteria / allowed tool surface

Planner 不需要知道：

- Skill persistence 的数据库细节
- MCP 连接细节
- Harness 执行实现

### Harness 最小集成点

Harness 不需要理解 Skill 业务。

只需要继续提供：

- tool registry
- invocation
- approval / policy boundary
- result / error truth
- trace / artifact

Skill Runtime 通过现有 Harness contract 消费工具能力。

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

- 用户说“帮我变得专业一点”具体意味着什么
- 哪些段落应该改，哪些应该保持
- 风险内容适合直接修改还是加批注
- 当前结果是否达到用户要求
- 在多个合法工具动作中下一步选哪个

动态路径示例：

```text
inspect
  ├─ 内容问题 -> read_content -> edit_content -> verify
  ├─ 格式问题 -> render_preview -> edit_content -> render_preview -> verify
  └─ 无需修改 -> verify -> complete
```

这是一种受状态和业务约束的动态编排，不是固定 Workflow。

## V1 Scope

第一版只批准这些核心概念：

- SkillDefinition registry
- SkillInstance + internal state
- Parent Agent 驱动的多步执行
- allowed tool surface
- state reducer / checkpoint
- cancel / resume
- error mapping
- existing trace metadata integration
- permission intersection
- version freeze

第一版明确不做：

- Skill Marketplace
- Nested Agent / Skill Agent
- 通用 Workflow DSL
- 通用状态迁移框架
- Skill 自有长期 Memory 系统
- Skill 自有 Tool Registry
- Skill 自有 approval / sandbox / trace runtime

## Code Anchors

当前设计应优先复用和对齐：

- `server/src/agent/graph/build-graph.ts`
- `server/src/harness/registry.ts`
- `server/src/mcp/routes.ts`
- `docs/harness/agentgraph-harness-protocol.md`
- `docs/tooling-runtime/harness-runtime-design.md`
- `docs/tooling-runtime/tools-protocol.md`
- `docs/development/agent-observability.md`

具体 Skill Runtime 源码目录在实现任务批准前不在本文拍死。

## Superseded Design

以下旧方向不再作为当前实现依据：

- `skill-memory-poc.md`
- `roadmap.md` 中以 memory skill card 为中心的旧路线
- `catalog/` 下旧 memory skill card
- `schema/skill-card.schema.md` 的旧 card 合同
- `eval/` 下针对旧 memory skill 的选择/边界用例

这些材料仅保留历史参考意义。

## Related Docs

- `README.md`
- `../harness/agentgraph-harness-protocol.md`
- `../tooling-runtime/harness-runtime-design.md`
- `../tooling-runtime/tools-protocol.md`
- `../development/agent-observability.md`
