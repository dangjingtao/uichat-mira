# 文枢 Skill / Domain Runtime 当前实现

Status: Current
Owner: chat / runtime / microapp
Last verified: 2026-07-23
Layer: raw-source
Module: MicroAPP / SKILL
Feature: WenShuSkillContext
Doc Type: current-contract
Canonical: true
Related:
  - ./office-runtime-task-contract.md
  - ./wenshu-pptx-swarm.md
  - ../skill/README.md
  - ../skill/skill-context-design.md
  - ../skill/skill-runtime-design.md
  - ../skill/skill-package-runtime-contract.md

## Purpose

本页描述文枢当前已经落地的四个基础 Skill、可选 Runtime Pack、Domain Runtime，以及它们与 Agent / Harness 的真实边界。

基础 Skill 的当前定义以 `docs/skill/README.md` 和 `docs/skill/skill-context-design.md` 为准：

> **Skill 本体是通过渐进式披露向 Agent 动态注入领域知识、执行策略和能力使用说明的可复用上下文能力包。**

`SkillInstance / state / reducer / checkpoint` 属于可选的 Stateful Skill Runtime，不是 DOCX / XLSX / PDF / PPTX 成为 Skill 的入场门槛。

## 当前层级

```text
WenShu MicroAPP
  ├─ Skills
  │    ├─ docx   (bundled)
  │    ├─ xlsx   (optional runtime pack)
  │    ├─ pdf    (optional runtime pack)
  │    └─ pptx   (optional runtime pack)
  │
  ├─ SkillContext
  │    └─ Manifest -> SKILL.md -> Reference on demand
  │
  ├─ Optional Runtime Pack
  │    └─ wenshu-office@1.0.0
  │
  └─ Domain Runtime
       ├─ DOCX Runtime
       ├─ PDF Runtime
       ├─ Spreadsheet Runtime
       └─ Presentation Runtime
```

这里必须区分：

```text
SkillContext
= 这类事情应该怎么做

ToolExposure
= 当前 Agent 真正能调用什么
```

Skill 命中不会把新的 Tool push 进 `state.toolExposure`。

## Progressive Disclosure

当前基础链：

```text
L0 Manifest
  -> match one primary Skill
L1 SKILL.md
  -> inject into currentTaskFrame.skillContext
L2 Reference / Resource
  -> disclose selectively or read by skill:// URI
Execution
  -> existing Tool / MCP / Runtime path
```

实现：

```text
server/src/skills/context/types.ts
server/src/skills/context/scanner.ts
server/src/skills/context/matcher.ts
server/src/skills/context/loader.ts
server/src/skills/context/provider.ts
server/src/agent/nodes/prepare-context.ts
```

### L0 Manifest

`SkillScanner` 只读取 `SKILL.md` 文件头的 bounded frontmatter window，不在扫描阶段加载正文和 references。

### L1 SKILL.md

当前任务命中一个 primary Skill 后，`SkillLoader` 才加载该 Skill 的正文。

V1 自动激活最多一个 primary Skill。Secondary 只保留为候选/trace，不默认同时注入多个 Skill 正文。

### L2 Reference

Reference 默认只列元数据和稳定 URI，例如：

```text
skill://xlsx/reference/DCF_SKILL.md
skill://docx/references/office-runtime-reference.md
skill://pptx/reference/pptx-swarm.md
```

`read_open` 支持只读 `skill://` virtual resource，不新增 `skill_read` 工具。

当前还提供少量确定性预披露：

- XLSX DCF / 三表 / Comps 根据明确任务语义只加载对应 reference；
- 20+ 页或批量 PPTX 只加载 `pptx-swarm` reference。

这不是全量 reference 注入。

## Skill Matching

V1 匹配优先级：

```text
0. explicit trigger
   $docx / /skill:docx

1. deterministic resource match
   filename / extension / MIME / latest attachment

2. exact semantic hint
   DCF Excel / PDF merge / PowerPoint / DOCX review

3. lightweight semantic match
   name / known domain terms

4. embedding / task model
   reserved for ambiguous cases
```

附件类型的确定性证据优先于模糊文本。

例如：

```text
user: "帮我审一下这个"
attachment: contract.docx
-> primary Skill = docx
```

## Skill Package 展示

Skills 页面当前展示四个文枢 Skill：

```text
docx
xlsx
pdf
pptx
```

展示内容包括：

- 名称 / 来源 / 分类 / 描述；
- `SKILL.md`；
- references / runtime 文件结构；
- Runtime Pack 状态；
- 「去使用」入口。

定义：

```text
server/src/skills/registry.ts
```

该 registry 是 Package/Manifest metadata source，不是 Tool Registry。

当前状态字段明确拆开：

```text
contextIntegration.status = ready
contextIntegration.mode = progressive-disclosure

statefulRuntime.status = deferred
```

## DOCX

DOCX 为 bundled Skill，不依赖 `wenshu-office` Python Pack。

核心能力：

- `docx@9` 结构化创建；
- 非破坏性新副本；
- Word native comments；
- `trackRevisions`；
- `w:ins / w:del / w:delText`；
- 复杂 run 无法安全局部修改时拒绝有损重写。

主要实现：

```text
server/src/microapps/office-suite/create.ts
server/src/microapps/office-suite/document-review.ts
server/src/microapps/office-suite/document.ts
server/src/microapps/office-suite/runtime.ts
server/src/skills/docx/
```

## Runtime Pack

PDF / XLSX / PPTX 共用：

```text
wenshu-office@1.0.0
```

点击「去使用」时：

```text
check pack
  ├─ installed -> enter WenShu
  └─ not installed
       -> system devkit Python -m pip install
       -> staging site-packages
       -> module probe
       -> manifest
       -> atomic replace
       -> enter WenShu
```

原则：

- 复用系统开发小套件 Python；
- 不打包第二套 Python；
- 第三方依赖安装在 Mira-managed runtime-pack；
- 不污染用户全局 Python；
- 安装 Runtime Pack 不等于激活 SkillContext 或获得额外权限；
- 成功安装后会改变环境真实 capability eligibility，Harness 独立 reconciliation 决定对应 Tool 是否进入 registry。

实现：

```text
server/src/microapps/office-suite/capability-pack.ts
server/src/microapps/office-suite/runtime-pack-paths.ts
server/tools/wenshu/requirements.txt
```

## PDF Domain Runtime

```text
server/tools/wenshu/pdf/pdf_create_runtime.py
server/tools/wenshu/pdf/pdf_runtime.py
```

当前能力：structured create、dynamic TOC、heading/paragraph/table/image/chart/equation/code/reference、header/footer/page number、Markdown conversion、text/table/image extraction、forms、merge/split、rotate/crop、metadata。

## XLSX Domain Runtime

```text
server/tools/wenshu/xlsx/xlsx_runtime.py
server/tools/wenshu/xlsx/xlsx_finalize.py
server/tools/wenshu/xlsx/xlsx_tools.py
```

当前能力：create / modify / inspect / recalc / verify、公式、样式、图表、named ranges、Sources、metadata，以及 three-statement / DCF / comps 业务语义。

`xlsx_tools.py` 的许可文件保留：

```text
server/tools/wenshu/xlsx/LICENSE.txt
```

## PPTX Domain Runtime

```text
server/tools/wenshu/pptx/pptx_runtime.py
```

当前能力：structured AST、validate、create、inspect、text/shape/image/icon/table/chart、create_batch。

用户提供的原 PPT 包引用未提供源码/许可的 `kimi_ppt_dsl` converter；文枢保持独立实现，不复制该缺失 converter。

当前不承诺任意复杂既有 PPTX 的无损修改。

## Agent / Harness 当前状态

### 已接入：SkillContext

`prepare-context` 现在会：

```text
current user task / attachment
-> SkillScanner / Registry
-> SkillMatcher
-> primary Skill
-> SkillLoader
-> progressive disclosure
-> currentTaskFrame.skillContext
-> Planner context
```

这条链只注入语义，不改变 `state.toolExposure`。

独立 Trace 节点：

```text
技能上下文
```

会明确记录：

- matched / not_matched；
- primary Skill id / name / version；
- match source / reason / score；
- available resource URIs；
- disclosed resource URIs；
- `toolExposureMutation=false`。

因此 Skill 是否生效不再依赖模型行为推断。

### 已接入：环境驱动的 Office execution capability reconciliation

DOCX：

```text
office_document
```

是内置 Node / OOXML 能力，按现有 Harness 注册与 matcher / Policy 决定是否进入本轮 `state.toolExposure`。

PDF / XLSX / PPTX：

```text
office_pdf
office_spreadsheet
office_presentation
```

由 `wenshu-office` Runtime Pack 的真实 readiness 独立控制：

```text
verified pack unavailable
  -> 三个 optional capability 不在 Harness registry

verified pack available
  -> Harness reconciliation 注册三个 optional capability
  -> capability matcher / Policy 决定本轮是否进入 state.toolExposure
```

实现：

```text
server/src/harness/wenshu-office-capability.ts
server/src/harness/runtime.ts
server/src/agent/nodes/prepare-context.ts
```

`prepare-context` 每轮在 Tool matching 之前进行一次低成本 reconciliation，因此用户安装 Runtime Pack 后不要求为了 Tool 可见性重启 Server。

这里必须保持：

```text
Skill match
!= Tool registration
!= Tool exposure
```

例如：

```text
"帮我做一个 DCF Excel 模型"
  -> xlsx SkillContext matched
  -> DCF reference disclosed

同时，独立地：
  wenshu-office ready
  -> office_spreadsheet eligible in Harness registry
  -> matcher / Policy 决定是否 exposed
```

SkillContext 从不强行加入 `office_spreadsheet`。

### 当前执行闭环

文枢基础 Skill V1 当前形成：

```text
SkillScanner / Registry
  -> Matcher
  -> SKILL.md
  -> selective Reference disclosure
  -> SkillContext
  -> Planner

Environment / Runtime Pack
  -> Harness capability reconciliation
  -> capability matcher / Policy
  -> state.toolExposure
  -> Planner

Planner
  -> Normalize
  -> Policy
  -> ToolNode
  -> Evidence
  -> Planner
```

认知层和执行层在 Planner 汇合，但保持两个独立真相源。

## Optional Stateful Skill Runtime

只有真实复杂业务需要持久业务状态时，才选择性接入：

```text
SkillDefinition
SkillInstance
state / stage
Evidence reducer
completion evaluation
checkpoint / resume
stage-specific tool constraints
```

例如长期可恢复合同审阅、大型三表模型、复杂发布流程等。

它不是基础 Skill 的入场门槛，也不是当前基础 Skill V1 的未完成项。
