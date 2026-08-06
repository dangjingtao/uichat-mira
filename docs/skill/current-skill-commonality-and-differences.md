---
status: current
owner: skill-runtime
last_verified: 2026-08-06
layer: wiki
module: SKILL
feature: SkillSystem
doc_type: current-analysis
canonical: false
related:
  - README.md
  - skill-authoring-and-governance-contract.md
  - skill-contract-audit-20260806.md
  - skill-context-design.md
  - pi-skill-agent-execution.md
  - skill-package-runtime-contract.md
  - skill-runtime-design.md
---

# 当前 Skill 共性与差异（dev）

> 本页是盘点，不替代 canonical 合同。第一次盘点把“当前所有普通 Skill 都 fork”误当成了应该长期统一的共性；经过反向审计，现修正为：统一的是治理边界，不是执行责任类型。

## 1. 真正共性

所有 public Skill 都应共享：

```text
稳定 package identity
-> routing / lifecycle
-> one primary Skill
-> progressive disclosure
-> explicit execution responsibility
-> governed capability / user interaction / workspace / approval
-> route-specific completion proof
-> Trace
```

不应强制共享：

```text
是否创建 Worker
是否有 Tool
是否有 private Runtime
是否有 Stateful Flow
是否需要 Artifact
完成真相来自文本、远程回读还是 deterministic renderer
```

## 2. 三个执行家族

### Context-only

```text
SkillContext
-> Parent conversation / answer
```

当前对象：

```text
deep-interview
black-mirror-writer
product-critic
```

它们需要完整用户语境，没有独立 Tool/Runtime/Artifact ownership。当前代码把它们 fork 是兼容行为和已知不合规，不是设计目标。

### Delegated worker

```text
anchored task + SkillContext + capability grant
-> bounded Worker
-> Evidence / Artifact / Deliverable
-> Parent governance
```

当前对象：

```text
docx
pdf
pptx
xlsx ready routes
github-collaboration
```

`wechat-article-layout` 目标也属于此类，但应使用 managed Script Runtime，且当前 package/build 闭环未验证。

### Stateful flow

```text
Parent user turn
-> deterministic Flow / Reducer
-> projection / requirements / delivery
-> Parent
```

当前对象：

```text
fertility-assessment
```

建议迁移：

```text
miradocs
```

MiraDocs 已经要求 durable phase、staging、checkpoint、失败续跑和不重复施工，超出普通临时 Worker 的可靠责任范围。

## 3. Inventory

### Registry built-in

```text
docx
xlsx
pdf
pptx
github-collaboration
wechat-article-layout
```

### 分类目录 public package

```text
github-collaboration
miradocs
deep-interview
black-mirror-writer
product-critic
fertility-assessment
```

`github-collaboration` 同 id 视为一个 identity。当前分析涉及 11 个唯一 Skill target。

`wechat-article-layout` 目前只有 Registry 定义得到确认；预期 package 文件与脚本未在当前 branch 闭环验证，因此不能视为 ready。

## 4. 差异矩阵

| Skill | 目标执行类型 | 能力 | 完成真相 | 当前主要问题 |
| --- | --- | --- | --- | --- |
| docx | delegated-worker | office_document | readable DOCX + requested changes | legacy profile / domain special-case |
| pdf | delegated-worker | office_pdf | operation Evidence / readable PDF | grant / inventory / route evaluator |
| pptx | delegated-worker | office_presentation | validator + renderer + artifact | provenance / inventory / grant |
| xlsx | delegated-worker | inspect ready; XML pending | route-specific workbook validation | flat readiness 会掩盖 route 缺口 |
| github-collaboration | delegated-worker | GitHub Harness | current remote Evidence + readback | completion gate / flat Tool list |
| wechat-article-layout | delegated-worker + script runtime | package script | rendered HTML + smoke | package 未闭环，Terminal 边界过宽 |
| miradocs | stateful-flow target | Terminal + GitHub | staged build + remote deploy verification | 普通 Worker 承担 durable workflow |
| fertility-assessment | stateful-flow | Flow + scoring/report runtime | deliveryReady + report | user prompt ownership / high-stakes validator |
| deep-interview | context-only | none | Parent dialogue progression | fork 丢上下文与 resume |
| black-mirror-writer | context-only | none | complete Parent text | Worker 无正式长文本 deliverable |
| product-critic | context-only | none | Parent covers judgment criteria | fork 增加成本且无治理收益 |

## 5. 统一约束

### Identity / Routing

- id/version/publisher 稳定；
- duplicate fail closed；
- lifecycle 影响 Matcher；
- routing truth 属于 Package；
- one primary。

### Capability

- declaration != grant；
- origin != trust；
- private Runtime 绑定 package identity/digest；
- route-specific eligibility；
- external/user deny by default。

### User interaction

- Parent 是唯一用户对话所有者；
- Worker/Flow 只返回中性 requirement；
- requirements 不直接成为 UI question。

### Completion

- route evaluator；
- Artifact/Evidence 必须对应用户目标；
- malformed envelope 不因任意中间 Evidence 自动升级；
- context-only 由 Parent completion criteria 验收。

### Workspace / Approval

- skillRoot/runtimeRoot/workspaceRoot 分离；
- exact approval 一次一用；
- side effect 前读后验；
- packaged script 不借通用 Terminal 获得隐式执行权。

## 6. 当前最重要的越界

```text
P0 external package 可借已知 private Runtime id
P0 一律 fork 导致 Context Skill 责任错误
P0 Child requirement 直接控制用户问题
P0 completion proof 偏弱
P0 flat capability 无 route readiness
P0 duplicate id first-wins
P0 wechat package/build 未闭环
```

完整证据与影响见：

```text
docs/skill/skill-contract-audit-20260806.md
```

## 7. 修复方向

```text
先封 Grant / duplicate / route / completion / user interaction
-> 再拆 context-only / delegated-worker / stateful-flow
-> 再迁移 MiraDocs durable Flow
-> 最后清 YAML parser / matcher hardcode / legacy profile / package inventory
```

不能继续把所有差异塞进一个更复杂的 SubAgent Prompt；那只会把契约问题埋进模型行为。
