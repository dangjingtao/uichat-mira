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
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-package-runtime-contract.md
  - ../../server/src/skills/flow/registry.ts
---

# Stateful Skill Flow 当前合同

## 1. 本页结论

Stateful Skill Flow 是可选的确定性业务控制器，只用于确实需要多轮结构化状态、阶段、requirements、checkpoint 或 deterministic reducer 的 Skill。

目标模型：

```text
execution.mode = stateful-flow
-> Conversation Flow / Reducer
-> structured interruption or completed delivery
-> Parent governance
```

它不是：

- 一个自由 Skill Worker；
- 第二个 Agent loop；
- Main Planner 逐步填写的状态表；
- 所有 Skill 的默认门槛；
- nested Skill；
- cross-Skill coordinator。

当前兼容 wrapper 会把 Flow 的工作状态投影成 `subagent` Trace 命名，以兼容现有 UI 和持久化字段；该命名不改变 Flow 是 deterministic controller 的本质。

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

建议迁移对象：

```text
miradocs
```

MiraDocs 已经声明固定 phase、staging、taskKey、checkpoint、审批恢复、失败续跑和不重复施工。这些是 durable workflow state，不应继续只依赖普通临时 Worker transcript。

## 3. 何时需要 Flow

适合：

- 多轮收集结构化业务事实；
- 必须区分 phase / round；
- 需要 requirements / interruption；
- 需要恢复同一业务会话；
- 需要 durable staging / workflow checkpoint；
- 需要 deterministic scoring / validator / renderer；
- 子阶段完成不等于最终交付完成；
- 需要强 completion truth。

不需要 Flow：

- 单轮写作或评审方法；
- 普通 GitHub 协作；
- 一次 bounded Office artifact；
- 只需要 Parent SkillContext 的对话任务；
- 一个普通 delegated Worker 能在当前 run 内完整验收的任务。

## 4. Parent 与 Flow 所有权

Parent owns：

- 用户对话；
- global goal；
- primary Skill routing；
- 判断 requirement 是否阻塞主目标；
- 用户可见问题措辞；
- Policy / Approval；
- terminal contract；
- 最终交付。

Flow owns：

- 本 Skill 的 phase / round；
- 结构化 facts；
- 不确定项与矛盾项；
- business requirements；
- interruption / resume；
- delivery readiness；
- deterministic reducer / scoring / renderer handoff。

Flow 不得：

- 改写 global goal；
- 直接创建 `nextAction`；
- 直接控制用户问题；
- 注册或扩大 ToolExposure；
- 自行获得 private Runtime；
- 把内部阶段暴露为第二个 Skill。

## 5. 结果语义

Flow controller 返回：

```text
working
interrupted(requirements)
completed(delivery state / artifacts)
failed(recoverable | terminal)
```

Requirement：

```ts
{
  id: string
  kind: "user_input" | "evidence" | "resource" | "capability"
  description: string
  requiredFor: string
  acceptedFormats?: string[]
  alternatives?: string[]
  sensitivity?: "normal" | "personal" | "health" | "financial"
}
```

`description` 是业务缺口，不是最终用户问题。

禁止作为正式 Flow 字段：

```text
question
nextAction
requiredAction = ask_user
pendingToolCall
```

Flow 可以提供非强制 `suggestedPrompt` 供 Parent 参考，但 Parent 必须经过 global-goal、已知事实、语气和 safety policy 复核。

## 6. 当前用户问题越界

当前 `prepare-context-with-forked-skill.ts` 的兼容 wrapper 会优先读取：

```text
requirement.userPrompt || requirement.description
```

并直接生成 `nextAction.ask_user.question`。

这不符合目标合同，因为：

- Flow/Worker 可以绕过 Parent 对全局阻塞性的判断；
- requirement 描述可能不是自然问题；
- 敏感领域缺少用户对话层安全复核；
- 多个 requirement 可能被机械拼接。

迁移要求：wrapper 只提交 requirements；由 Parent Planner / Dialogue Policy 决定是否询问以及如何询问。

## 7. 恢复

正确链路：

```text
Flow interrupted
-> persist same session/state
-> Parent asks or resolves capability
-> new user/evidence input
-> restore exact Flow session
-> reducer consumes delta
-> continue from current phase
```

必须绑定：

- Skill id/version；
- Flow runtime version；
- session id；
- active phase/round；
- accepted facts/evidence refs；
- active requirements；
- package/config versions relevant to deterministic results。

不得：

- interruption 后从原始目标新建 Flow；
- 依赖自由 Worker transcript 充当业务数据库；
- 重复询问已进入 facts 的信息；
- 恢复时重复不可幂等 side effect。

## 8. 与 delegated Worker 的关系

```text
context-only
!= delegated-worker
!= stateful-flow
```

当 Skill 使用 Flow：

```text
Flow / Reducer
= single domain controller
```

禁止在 Flow 外再叠 Pi Worker，让两个控制器轮流决定领域下一步。

允许的内部能力：

- 受治理 TaskModel；
- pure normalization；
- deterministic scoring；
- ViewModel / HTML / SVG renderer；
- package-owned internal handoff。

这些是 Flow 实现组件，不是 nested Skill 或自由 Worker。

## 9. Capability 与 Evidence

Flow 声明能力需求，不授予能力。

真实能力：

```text
Capability Grant
∩ selected phase/route requirement
∩ adapter registered
∩ environment healthy
∩ workspace
∩ Policy / exact Approval
```

外部执行结果必须形成 Evidence / Artifact，再由 reducer 消费。Flow 不得私下执行 Harness Tool、绕过 approval 或决定是否记录 Evidence。

如果某个 phase 缺少能力：

```text
interrupted(kind=capability)
```

不能退化为另一个未经批准的工具或脚本路径。

## 10. State 边界

Flow state 只保存恢复业务执行所需的最小真相：

- phase / round；
- confirmed facts；
- uncertainty / conflicts；
- active requirements；
- accepted Evidence refs；
- route/phase checkpoint；
- delivery readiness；
- Artifact refs；
- resume identity；
- relevant rules/profile versions。

禁止复制：

- 完整聊天历史；
- 全量 Tool Result；
- 全量 Trace；
- 大文件正文；
- CurrentTaskFrame 完整副本；
- secrets / provider credentials。

## 11. Internal handoff

同一 Skill 可以把冻结状态交给内部 renderer：

```text
business state
-> internal handoff
-> deterministic renderer
-> delivery view / artifacts
```

要求：

- public Skill owns handoff；
- 同一事实源；
- 不从聊天历史重新拼状态；
- handoff id 不进入 public Registry；
- renderer 不获得用户对话控制权；
- 输入与配置版本进入 Trace；
- 输出接受 completion evaluator。

## 12. Completion

`flowCompleted` 只表示 Flow 到达声明的业务终点；它不自动等于用户目标完成。

必须同时满足：

```text
required phases completed
+ deliveryReady
+ required Evidence/Artifact/Deliverable exists
+ completion evaluator passed
+ no blocking requirements
```

例如 `fertility-assessment`：

```text
information collection completed
!= user goal completed

assessment
+ deterministic scoring
+ report generation
+ delivery
= completed
```

MiraDocs 若迁移 Flow：

```text
files rendered
!= site delivered

staging build verified
+ remote write verified
+ Actions/Pages verified when requested
+ exact delivery status
= completed
```

## 13. High-stakes Flow

健康、金融、法律等 Flow 还必须：

- 标记 sensitivity；
- 定义 emergency/not-applicable route；
- 固定规则、来源和 profile 版本；
- 关键结论由 validator/reducer 约束，不只靠 prompt；
- 记录 profile 选择与降级；
- 输出不能越过诊断/处方/效果承诺边界；
- 敏感 requirement 由 Parent 安全组织问题。

`fertility-assessment` 需要继续专项验证：医学边界是否全部由 Runtime/validator 强制，而不是仅写在 SKILL.md。

## 14. Trace

至少记录：

```text
skill/package/flow runtime identity and version
session
phase / round
working state
requirements / sensitivity
interruption / resume
Capability request / grant / readiness
Evidence refs
internal handoff
config/profile/rule versions
Artifacts / delivery readiness
completion evaluator
terminal status
```

Trace 只记录事实，不反向驱动 reducer。

## 15. 当前非目标

- cross-Skill automatic handoff；
- 多 active Flow 并行；
- nested Worker；
- Flow 自主调度任意 Tool；
- Flow 自主决定用户 global completion；
- 把所有 Skill 迁移成状态机。

## 16. Hard Rules

1. Stateful Flow 是 deterministic controller，不是 SubAgent 外壳。
2. 当前只有 `fertility-assessment` 注册 Flow；MiraDocs 是建议迁移对象，不是已完成。
3. Flow 与自由 Worker 不得双重控制同一领域。
4. Parent 始终拥有用户对话、global goal、Policy、Approval 和最终交付。
5. Requirement 描述业务缺口，不直接控制用户问题。
6. 恢复必须继续同一 session / phase，不从头重跑。
7. internal handoff 不注册第二个 public Skill。
8. Flow 不凭自身扩大 Tool/Runtime 权限。
9. Capability 按 phase/route fail closed。
10. completed 需要 delivery state + Evidence/Artifact + evaluator。
11. high-stakes 关键边界必须 machine-enforced。
12. V1 不做 cross-Skill coordinator 或 nested Worker。
