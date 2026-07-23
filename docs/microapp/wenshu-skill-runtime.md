# 文枢 Skill / Domain Runtime 当前实现

Status: Current
Protocol: Skill V1 Settled
Owner: chat / runtime / microapp
Last verified: 2026-07-23
Layer: raw-source
Module: MicroAPP / SKILL
Feature: WenShuSkillContext
Doc Type: current-contract
Canonical: true
Related:
  - ../skill/README.md
  - ../skill/skill-context-design.md
  - ../skill/skill-runtime-design.md
  - ../skill/skill-package-runtime-contract.md
  - ./office-runtime-task-contract.md
  - ./wenshu-pptx-swarm.md

## Purpose

这页记录文枢四个首批 Base Skill、Runtime Pack、Domain Runtime、Harness execution capability 与当前真实烟测状态。

基础定义以 `docs/skill/README.md` 和 `docs/skill/skill-context-design.md` 为上位真相。

---

## 1. 当前四个 Base Skill

```text
docx
xlsx
pdf
pptx
```

它们已经是正式 Base Skill，不要求 SkillInstance / reducer / checkpoint 才能成立。

```text
Skill Package
  ↓ discover
Manifest
  ↓ match
SKILL.md
  ↓ selective disclosure
Reference / Resource
  ↓
SkillContext
  ↓
Planner
```

---

## 2. 两个独立真相源

```text
currentTaskFrame.skillContext
= 这类事情应该怎么做

state.toolExposure
= 当前 Agent 真正能调用什么
```

必须保持：

```text
Skill match
!= Tool registration
!= Tool exposure
```

SkillContext 不注册 Tool、不扩大 ToolExposure、不授予权限。

---

## 3. 文枢 Skill Package / Runtime

### DOCX

```text
docx Skill Package
→ bundled
→ no wenshu-office Python pack required
```

Domain Runtime：Node / OOXML。

主要能力：

- 结构化 DOCX 创建；
- 非破坏性副本；
- Word native comments；
- Track Changes；
- `w:ins / w:del / w:delText`；
- 复杂 run 无法安全局部修改时拒绝有损强改。

Agent execution capability：

```text
office_document
```

### XLSX / PDF / PPTX

共享：

```text
wenshu-office@1.0.0
```

Runtime Pack 使用系统开发小套件 Python 作为解释器，第三方依赖安装在 Mira-managed runtime-pack，不污染用户全局 Python。

安装：

```text
点击「去使用」
→ check pack
→ pip install into staging site-packages
→ module probe
→ write manifest
→ atomic promote
→ ready
```

安装失败不得写入 installed 真值。

---

## 4. Progressive Disclosure 当前实现

代码锚点：

```text
server/src/skills/context/scanner.ts
server/src/skills/context/matcher.ts
server/src/skills/context/loader.ts
server/src/skills/context/provider.ts
server/src/agent/nodes/prepare-context.ts
```

### L0

Scanner 只 bounded 读取 SKILL.md frontmatter，不预加载正文 / references。

### L1

命中一个 primary Skill 后才加载对应 SKILL.md。

### L2

Reference 使用稳定 URI：

```text
skill://xlsx/reference/DCF_SKILL.md
skill://xlsx/reference/COMPS_SKILL.md
skill://xlsx/reference/3_statement_model.md
skill://docx/references/office-runtime-reference.md
skill://pptx/reference/pptx-swarm.md
```

`read_open` 支持只读 `skill://` virtual resource，不新增专用 Skill Tool。

确定性选择披露：

```text
DCF → DCF_SKILL.md
三表 → 3_statement_model.md
Comps → COMPS_SKILL.md
20+ / batch PPTX → pptx-swarm.md
```

不做全量 Reference 注入。

---

## 5. Skill Matching

优先级：

```text
0 explicit
1 attachment / MIME / extension
2 exact semantic
3 lightweight semantic
4 embedding / task model fallback
```

自动注入最多一个 primary Skill。

secondary 只做候选 / trace。

---

## 6. 多轮 continuity

当用户在下一轮只回答 Planner 的补充问题时，Base Skill 不应丢失。

规则：

```text
new primary matched
→ switch to new Skill

no new primary
+ obvious clarification / parameter reply / continuation
→ inherit recent primary
→ source = continuation

new task / topic switch / cancel / stop
→ do not inherit stale Skill
```

继承时必须同时保留原任务的 Reference disclosure 语义。

真实验证：

```text
Turn 1
帮我做一个 DCF Excel 模型
→ xlsx / exact
→ DCF_SKILL.md

Turn 2
用一家虚拟科技公司，历史3年，预测5年，其余参数合理默认
→ xlsx / continuation
→ DCF_SKILL.md remains disclosed
```

该机制属于 task-context continuity，不是 Stateful Skill Runtime。

---

## 7. Harness execution capability reconciliation

### Built-in DOCX

```text
office_document
```

按正常 Harness registry / matcher / Policy 决定是否进入本轮 ToolExposure。

### Optional WenShu capabilities

```text
office_pdf
office_spreadsheet
office_presentation
```

由 Runtime Pack readiness 独立控制：

```text
wenshu-office unavailable
→ optional capabilities not registered

wenshu-office verified ready
→ register optional capabilities
→ capability matcher / Policy
→ state.toolExposure
```

实现：

```text
server/src/harness/wenshu-office-capability.ts
server/src/harness/runtime.ts
server/src/agent/nodes/prepare-context.ts
```

`prepare-context` 在 Tool matching 前执行 reconciliation，因此 Runtime Pack 安装后不要求为了 Tool 可见性重启 Server。

SkillContext 从不直接加入这些 Tool。

---

## 8. 当前完整基础链

```text
SkillScanner / Registry
  → Matcher
  → SKILL.md
  → selective Reference disclosure
  → SkillContext
  → Planner

Environment / Runtime Pack
  → Harness capability reconciliation
  → capability matcher / Policy
  → state.toolExposure
  → Planner

Planner
  → Normalize
  → Policy
  → ToolNode
  → Evidence
  → Planner
```

认知层与执行层在 Planner 汇合，但保持两个独立真相源。

---

## 9. Trace 当前合同

独立节点：

```text
技能上下文
```

记录：

```text
matched / not_matched
primary id / name / version
match source / reason / score
secondarySkillIds
availableResourceUris
disclosedResourceUris
toolExposureMutation=false
```

多轮继承明确显示：

```text
match.source = continuation
```

`准备上下文` 还记录：

```text
wenshuRuntimePackAvailable
wenshuRegisteredCapabilityIds
exposedToolIds
```

因此 Skill 是否命中、Reference 是否披露、Tool 是否真实可用都可直接验收。

---

## 10. 真实烟测状态（2026-07-23）

### 已验证：XLSX 单轮 Skill

```text
query = 帮我做一个 DCF Excel 模型
primary = xlsx
source = exact
score = 0.96
availableResourceCount = 3
disclosedResourceCount = 1
disclosed = skill://xlsx/reference/DCF_SKILL.md
```

结论：单 primary、SKILL.md 注入、Selective Reference Disclosure 均工作。

### 已验证：XLSX 多轮 continuity

```text
follow-up = 虚拟科技公司 / 历史3年 / 预测5年 / 其余默认
primary = xlsx
source = continuation
disclosed = DCF_SKILL.md
```

结论：续轮不再因缺少 `Excel / DCF` 关键词而丢失 SkillContext。

### 已验证：执行能力独立进入 Harness

Runtime Pack ready 时，trace 已观察：

```text
office_spreadsheet
office_pdf
office_presentation
```

进入正常 exposed capability 路径。

同时 Skill trace：

```text
toolExposureMutation = false
```

说明不是 Skill 扩权。

### 当前独立 Planner 阻断

烟测继续执行时出现：

```text
Planner output was invalid JSON
```

该问题当前归类为 Planner structured-output / recovery bug。

它不改变以下已验证事实：

- Skill exact match 工作；
- selective disclosure 工作；
- continuation 工作；
- Runtime Pack / Harness eligibility 与 SkillContext 解耦工作。

在没有新证据前，不得因为该 Planner bug 回滚或重构 Base Skill V1 协议。

---

## 11. Domain Runtime Anchors

### DOCX

```text
server/src/microapps/office-suite/create.ts
server/src/microapps/office-suite/document-review.ts
server/src/microapps/office-suite/document.ts
server/src/microapps/office-suite/runtime.ts
server/src/skills/docx/
```

### XLSX

```text
server/tools/wenshu/xlsx/xlsx_runtime.py
server/tools/wenshu/xlsx/xlsx_finalize.py
server/tools/wenshu/xlsx/xlsx_tools.py
server/tools/wenshu/xlsx/LICENSE.txt
```

### PDF

```text
server/tools/wenshu/pdf/pdf_create_runtime.py
server/tools/wenshu/pdf/pdf_runtime.py
```

### PPTX

```text
server/tools/wenshu/pptx/pptx_runtime.py
```

PPTX 当前为独立实现，不复制缺失源码 / 许可的 `kimi_ppt_dsl` converter。

---

## 12. Build / Distribution

```text
server/tools/
→ <server-bundle>/tools/

server/src/skills/**/*.{md,txt,json,yaml,yml}
→ <server-bundle>/skills/
```

打包后仍必须可以执行 Manifest scan / SKILL.md load / Reference disclosure。

---

## 13. Optional Stateful Skill Runtime

当前四个文枢 Skill 的 Base Skill 协议不依赖 Stateful Runtime。

只有真实复杂业务需要时才增加：

```text
SkillDefinition
SkillInstance
state / stage
Evidence reducer
completion evaluation
checkpoint / resume
stage-specific tool constraints
```

它不是当前 Base Skill V1 的未完成项。

---

## 14. Hard Rules

1. DOCX / XLSX / PDF / PPTX 都是正式 Base Skill。
2. Skill 本体是渐进式披露的动态上下文能力包。
3. SkillContext 与 ToolExposure 是独立真相源。
4. Skill match 不等于 Tool registration / exposure。
5. 自动注入最多一个 primary Skill。
6. Reference 默认按需披露。
7. continuation 是轻量任务连续性，不是隐藏状态机。
8. Runtime Pack 安装状态与 SkillContext 激活状态分离。
9. Domain Runtime 不拆成大量 Agent 原子工具。
10. Stateful Skill Runtime 是可选高级层。
11. Parent Agent Loop 始终唯一。
12. Planner 自身错误不得在无证据时归因于 Skill 协议。
