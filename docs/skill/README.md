# SKILL 模块总纲

Status: Current
Protocol: V1 Settled
Owner: chat / runtime / docs
Last verified: 2026-07-23
Layer: raw-source
Module: SKILL
Feature: SkillSystem
Doc Type: overview
Canonical: true
Related:
  - ./skill-context-design.md
  - ./skill-runtime-design.md
  - ./skill-package-runtime-contract.md
  - ../harness/agentgraph-harness-protocol.md
  - ../tooling-runtime/harness-runtime-design.md

## 单点真相

> **Skill 是一个通过渐进式披露，向 Agent 动态注入领域知识、执行策略和能力使用说明的可复用上下文能力包。**

Skill 的本体不是 Tool，也不要求状态机、SkillInstance 或独立 Runtime。

基础 Skill：

```text
Manifest
+ SKILL.md
+ optional Resources
+ optional dependency declarations
+ dynamic SkillContext
```

回答：

```text
这类事情应该怎么做
```

Harness / ToolExposure 回答：

```text
当前真正能做什么
```

两者是独立真相源。

---

## 1. 两层 Skill 体系

```text
Base Skill
= Progressive Disclosure + Dynamic SkillContext

Optional Stateful Skill Runtime
= SkillInstance + State/Stage + Evidence Reducer + Lifecycle
```

### Base Skill

是所有 Skill 的基础形态，适合 DOCX / PDF / XLSX / PPTX、搜索策略、代码审查方法等。

不要求：

```text
SkillInstance
state machine
checkpoint / resume
Evidence reducer
stage-specific tool constraints
```

### Stateful Skill Runtime

仅在真实业务需要持久状态、多阶段约束、恢复语义时选择性启用。

它是增强层，不是 Skill 的入场门槛。

---

## 2. 渐进式披露协议

```text
L0 Manifest
   ↓ match
L1 SKILL.md
   ↓ on demand
L2 Reference / Template / Example
   ↓ execute
Execution Boundary
Tool / MCP / Script / Runtime
```

### L0 Manifest

只保留轻量发现信息：

```text
id
name
description
version
entry
optional source / license / runtimeRequirements
```

启动扫描不得预加载所有正文和 references。

### L1 SKILL.md

命中当前任务后加载，主要表达：

- Routing；
- 领域规则；
- 执行策略；
- 能力边界；
- Quality Rules；
- Completion Criteria；
- 可继续读取的 Resource URI。

### L2 Resource

Reference / Template / Example 默认只建立清单，按需披露。

稳定 URI 示例：

```text
skill://xlsx/reference/DCF_SKILL.md
skill://docx/references/office-runtime-reference.md
skill://pptx/reference/pptx-swarm.md
```

### Execution Boundary

Tool / MCP / Script / Runtime 是执行能力，不属于 DisclosureLevel。

Skill 可以声明或依赖它们，但不能凭声明获得权限或真实可用性。

---

## 3. Base Skill 当前核心链

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

### SkillScanner

只发现 Skill 并解析轻量 Manifest。

不加载完整正文、不加载 reference 内容、不执行 scripts、不触碰 Tool Registry。

### SkillRegistry

管理可发现 Skill Manifest。

不复制 Harness / Tool Registry。

### SkillMatcher

V1 优先级：

```text
0. explicit trigger
1. attachment / MIME / extension deterministic match
2. exact semantic hint
3. lightweight semantic match
4. embedding / task model fallback（模糊时）
```

V1 自动注入最多一个 `primary Skill`。

`secondary` 仅作为候选 / trace，不默认同时加载多个 SKILL.md。

### SkillLoader

负责命中后的 SKILL.md 和 Skill Resource 读取。

Loader cache 不是 Skill 生命周期。

---

## 4. 多轮任务连续性

基础 Skill 必须支持同一任务的自然续轮，但不因此引入 Stateful Skill Runtime。

规则：

```text
本轮明确命中新 Skill
→ 使用新 primary Skill

本轮未命中新 Skill
+ 明显是在回答上一轮追问 / 补参数 / 继续 / 修改同一任务
→ 继承最近有效 primary Skill
→ match.source = continuation

本轮明确新任务 / 换话题 / 取消 / 结束
→ 不继承旧 Skill
```

继承时必须保留原任务的披露依据。

例如：

```text
Turn 1: 帮我做一个 DCF Excel 模型
→ xlsx / exact
→ disclose DCF_SKILL.md

Turn 2: 用一家虚拟科技公司，历史 3 年，预测 5 年，其余参数合理默认
→ xlsx / continuation
→ DCF_SKILL.md 继续披露
```

这叫 **task-context continuity**，不是 SkillInstance、sticky lifecycle 或状态机。

---

## 5. SkillContext 与 ToolExposure

```text
currentTaskFrame.skillContext
= 当前任务应该掌握哪些领域策略

state.toolExposure
= Planner 当前真正可以调用哪些工具
```

必须保持：

```text
Skill match
!= Tool registration
!= Tool exposure
```

SkillContext：

- 不注册 Tool；
- 不 push Tool 到 `state.toolExposure`；
- 不授予权限；
- 不生成 `pendingToolCall`；
- 不绕过 Policy / Approval / Sandbox。

执行能力由 Harness / environment 独立决定。

---

## 6. Runtime Pack 与 Harness

Runtime Pack 是可选执行依赖，不是 Skill 本体。

例如文枢：

```text
docx
→ bundled runtime
→ office_document 可作为正常 Harness capability

wenshu-office verified ready
→ office_pdf
→ office_spreadsheet
→ office_presentation
可进入 Harness capability registry

wenshu-office unavailable
→ 上述 optional capabilities 不进入 / 从 registry 撤出
```

关键不变量：

> Runtime readiness 可以改变环境真实 capability eligibility，但 Skill 命中不参与 Tool 注册决策。

Tool 最终是否进入本轮 `state.toolExposure`，继续由 capability matcher / Policy / environment 决定。

---

## 7. AgentGraph 稳定边界

当前唯一主循环保持：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
```

Base Skill 不改变该链。

硬规则：

1. 不新增 `use_skill` Planner action；
2. `state.toolExposure` 仍是 Planner 工具面的唯一真相；
3. SkillContext 只进入 Agent Context / `currentTaskFrame`；
4. SkillContext 不生成 `pendingToolCall`；
5. Skill 命中不扩大 ToolExposure；
6. Parent Agent Loop 始终是唯一控制循环；
7. Normalize / Policy / ToolNode / Evidence / Harness 不因 Base Skill 重写。

---

## 8. Trace 真相合同

Skill 是否生效必须可观察，不能从模型回答风格猜测。

独立 Trace 节点：

```text
技能上下文
```

至少记录：

```text
status: matched | not_matched
primary: id / name / version
match.source: explicit | resource | exact | semantic | embedding | continuation
match.reason
match.score
secondarySkillIds
skillBodyLoaded
availableResourceUris
disclosedResourceUris
toolExposureMutation=false
```

`Prepare Context` 还应能看到环境执行能力状态，例如 WenShu Runtime Pack readiness 和已注册 optional capability IDs。

---

## 9. 当前已验证事实（2026-07-23）

### XLSX 单轮匹配 / 渐进披露

真实烟测：

```text
用户：帮我做一个 DCF Excel 模型
→ primary = xlsx
→ source = exact
→ score = 0.96
→ available resources = 3
→ disclosed resources = 1
→ disclosed = skill://xlsx/reference/DCF_SKILL.md
```

证明：

- Skill 匹配有效；
- SKILL.md 已加载；
- Reference 不是全量注入；
- DCF 只披露对应 Reference。

### XLSX 多轮 continuity

真实烟测：

```text
上一轮：DCF Excel
本轮：虚拟公司 + 历史3年 + 预测5年 + 其余默认
→ primary = xlsx
→ source = continuation
→ DCF_SKILL.md 继续披露
```

证明基础 Skill 的 task-context continuity 已工作。

### ToolExposure 独立真相

Runtime Pack ready 时，真实 trace 已看到：

```text
office_spreadsheet
office_pdf
office_presentation
```

进入正常 Harness / matcher / Policy 路径。

这不是 Skill 扩权；Trace 继续记录：

```text
toolExposureMutation = false
```

### 当前未归因于 Skill 的阻断

烟测过程中出现：

```text
Planner output was invalid JSON
```

该问题属于 Planner structured-output / recovery 路径，**不是 Skill 协议未完成的证据**，不得因此重构已经验证通过的 SkillContext 协议。

---

## 10. 当前首批 Skill

```text
docx
xlsx
pdf
pptx
```

它们都属于 Base Skill。

- DOCX：bundled Domain Runtime；
- XLSX / PDF / PPTX：可声明 `wenshu-office` Runtime Pack 依赖；
- SkillContext 激活状态与 Runtime Pack 安装状态严格分离。

---

## 11. Optional Stateful Skill Runtime

仅在真实复杂业务需要时增加：

```text
SkillDefinition
SkillInstance
state / stage
Evidence reducer
completion evaluation
checkpoint / resume
stage-specific tool constraints
version binding
```

它仍然必须：

- 复用 Parent Agent Loop；
- 复用 canonical ToolExposure；
- 复用 Normalize / Policy / ToolNode / Evidence；
- 不拥有第二套 Tool Registry；
- 只能收窄工具面，不能扩大权限。

详细设计见 `skill-runtime-design.md`。

---

## 12. V1 Hard Rules

1. **Skill 本体 = 渐进式披露的动态上下文能力包。**
2. Skill 不等于 Tool，不伪装成 Tool。
3. SkillContext 与 ToolExposure 是独立真相源。
4. Skill 命中不得主动扩大 Harness `state.toolExposure`。
5. 自动激活最多一个 primary Skill；secondary 默认只是候选。
6. Reference 默认按需披露，不全量注入。
7. 多轮同任务通过轻量 `continuation` 继承 primary Skill；不得为此创建隐藏状态机。
8. 新 Skill 明确命中优先于 continuation；新任务 / 换话题 / 取消不得继承旧 Skill。
9. Tool / MCP / Script / Runtime 是执行边界，不是 DisclosureLevel。
10. Runtime Pack readiness 与 SkillContext 激活严格分离。
11. Base Skill 不要求 SkillInstance / reducer / checkpoint。
12. Stateful Skill Runtime 是可选高级层，不是 Skill 的入场门槛。
13. Parent Agent Loop 始终是唯一控制循环。
14. Planner / Normalize / Policy / ToolNode / Evidence / Harness 现有合同不因 Base Skill 重写。
15. Skill 生效必须有明确 Trace 证据，不允许凭模型行为推断。
