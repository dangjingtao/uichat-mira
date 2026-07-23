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

基础定义：

> **Skill 本体是通过渐进式披露向 Agent 动态注入领域知识、执行策略和能力使用说明的可复用上下文能力包。**

`SkillInstance / state / reducer / checkpoint` 属于可选 Stateful Skill Runtime，不是 DOCX / XLSX / PDF / PPTX 成为 Skill 的入场门槛。

## 当前层级

```text
WenShu MicroAPP
  ├─ Skill Packages
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

两个真相必须分开：

```text
SkillContext
= 这类事情应该怎么做

state.toolExposure
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
  -> selective disclosure / skill:// read
Execution Boundary
  -> existing Tool / MCP / Script / Runtime path
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

当前任务命中一个 primary Skill 后，`SkillLoader` 才加载正文。

V1 自动激活最多一个 primary Skill；secondary 只作为候选 / trace，不默认同时注入多个 Skill 正文。

### L2 Reference

Reference 默认只建立清单和稳定 URI，例如：

```text
skill://xlsx/reference/DCF_SKILL.md
skill://docx/references/office-runtime-reference.md
skill://pptx/reference/pptx-swarm.md
```

`read_open` 支持只读 `skill://` virtual resource，不新增 `skill_read` 工具。

当前确定性预披露：

- XLSX DCF / 三表 / Comps：只按明确任务语义披露对应 reference；
- 20+ 页或批量 PPTX：只披露 `pptx-swarm` reference。

不做 reference 全量注入。

## Skill Matching

V1 优先级：

```text
0. explicit trigger
   $docx / /skill:docx

1. deterministic resource match
   filename / extension / MIME / attachment

2. exact semantic hint
   DCF Excel / PDF merge / PowerPoint / DOCX review

3. lightweight semantic match
   name / known domain terms

4. embedding / task model
   only when ambiguous
```

附件类型确定性证据优先于模糊文本。

## Skill Package 展示

Skills 页面当前展示：

```text
docx
xlsx
pdf
pptx
```

展示名称、来源、分类、描述、`SKILL.md`、references / runtime 文件结构、Runtime Pack 状态和「去使用」入口。

Package metadata source：

```text
server/src/skills/registry.ts
```

它不是 Tool Registry。

当前状态：

```text
contextIntegration.status = ready
contextIntegration.mode = progressive-disclosure
statefulRuntime.status = deferred
```

## DOCX

DOCX 为 bundled Skill，不依赖 `wenshu-office` Python Pack。

当前能力：

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

Agent execution capability：

```text
office_document
```

它按正常 Harness matcher / Policy 决定是否进入本轮 `state.toolExposure`，不由 DOCX Skill 强行加入。

## Runtime Pack

PDF / XLSX / PPTX 共用：

```text
wenshu-office@1.0.0
```

安装流程：

```text
点击「去使用」
  -> check pack
  -> system devkit Python -m pip install
  -> staging site-packages
  -> module probe
  -> write manifest
  -> atomic replace
  -> enter WenShu
```

原则：

- 复用系统开发小套件 Python；
- 不打包第二套 Python；
- 第三方依赖安装在 Mira-managed runtime-pack；
- 不污染用户全局 Python；
- 安装失败不写 installed 真值；
- 安装 Runtime Pack 不等于激活 SkillContext 或获得额外权限；
- 成功安装会改变 environment capability eligibility，由 Harness 独立 reconciliation 决定预声明 Tool 是否进入 registry。

实现：

```text
server/src/microapps/office-suite/capability-pack.ts
server/src/microapps/office-suite/runtime-pack-paths.ts
server/tools/wenshu/requirements.txt
```

## Domain Runtimes

### PDF

```text
server/tools/wenshu/pdf/pdf_create_runtime.py
server/tools/wenshu/pdf/pdf_runtime.py
```

能力：structured create、TOC、heading / paragraph / table / image / chart / equation / code / reference、header / footer / page number、Markdown conversion、text / table / image extraction、forms、merge / split、rotate / crop、metadata。

Agent execution capability：`office_pdf`。

### XLSX

```text
server/tools/wenshu/xlsx/xlsx_runtime.py
server/tools/wenshu/xlsx/xlsx_finalize.py
server/tools/wenshu/xlsx/xlsx_tools.py
```

能力：create / modify / inspect / recalc / verify、公式、样式、图表、named ranges、Sources、metadata，以及 three-statement / DCF / comps 业务语义。

`xlsx_tools.py` 许可保留在：

```text
server/tools/wenshu/xlsx/LICENSE.txt
```

Agent execution capability：`office_spreadsheet`。

### PPTX

```text
server/tools/wenshu/pptx/pptx_runtime.py
```

能力：structured AST、validate、create、inspect、text / shape / image / icon / table / chart、create_batch。

用户提供的原 PPT 包引用未提供源码 / 许可的 `kimi_ppt_dsl` converter；文枢保持独立实现，不复制该缺失 converter。

当前不承诺任意复杂既有 PPTX 的无损修改。

Agent execution capability：`office_presentation`。

## Agent / Harness 当前状态

### SkillContext 已接入

```text
current task / attachment
-> SkillScanner / Registry
-> SkillMatcher
-> primary Skill
-> SkillLoader
-> progressive disclosure
-> currentTaskFrame.skillContext
-> Planner
```

独立 Trace 节点：

```text
技能上下文
```

记录：

- `matched / not_matched`；
- primary Skill id / name / version；
- match source / reason / score；
- available resource URIs；
- disclosed resource URIs；
- `toolExposureMutation=false`。

因此 Skill 是否生效不再依赖模型行为推断。

### Office execution capability reconciliation 已接入

PDF / XLSX / PPTX optional capabilities：

```text
office_pdf
office_spreadsheet
office_presentation
```

由 Runtime Pack readiness 独立控制：

```text
verified pack unavailable
  -> optional capabilities 不在 Harness registry

verified pack available
  -> Harness reconciliation 注册 optional capabilities
  -> capability matcher / Policy 决定本轮是否进入 state.toolExposure
```

实现：

```text
server/src/harness/wenshu-office-capability.ts
server/src/harness/runtime.ts
server/src/agent/nodes/prepare-context.ts
```

`prepare-context` 在 Tool matching 前执行低成本 reconciliation，因此安装 Pack 后不要求为 Tool 可见性重启 Server。

必须保持：

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

独立地：
  wenshu-office ready
  -> office_spreadsheet eligible
  -> matcher / Policy decides exposure
```

SkillContext 从不强行加入 `office_spreadsheet`。

## 当前执行闭环

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

只有真实复杂业务需要持久业务状态时才选择性接入：

```text
SkillDefinition
SkillInstance
state / stage
Evidence reducer
completion evaluation
checkpoint / resume
stage-specific tool constraints
```

它不是基础 Skill 的入场门槛，也不是当前基础 Skill V1 的未完成项。

## Build / Distribution

Server build 当前：

```text
server/tools/
  -> <server-bundle>/tools/

server/src/skills/**/*.{md,txt,json,yaml,yml}
  -> <server-bundle>/skills/
```

因此 packaged app 的 Manifest scan / `SKILL.md` load / Markdown Reference disclosure 不依赖开发源码目录存在；确定性 Python runtime 继续由 `server/tools/wenshu/` 分发。

当前 `copySkillsDir()` 不把 `.ts/.tsx` 实现源码当 Skill 资源重复打包。

## Hard Rules

1. DOCX / XLSX / PDF / PPTX 都是基础 Skill。
2. Skill 本体是渐进式披露的动态上下文能力包。
3. V1 自动注入最多一个 primary Skill。
4. Reference 默认按需披露，不全量灌入 Prompt。
5. Tool / MCP / Script / Runtime 是执行边界，不是 DisclosureLevel。
6. SkillContext 不注册 Tool，不扩大 `state.toolExposure`。
7. Runtime Pack readiness 可以改变环境 capability eligibility，但只能由 Harness 独立 reconciliation 处理。
8. 所有执行能力继续服从 capability matcher / Policy / Approval / Sandbox。
9. Domain Runtime 不拆成几十个 Agent 原子工具。
10. Stateful Skill Runtime 是可选高级层，不是 Skill 入场门槛。
11. Parent Agent Loop 始终是唯一控制循环。
12. Planner -> Normalize -> Policy -> ToolNode -> Evidence 主链不因 Skill 重写。

## Code Anchors

- `desktop/src/features/Settings/pages/Skills/`
- `server/src/skills/registry.ts`
- `server/src/skills/context/`
- `server/src/agent/nodes/prepare-context.ts`
- `server/src/mcp/tools/read-open.tool.ts`
- `server/src/harness/wenshu-office-capability.ts`
- `server/src/harness/runtime.ts`
- `server/src/mcp/tools/office-document.tool.ts`
- `server/src/mcp/tools/office-pdf.tool.ts`
- `server/src/mcp/tools/office-spreadsheet.tool.ts`
- `server/src/mcp/tools/office-presentation.tool.ts`
- `server/src/microapps/office-suite/capability-pack.ts`
- `server/src/microapps/office-suite/runtime-pack-paths.ts`
- `server/src/routes/microapps/office-suite/capability-pack.ts`
- `server/src/routes/microapps/office-suite/skill-task.ts`
- `server/tools/wenshu/`
