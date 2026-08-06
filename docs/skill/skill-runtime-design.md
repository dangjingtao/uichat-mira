---
status: current
owner: skill-runtime / agent-runtime
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: StatefulSkillRuntime
doc_type: current-contract
canonical: true
related:
  - README.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-package-runtime-contract.md
  - ../../server/src/skills/flow/registry.ts
---

# Stateful Skill Flow 当前合同

## 1. 本页结论

Stateful Skill Flow 是可选的确定性业务控制器，只用于确实需要多轮结构化状态、阶段、requirements、checkpoint 或确定性 reducer 的 Skill。

当前模型：

```text
Skill-owned SubAgent
  -> Conversation Flow / Reducer as its single controller
  -> structured interruption or completed delivery
  -> Parent governance
```

它不是：

- 第二个自由 Agent loop；
- Main Planner 逐步填写的一张状态表；
- 所有 Skill 的默认门槛；
- nested Skill；
- cross-Skill coordinator。

## 2. 当前实现状态

当前 Flow Registry 只登记一个 public Skill：

```text
fertility-assessment
```

代码锚点：

```text
server/src/skills/flow/registry.ts
server/src/skills/fertility-assessment/runtime.ts
server/src/skills/fertility-assessment/runtime/report-handoff.ts
```

报告阶段使用内部 directive handoff。它仍由 `fertility-assessment` 所有，不注册第二个可发现 `fertility-report` Skill。

## 3. 何时需要 Flow

适合：

- 多轮收集结构化业务事实；
- 必须区分 phase / round；
- 需要明确 requirements 与 interruption；
- 需要恢复同一业务会话；
- 需要确定性评分、校验或 renderer；
- 访谈完成不等于最终交付完成；
- 需要强 completion truth。

不需要 Flow：

- 单轮规则、写作方法或评审方法；
- 普通 GitHub 协作；
- 一次 bounded Office artifact 任务；
- 只需要 SkillContext + SubAgent local loop 的任务。

## 4. Parent 与 Flow 所有权

Parent owns：

- 用户对话；
- global goal；
- primary Skill routing；
- Policy / Approval；
- terminal contract；
- 最终 Generate 与交付。

Flow owns：

- 本 Skill 的业务 phase / round；
- 结构化 facts；
- 不确定项与矛盾项；
- requirements；
- interruption / resume 语义；
- delivery readiness；
- deterministic reducer / scoring / renderer handoff。

Flow 不得改写用户 global goal，也不得注册或扩大 ToolExposure。

## 5. 当前结果语义

Flow controller 可以返回：

```text
working
interrupted(requirements)
completed(delivery state / artifacts)
failed(recoverable | terminal)
```

Requirements 描述缺失的业务事实及影响，例如：

```ts
{
  id: string
  kind: "user_input" | "evidence" | "resource" | "capability"
  description: string
  requiredFor: string
  acceptedFormats?: string[]
  alternatives?: string[]
}
```

Requirement 不是已经写好的用户问题，也不是 Planner action：

```text
question
nextAction
pendingToolCall
requiredAction = ask_user
```

这些字段不属于 Flow 业务合同。

## 6. 用户追问与恢复

正确链路：

```text
Flow returns requirements
  -> Parent interprets against global goal
  -> Parent asks user or reports capability gap
  -> user reply enters next Agent run
  -> restore same Skill flow/session
  -> reducer consumes new facts
  -> continue same controller
```

不得：

- 在 interruption 后从原始目标新建一份 Flow；
- 重复询问已经进入结构化 facts 的信息；
- 把访谈子阶段完成误判为完整用户目标完成。

## 7. 与自由 SubAgent loop 的关系

普通 Skill-owned SubAgent 可以运行 task-local Pi tool loop。

当 Skill 存在专用 Flow 时：

```text
Flow / Reducer
= this Skill's controller
```

不得在 Flow 外再叠一个自由 Child Planner，让两个控制器轮流决定领域下一步。

允许的内部能力：

- 受治理 TaskModel 调用；
- 纯函数归一化；
- deterministic scoring；
- ViewModel / HTML / SVG renderer；
- 本 Skill 内部 directive handoff。

这些是 Flow 实现，不是 nested Skill。

## 8. Tool、Runtime 与 Evidence

Flow 不凭自身存在获得 Harness Tool 或 private Runtime。

真实执行仍遵循：

```text
Skill requirement
∩ environment capability
∩ exposure / binding
∩ Policy / Approval
```

外部执行结果必须进入 Evidence / structured observation，再由 Flow reducer 消费。Flow 不得私下绕过 Policy、approval 或审计。

## 9. 状态边界

Flow state 只保存恢复业务执行所需的最小真相：

- phase / round；
- 已确认结构化 facts；
- 不确定项与矛盾项；
- active requirements；
- accepted evidence refs；
- delivery readiness；
- artifact / report refs；
- resume identity。

不得复制：

- 完整聊天历史；
- 全量 Tool Result；
- 全量 Trace；
- 大文件正文；
- CurrentTaskFrame 完整副本。

## 10. Internal handoff

同一 Skill 可以在 Flow 内部把冻结状态交给专用 renderer：

```text
assessment state
  -> report handoff
  -> scoring / ViewModel / HTML / PDF
  -> artifacts
```

该 handoff 必须：

- 由 public Skill 所有；
- 使用同一事实源；
- 不重新从聊天历史拼装状态；
- 不成为第二个 discoverable Skill；
- 不引入第二套用户会话控制权。

## 11. Completion

Flow 的 `flowCompleted` 只表示 controller 已达到该 Skill 定义的业务终点。

对于端到端 Skill，完成标准必须覆盖最终交付。例如 `fertility-assessment`：

```text
信息采集完成
!= 用户目标完成

结构化评估
+ 确定性评分
+ 报告生成
+ 行内 / artifact 交付
= completed
```

Parent 只能在结构化完成状态和 Evidence / Artifact 足够时冻结交付。

## 12. Trace

至少记录：

```text
skillId / flow runtime id
session / run identity
phase / round
working state
requirements
interruption reason
resume
internal handoff
artifacts
delivery readiness
terminal status
```

Trace 只记录 controller 事实，不反向决定 Flow 状态。

## 13. 当前非目标

- 通用 cross-Skill handoff；
- 多 active Flow 并行；
- nested SubAgent；
- Flow 自主调度任意 Tool；
- Flow 自主决定用户 global completion；
- 把所有 Skill 强制迁移为状态机。

## 14. Hard Rules

1. Stateful Flow 是可选确定性 controller，不是 Skill 本体。
2. 当前只有 `fertility-assessment` 注册专用 Conversation Flow。
3. Flow 与自由 Skill-owned Child loop 不得双重控制同一领域执行。
4. Parent 始终保留用户对话、Policy、Approval、terminal contract 与最终交付。
5. Requirements 必须描述业务缺口，不得携带 Planner action。
6. 恢复必须继续同一 session / controller，不得从头重跑。
7. 内部 renderer handoff 不得注册成第二个 public Skill。
8. Flow 不扩大 ToolExposure 或 Runtime 权限。
9. 完成必须由结构化状态、Evidence 和 Artifact 支持。
10. V1 不做 cross-Skill coordinator 或 nested SubAgent。