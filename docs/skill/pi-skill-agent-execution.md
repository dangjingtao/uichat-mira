---
status: current
owner: agent-runtime / skill-runtime
last_verified: 2026-08-06
layer: raw-source
module: Agent
feature: SubAgentExecution
doc_type: current-contract
canonical: true
related:
  - ../AGENT_CURRENT_TRUTH.md
  - README.md
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - ../harness/agentgraph-harness-protocol.md
  - ../../server/src/agent/nodes/forked-skill-agent.ts
  - ../../server/src/skills/agent/subagent-runtime.ts
---

# Delegated Worker / SubAgent 当前合同

> 本页只定义真正需要 task-local execution ownership 的 Worker。它不再用于证明“每个 Skill 都应该 fork”。当前代码仍会把普通 matched Skill 统一送入 Worker，这是已知兼容行为和迁移缺口。

## 1. 两类 Worker

### Generic Task Worker

由 Main Planner 显式选择：

```text
Parent
-> delegate_task(goal, acceptanceCriteria)
-> generic-task Worker
-> local tool loop
-> structured result
-> Parent acceptance
```

适用于无固定 Skill、但边界明确的多步工作包。

### Skill Delegated Worker

只适用于 `execution.mode=delegated-worker`：

```text
anchored task + SkillContext + capability grant
-> one Skill Worker
-> governed Tool / private Runtime
-> Evidence / Artifact / Requirement / Deliverable
-> Parent governance
```

当前合理对象：

```text
docx / pdf / pptx / xlsx ready routes / github-collaboration
```

不适用：

```text
black-mirror-writer / product-critic / deep-interview
```

这些属于 Parent context-only。

## 2. 单层边界

```text
Parent
-> one Worker
```

Worker 禁止：

- `delegate_task`；
- nested Worker；
- cross-Skill handoff；
- 扩展 global goal；
- 直接与用户对话；
- 访问未授予能力；
- 选择任意 executable / shell / provider / runtime；
- 把观察性 Trace 当控制指令。

## 3. 所有权

Parent owns：

- global goal；
- decomposition；
- primary Skill routing；
- acceptance criteria；
- user interaction；
- Policy / Approval；
- terminal contract；
- final delivery。

Worker owns：

- delegated local goal；
- local plan；
- concrete capability loop；
- task-local repair；
- Evidence coverage；
- Artifact construction；
- route-local completion judgment。

Worker completed 后 Parent 不应重做同一 Artifact；但 Parent 仍必须验证 completion evaluator 已通过。

## 4. 输入合同

目标 Worker 输入：

```text
anchored global/current goal
current subtask
acceptance criteria
confirmed facts
current user delta
SkillContext
workspace binding
actual child capability grant
```

当前实现主要把 `state.question || state.goal.text` 作为 goal。续轮中 `state.question` 往往只是本轮短回复，因此当前不等于完整 anchored task input。

迁移要求：Worker 不得只靠本轮回复猜原任务。

## 5. Capability envelope

Package 声明 requirement，不授予能力。

目标 Child capability：

```text
Capability Grant Registry
∩ environment registered/healthy
∩ route requirement
∩ workspace
∩ Policy / exact Approval
```

受信任 Child grant 可以独立于 Parent ToolExposure 构建，但必须：

- 不修改 Parent `state.toolExposure`；
- Trace 明确显示 grant source；
- 绑定 Skill id/version/publisher/digest；
- user/external deny by default；
- private Runtime 不能只凭字符串 id 获得。

当前 grant 分散在 built-in Registry、`LEGACY_OFFICE_EXECUTION`、known binding map 与 origin 特判中，尚未形成独立真相源。

## 6. Route eligibility

Worker 启动前必须确定 route，并检查该 route 的 required capability。

禁止：

```text
Skill 声明多个能力
+ 任意一个 ready
-> 整个 Skill 可以执行
```

XLSX 示例：

```text
inspect -> office_spreadsheet
create/edit/fix -> wenshu_xlsx_xml_runtime
```

XML binding pending 时 create/edit/fix 必须在 Worker 启动前阻断。

## 7. User requirement

Worker 返回中性业务 requirement：

```ts
{
  id
  kind
  description
  requiredFor
  acceptedFormats?
  sensitivity?
}
```

`description` 不是用户问题。

正确链：

```text
Worker requirement
-> Parent global relevance / safety judgment
-> Parent writes question
```

当前 wrapper 会直接使用 `userPrompt || description` 生成 ask_user；这是已知越界，不能作为新实现合同。

## 8. Result contract

### 当前结果

当前 Worker 主要返回：

```text
completed
insufficient_evidence
needs_input
failed
summary
Evidence
Artifacts
Requirements
missingEvidence
trace/checkpoint
```

### 目标补充

必须增加正式 Deliverable：

```ts
deliverables: Array<
  | { kind: "text"; content: string }
  | { kind: "artifact"; artifactRef: string }
  | { kind: "structured"; data: unknown }
>
```

`summary` 是运行摘要，不是完整文章、报告正文或用户交付物。

## 9. Completion evaluator

`completed` 只有 route evaluator 通过才可被 Parent接受。

最低检查：

- acceptance criteria coverage；
- required Evidence refs；
- required Artifact type/readability；
- side-effect readback；
- unresolved gaps；
- runtime terminal result。

禁止：

- 任意 governed Tool call + 任意 Evidence 就覆盖 malformed envelope；
- read/inspect 中间结果被当作 create/write 完成；
- model summary 单独成为强 completion proof。

当前 `normalizeMalformedCompletion()` 的恢复门槛偏弱，应改为 evaluator-driven。

## 10. Approval checkpoint

当前 exact approval checkpoint 合同保留：

- Skill id/version；
- tool id / call id；
- frozen input / input hash；
- transcript；
- Evidence / Artifacts；
- trace seq / working state。

恢复规则：

- 只消费当前 exact approval；
- approval 一次一用；
- 不从原始 goal 重跑；
- Skill/version/call/hash 任一不一致即阻断。

这是当前 Worker 最成熟的治理边界。

## 11. 普通 needs_input resume

当前普通 model-authored `needs_input` 没有与 approval 等价的 transcript checkpoint。下一轮通常重新创建 Worker。

目标规则：

- 需要恢复同一个 Worker 时返回 `checkpointRef`；
- 不需要恢复时明确由 Parent 重新委派 anchored task；
- 多轮业务状态不应靠自由 Worker transcript，应该使用 Stateful Flow。

## 12. Workspace

- `workspaceBound=true` 没有 workspace 时执行前阻断；
- 输入、输出、staging 只能在 workspace / managed Artifact Store；
- SkillRoot / RuntimeRoot 不得成为用户任务写入位置；
- packaged script 不通过 Terminal 任意执行。

## 13. Stateful Flow 不属于自由 Worker

Stateful Flow 是 deterministic controller：

```text
Flow / Reducer
-> projection / requirement / delivery
```

它不再叠一个 Pi Worker loop。`fertility-assessment` 当前走 Flow；MiraDocs 建议迁移 durable Flow。

## 14. Trace

记录：

- Worker run id；
- Skill identity/version/digest；
- anchored task / route；
- grant source；
- requested vs actual capabilities；
- readiness；
- workspace；
- Tool events；
- Evidence / Artifact / Deliverable；
- requirements；
- approval / resume；
- completion evaluator；
- terminal status。

## 15. 当前代码锚点

- `server/src/agent/nodes/forked-skill-agent.ts`
- `server/src/agent/nodes/prepare-context-with-forked-skill.ts`
- `server/src/skills/agent/profiles.ts`
- `server/src/skills/agent/subagent-runtime.ts`
- `server/src/skills/agent/pi-core.ts`
- `server/src/skills/agent/tool-adapters.ts`

## 16. 当前已知不合规

1. 普通 Skill 一律 fork；
2. input 未形成完整 anchored task envelope；
3. external private Runtime grant 存在洞；
4. flat capability 无 route eligibility；
5. requirement 可能直接控制用户问题；
6. completion normalization 偏弱；
7. long text deliverable 缺正式字段；
8. ordinary needs_input 无可靠 resume。

这些问题不能通过继续强化 Prompt 解决，必须修改执行合同与 Runtime gate。
