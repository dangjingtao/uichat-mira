# Skill Context / Progressive Disclosure 设计

Status: Current
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
  - ../tooling-runtime/harness-runtime-design.md

## Purpose

这页定义 Mira 基础 Skill 的发现、匹配、渐进式披露与动态上下文注入合同。

核心定义：

> **Skill 是一个通过渐进式披露，向 Agent 动态注入领域知识、执行策略和能力使用说明的可复用上下文能力包。**

Skill 的本体不要求独立 Runtime、状态机或 SkillInstance；但 Skill 可以声明或依赖 Tool、MCP、Script、Runtime、模板和 Reference。

需要内部状态、多工具业务约束、Evidence reducer、checkpoint / resume 的复杂业务，可以选择接入 `Stateful Skill Runtime`。该高级层见 `skill-runtime-design.md`。

---

## 1. 核心分层

```text
Skill Package
  Manifest + SKILL.md + Resources
        ↓
Progressive Disclosure
  按当前任务只披露需要的上下文
        ↓
SkillContext
  “这类事情应该怎么做”
        ↓
Parent Agent / Planner
        ↓
ToolExposure
  “当前能做什么”
        ↓
Tool / MCP / Script / Runtime
```

两个运行时真相必须分开：

```text
state.toolExposure
= Agent 当前能调用什么

state.skillContext / currentTaskFrame.skillContext
= Agent 当前应该掌握哪些领域策略和已披露资源
```

SkillContext 不替代 ToolExposure，也不得扩大 ToolExposure。

---

## 2. 渐进式披露模型

Mira 使用三层上下文披露 + 一层执行边界：

```text
L0  Skill Manifest
    ↓ 任务命中
L1  SKILL.md
    ↓ Agent 确实需要更深资料
L2  Skill Resource / Reference / Template / Example
    ↓ 需要真实执行
Execution Boundary
    Tool / MCP / Script / Runtime
```

### L0 — Manifest

启动或安装后只保留轻量 Manifest，用于发现与匹配。

不得在 L0 预加载：

- SKILL.md 全文
- references 全文
- templates / examples 全文
- scripts 源码
- runtime 实现细节

Manifest 的目标是低 token、低 IO、可索引。

### L1 — SKILL.md

当当前任务命中 Skill 时加载。

SKILL.md 应主要表达：

- Routing / 什么时候使用
- 领域规则
- 能力边界
- 执行建议
- 质量标准
- 完成标准
- 可继续读取的 Resource URI

SKILL.md 是动态语义上下文，不是 Tool，也不是独立 Agent。

### L2 — Skill Resources

Reference / Template / Example 等资源默认只建立清单，不自动全量注入。

Agent 根据当前任务和 SKILL.md 指引按需读取：

```text
skill://xlsx/references/DCF_SKILL.md
skill://docx/references/office-runtime-reference.md
skill://pptx/references/pptx-swarm.md
```

稳定 URI 隐藏真实磁盘路径，允许未来统一内置 Skill、用户 Skill、社区 Skill 和远程安装 Skill。

### Execution Boundary

Tool / MCP / Script / Runtime 不属于 DisclosureLevel。

它们是执行能力：

- Skill 可以声明依赖；
- SkillContext 可以告诉 Agent 何时以及为什么使用；
- 真实可用性、权限、side effect、approval、sandbox 仍由既有执行体系决定；
- SkillLoader 不直接执行 Script / Runtime。

---

## 3. V1 Manifest 合同

V1 Manifest 保持最小，不提前引入 dependency graph 或复杂生命周期。

概念类型：

```ts
type SkillManifest = {
  id: string
  name: string
  description: string
  version: string

  entry: string // normally SKILL.md

  source?: string
  license?: string

  runtimeRequirements?: string[]
}
```

### 暂不作为 V1 核心字段

以下能力可以以后扩展，但不应成为基础 Skill 的入场门槛：

```text
priority
conflicts
dependencies
maxTokens
sticky lifecycle
```

原因：

- `dependencies` 很容易演化为第二套 Skill dependency runtime；
- `conflicts` / `priority` 在 V1 单 primary 自动激活下不是必要能力；
- `maxTokens` 属于 Context Budget Policy，不应把预算策略写死进 Skill 本体；
- sticky / lifecycle 属于任务上下文或 Stateful Skill Runtime，而不是基础 Skill 的必需属性。

---

## 4. Skill Package 目录

推荐结构：

```text
.skills/
└─ docx/
   ├─ SKILL.md
   ├─ references/
   │  └─ office-runtime-reference.md
   ├─ templates/
   ├─ examples/
   └─ scripts/
```

并非每个目录都必须存在。

基础原则：

> **Package 可以包含执行资源，但 Package 本身仍然是上下文与分发单位。**

安装 Package 不等于创建 SkillInstance，也不等于扩大 Harness 权限。

---

## 5. 核心接口

### 5.1 SkillScanner

只负责发现 Skill，并读取轻量 Manifest。

```ts
interface SkillScanner {
  scan(paths: string[]): Promise<SkillManifest[]>
}
```

职责：

- 发现 `SKILL.md`；
- 解析 frontmatter；
- 校验最低 Manifest 合同；
- 不读取正文；
- 不读取 reference 内容；
- 不执行 scripts；
- 不触碰 Harness Registry。

热重载 / watch 属于开发体验增强，不是 V1 核心接口。

### 5.2 SkillRegistry

保存已发现、已安装且可用的 Skill Manifest。

```ts
interface SkillRegistry {
  register(manifest: SkillManifest): void
  get(id: string, version?: string): SkillManifest | null
  listAvailable(): SkillManifest[]
}
```

Registry 不复制 Tool Registry，也不拥有 Tool 可用性真相。

### 5.3 SkillMatcher

```ts
type SkillMatchCandidate = {
  skillId: string
  score: number
  reason: string
  source: "explicit" | "resource" | "exact" | "semantic" | "embedding"
}

type SkillMatchResult = {
  primary: SkillMatchCandidate | null
  secondary: SkillMatchCandidate[]
}
```

V1 匹配优先级：

```text
0. Explicit trigger
   $docx / /skill:docx

1. Deterministic resource match
   filename / extension / MIME / attachment metadata

2. Exact semantic hint
   “做一个 DCF Excel”

3. Lightweight semantic match
   name / description / keywords

4. Embedding / task model
   only when ambiguous
```

### V1 自动激活规则

> **自动注入只选择一个 primary Skill。**

`secondary` 只作为候选、trace 或后续 Parent Agent 协调依据，不默认同时加载多个 SKILL.md。

原因：

- 避免上下文膨胀；
- 避免多个 Skill 规则互相污染；
- 保持任务边界清晰；
- 跨 Skill 任务继续由 Parent Agent 协调。

显式组合能力可以后续独立设计，不作为 V1 默认行为。

### 5.4 SkillLoader

```ts
interface SkillLoader {
  loadContent(manifest: SkillManifest): Promise<SkillContent>
  listResources(manifest: SkillManifest): Promise<SkillResource[]>
  loadResource(uri: string): Promise<LoadedSkillResource>
  invalidate(skillId: string): void
}
```

概念类型：

```ts
type SkillContent = {
  manifest: SkillManifest
  body: string
}

type SkillResource = {
  uri: string
  skillId: string
  name: string
  kind: "reference" | "template" | "example" | "script"
  description?: string
}

type LoadedSkillResource = SkillResource & {
  content: string
}
```

Loader 可以缓存 IO 结果，但缓存不是 Skill 生命周期。

### 5.5 Disclosure Planner

基础 Skill 不建立 `idle -> matched -> active -> released` 状态机。

每个任务准备阶段根据当前输入计算披露计划：

```ts
type SkillDisclosurePlan = {
  primarySkillId?: string
  includeBody: boolean
  availableResources: SkillResource[]
  disclosedResourceUris: string[]
}
```

职责：

- 决定当前是否披露 L1；
- 记录哪些 L2 已被按需读取；
- 遵守 Context Budget；
- 不直接执行 Tool / Script / Runtime；
- 不创建 SkillInstance。

### 5.6 SkillContext

不要使用 `Map` 作为跨边界合同，避免 trace / JSON serialization / persistence 问题。

```ts
type SkillContext = {
  primary?: {
    id: string
    version: string
    body: string
  }

  resources: SkillResource[]

  disclosedResources: Array<{
    uri: string
    content: string
  }>
}
```

SkillContext 是结构化上下文，由 Agent Context / Prompt 构造层消费。

---

## 6. 与 Mira Agent / Harness 的集成

### 6.1 不让 Harness 变成 PromptAssembler

SkillContext 应进入 `Prepare Context / currentTaskFrame`，而不是让 Harness 负责拼接 Skill Prompt。

推荐链路：

```text
Prepare Context
│
├─ Tool capability preparation
│    ↓
│  canonical state.toolExposure
│
└─ Skill context preparation
     ↓
   SkillScanner / Registry
     ↓
   SkillMatcher
     ↓
   SkillLoader
     ↓
   SkillDisclosurePlan
     ↓
   currentTaskFrame.skillContext

        ↓
      Planner
```

### 6.2 两个真相源互不替代

```text
ToolExposure
= 当前允许 Planner 调用哪些真实工具

SkillContext
= 当前任务应该掌握哪些领域策略
```

SkillContext 可以描述某类 Tool / Runtime 的正确使用方式，但不能因为 Skill 命中就把不可用 Tool push 进 `state.toolExposure`。

### 6.3 Planner 合同不改

V1：

- 不新增 `use_skill` action；
- 不新增第二 Agent Loop；
- 不生成 `pendingToolCall`；
- 不绕过 Normalize / Policy / ToolNode；
- Planner 继续只从 `state.toolExposure` 选择真实执行能力。

SkillContext 只是 Planner 当前上下文的一部分。

---

## 7. Reference 按需披露

Reference 默认不自动全量加载。

推荐 SKILL.md 显式留下资源入口：

```markdown
For DCF methodology, read:
`skill://xlsx/references/DCF_SKILL.md`
```

Agent 确实进入 DCF 任务时再读取。

推荐流程：

```text
用户：做一个 Excel DCF
  ↓
命中 xlsx Manifest
  ↓
注入 xlsx/SKILL.md
  ↓
SKILL.md 指向 DCF Reference
  ↓
Agent 判断当前需要 DCF 细则
  ↓
read skill://xlsx/references/DCF_SKILL.md
  ↓
Reference 进入 disclosedResources
  ↓
Planner 继续正常工具决策
```

这样避免：

```text
xlsx 命中
→ 三表 + DCF + Comps + 所有模板全塞 Prompt
```

---

## 8. Context Budget

Token 预算属于 Agent Context Policy，不属于 Skill 生命周期。

原则：

1. Manifest 始终轻量；
2. 只自动加载 primary 的 SKILL.md；
3. Reference 按需；
4. 大型资源使用 URI / artifact / file reference，不复制全文；
5. 已披露资源可以根据当前 Task Frame 重建，不要求隐藏全局状态长期 sticky；
6. 超预算时优先保留当前 primary Skill 的核心 Routing / Hard Rules / Completion，再裁剪低优先级参考内容。

具体 token 数字由模型上下文预算策略决定，不写死在 Skill Manifest。

---

## 9. Scripts / Runtime / Tool 依赖边界

Skill 可以声明：

```text
runtimeRequirements
Tool capability IDs
Script resources
MCP capability assumptions
```

但必须保持：

- SkillScanner 不执行；
- SkillLoader 不执行；
- SkillContext 不授予权限；
- Runtime Pack 安装不等于 Harness 注册；
- Script 执行必须经过现有 Terminal / Sandbox / Policy / Approval 合同；
- Tool 可用性仍由 Harness / environment 决定。

因此：

> **Skill 可以告诉 Agent“应该用什么”，但不能凭这句话让系统获得原本没有的能力。**

---

## 10. 基础 Skill 与 Stateful Skill Runtime

### 基础 Skill

适合：

- DOCX 处理规则
- PDF 处理规则
- Excel 建模规范
- PPT 生成规范
- Web Search 策略
- 代码审查方法

组成：

```text
Manifest
+ SKILL.md
+ optional Resources
+ optional Tool / Runtime / Script dependency declaration
+ dynamic SkillContext
```

不要求：

```text
SkillInstance
state machine
Evidence reducer
checkpoint
resume
stage tool constraints
```

### Stateful Skill Runtime

仅在业务确实需要时启用，例如：

- 多阶段合同审阅；
- 大型代码迁移；
- 长期可恢复发布流程；
- 复杂三表 / DCF 建模；
- 20+ 页或多份演示的可恢复项目执行。

它可以增加：

```text
SkillDefinition
SkillInstance
state / stage
Evidence reducer
completion evaluation
checkpoint / resume
stage-specific tool constraints
```

但它仍然：

- 不创建第二 Agent Loop；
- 不拥有第二套 Tool Registry；
- 不扩大 Harness 权限；
- 不绕过 Planner / Policy / Evidence。

---

## 11. 当前 WenShu Skills

当前四个文枢 Skill 都可以作为基础 Skill 首批验证对象：

```text
docx
xlsx
pdf
pptx
```

预期行为：

### DOCX

```text
attachment: contract.docx
user: “帮我审一下这个”
→ deterministic attachment match
→ inject docx/SKILL.md
→ references only on demand
→ Planner uses existing eligible Read / Office capabilities
```

### XLSX

```text
user: “做一个 DCF Excel”
→ match xlsx
→ inject xlsx/SKILL.md
→ on demand read skill://xlsx/references/DCF_SKILL.md
→ execution remains existing Office / Runtime capability path
```

### PDF

```text
user: “合并这几个 PDF”
→ match pdf
→ inject pdf/SKILL.md
→ no unnecessary report-creation references
→ use eligible PDF runtime capability when available
```

### PPTX

```text
user: “做一份 30 页路演 PPT”
→ match pptx
→ inject pptx/SKILL.md
→ on demand disclose pptx-swarm reference
→ Parent Agent remains the only control loop
```

---

## 12. V1 实现顺序

```text
1. 更新 Skill 总纲定义
2. SkillScanner + SkillRegistry
3. SkillMatcher
4. SkillLoader
5. SKILL.md 动态 SkillContext 注入
6. Stable skill:// Resource URI + Reference 按需读取
7. DOCX / XLSX / PDF / PPTX 跑通
8. 观测误匹配、token、trace、资源披露质量
9. 最后挑一个真实复杂业务验证 Stateful Skill Runtime
```

不要反过来先做通用 Skill 状态机，再寻找业务去套。

---

## 13. V1 Acceptance Criteria

基础 Skill Context V1 完成至少满足：

1. 启动时只扫描 Manifest，不预加载所有正文；
2. 用户任务可以通过 explicit / attachment / semantic 方式稳定匹配 primary Skill；
3. V1 自动注入最多一个 primary SKILL.md；
4. `state.toolExposure` 不因 Skill 匹配而被扩大；
5. Planner 不新增 `use_skill` action；
6. Reference 默认不全量加载；
7. Agent 可以通过稳定 `skill://` URI 按需读取 Reference；
8. SkillContext 可 trace、可 JSON serialize；
9. 未安装 Runtime Pack 时，Skill 仍可被发现，但执行能力必须真实报告 unavailable；
10. DOCX / XLSX / PDF / PPTX 四个 Skill 至少完成一轮真实端到端验证。

---

## 14. Hard Rules

1. **Skill 本体 = 渐进式披露的动态上下文能力包。**
2. Skill 不等于 Tool，不伪装成 Tool。
3. SkillContext 不拥有 ToolExposure 真相。
4. Skill 命中不得主动扩大 Harness `state.toolExposure`。
5. V1 自动激活只注入一个 primary Skill；secondary 默认只是候选。
6. Reference 默认按需披露，不全量注入。
7. Tool / MCP / Script / Runtime 是执行边界，不是 DisclosureLevel。
8. 基础 Skill 不建立隐藏 lifecycle / state machine。
9. Stateful Skill Runtime 是可选高级层，不是 Skill 的入场门槛。
10. Parent Agent Loop 始终是唯一控制循环。
11. Normalize / Policy / ToolNode / Evidence / Harness 现有合同不因 Skill Context 重写。
12. Skill 可以声明依赖能力，但不能凭声明获得权限或执行能力。
