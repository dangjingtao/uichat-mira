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
  - pi-skill-agent-execution.md
  - skill-runtime-design.md
  - skill-package-runtime-contract.md
  - skill-discovery-layout-contract.md
---

# Skill Context 与渐进式披露当前合同

## 1. Purpose

本页定义 Skill 的发现、匹配、渐进式披露、连续性和 execution profile 投影。

核心定义：

> SkillContext 回答“这类任务应该怎样做”；ExecutionProfile 回答“Skill-owned SubAgent 希望在什么最大能力边界内做”。两者都不等于真实权限。

## 2. 当前完整链路

```text
SkillScanner
  -> SkillRegistry
  -> SkillMatcher
  -> SkillLoader
  -> DisclosurePlan
  -> SkillContext
  -> SubAgent ExecutionProfile
  -> one Skill-owned SubAgent
  -> Evidence / Artifact / Requirement
  -> Parent delivery
```

并行存在真实能力链：

```text
Environment / Harness / Runtime adapters
  -> registered and ready capabilities
  -> exposure / binding
  -> Policy / Approval
```

两条链在执行前求交集，互不替代。

## 3. 渐进式披露

```text
L0 Manifest
  -> match
L1 SKILL.md
  -> task rules / completion contract
L2 Resource
  -> reference / template / example / script metadata
Execution Boundary
  -> governed Harness Tool / managed private Runtime
```

### L0 Manifest

Scanner 只 bounded 读取 frontmatter，不预加载正文和 references。

当前 Manifest 至少包含：

```ts
type SkillManifest = {
  id: string
  name: string
  description: string
  version: string
  entry: string
  origin: "built-in" | "user" | "external"
  source?: string
  category?: string
  license?: string
  runtimeRequirements?: string[]
  execution?: SkillExecutionManifest
}
```

### Canonical execution frontmatter

源码 Skill 新增或整理 execution metadata 时统一使用：

```yaml
execution.agent: subAgent
execution.allowedTools: read_open, github_repository
execution.runtimeBindings: office_document
execution.workspaceBound: true
```

当前 `execution.context` 不作为可配置路由；Scanner 会把 discovered Skill 统一规范化为：

```text
context = fork
agent = subAgent
```

兼容字段仍可被解析，但新文档不得继续扩散：

```text
agent
allowedTools
runtimeBindings
workspaceBound
```

`executionContext` 当前不会决定执行模式，不能继续作为规范字段。

### L1 SKILL.md

正文负责表达：

- Routing；
- domain rules；
- execution strategy；
- capability boundary；
- quality rules；
- completion criteria；
- Resource URI。

### L2 Resource

默认只建立目录，按需读取：

```text
skill://<skill-id>/<relative-path>
```

Resource 是上下文，不是新 Tool。

## 4. Discovery layout

当前公开源码布局：

```text
<root>/<category>/<skill-id>/SKILL.md
```

兼容布局：

```text
<user-root>/<skill-id>/SKILL.md
<system-root>/<skill-id>/SKILL.md  # 仅 registered built-in
```

一个目录包含 `SKILL.md` 后即成为完整 package boundary，不再向下把 references/scripts 误识别为独立 Skill。

系统/package roots 先于 user root；相同 id 的用户 Skill 不能 shadow built-in / external identity。

## 5. Origin 与执行安全

### built-in / external

可以声明 Harness Tool 和 private Runtime requirements，但真实能力仍取决于环境、binding、Policy 和 approval。

### user

用户导入 Skill 固定规范化为：

```text
context = fork
agent = subAgent
allowedTools = []
runtimeBindings = []
workspaceBound = false
```

用户 Skill frontmatter 中声明的 Tool 或 Runtime 不构成授权。

## 6. Matching

当前最多一个 primary Skill。

优先级：

```text
explicit trigger
-> attachment / MIME / extension
-> exact semantic hint
-> lightweight semantic match
-> embedding / task-model fallback
```

Match source：

```text
explicit
resource
exact
semantic
embedding
continuation
```

secondary 只用于候选和 trace，不默认同时注入多份 Skill 正文。

## 7. Task-context continuity

```text
本轮明确命中新 Skill
-> 使用新 primary

本轮无新 Skill
+ 明显是补参数 / 确认 / 修改 / 继续同一任务
-> 继承最近有效 primary
-> source = continuation

明确新任务 / 换话题 / 取消
-> 不继承旧 Skill
```

continuation 继承：

- primary Skill identity；
- 原任务的 disclosure 语义；
- 当前任务相关的 resource selection。

它不等于长期 Memory，也不自动激活 Stateful Flow。

## 8. DisclosurePlan 与 SkillContext

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
    execution?: SkillExecutionManifest
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

SkillContext 不直接修改 Tool registry 或 approval state。

## 9. 当前执行投影

每个 discovered Skill 都解析为：

```ts
{
  skillId,
  mode: "forked-agent",
  engine: "pi-agent-core",
  allowedHarnessToolIds,
  runtimeBindings,
  workspaceBound
}
```

这是一份 requirement envelope，不是 permission grant。

真实 Child 能力为：

```text
allowedHarnessToolIds
∩ current registered/exposed tools
∩ Policy / Approval

+

ready managed private runtime bindings
```

没有声明 Tool/Runtime 的规则型 Skill 仍进入同一 SubAgent 外壳，只是执行面为空。

## 10. Context budget

1. Manifest 保持轻量；
2. 自动只加载 primary `SKILL.md`；
3. Resource 按需；
4. 大资源使用 URI / artifact / file reference；
5. 超预算优先保留 Routing / Hard Rules / Completion；
6. continuation 重建当前上下文，不复制历史多份正文。

## 11. Workspace

`skillRoot`、`runtimeRoot`、`workspaceRoot` 独立。

`workspaceBound=true` 只表示该 execution profile 需要有效任务 workspace。没有 workspace 时应返回 capability requirement / structured failure，不得退化写到 Skill package 或 Runtime Pack 目录。

## 12. Optional Conversation Flow

SkillContext 命中后，宿主可按 primary id 查询专用 Flow binding。

当前只有：

```text
fertility-assessment
```

Flow 是该 Skill 的确定性 SubAgent controller，不是第二个可发现 Skill，也不在普通 SkillContext 中复制完整业务状态。

## 13. Trace

必须记录：

```text
matched / not_matched
primary id / name / version / origin
match source / reason / score
secondarySkillIds
skillBodyLoaded
availableResourceUris
disclosedResourceUris
execution profile
allowedHarnessToolIds
runtime bindings and readiness
workspaceBound
toolExposureMutation = false
```

`continuation` 必须保留为独立 source。

## 14. 当前 Acceptance

1. L0 bounded Manifest scan；
2. canonical package boundary；
3. 单 primary 匹配；
4. SKILL.md 动态加载；
5. stable `skill://` URI；
6. selective Resource disclosure；
7. task-context continuation；
8. execution manifest 投影；
9. 每个 discovered Skill 解析为一个 forked SubAgent profile；
10. user Skill 不继承系统能力；
11. SkillContext 不扩大 ToolExposure；
12. Flow binding 与普通 SkillContext 分离；
13. 独立 Trace。

## 15. Hard Rules

1. SkillContext 是领域上下文，不是 Tool、权限或 Runtime。
2. ExecutionProfile 是最大需求边界，不是授权。
3. 当前每个 discovered Skill 都通过一个 Skill-owned SubAgent 执行。
4. 自动激活最多一个 primary Skill。
5. Resources 默认按需披露。
6. 用户 Skill 不因 frontmatter 获得能力。
7. continuation 不是长期 Memory，也不是隐藏状态机。
8. Tool / MCP / Runtime 是 Execution Boundary，不是 DisclosureLevel。
9. private Runtime 不暴露给 Main Planner。
10. Stateful Flow 是可选 controller，不能与自由 Child loop 叠加。