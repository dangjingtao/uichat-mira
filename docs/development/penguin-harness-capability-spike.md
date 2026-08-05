---
status: planned
owner: agent-runtime / skill-runtime / product
last_verified: 2026-08-05
layer: wiki
module: Agent
feature: LongRunningSkillAndAutonomy
doc_type: research
canonical: false
related:
  - ../AGENT_CURRENT_TRUTH.md
  - ../EVALUATION_CURRENT_TRUTH.md
  - ../skill/README.md
  - ../skill/pi-skill-agent-execution.md
  - ../harness/agentgraph-harness-protocol.md
  - ../knowledge-system/DOCUMENTATION_STANDARDS.md
---

# PenguinHarness Capability Spike：长技能、主动任务、自主规划与自主进化

> 本页是 Planning / Research，不是当前产品能力声明。它研究 PenguinHarness 对 Mira 产品能力增强与补充的价值，并给出不破坏 Agent V1.5 稳定合同的分期方向。

## 1. Spike 结论

结论是 **GO，但只做选择性吸收，不把 PenguinHarness 作为 Mira Runtime 依赖，也不替换 Mira Agent Core。**

PenguinHarness 对 Mira 最有价值的不是通用 Agent Loop，而是它把以下对象接成了一条可验证闭环：

```text
Agent State
→ Session / Trace
→ Benchmark
→ Candidate Change
→ Snapshot
→ Re-evaluation
→ Accept or Rollback
```

Mira 当前已经具备：

- 持久化 `AgentRun`；
- Main Planner 与 `TaskCoverageView`；
- 单层 Generic / Skill-owned SubAgent；
- Stateful Skill Flow；
- Policy / Approval / exact invocation checkpoint；
- Evidence / Artifact / execution trace；
- 一套面向 Knowledge Base / RAG 的 Evaluation 工作流。

Mira 真正缺少的是：

1. **跨进程、跨时间的 Durable Task Orchestration**；
2. **定时、条件与外部事件触发层**；
3. **长技能的版本化状态、恢复和迁移合同**；
4. **跨多个 AgentRun 的目标级规划与预算治理**；
5. **面向 Agent / Skill / Planner 的版本化评测与晋级闭环**。

优先级必须是：

```text
Durable Task Kernel
→ Scheduled / Proactive Trigger
→ Durable Skill
→ Goal-level Planning
→ Evaluation Gate
→ Supervised Evolution
```

不应反过来从“自主进化”开始。没有 durable execution、版本、评测和回滚，自主进化只会变成自动改 Prompt 的高风险演示。

## 2. 研究问题

本 Spike 回答四个问题：

1. Mira 的“长技能”应该是什么，和现有 Stateful Skill Flow 有什么区别？
2. 主动 / 定时任务应该放在 Agent Loop 内还是 Loop 外？
3. 自主规划如何跨多个执行段持续推进，同时不重做现有 Planner？
4. 自主进化怎样建立证据、版本、评测和回滚，而不是模型自说自话？

## 3. Mira 当前基线

### 3.1 AgentRun 已持久化，但不是通用 Durable Workflow

当前 `AgentRun` 可以保存：

- `queued / running / waiting_approval / waiting_user / completed / failed / blocked / cancelled`；
- goal、observations、Evidence；
- frozen `pendingToolCall`；
- approval、Policy decision；
- `currentTaskFrame`；
- `finalizationPacket`；
- runtime input。

代码锚点：

- `server/src/agent/types.ts`
- `server/src/agent/run-store.ts`
- `server/src/db/repositories/agent-run.repository.ts`

但当前 checkpoint 主要围绕 `waiting_approval` 保存。它不是一个可以在任意 phase、任意等待原因、服务重启之后继续推进的通用工作流检查点。

代码锚点：

- `server/src/agent/runtime-checkpoint.ts`

因此：

```text
AgentRun persisted
!= Durable Task resumable from every boundary
```

### 3.2 Stateful Skill Flow 是确定性局部控制器，不是长期任务宿主

当前 Stateful Skill Flow 已经能够维护：

- session；
- phase / round；
- structured requirements；
- interruption；
- deliveryReady / flowCompleted。

它的正确定位仍然是：

```text
Stateful Skill Flow / Reducer
= bounded Skill-local deterministic controller
```

它不负责：

- 服务重启后的通用任务恢复；
- 定时唤醒；
- 条件等待；
- 外部事件订阅；
- 多日任务的 lease / ownership；
- Agent / Skill 版本演进。

### 3.3 Main Planner 不应被扩成长期工作流引擎

当前 Main Planner 负责一个 AgentRun 内的滚动决策，并通过 `TaskCoverageView` 区分：

```text
latest evidence answerable
!= global task completable
```

这是正确的局部完成判断。长期任务不能通过给 `currentTaskFrame`、`planList` 或 Planner Prompt 无限加字段来实现。

长期任务需要额外一层 orchestration：

```text
Durable Task Orchestrator
  → starts or resumes one bounded AgentRun / SkillRun segment
  → persists checkpoint and next wake condition
  → waits
  → starts the next bounded segment
```

Planner 仍只决定当前 segment 的下一步，不负责系统时钟、任务 lease、重启恢复和跨日状态。

### 3.4 Evaluation 已存在，但当前只覆盖 RAG

Mira 当前 Evaluation 对象链是：

```text
EvaluationPackage
→ EvaluationDataset
→ EvaluationRun
→ SampleResult
→ Attempt
→ MetricSummary
```

它已经具备：

- Dataset / Run 持久化；
- repeat / concurrency / timeout；
- 日志、样本结果和指标；
- 评测中心和报告。

但当前限制包括：

- 主要面向 Knowledge Base / RAG；
- 调度仍在 backend 当前进程中；
- Run 持久化不等于进程重启后恢复执行；
- 没有 Agent State / Skill Version provenance；
- 没有 Candidate / Baseline / Promotion / Rollback；
- 没有隐藏回归集或产品发布门禁。

代码锚点：

- `server/src/services/evaluation.service.ts`
- `server/src/routes/evaluation/index.ts`
- `desktop/src/shared/api/evaluation.ts`
- `docs/EVALUATION_CURRENT_TRUTH.md`

## 4. PenguinHarness 机制拆解

研究基于 PenguinHarness `main` 在 2026-08-05 可见实现。

### 4.1 Goal mode：多个完整 Task 组成一个目标

Penguin 的 Goal mode 不是把单次 Agent Loop 无限延长，而是：

```text
Goal
→ Round 1 Task
→ inspect goal status / token budget
→ Round 2 Task
→ ...
→ complete / blocked / budget_limited / aborted
```

它将目标写入 `GOAL.yaml`，每个 round 重新注入 objective，并用：

- token budget；
- `maxRounds`；
- goal status；
- abort / failed round；

决定是否继续。

代码锚点：

- `Prism-Shadow/penguin-harness/packages/core/src/goal/goal-file.ts`
- `Prism-Shadow/penguin-harness/packages/core/src/goal/goal-loop.ts`

值得吸收的是“**目标由多个有界 Task 组成**”和独立预算，不是照搬 `GOAL.yaml`。Mira 的 durable state 应由数据库和版本化 checkpoint 负责，工作区文件最多作为人类可读投影，不能成为唯一运行时真相。

### 4.2 Scheduler：声明式意图与运行状态分开

Penguin 的 Schedule 定义保存在 Agent State 的 TOML 文件中，Scheduler 运行状态保存在 SQLite：

```text
schedule file = declarative intent
SQLite row = fired / missed / last slot / invalid / queued state
```

其当前语义包括：

- Server 启动时 reconcile；
- 周期扫描；
- 默认不补跑服务离线期间错过的触发；
- bound Session busy 时最多排队一个 fire；
- one-shot 与 fixed period；
- 最小 period 为 5 分钟；
- 可绑定既有 Session，或每次创建新 Session；
- 定义无效时跳过并记录错误；
- Scheduler 只投递 scheduled message，由 Session / Agent 继续执行。

代码锚点：

- `Prism-Shadow/penguin-harness/packages/server/src/runtime/scheduler.ts`
- `Prism-Shadow/penguin-harness/packages/server/src/runtime/schedule-file.ts`
- `Prism-Shadow/penguin-harness/packages/server/src/db/repos/schedules.ts`

值得吸收的是：

1. intent 与 runtime state 分离；
2. misfire 策略明确；
3. busy concurrency 明确；
4. schedule 只触发任务，不直接执行工具。

### 4.3 Agent optimization：证据、候选、评测、快照和回滚

Penguin 的 `agent-optimization` Skill 明确规定：

```text
Reference Agent State
→ diagnose score-linked Traces
→ one falsifiable hypothesis
→ one bounded Candidate
→ snapshot Reference
→ evaluate frozen Case set × runs
→ strictly higher score: accept
→ otherwise: rollback
```

它修改的是 Agent State，例如：

- `AGENTS.md`；
- focused Skill；
- safe runtime config。

它不是模型权重训练。

代码锚点：

- `Prism-Shadow/penguin-harness/packages/skills/skills/agent-optimization/SKILL.md`
- `Prism-Shadow/penguin-harness/packages/skills/skills/agent-evaluation/SKILL.md`
- `Prism-Shadow/penguin-harness/packages/skills/skills/benchmark-design/SKILL.md`

其最重要的思想是：

```text
change without re-evaluation
!= improvement
```

但它当前仍有需要警惕的地方：

- Candidate 与 Reference 可能使用不同 runs 数直接比较；
- 只要求总分严格提高，未天然保证关键 Case 不回归；
- 同一 frozen Case set 被反复用于优化，仍可能逐渐过拟合；
- LLM 生成、诊断和评分链条仍需要独立人工与隐藏集约束；
- 自动修改生产 Agent State 的供应链和权限风险很高。

Mira 应吸收闭环，不应照搬其全部接受规则。

## 5. 产品价值矩阵

| 能力 | Penguin 提供的参考 | Mira 当前 | 对 Mira 价值 | 结论 |
| --- | --- | --- | --- | --- |
| 有界 Agent Loop | Session / context engine | 已有稳定 V1.5 主线 | 低 | 不替换 |
| Goal 多 Round | Goal mode + budget | 缺跨 AgentRun 目标层 | 高 | 吸收概念 |
| 定时任务 | declarative schedule + SQLite state | 无通用 scheduler | 很高 | 优先实现 |
| 长技能 | Agent State + Skill + Goal / Session | 有 Stateful Flow，缺 durable host | 很高 | 优先实现 |
| Trace | 完整 Session Trace | 已有 execution trace | 中 | 补跨段关联 |
| Benchmark | Agent / Skill Case evaluation | 当前主要是 RAG Evaluation | 很高 | 扩展现有 Evaluation |
| Snapshot / rollback | versioned Agent State archive | 无统一 Skill / Agent 快照 | 高 | 后续实现 |
| 自主进化 | optimizer loop | 无 promotion loop | 中长期高 | 必须晚于评测门禁 |
| Web / Desktop / Provider | 一整套宿主产品 | Mira 已有自己的产品与 Provider | 负价值 | 不集成 |

## 6. 建议目标架构

### 6.1 新增 Durable Task Host，放在 AgentRun 之上

```text
User / Schedule / Event / Condition
              │
              ▼
        DurableTask
              │
              ▼
   DurableTask Orchestrator
      │       │       │
      │       │       └─ wait until time / dependency / user / approval
      │       └─ persist checkpoint / progress / budget
      └─ start or resume one bounded execution segment
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
       AgentRun            SkillRun
          │                   │
          └──── Evidence / Artifact / Requirement
                              │
                              ▼
                  Task-level completion / notification
```

关键原则：

1. Durable Task 不是 Conversation Thread；
2. 一个 Durable Task 可以产生多个 AgentRun；
3. 每个 AgentRun 仍遵守现有 V1.5 Planner / Policy / Evidence 合同；
4. Scheduler 不直接执行工具，只创建或唤醒 Durable Task；
5. Orchestrator 不根据 UI 状态推断执行；
6. 所有恢复必须从持久化 checkpoint 和 exact pending work 恢复；
7. 不允许借长期任务引入 recursive delegation。

### 6.2 建议核心对象

#### `DurableTask`

```ts
interface DurableTask {
  id: string;
  ownerUserId: number;
  title: string;
  objective: string;
  status:
    | "queued"
    | "running"
    | "waiting_time"
    | "waiting_dependency"
    | "waiting_user"
    | "waiting_approval"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  currentPhase?: string;
  currentStepId?: string;
  nextWakeAt?: string;
  budget: DurableTaskBudget;
  activeLease?: TaskLease;
  skillRef?: VersionedSkillRef;
  createdAt: string;
  updatedAt: string;
}
```

#### `DurableTaskCheckpoint`

至少保存：

- task version；
- phase / step；
- completed milestones；
- current bounded goal；
- linked AgentRun / SkillRun ids；
- Evidence / Artifact refs，而非复制全部正文；
- pending requirement / approval；
- next wake condition；
- budget usage；
- retry / repair state；
- idempotency key；
- checkpoint codec version。

#### `TaskLease`

用于避免多个 backend / worker 同时推进同一任务：

- owner id；
- acquiredAt；
- expiresAt；
- heartbeat；
- fencing token。

即使 Mira 初期只有单进程，也应从第一版保存 lease / fencing 语义，否则以后服务化时会被迫重写任务一致性。

### 6.3 运行时分层

```text
Trigger Layer
= 什么时候应创建或唤醒任务

Durable Orchestration Layer
= 当前任务处于哪个 phase、下一段做什么、何时等待

Agent / Skill Execution Layer
= 当前有界工作段如何 plan / act / observe / recover

Policy / Approval Layer
= exact invocation 是否允许

Evidence / Artifact Layer
= 什么真实发生、什么可交付

Evaluation / Promotion Layer
= 某个版本是否真的更好
```

这些层不能合并成一个“万能自主 Agent”。

## 7. 长技能合同

### 7.1 四级 Skill 模型

```text
L1 Context Skill
= 提供领域规则，不独立执行

L2 Task Skill
= 一个 forked SubAgent 拥有有界局部施工

L3 Stateful Skill
= 确定性 Flow / Reducer，允许中断和结构化需求

L4 Durable Skill
= Stateful Skill + Durable Task Host + versioned checkpoint + wake policy
```

`Durable Skill` 不是让 SubAgent 一直留在内存中运行。它应当是：

```text
Skill package
+ state schema
+ checkpoint codec
+ phase reducer / orchestrator adapter
+ wake policy
+ completion contract
+ migration policy
+ versioned runtime requirements
```

### 7.2 Durable Skill Manifest 建议新增

```yaml
execution:
  mode: durable
  controller: reducer
  max_active_segment_minutes: 20

state:
  schema_version: 1
  migration: required

wake:
  supports_time: true
  supports_dependency: true
  supports_user_input: true

concurrency:
  policy: single_active
  coalesce: true

completion:
  artifact_required: true
  evidence_required: true
```

这仍然只是 requirement envelope，不授予任何 Tool / Runtime / Permission。

### 7.3 第一批适合的长技能

优先选择可验证、可恢复、边界明确的工作流：

1. 定期生成日报 / 周报；
2. 内容批量转换、校验、发布；
3. 网站定期抓取、差异分析、摘要；
4. Release 构建、产物检查、分发状态汇总；
5. Knowledge Base 周期性增量同步与评测。

不建议第一批做：

- 模糊的“自己经营一个公司”；
- 无限网页探索；
- 自动改整个仓库并直接合并；
- 没有验收条件的长期研究；
- 无人审批的外部发送、支付、删除和生产发布。

## 8. 主动 / 定时任务

### 8.1 定时与主动必须分开

```text
Scheduled Task
= 到达明确时间或周期后触发

Condition Watch
= 某个可验证条件成立后触发

Event Trigger
= 外部系统明确发送事件后触发

Proactive Suggestion
= Mira 根据上下文建议用户创建任务，不自动获得执行权
```

第一阶段只实现 Scheduled Task；Condition / Event 作为后续 Trigger Adapter。

### 8.2 Scheduler 第一版建议语义

- 支持 one-shot 与 fixed interval / calendar schedule；
- 显式 timezone；
- 最低频率限制；
- 默认 no-backfill；
- 可选 `fire_once` misfire policy；
- `single_active` 并发策略；
- busy 时 coalesce 为最多一个 pending wake；
- 每次 fire 生成唯一 idempotency key；
- schedule definition 与 runtime state 分离；
- 用户可以 pause / resume / run now / cancel；
- 每次 fire 都有可查看的 TaskRun；
- 风险动作仍逐次走 Policy / Approval；
- 服务离线期间的行为必须可预测并在 UI 明示。

### 8.3 不允许的捷径

- Scheduler 直接调用 Harness Tool；
- Schedule 创建时一次批准，未来永久复用 exact invocation approval；
- 用聊天消息列表充当任务队列；
- 只靠内存 timer；
- 进程启动后把所有错过的任务瞬间补跑；
- 多个 worker 无 lease 抢同一个任务。

## 9. 自主规划

### 9.1 两层规划，而不是重做 Planner

```text
Goal / Orchestration Plan
= milestones、dependencies、budget、wake condition、segment boundary

Execution Planner
= 当前 AgentRun 内的 nextAction
```

Goal-level plan 可以保存：

- milestones；
- acceptance criteria；
- dependency refs；
- status；
- next eligible milestone；
- total / remaining budget；
- blocked reason；
- revision history。

它不能保存：

- 模型隐藏推理；
- 未进入 Evidence 的事实；
- 可直接执行的 Tool invocation；
- 可复用审批。

### 9.2 初期不要上通用 DAG

第一版使用：

```text
ordered milestones
+ explicit blocked dependencies
+ one active segment
```

只有出现真实的并行 / 汇合需求后，才评估 DAG scheduler。当前先解决：

- 可暂停；
- 可恢复；
- 可等待；
- 可审计；
- 不重复执行；
- 不因服务重启丢失进度。

### 9.3 Goal round 合同

一个 round 应当是一个完整的 bounded execution segment：

```text
select milestone
→ create AgentRun / SkillRun
→ execute under V1.5 contracts
→ commit Evidence / Artifact
→ update task checkpoint
→ decide complete / next / wait / blocked
```

不要在同一个 AgentRun 内无限增加 iteration；跨 round 的预算和完成判断属于 Orchestrator。

## 10. 自主进化

### 10.1 Mira 中的正确对象

```text
Versioned Capability
= Agent policy / Planner policy / Skill / runtime config 的一个不可变版本

Evaluation Suite
= public train cases + private holdout + critical regression cases

Candidate Change
= 一个可审阅、可回滚的 bounded diff

Promotion Decision
= 是否允许 Candidate 成为 active version
```

### 10.2 建议闭环

```text
Production / Test Traces
→ failure pattern clustering
→ one falsifiable hypothesis
→ create Candidate on isolated copy
→ snapshot Reference
→ train-case evaluation
→ private holdout evaluation
→ critical regression evaluation
→ cost / latency / side-effect checks
→ human diff review
→ staged promotion or rollback
```

### 10.3 晋级门槛

Candidate 不能只因平均分更高就晋级。至少需要：

1. 总分达到最小提升阈值，而不是随机高 0.01；
2. critical Case 不允许下降；
3. holdout 不下降；
4. side-effect / Policy violations 为 0；
5. cost、latency、tool-call count 不超过预算；
6. 使用同一 model / provider / thinking level 比较；
7. Agent / Skill 内容 fingerprint 与结果绑定；
8. 多次重复运行，记录方差；
9. Candidate diff 可审阅；
10. 生产发布初期必须人工确认。

### 10.4 第一阶段只做 Supervised Evolution

第一阶段允许系统自动：

- 归纳失败模式；
- 提出假设；
- 在隔离副本生成 Candidate；
- 跑评测；
- 生成 diff、分数和风险报告；
- 推荐接受或拒绝。

第一阶段不允许系统自动：

- 修改 active production Skill；
- 修改 Policy / permission defaults；
- 发布未经人工检查的脚本；
- 用生产秘密作为评测输入；
- 自己修改 Benchmark 后宣称变强；
- 自动提升外部发送、删除或发布权限。

## 11. 与现有 Evaluation 的结合

不要新造一套完全独立的 Benchmark 产品。应把现有 Evaluation 抽象为可扩展执行后端：

```text
Evaluation Suite
  ├─ RAG case runner（当前）
  ├─ Agent task runner
  ├─ Skill artifact runner
  └─ Policy / side-effect runner
```

建议新增概念：

- `subjectType: rag | agent | skill | planner_policy`；
- `subjectRef: id + immutable version + fingerprint`；
- `suiteVersion`；
- `caseVisibility: public | holdout | critical`；
- `environmentSnapshot`；
- `runtimeRef`；
- `artifactAssertions`；
- `sideEffectAssertions`；
- `promotionPolicy`。

当前 RAG Evaluation 可继续使用原有 UI 和数据模型；Agent / Skill 评测在共享 Run / Attempt / Report 之上扩展，不强行把所有指标统一成 RAG 指标。

## 12. 建议分期

### Phase 0：Spike（本分支）

交付：

- 机制对照；
- 能力价值矩阵；
- 目标架构；
- 分期和边界；
- 明确不引入 Penguin Runtime dependency。

### Phase 1：Durable Task Kernel

范围：

- `DurableTask` / `TaskRun` / `TaskEvent` 持久化；
- lease / fencing；
- checkpoint；
- restart recovery；
- cancel / pause / resume；
- 一个 active segment；
- 用现有 AgentRun 作为 segment executor。

验收：

- backend 在 segment 中、等待中、segment 完成后重启都不丢任务；
- 同一 wake 不重复执行；
- 不改变 Planner / Normalize / Policy / Evidence 主线。

### Phase 2：Scheduled Trigger

范围：

- one-shot / recurring schedule；
- timezone / misfire / concurrency；
- run now / pause / resume；
- task history / next wake UI；
- 通知和错误可见。

验收：

- Schedule 只唤醒 Durable Task；
- 服务离线行为可预测；
- busy coalesce 与 idempotency 有回归测试。

### Phase 3：Durable Skill Contract

范围：

- Durable Skill manifest；
- state schema / codec / migration；
- phase reducer adapter；
- 首个真实长技能。

建议首个样例：

```text
定时读取数据源
→ 生成日报
→ 校验产物
→ 等待或请求审批
→ 发布 / 保存
→ 返回可追踪报告
```

### Phase 4：Goal Orchestration

范围：

- milestone plan；
- per-goal budget；
- multi-segment continuation；
- blocked / waiting dependency；
- plan revision history。

保持：

- 一个 segment 内仍使用现有 Main Planner；
- 不引入 recursive SubAgent；
- 不先做通用 DAG。

### Phase 5：Agent / Skill Evaluation

范围：

- generic Evaluation subject；
- immutable version / fingerprint；
- public / holdout / critical Case；
- trace-linked results；
- artifact / side-effect assertions；
- Candidate comparison report。

### Phase 6：Supervised Evolution

范围：

- trace diagnosis；
- Candidate isolated copy；
- snapshot / rollback；
- automatic evaluation；
- human promotion gate。

### Phase 7：Condition / Event / Proactive Layer

范围：

- connector events；
- condition watchers；
- dependency completion；
- proactive suggestions；
- notification policy。

只有在 durable task、权限、去重和审计稳定后，才开放更多无人值守执行。

## 13. 黑盒验证计划

PenguinHarness 可以作为外部对照系统，而不是运行时依赖。使用同一模型和同一组任务比较：

1. 多文件读取、修改、验证；
2. 执行中断后恢复；
3. 服务重启后的等待与恢复；
4. one-shot / recurring schedule；
5. bound session busy 时的并发语义；
6. 多 Round Goal；
7. Skill 版本变化前后评测；
8. Candidate 失败后的回滚；
9. approval 在恢复后是否仍绑定 exact invocation；
10. cost / latency / tool-call count / failure rate。

每项记录：

- success / partial / failed；
- completion proof；
- tool calls；
- token / cost；
- duration；
- duplicate side effects；
- restart recovery；
- human intervention；
- trace completeness。

## 14. 明确不采用

1. 不替换 Mira Pi Loop / AgentGraph stable facade；
2. 不引入 Penguin OmniMessage、AgentHub、Server、Web 或 Provider 作为核心依赖；
3. 不让 `GOAL.yaml` 成为 Mira durable state 真相源；
4. 不把 Schedule 变成权限或 Tool invocation；
5. 不允许 long task 绕过 exact approval；
6. 不为长任务开放 recursive delegation；
7. 不使用同一套 Case 反复优化后直接宣布泛化提升；
8. 不让 Optimizer 读取 private rubric、生产秘密或用户无关数据；
9. 不自动发布未审阅的 Candidate；
10. 不在 Durable Task Kernel 稳定前做“完全自主进化”。

## 15. 最终判断

PenguinHarness 对 Mira 的价值，不是提供一套可以直接嫁接的 Agent 框架，而是验证了几个重要产品方向确实可以被工程化：

```text
目标可以拆成多个完整、有界、可计量的执行段；
定时意图可以和运行状态分离；
Agent / Skill 的变化可以绑定 Trace、版本、评测和回滚；
“学会了”必须由复测证明，而不是由模型自己宣布。
```

Mira 应把这些思想收进自己的产品合同：

```text
长技能
= 可暂停、可恢复、可迁移、可验证的 Durable Skill

主动任务
= 受控 Trigger 对 Durable Task 的唤醒

自主规划
= Goal Orchestrator 管长期里程碑，Main Planner 管当前执行段

自主进化
= Candidate + Benchmark + Holdout + Snapshot + Human Promotion
```

这条路线能够补上 Mira 从“能完成一个会话任务”到“能长期负责一件事”的能力缺口，同时保住现有 Agent V1.5 已经建立的权限、Evidence、Approval 和终止边界。
