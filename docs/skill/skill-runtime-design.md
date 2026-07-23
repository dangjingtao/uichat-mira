# Stateful Skill Runtime 设计

Status: Planned
Protocol: V1 Settled
Owner: chat / runtime
Last verified: 2026-07-24
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

## 0. 本页结论

本页只定义 **可选 Stateful Skill Runtime**，不改变 Base Skill 的正式定义：

> **Base Skill 是通过渐进式披露，向 Agent 注入领域知识、执行策略和能力使用说明的上下文能力包。**

当一个 Skill 需要跨轮维护业务状态、恢复执行、生成确定性产物，或在执行中发现缺失条件时，才接入 Stateful Skill Runtime。

V1 的核心边界：

1. **Parent Agent Loop 始终是唯一主流程。**
2. **Planner 始终拥有用户对话控制权。**
3. Skill 可以报告“我缺什么”，但不能直接向用户追问。
4. Skill 内部需要 TaskModel 时，可以通过受治理接口直接调用，不需要向 Planner 申请。
5. Skill 不直接执行 Harness Tool / MCP，不生成 `pendingToolCall`，不绕过 Policy / Approval / Sandbox。
6. Skill 的完整业务状态留在 Skill Runtime Store；Planner 只看到小型运行投影和结构化执行结果。
7. V1 不新增第二 Agent Loop，不新增 `use_skill` Planner action，不支持 nested Skill / cross-Skill handoff。

一句话：

> **Skill 是可中断、可恢复的业务执行单元；Planner 决定问不问、继续不继续、何时结束。**

---

## 1. 为什么需要 Stateful Runtime

适合：

- 任务跨多个用户轮或执行步骤才能完成；
- 必须可靠记住业务阶段和已确认数据；
- 需要 checkpoint / resume / cancel；
- 需要确定性报告、结构化输出或 artifact；
- 执行过程中会发现缺失输入或依赖；
- 需要强 completion truth，不能只依赖模型一句“完成了”；
- 需要在 Evidence 到达后更新业务状态。

不适合：

- DOCX / PDF / XLSX / PPTX 的普通使用说明；
- 搜索策略；
- 简单代码审查规则；
- 只需要 SKILL.md + Reference 的单轮任务。

这些继续使用 Base SkillContext。

---

## 2. 三层上下文，不造万能 Skill ctx

Mira 不给 Skill 复制一套完整 Agent Context。

```text
Agent shared context
├─ CurrentTaskFrame
│  └─ 全局目标、当前任务、完成条件、进度与剩余工作
├─ SkillContext
│  └─ 当前领域应该怎么做
├─ SkillRuntimeProjection
│  └─ 当前 Stateful Skill 做到哪、刚返回了什么
├─ Evidence / Observation
│  └─ 工具、检索和 Skill 执行的真实结果
└─ Conversation
   └─ 用户与 Agent 对话
```

### 2.1 CurrentTaskFrame

由 Planner 负责解释和维护任务语义：

```text
globalGoal
currentGoal
currentSubtask
currentBlocker
completionCriteria
coveredProgress
remainingWork
confirmedObjects
```

Skill 不直接改写 `globalGoal / completionCriteria / remainingWork`。

### 2.2 SkillContext

Base Skill 的渐进披露结果：

```text
instruction
primary body
resources
disclosedResources
match metadata
```

它回答：

```text
这类事情应该怎么做
```

### 2.3 SkillRuntimeProjection

Stateful Runtime 给 Planner 的最小事实投影，不包含完整业务 state：

```ts
type SkillRuntimeProjection = {
  skillId: string
  skillVersion: string
  instanceId: string
  status: "running" | "interrupted" | "completed" | "failed" | "cancelled"
  stage?: string
  stateRef?: string
  latestResult?: SkillExecutionResult
}
```

推荐放在独立 Agent runtime state，并通过 `PlannerObservationContext` 暴露给 Planner。

不要把完整 Skill state 塞进 `CurrentTaskFrame`，也不要让 Planner 去 workspace 找 Skill state。

---

## 3. 唯一主流程

当前 Pi-loop 保持不变：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
  -> Generate
  -> Finalize
```

Stateful Skill Runtime 只增加一个 **bounded execution bridge**，不是第二循环。

### 3.1 用户轮入口

```text
User turn
  -> Prepare Context
  -> 匹配 / 恢复 active Stateful Skill
  -> SkillExecutionBridge 执行一次有界 Skill step
  -> SkillExecutionResult
  -> Observation / PlannerObservationContext
  -> Planner
```

### 3.2 Evidence 到达后

```text
Tool / Retrieve
  -> Evidence accepted
  -> active Skill reducer 消费相关 Evidence
  -> SkillExecutionBridge 再执行一次有界 step
  -> SkillExecutionResult
  -> Planner
```

Bridge 只负责：

- 找到或恢复 active SkillInstance；
- 调用一次 Runtime；
- 保存 state；
- 把结果转换为 Planner 可见的结构化事实。

Bridge 不负责：

- 决定是否追问用户；
- 决定主任务是否完成；
- 选择下一个 Harness Tool；
- 代替 Planner 编排多轮任务。

---

## 4. Skill 执行结果协议

所有 Stateful Skill 必须返回统一结果：

```ts
type SkillExecutionResult<Output = unknown> =
  | {
      status: "completed"
      output: Output
      stateRef?: string
      artifactRefs?: string[]
      facts?: string[]
    }
  | {
      status: "interrupted"
      reason:
        | "missing_requirement"
        | "waiting_for_evidence"
        | "recoverable_dependency"
      requirements: SkillRequirement[]
      resumeToken: string
      stateRef?: string
      partialOutput?: unknown
      facts?: string[]
    }
  | {
      status: "failed"
      recoverable: boolean
      error: string
      stateRef?: string
      facts?: string[]
    }
```

Requirement 只描述业务事实：

```ts
type SkillRequirement = {
  id: string
  kind: "user_input" | "evidence" | "resource" | "capability"
  description: string
  requiredFor: string
  acceptedFormats?: string[]
  alternatives?: string[]
}
```

禁止出现：

```ts
requiredAction: "ask_user"
question: "请问……"
nextAction: "use_tool"
pendingToolCall: {...}
```

原因：

> Skill 能判断自己的业务输入是否缺失，但不能决定这个缺失是否阻塞用户的全局目标。

---

## 5. 追问权只属于 Planner

正确链路：

```text
Skill 执行
  -> interrupted(requirements)
  -> Agent Loop 提交 Planner
  -> Planner 结合 globalGoal / completionCriteria / remainingWork 判断
       ├─ 阻塞主线
       │   -> nextAction = ask_user
       ├─ 当前不阻塞
       │   -> 写入 remainingWork
       │   -> 继续其他 Tool / Retrieve / Skill-independent 工作
       └─ 可降级交付
           -> 明确缺口与影响
           -> 继续完成可完成部分
```

“稍后补问”在 V1 中不代表后台并行对话。

它只表示：

```text
Planner 暂不打断用户
-> 将 requirement 留在 remainingWork
-> 在最终交付前或合适节点再次评估
```

### 5.1 用户回答后的恢复

```text
用户回答
  -> 新一轮 AgentRun
  -> 外层根据 active instance / resumeToken 恢复 Skill
  -> Skill 消费本轮输入并更新自己的业务 state
  -> SkillExecutionResult
  -> Planner 更新 CurrentTaskFrame
```

Planner 不直接修改 Skill 的领域 state。

Planner 只负责：

- 判断这轮回答是否用于恢复 active Skill；
- 维护主任务进度；
- 决定下一步动作。

---

## 6. Skill 内部 LLM 调用

Stateful Skill Runtime 可以在一次 bounded step 内，直接调用受治理的 TaskModel 接口。

推荐合同：

```ts
type SkillRuntimeContext = {
  taskModel: {
    invoke<T>(input: {
      purpose: string
      messages: NormalizedChatMessage[]
      outputSchema?: unknown
      modelClass?: "task" | "reasoning" | "vision"
      temperature?: number
      maxTokens?: number
    }): Promise<T>
  }
}
```

职责分工：

```text
Skill Runtime
-> 决定 purpose / prompt / schema / modelClass / temperature / maxTokens

Model Gateway
-> 决定实际 Provider / Model
-> 执行权限、预算、重试、超时、审计和 telemetry

Planner
-> 不参与 Skill 内部这次推理
```

禁止：

- 在 SKILL.md 中发明 `<llm_call>` 等可执行文本协议；
- 让主模型输出特殊 XML，再由 Loop 猜测执行；
- Skill 绕过统一 Model Gateway 直连 Provider；
- Skill 自行选择未经允许的具体 Provider / Model；
- 用内部 LLM 调用形成第二 Agent Loop。

内部 LLM 调用属于 Skill Runtime 的实现步骤，不是用户对话动作。

---

## 7. Tool / MCP / Evidence 边界

Skill 内部 TaskModel 调用和外部 Tool 执行必须分开理解。

### 7.1 Skill 可以直接做

- 读取和更新自己的最小业务 state；
- 调用受治理 TaskModel；
- 执行纯函数校验、归一化、渲染；
- 生成结构化中间结果；
- 生成确定性文本 / HTML ViewModel；
- 返回 completed / interrupted / failed。

### 7.2 Skill 不可以直接做

- 创建 frozen `pendingToolCall`；
- 直接执行 Harness Tool / MCP；
- 绕过 Policy / Approval；
- 私下消费 Tool Result 后再决定是否写 Evidence；
- 扩大 `state.toolExposure`。

需要外部能力时：

```text
Skill
-> interrupted(requirement.kind = capability | evidence | resource)
-> Planner
-> use_tool / retrieve
-> Normalize / Policy / ToolNode
-> Evidence
-> Skill reducer
-> Planner
```

Evidence 仍是外部执行结果进入 Agent 业务判断的公共真相层。

---

## 8. SkillInstance 与状态存储

```ts
type SkillInstance<State = unknown, Output = unknown> = {
  id: string
  threadId: string
  userId: number
  skillId: string
  skillVersion: string
  status: "running" | "interrupted" | "completed" | "failed" | "cancelled"
  stage?: string
  state: State
  output?: Output
  artifactRefs: string[]
  activeResumeToken?: string
  createdAt: string
  updatedAt: string
}
```

State 只保存恢复业务执行需要的最小真相：

- 当前 stage；
- 已确认结构化事实；
- 缺失要求；
- 已接受的关键 Evidence refs；
- 产物引用；
- 恢复标记。

禁止复制：

- 完整聊天历史；
- 全量 Tool Result；
- 全量 Trace；
- 大文件正文；
- CurrentTaskFrame 的完整副本。

### 8.1 stateRef

`stateRef` 是 Runtime 内部的不透明引用。

规则：

- Planner 不解析 stateRef；
- Planner 不根据 stateRef 去 workspace 搜文件；
- Runtime Store 必须能根据 active instance 或 ref 恢复 state；
- `resumeToken` 必须绑定 instance 和最近一次 interruption，防止旧回复重复恢复。

V1 可以继续按 `(threadId, userId)` 维护 active instance 索引，但实例真相必须有稳定 `instanceId`。

---

## 9. Activation

Base SkillContext 先完成匹配与披露。

只有同时满足以下条件时才激活 Stateful Runtime：

1. 当前 primary Skill 明确绑定 Runtime；
2. 当前请求属于该 Runtime 的业务入口，或存在可恢复 active instance；
3. Runtime version 可用；
4. 没有明确的新任务 / 取消 / Skill 切换。

概念链：

```text
Prepare Context
  -> match Base Skill
  -> load SkillContext
  -> resolve optional Runtime binding
  -> create / restore SkillInstance
  -> bounded SkillExecutionBridge
  -> SkillRuntimeProjection
  -> Planner
```

V1 同一时刻最多一个 active Stateful SkillInstance。

---

## 10. V1 不做 cross-Skill handoff

V1 不允许：

```text
Skill A
-> next.targetSkillId = Skill B
-> Coordinator 自动接管并执行 B
```

这会让 Coordinator 逐渐成为第二套调度器。

Stateful Skill 可以调用自己包内的普通 Runtime 模块，例如：

```text
assessment runtime
-> internal report builder
-> HTML renderer
-> PDF converter
```

这些是一个 Skill 的内部实现，不是 nested Skill。

跨 Skill 的任务协调仍属于 Parent Planner；V1 在未引入正式 Planner Skill invocation contract 前，不实现自动 cross-Skill handoff。

---

## 11. Fertility Bug 定位与迁移决定

### 11.1 已确认事实

当前实现中：

- 评估数据已经保存在 `StoredSkillFlowSession.state`；
- fertility report runtime 可以直接读取 `session.state`；
- 正常 report runtime 不需要去 workspace 找 assessment JSON；
- Pi-loop 没有被 `maxIterations=8` 强制停止。

失败路径是：

```text
fertility-report 的 SKILL.md 被普通 Matcher 命中
-> Planner 看到了“必须有完成态 assessment state”的说明
-> 但本轮没有真实 Skill Runtime 执行结果
-> Planner 无法访问完整 Skill state
-> 错误地去 workspace 搜 assessment JSON / schema
-> 找不到后提前 answer
```

所以该 bug 不是：

- Context token 不足；
- Pi-loop 预算不足；
- report renderer 不会读取 state；
- Planner 应该多搜几轮。

根因是：

> **静态 SkillContext 被曝光了，但对应 Stateful Runtime 没有作为可执行单元向 Agent Loop 返回统一结果。**

### 11.2 V1 迁移决定

`fertility-assessment` 作为一个 Stateful Skill Runtime，内部阶段至少包括：

```text
collect
-> final-confirmation
-> report-generation
-> delivery
```

`fertility-report` 调整为该 Runtime 包内的 report builder / renderer，不再作为可被普通 Matcher 单独命中的顶层 Skill。

报告生成阶段：

```text
fertility runtime
-> 直接读取自己的 state
-> 内部调用 TaskModel 补齐维度 / summary
-> 确定性生成 Markdown / HTML / PDF
-> SkillExecutionResult.completed(output + artifactRefs)
-> Planner
-> Generate / deterministic delivery
```

缺失信息阶段：

```text
fertility runtime
-> SkillExecutionResult.interrupted(requirements)
-> Planner 决定 ask_user 或降级继续
```

不再返回：

```text
requiredAction = ask_user
question = "……"
next.targetSkillId = fertility-report
```

---

## 12. Planner 合同

Planner 必须收到：

```text
CurrentTaskFrame
+ SkillContext
+ active SkillRuntimeProjection
+ latest SkillExecutionResult
+ Evidence / execution history
```

Planner 规则：

1. `interrupted` 不等于必须追问；结合 `globalGoal` 判断。
2. 只有 Planner 可以输出 `ask_user`。
3. `completed` 只证明 Skill 自己的业务执行完成，不自动证明全局任务完成。
4. Planner 仍需核对全局 `completionCriteria`。
5. `failed(recoverable=true)` 可以重试、换路径或降级。
6. `failed(recoverable=false)` 决定 error 或诚实交付部分结果。
7. Planner 不解析完整 Skill state，不重写 Skill 领域 state。
8. Planner 不去 workspace 猜测 Stateful Skill 内部数据位置。

---

## 13. Generate / Delivery

Skill completed output 可以包含：

```ts
type SkillCompletedOutput = {
  summary?: string
  structuredData?: unknown
  delivery?: {
    kind: "text" | "markdown" | "inline_html"
    content: string
  }
  artifactRefs?: string[]
}
```

Planner 决定全局可以回答后：

- deterministic delivery 可以直接交付；
- 普通结构化输出可以作为 finalization evidence；
- Generate 不重新执行 Skill；
- Generate 不重新判断 Skill 是否完成；
- PDF 失败不能吞掉已成功生成的 HTML / Markdown。

---

## 14. Observability

至少记录：

```text
skillId
skillVersion
skillInstanceId
stage
status
executionAttempt
stateRef
resumeTokenCreated / consumed
result.status
requirement ids / kinds
internalTaskModel purpose / modelClass / token / latency / cost
reduced Evidence refs
artifactRefs
```

Trace 必须能回答：

- Skill 为什么被激活；
- 本轮 Skill 实际执行了吗；
- 是 completed / interrupted / failed；
- 缺了什么；
- Planner 为什么决定问或不问；
- 哪次用户回复恢复了哪个 instance；
- 报告从哪份 state 生成；
- 内部 TaskModel 调用了几次、花了多少。

不要从 Planner 文本风格猜 Skill 是否执行。

---

## 15. 施工顺序

### T1：落统一合同

新增或收口：

```text
SkillExecutionResult
SkillRequirement
SkillRuntimeContext
SkillRuntimeProjection
SkillInstance
SkillExecutionBridge
```

弃用当前控制型字段：

```text
SkillDirective.requiredAction
SkillDirective.question
SkillDirective.next.targetSkillId
```

保留兼容层时，只能做旧数据读取，不得继续作为新主链真相。

### T2：Planner 接收 Skill execution observation

- `PlannerObservationContext` 增加 active runtime projection；
- 增加 latest Skill execution result；
- Planner prompt 明确：只有 Planner 可 ask_user；
- `interrupted` 由 Planner 评估是否阻塞；
- 非阻塞 requirement 进入 `remainingWork`。

### T3：实现 bounded SkillExecutionBridge

- 用户轮入口执行一次；
- Evidence accepted 后执行一次；
- 负责 create / restore / save instance；
- 不含 while-loop；
- 不决定 nextAction。

### T4：迁移 fertility

- 合并 assessment + report 为一个 Stateful Runtime；
- report builder 变为内部模块；
- 不再顶层匹配 `fertility-report`；
- 内部 TaskModel 改走 `SkillRuntimeContext.taskModel`；
- 缺失信息返回 `interrupted(requirements)`；
- 报告返回 `completed(output/artifactRefs)`。

### T5：Resume 与持久化

- active instance 索引；
- 稳定 instanceId；
- bounded resumeToken；
- 防重复消费 userMessageId；
- cancel / switch task 清理。

### T6：删除旧旁路

删除或下线：

- Flow Runtime 直接生成用户问题；
- Coordinator 自动 cross-Skill handoff；
- `stateRef` 被当作 Planner 可读文件地址；
- 顶层 `fertility-report` 普通 Matcher 路径。

---

## 16. 验收标准

### 架构验收

1. Parent Pi-loop 仍是唯一循环。
2. 没有新增 `use_skill` Planner action。
3. Skill 不直接输出用户问题。
4. 只有 Planner 输出 `ask_user`。
5. Skill 内部 TaskModel 可直接调用，但全部经过 Model Gateway 治理和审计。
6. Skill 不扩张 ToolExposure，不绕过 Policy / Approval。
7. 完整 Skill state 不进入 Planner prompt。
8. Skill execution 结果以结构化 Observation / projection 进入 Planner。

### Fertility 回归验收

1. 用户说“做一份备孕全景报告”后进入同一个 fertility Stateful Runtime。
2. 缺信息时，Skill trace 显示 `interrupted(requirements)`。
3. 用户看到的问题来自 Planner `ask_user`，不是 Skill directive.question。
4. 用户回答后恢复同一个 instance，不创建第二个评估。
5. 最终确认后直接从 instance state 生成报告。
6. Planner 不再搜索 workspace 中的 assessment JSON / schema。
7. HTML 报告成功时，即使 PDF 转换失败也正常交付。
8. 报告完成后 Planner 根据全局 completion criteria 决定最终 answer。
9. Trace 可串起 state、内部 TaskModel 调用、报告产物与最终交付。

### 非阻塞缺口验收

1. Skill 返回非关键 requirement 时，Planner 可以不立刻追问。
2. requirement 被记录进 `remainingWork`。
3. Agent 可以继续完成不依赖该信息的下游工作。
4. 最终交付前 Planner 再评估是否需要补问或明确降级影响。

---

## 17. V1 明确不做

- 多个并行 active SkillInstance；
- nested Skill；
- Coordinator 自动 cross-Skill handoff；
- 后台异步向用户提问；
- Skill 自选任意具体 Provider / Model；
- SKILL.md 可执行 `<llm_call>` 协议；
- 第二套 Tool Registry / ToolExposure；
- 第二 Agent Loop；
- 为所有 Base Skill 强制创建 state machine；
- marketplace / remote runtime / distributed checkpoint。

---

## 18. Hard Rules

1. Base Skill 与 Stateful Runtime 是同一体系的基础层与可选增强层。
2. Parent Agent Loop 始终是唯一控制循环。
3. Planner 始终拥有用户对话控制权。
4. Skill 只能报告 requirement，不能直接向用户提问。
5. Planner 判断 requirement 是否阻塞全局任务。
6. Skill 只更新自己的业务 state；Planner 只维护主任务语义。
7. Skill 内部 TaskModel 直接走受治理 Runtime Context，不经过 Planner 申请。
8. Skill 不通过 SKILL.md 发明可执行 LLM 协议。
9. Skill 不直接执行 Harness Tool / MCP，不生成 pendingToolCall。
10. 外部执行结果必须先进入 Evidence，再推进 Skill state。
11. Skill execution 必须返回 completed / interrupted / failed 结构化结果。
12. 完整 Skill state 不进入 Planner prompt。
13. `stateRef` 不得诱导 Planner 去 workspace 查找内部状态。
14. V1 不支持 nested Skill 或自动 cross-Skill handoff。
15. fertility report 是 fertility Stateful Runtime 的内部阶段，不是独立顶层入口 Skill。
16. `maxIterations` 与 Skill 业务轮次、缺失条件和追问判断无关。
