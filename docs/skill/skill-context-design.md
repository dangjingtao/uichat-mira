# Skill Context / Progressive Disclosure 设计

Status: Current
Protocol: V1 Settled
Owner: chat / runtime / docs
Last verified: 2026-07-23
Layer: raw-source
Module: SKILL
Feature: SkillContext
Doc Type: design
Canonical: true
Related:
  - ./README.md
  - ./skill-runtime-design.md
  - ./skill-package-runtime-contract.md
  - ../harness/agentgraph-harness-protocol.md

## Purpose

这页定义 Mira Base Skill 的发现、匹配、渐进式披露、动态上下文注入、多轮连续性与 Trace 合同。

核心定义：

> **Skill 是通过渐进式披露向 Agent 动态注入领域知识、执行策略和能力使用说明的可复用上下文能力包。**

`SkillInstance / state / reducer / checkpoint` 属于可选 Stateful Skill Runtime，不属于 Base Skill V1 的最低合同。

---

## 1. 总体链路

```text
SkillScanner
  ↓
SkillRegistry
  ↓
SkillMatcher
  ↓
SkillLoader
  ↓
DisclosurePlan
  ↓
SkillContext
  ↓
Prepare Context / currentTaskFrame
  ↓
Planner
```

并行存在：

```text
Environment / Harness
  ↓
capability registry
  ↓ matcher / Policy
state.toolExposure
  ↓
Planner
```

两个真相源在 Planner 汇合，但互不替代。

---

## 2. 渐进式披露

```text
L0 Manifest
  ↓ match
L1 SKILL.md
  ↓ on demand
L2 Resource / Reference / Template / Example
  ↓ execution need
Execution Boundary
Tool / MCP / Script / Runtime
```

### L0 Manifest

Scanner 只读取轻量 frontmatter，不预加载正文和 references。

最低字段：

```ts
type SkillManifest = {
  id: string
  name: string
  description: string
  version: string
  entry: string
  source?: string
  license?: string
  runtimeRequirements?: string[]
}
```

`priority / conflicts / dependencies / sticky lifecycle / maxTokens` 不属于 V1 必需字段。

### L1 SKILL.md

命中 primary Skill 后加载。

正文主要表达：Routing、Hard Rules、领域策略、能力边界、质量标准、完成标准、Resource URI。

### L2 Resource

默认只列清单，不自动全量加载。

稳定 URI：

```text
skill://<skill-id>/<relative-resource-path>
```

示例：

```text
skill://xlsx/reference/DCF_SKILL.md
skill://docx/references/office-runtime-reference.md
skill://pptx/reference/pptx-swarm.md
```

当前 `read_open` 可以只读 `skill://` virtual resource，不新增 `skill_read` Tool。

### Execution Boundary

Tool / MCP / Script / Runtime 不是 DisclosureLevel。

Skill 可以声明依赖，但真实可用性、权限、approval、sandbox、side effect 继续由既有执行体系决定。

---

## 3. SkillScanner

职责：

- 发现 `SKILL.md`；
- bounded 读取文件头；
- 解析 Manifest；
- 不加载正文；
- 不加载 Reference 内容；
- 不执行 Script；
- 不注册 Tool。

概念接口：

```ts
interface SkillScanner {
  scan(paths: string[]): Promise<SkillManifest[]>
}
```

---

## 4. SkillRegistry

```ts
interface SkillRegistry {
  get(id: string, version?: string): SkillManifest | null
  listAvailable(): SkillManifest[]
}
```

Registry 是 Skill Manifest 真相，不复制 Tool Registry。

---

## 5. SkillMatcher

```ts
type SkillMatchSource =
  | "explicit"
  | "resource"
  | "exact"
  | "semantic"
  | "embedding"
  | "continuation"
```

正常首轮匹配优先级：

```text
0. explicit trigger
1. deterministic attachment / MIME / extension
2. exact semantic hint
3. lightweight semantic match
4. embedding / task model fallback
```

V1 自动注入最多一个 primary Skill。

`secondary` 只用于候选 / trace，不默认同时注入多个 Skill 正文。

---

## 6. 多轮 Task-Context Continuity

### 目标

用户回答 Planner 追问时，不能因为本轮没有再次出现 `Excel / DCF / PPT` 等关键词就丢失 SkillContext。

### 规则

```text
A. 本轮正常 Matcher 命中 primary
→ 使用本轮 primary

B. 本轮未命中
+ 本轮明显是补参数 / 继续 / 确认 / 修改上一任务
→ 向最近用户轮回看最近有效 primary
→ source = continuation

C. 本轮明确新任务 / 换话题 / 取消 / 结束
→ 禁止继承旧 Skill
```

### 不变量

- continuation 不创建 SkillInstance；
- continuation 不创建 hidden lifecycle state machine；
- 继承的是任务语义上下文，不是长期 Memory；
- 新的明确 Skill 命中始终优先于 continuation；
- continuity 只在有限近期用户轮内回看，避免陈旧 Skill 污染。

### Reference continuity

继承 primary 时，DisclosurePlan 必须同时保留原始任务的披露语义。

例如：

```text
Turn 1: 帮我做一个 DCF Excel 模型
→ xlsx / exact
→ DCF_SKILL.md

Turn 2: 虚拟科技公司，历史3年，预测5年，其余默认
→ xlsx / continuation
→ disclosure query = anchor task + current reply
→ DCF_SKILL.md 继续披露
```

---

## 7. SkillLoader

```ts
interface SkillLoader {
  loadContent(manifest: SkillManifest): Promise<SkillContent>
  listResources(manifest: SkillManifest): Promise<SkillResource[]>
  loadResource(uri: string): Promise<LoadedSkillResource>
  invalidate(skillId: string): void
}
```

Loader cache 仅是 IO 优化，不是 Skill 生命周期。

Resource 合同应使用可序列化数组 / 对象，不使用 `Map` 作为跨边界合同。

---

## 8. DisclosurePlan / SkillContext

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
  }
  resources: SkillResource[]
  disclosedResources: Array<{
    uri: string
    content: string
  }>
  match?: {
    source: SkillMatchSource
    reason: string
    score: number
    secondarySkillIds: string[]
  }
}
```

SkillContext 是结构化 Agent Context，不直接操作 Tool Registry。

---

## 9. Reference 按需披露

原则：

```text
primary matched
→ load SKILL.md
→ list resources
→ only disclose resources required by current task
```

当前确定性披露：

```text
XLSX DCF
→ DCF_SKILL.md only

XLSX three-statement
→ 3_statement_model.md only

XLSX comps
→ COMPS_SKILL.md only

20+ / batch PPTX
→ pptx-swarm.md only
```

禁止：

```text
match xlsx
→ automatically inject all references
```

---

## 10. Context Budget

预算属于 Agent Context Policy，不属于 Skill 生命周期。

原则：

1. Manifest 轻量；
2. 自动只加载 primary SKILL.md；
3. Reference 按需；
4. 大资源使用 URI / artifact / file reference；
5. 超预算时优先保留 Routing / Hard Rules / Completion；
6. continuation 不应复制多份历史 Skill 正文，只重建当前需要的 SkillContext。

---

## 11. 与 Harness / AgentGraph 的边界

```text
currentTaskFrame.skillContext
= how to do this task

state.toolExposure
= what the Agent can actually call now
```

SkillContext：

- 不注册 Tool；
- 不扩大 ToolExposure；
- 不授予权限；
- 不创建 `pendingToolCall`；
- 不绕过 Normalize / Policy / ToolNode / Evidence。

主循环保持：

```text
Planner -> Normalize -> Policy -> Tool/Retrieve -> Evidence -> Planner
```

不新增 `use_skill` action，不新增第二 Agent Loop。

---

## 12. Runtime Pack / Execution Eligibility

Skill 匹配和 Tool 注册是两条独立链。

```text
SkillScanner / Matcher / Loader
→ SkillContext

Runtime Pack / Environment
→ Harness capability reconciliation
→ capability registry
→ matcher / Policy
→ state.toolExposure
```

文枢当前：

```text
office_document
→ built-in runtime capability

wenshu-office verified ready
→ office_pdf
→ office_spreadsheet
→ office_presentation
eligible for Harness registry
```

Skill 命中不参与 capability 注册决策。

---

## 13. Trace 合同

必须存在独立 `技能上下文` Trace 节点。

matched 时至少记录：

```text
primary id / name / version
match.source
match.reason
match.score
secondarySkillIds
skillBodyLoaded
availableResourceUris
disclosedResourceUris
toolExposureMutation=false
```

not_matched 时也必须明确记录，而不是无声缺失。

`continuation` 必须可见为独立 match source，不能伪装成新的 exact / semantic 命中。

---

## 14. 当前真实烟测结论

### 单轮 DCF

```text
query = 帮我做一个 DCF Excel 模型
primary = xlsx
source = exact
score = 0.96
availableResourceCount = 3
disclosedResourceCount = 1
disclosedResourceUris = [skill://xlsx/reference/DCF_SKILL.md]
```

### 多轮 DCF

```text
next query = 用一家虚拟科技公司，历史3年，预测5年，其余参数合理默认
primary = xlsx
source = continuation
disclosedResourceUris = [skill://xlsx/reference/DCF_SKILL.md]
```

说明：

- primary continuity 已工作；
- DCF Reference continuity 已工作；
- 没有把三份 XLSX Reference 全量注入。

### ToolExposure

Runtime Pack ready 后，真实 trace 已观察到 Office optional capabilities 进入正常 exposed tool candidate 路径，同时：

```text
toolExposureMutation = false
```

### 非 Skill 阻断

`Planner output was invalid JSON` 属于 Planner structured-output / recovery 问题。

除非证据显示 SkillContext 输入合同直接导致错误，否则不得把该问题归因于 Skill 协议并重构 SkillContext。

---

## 15. V1 Acceptance

当前协议层已满足 / 已实现：

1. L0 轻量 Manifest scan；
2. 单 primary 匹配；
3. SKILL.md 动态注入；
4. stable `skill://` Resource URI；
5. selective Reference disclosure；
6. `currentTaskFrame.skillContext` 注入；
7. SkillContext 不扩大 ToolExposure；
8. 独立 Skill Trace；
9. 多轮 `continuation`；
10. Runtime Pack / Tool eligibility 与 Skill match 解耦。

仍需按各业务分别验证的是**具体 Domain Runtime 输出质量和 Planner 执行稳定性**，不是 Base Skill 协议本身。

---

## 16. Hard Rules

1. **Skill 本体 = 渐进式披露的动态上下文能力包。**
2. Base Skill 不等于 Tool / Agent / Workflow / Runtime。
3. 自动注入最多一个 primary Skill。
4. Reference 默认按需披露。
5. SkillContext 与 ToolExposure 是两个独立真相源。
6. Skill 命中不得主动扩大 `state.toolExposure`。
7. `continuation` 是轻量任务上下文继承，不是 Stateful Runtime。
8. 新 Skill 明确命中优先；新任务 / 换话题 / 取消不得继承旧 Skill。
9. Tool / MCP / Script / Runtime 是 Execution Boundary，不是 DisclosureLevel。
10. Parent Agent Loop 始终唯一。
11. Base Skill 不要求 SkillInstance / reducer / checkpoint。
12. Stateful Skill Runtime 是可选高级层。
13. Skill 是否生效必须有 Trace 证据。
