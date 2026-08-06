---
status: current
owner: skill-runtime
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillContext
doc_type: current-contract
canonical: true
related:
  - README.md
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - pi-skill-agent-execution.md
  - skill-runtime-design.md
  - skill-package-runtime-contract.md
  - skill-discovery-layout-contract.md
---

# Skill Context 与渐进式披露当前合同

## 1. Purpose

本页只定义：

- Skill 发现与匹配；
- L0/L1/L2 渐进式披露；
- task-context continuation；
- execution responsibility 投影的边界。

核心定义：

> SkillContext 回答“这类任务应该怎样做”。它不回答“谁执行”、不授予能力，也不证明任务已经完成。

## 2. Context 链路

```text
SkillScanner
-> SkillRegistry
-> SkillMatcher
-> SkillLoader
-> DisclosurePlan
-> SkillContext
```

到这里为止只形成领域上下文。

目标执行分流：

```text
SkillContext
├─ context-only -> Parent
├─ delegated-worker -> bounded Skill Worker
└─ stateful-flow -> deterministic Flow / Reducer
```

当前兼容实现仍把普通 matched Skill 统一送入 forked Worker；这是已知迁移差距，不属于 SkillContext 的本质合同。

## 3. Progressive Disclosure

```text
L0 Manifest
  -> identity / routing / lifecycle / execution responsibility
L1 SKILL.md
  -> domain strategy / hard rules / completion criteria
L2 Resource
  -> reference / template / example / script metadata
Execution Boundary
  -> Parent / governed Worker / Flow
```

### L0

Scanner 只 bounded 读取 frontmatter，不预加载正文与 resources。

当前 `SkillManifest` 主要包含：

```ts
{
  id
  name
  description
  version
  entry
  origin
  source?
  category?
  license?
  runtimeRequirements?
  execution?
}
```

目标 Manifest 还必须正式包含：

```text
lifecycle
routing
execution.mode
completion
publisher / trust projection
```

当前 parser 不是完整 YAML parser，嵌套元数据和未知字段可能被忽略。目标 schema 见 `skill-authoring-and-governance-contract.md`。

### L1

SKILL.md 正文负责：

- Routing domain semantics；
- 方法和领域规则；
- 禁止行为；
- route capability requirement；
- quality / completion criteria；
- Resource URI。

SKILL.md 不负责授予 Tool/Runtime。

### L2

```text
skill://<skill-id>/<relative-path>
```

Resource 默认按需读取。Resource 不注册 Tool；script 被读取或 materialize 也不构成执行许可。

## 4. Package boundary

Canonical source layout：

```text
<root>/<category>/<skill-id>/SKILL.md
```

兼容：

```text
<user-root>/<skill-id>/SKILL.md
<system-root>/<skill-id>/SKILL.md  # explicit built-in only
```

一旦目录存在 `SKILL.md`，该目录就是完整 package boundary，Scanner 不继续把内部 references/scripts/helper `SKILL.md` 注册为 public Skill。

## 5. Duplicate identity

当前 Scanner 使用 `seen` first-wins，重复 id 会静默忽略后者。这是已知不合规行为。

目标规则：

```text
duplicate id
-> fail closed
-> emit conflict diagnostics
-> resolve only through explicit trust / registry policy
```

不得依赖 root 顺序或 `readdir()` 顺序形成身份优先级。

## 6. Origin 与 Trust

当前 origin：

```text
built-in | user | external
```

它只能说明 package 来源，不能同时表示执行信任。

已知差距：

- user Tool/Runtime 声明会被清空；
- external 声明仍可能进入 profile；
- 已知 private Runtime id 可能进一步被解析为 ready adapter。

因此在独立 Grant Registry 落地前：

```text
external / user private Runtime
= deny by default
```

目标必须把 `origin` 与 `trustTier` 分离。

## 7. Matching 当前事实

当前支持：

```text
explicit
attachment extension / MIME
id / display name
hard-coded semantic hints
continuation
```

类型中存在 `embedding`，但当前 Matcher 没有 embedding 执行路径。不得把它写成已实现优先级。

当前 semantic hints 仍硬编码在核心 Matcher，只覆盖部分 Skill。目标是把 aliases/intents/file hints/conflicts 移入 Package，Matcher 只实现通用算法。

## 8. 一个 primary

V1 最多自动激活一个 primary Skill。

- secondary 只用于 Trace / 候选；
- 不默认同时注入多个完整正文；
- 冲突无法可靠消解时由 Parent 澄清；
- 生命周期为 review/blocked 的 Skill 目标上不得普通自动匹配。

当前 `status: review` 尚未进入 Manifest gating，是已知差距。

## 9. Continuation

```text
本轮明确命中新 Skill
-> 新 primary

本轮无新命中
+ 明显补参数 / 确认 / 修改 / 继续
-> inherit recent primary
-> source = continuation

明确换题 / 取消 / 结束
-> do not inherit
```

Continuation 继承：

- primary identity；
- anchored task semantics；
- relevant disclosure selection。

它不是长期 Memory，也不是 Stateful Flow。

### Context-only continuation

Parent 必须拥有相关对话历史和 current task frame，适用于 `deep-interview` 等动态对话 Skill。

### Worker continuation

Worker 首次委派目标应包含 anchored goal、acceptance criteria、confirmed facts 和本轮 delta。当前普通 Worker 主要只收到本轮 goal，是已知 P0/P1 行为缺口。

### Flow continuation

Flow 通过 session / reducer state 恢复，不依赖自由模型聊天 transcript 充当业务状态。

## 10. DisclosurePlan

```ts
type SkillDisclosurePlan = {
  primarySkillId?: string
  includeBody: boolean
  availableResources: SkillResource[]
  disclosedResourceUris: string[]
}
```

```ts
type SkillContext = {
  instruction: string
  primary?: {
    id: string
    version: string
    name: string
    body: string
    origin?: SkillPackageOrigin
    execution?: SkillExecutionManifest
  }
  resources: SkillResource[]
  disclosedResources: Array<{ uri: string; content: string }>
  match?: {
    source: SkillMatchSource
    reason: string
    score: number
    secondarySkillIds: string[]
  }
}
```

`primary.execution` 当前是兼容投影，不应继续承担最终 Grant 真相。

## 11. Execution responsibility

目标字段：

```text
context-only
delegated-worker
stateful-flow
```

当前代码仍使用 `inline | fork` 类型，并且 resolver 无条件归一为 fork。`inline` 当前不可达；该枚举与静默改写必须在迁移后删除。

规则：

- Context Skill 不应因为“被发现”自动创建 Worker；
- Worker profile 只适用于 delegated-worker；
- Flow binding 只适用于 stateful-flow；
- execution responsibility 不由 Package Markdown 自行授予能力。

## 12. Context budget

1. Manifest 轻量；
2. 自动只加载 primary SKILL.md；
3. Resource 按需；
4. 大内容使用 URI / Artifact reference；
5. 超预算优先保留 Routing / Hard Rules / Completion；
6. continuation 重建当前上下文，不复制历史多份 Skill 正文。

## 13. Trace

至少记录：

```text
matched / not_matched
primary id / version / origin
package lifecycle / publisher / digest when available
match source / score / reason
candidate conflicts
disclosed resources
execution responsibility
capability request (not grant)
toolExposureMutation=false
```

Capability grant、environment readiness、approval 和 completion evaluator 属于执行 Trace，不应伪装成 SkillContext 自身字段。

## 14. 当前 Acceptance

已落地：

1. bounded manifest scan；
2. package boundary；
3. 单 primary；
4. SKILL.md 动态加载；
5. stable `skill://` URI；
6. selective disclosure；
7. continuation；
8. independent Skill Trace。

尚未达到目标规范：

1. real YAML + schema；
2. package-owned routing metadata；
3. duplicate fail closed；
4. lifecycle gating；
5. origin/trust separation；
6. three execution responsibility modes；
7. anchored Worker input；
8. Capability Grant Registry。
