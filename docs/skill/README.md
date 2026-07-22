# SKILL 模块总纲

Status: Current
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
  - ../tooling-runtime/tools-protocol.md
  - ../development/agent-observability.md

## 单点真相范围

这页定义 Mira 当前 `Skill` 的正式产品边界与总体架构。

核心定义：

> **Skill 是一个通过渐进式披露，向 Agent 动态注入领域知识、执行策略和能力使用说明的可复用上下文能力包。**

Skill 的核心不是独立 Tool，也不是必须拥有状态机。

基础 Skill 通过：

```text
Manifest
+ SKILL.md
+ optional Resources
+ dynamic SkillContext
```

让 Agent 在当前任务里知道：

```text
这类事情应该怎么做
```

而现有 Harness / ToolExposure 继续回答：

```text
当前到底能做什么
```

需要内部状态、多阶段业务约束、Evidence reducer、checkpoint / resume 的复杂能力，可以选择接入 `Stateful Skill Runtime`。该高级层不是 Skill 的入场门槛。

详细设计：

- `skill-context-design.md`：基础 Skill 的 Scanner / Matcher / Loader / Progressive Disclosure / SkillContext；
- `skill-runtime-design.md`：可选 Stateful Skill Runtime；
- `skill-package-runtime-contract.md`：Skill Package 与可选 Runtime Pack 的分发 / 安装边界。

---

## 当前结论

Mira 的 Skill 体系分成两层：

```text
Base Skill
= Progressive Disclosure + Dynamic SkillContext

Optional Stateful Skill Runtime
= SkillInstance + State/Stage + Evidence Reducer + Lifecycle
```

它们是同一 Skill 体系的两个能力层次，不是两套互斥实现。

### Base Skill

适合大多数领域能力：

- DOCX 处理规则
- PDF 处理规则
- Excel 建模规范
- PPT 生成规范
- Web Search 策略
- Code Review 方法

它不要求：

```text
SkillInstance
state machine
checkpoint
resume
Evidence reducer
```

### Stateful Skill Runtime

只在业务确实需要跨步骤保存业务状态和恢复语义时启用，例如：

- 多阶段合同审阅
- 大型代码迁移
- 可恢复发布流程
- 复杂三表 / DCF 项目
- 长篇 / 批量演示项目

---

## Skill 的四层视图

严格来说，前三层是“渐进式披露”，第四层是执行边界：

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

### L0 — Manifest

启动时只保留轻量信息：

- id
- name
- description
- version
- entry
- optional source / license / runtimeRequirements

Manifest 用于发现与匹配，不加载正文。

### L1 — SKILL.md

命中当前任务后动态加载。

主要包含：

- Routing
- 领域规则
- 执行策略
- 能力边界
- Quality Rules
- Completion Criteria
- 可继续读取的 Resource URI

### L2 — Resource

Reference / Template / Example 默认只建立清单，按需读取。

示例：

```text
skill://xlsx/references/DCF_SKILL.md
skill://docx/references/office-runtime-reference.md
skill://pptx/references/pptx-swarm.md
```

### Execution Boundary

Tool / MCP / Script / Runtime 是真实执行能力，不属于 DisclosureLevel。

Skill 可以声明或依赖它们，但：

- SkillScanner 不执行；
- SkillLoader 不执行；
- SkillContext 不授予权限；
- 真实执行仍走现有 Harness / Policy / Sandbox / Runtime 合同。

---

## 核心关系

```text
Agent
├─ SkillContext
│   └─ 这类事情应该怎么做
│
└─ ToolExposure
    └─ 当前能做什么
```

两个真相源必须分开。

```text
state.toolExposure
= Planner 可见工具面的唯一真相

currentTaskFrame.skillContext
= 当前任务的领域语义上下文
```

SkillContext 可以告诉 Agent 某个 Tool / Runtime 应该如何使用，但不能因为 Skill 命中就把不可用 Tool push 进 `state.toolExposure`。

---

## Skill 不是什么

Skill 不是：

- 一个 Tool alias
- 一个新的 Agent
- 一个独立 Planner
- 一个第二 Agent Loop
- 一个新的 Harness
- 一个新的 approval / sandbox / trace runtime
- 一个必须存在的状态机
- 一个固定 `A -> B -> C` Workflow
- 一个把所有 references 一次性塞进 Prompt 的大文本包

Skill 可以包含 Prompt、Reference、Template、Example、Script，也可以依赖 Tool / MCP / Runtime，但这些都不改变它作为动态上下文能力包的核心性质。

---

## Skill vs Tool

一句话：

```text
Tool = 能做什么
Skill = 做这类事情时应该怎么想、怎么做
```

Tool 是真实执行能力。

Skill 是语义与方法层。

两者互补，不竞争。

Skill 不复制 Tool schema，也不复制 Harness Registry。

---

## Skill vs Agent

Agent 负责：

- 理解用户总目标；
- 选择 / 切换业务能力；
- 跨 Skill / Tool 协调；
- 在真实 ToolExposure 中决定下一步。

Skill 提供：

- 领域语义；
- Routing；
- 方法规则；
- 质量标准；
- 完成标准；
- 可按需读取的资源入口。

Stateful Skill Runtime 可以增加业务状态，但仍不拥有第二 Agent Loop。

---

## Skill vs Workflow

Workflow 适合固定、确定流程。

基础 Skill 更像：

```text
领域说明书 + 动态上下文
```

它告诉 Agent：

- 什么情况下走哪类路径；
- 哪些规则不能违反；
- 哪些资源可以进一步读取；
- 怎样算完成得好。

如果复杂业务需要确定性状态迁移，可以在 Stateful Skill Runtime 中增加 stage / reducer / checkpoint，但不要求所有 Skill 都变成 Workflow。

---

## Skill vs MCP

MCP 是能力接入协议。

Skill 可以引用 / 依赖 MCP Tool，但：

- 不复制 MCP Registry；
- 不复制连接和鉴权；
- 不自己执行 MCP 协议；
- 真实调用仍通过现有 Harness / MCP Runtime。

---

## Skill vs Memory

基础 SkillContext 不是长期 Memory。

```text
SkillContext
= 当前任务需要的领域策略与已披露资源

Memory
= 可跨任务 / 跨实例长期复用的信息
```

Skill 可以读取 Memory，但 Memory 不属于 Skill 基础定义。

Stateful Skill Runtime 的内部 state 也不等于长期 Memory。

---

## Skill vs MicroAPP

MicroAPP 是产品入口和独立业务模块形态，可能包含 UI、平台接入和 Runtime。

Skill 是 Agent 的动态上下文能力包，也可以与 MicroAPP 共用同一 Domain Runtime。

例如：

```text
WenShu MicroAPP
  -> UI / Domain Runtime / Debug / Verification

DOCX Skill
  -> Routing / Rules / Completion / References
```

MicroAPP 不自动等于 Skill，Skill 也不要求必须有 MicroAPP。

---

## Skill Package 与 Runtime Pack

Skill Package 是发现 / 展示 / 分发单位：

```text
SKILL.md
references/
templates/
examples/
scripts/
metadata
```

Runtime Pack 是可选安装的执行依赖。

安装 Runtime Pack：

- 可以让某些执行能力从 unavailable 变成 available；
- 不自动注入 SkillContext；
- 不自动扩大 `state.toolExposure`；
- 不创建 SkillInstance。

详见 `skill-package-runtime-contract.md`。

---

## 基础 Skill 核心模块

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

不加载正文、不加载 reference 内容、不执行 script。

### SkillRegistry

管理可发现 / 可用 Skill Manifest。

不管理 Tool，不复制 Harness Registry。

### SkillMatcher

V1 匹配优先级：

```text
0. explicit trigger
1. attachment / MIME / extension deterministic match
2. exact semantic hint
3. lightweight semantic match
4. embedding / task model fallback
```

V1 自动注入只选择一个 `primary Skill`。

`secondary` 只作为候选 / trace，不默认一起加载。

### SkillLoader

负责：

- 加载命中的 SKILL.md；
- 列出 Skill Resource；
- 按稳定 URI 读取指定 Resource；
- 做 IO cache。

Loader 的 cache 不是 Skill 生命周期。

### DisclosurePlan

每个任务准备阶段重新计算当前应该披露什么。

基础 Skill 不建立：

```text
idle -> matched -> active -> released
```

这种隐藏 lifecycle state machine。

需要 lifecycle 的业务交给 Stateful Skill Runtime。

---

## Reference 按需披露

Reference 默认不全量注入。

正确模型：

```text
用户任务
  ↓
命中 Manifest
  ↓
注入 SKILL.md
  ↓
SKILL.md 指向 skill:// Resource URI
  ↓
Agent 当前确实需要
  ↓
按需读取 Resource
```

例如：

```text
“做一个 DCF Excel”
→ xlsx/SKILL.md
→ skill://xlsx/references/DCF_SKILL.md
→ only when needed
```

避免：

```text
命中 xlsx
→ 三表 + DCF + Comps + 所有模板全部塞入上下文
```

---

## 与 AgentGraph / Harness 的稳定边界

当前默认主循环仍然是：

```text
Planner
  -> Normalize
  -> Policy
  -> Tool / Retrieve
  -> Evidence
  -> Planner
```

基础 Skill Context 不改变这条链。

必须保持：

1. V1 不新增 `use_skill` Planner action；
2. `state.toolExposure` 仍是 Planner 工具面的唯一真相；
3. 真实执行仍从 frozen `pendingToolCall` 开始；
4. Policy / ToolNode / Harness 不因 Skill Context 重写；
5. SkillContext 不生成 `pendingToolCall`；
6. Skill 命中不扩大 ToolExposure；
7. Parent Agent Loop 始终是唯一控制循环。

推荐集成：

```text
Prepare Context
│
├─ Tool preparation
│    -> state.toolExposure
│
└─ Skill preparation
     -> primary Skill
     -> SKILL.md
     -> Resource manifest
     -> currentTaskFrame.skillContext

        ↓
      Planner
```

Harness 不应该变成 Skill PromptAssembler。

---

## Optional Stateful Skill Runtime

旧设计中：

```text
Skill = 内部状态 + 多工具编排 + 业务语义封装
```

现在调整为：

> 这是 **Stateful Skill Runtime** 的能力模型，不再是所有 Skill 的最低定义。

Stateful Skill Runtime 可以增加：

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

只有业务确实需要这些能力时才启用。

它仍然必须：

- 复用 Parent Agent Loop；
- 复用 ToolExposure；
- 复用 Normalize / Policy / ToolNode / Evidence；
- 不拥有第二套 Tool Registry；
- 不通过 Skill 扩大权限。

详细设计见 `skill-runtime-design.md`。

---

## 当前 WenShu 首批验证对象

```text
docx
xlsx
pdf
pptx
```

它们现在都可以被称为真正的 Skill，因为已经具备领域 SKILL.md / Resource / Runtime 依赖关系。

基础 Skill 是否成立，不再以“是否有 SkillInstance / reducer”为判断标准。

### DOCX

- 内置 Domain Runtime；
- SKILL.md 动态注入；
- `office-runtime-reference.md` 按需披露；
- 不要求 Python Runtime Pack。

### XLSX / PDF / PPTX

- Skill Package 可发现；
- `wenshu-office` Runtime Pack 可选安装；
- SkillContext 与 Runtime 安装状态分离；
- 未安装 Runtime 时仍可发现 Skill，但真实执行必须报告 unavailable。

---

## V1 实现顺序

```text
1. Canonical 文档定稿
2. SkillScanner + SkillRegistry
3. SkillMatcher
4. SkillLoader
5. SKILL.md 动态 SkillContext 注入
6. stable skill:// Resource URI
7. Reference 按需披露
8. DOCX / XLSX / PDF / PPTX 跑通
9. 观察匹配、token、trace、披露质量
10. 最后用真实复杂业务验证 Stateful Skill Runtime
```

不要先造通用状态机，再寻找业务去套。

---

## 当前硬规则

1. **Skill 本体 = 渐进式披露的动态上下文能力包。**
2. Skill 的核心职责是向当前任务注入“这类事情应该怎么做”。
3. `state.toolExposure` 继续回答“当前能做什么”，两者不可合并成第二工具真相。
4. Skill 不伪装成 Tool，不新增 `use_skill` Planner action。
5. Skill 命中不得主动扩大 Harness ToolExposure。
6. V1 自动注入最多一个 primary Skill；secondary 默认只是候选。
7. Reference 默认按需读取，不全量注入。
8. Tool / MCP / Script / Runtime 是执行边界，不是 DisclosureLevel。
9. Skill 可以声明或依赖执行能力，但不能凭声明获得权限或真实可用性。
10. 基础 Skill 不要求 SkillInstance / state machine / reducer / checkpoint。
11. Stateful Skill Runtime 是可选高级层，不是 Skill 的入场门槛。
12. Parent Agent Loop 始终是唯一控制循环。
13. Normalize / Policy / ToolNode / Evidence / Harness 现有合同不因基础 Skill Context 重写。
14. Skill Package / Runtime Pack 的安装状态与 SkillContext 激活状态必须分离。
15. 当前详细实现以 `skill-context-design.md` 和 `skill-runtime-design.md` 各自负责的层为真相源。
