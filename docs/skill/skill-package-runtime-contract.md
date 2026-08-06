---
status: current
owner: skill-runtime / runtime-pack / desktop
last_verified: 2026-08-06
layer: raw-source
module: SKILL
feature: SkillPackageDistribution
doc_type: current-contract
canonical: true
related:
  - README.md
  - skill-context-design.md
  - skill-runtime-design.md
  - ../microapp/wenshu-skill-runtime.md
---

# Skill Package、Runtime Pack 与 Private Runtime 合同

## 1. Purpose

本页定义 Skill Package、Runtime Pack、Skill-private Runtime binding、Harness Tool 与 Stateful Flow 的当前边界。

## 2. 五层必须分开

```text
Skill Package
  Manifest / SKILL.md / Resources

SkillContext
  当前任务的领域策略与完成合同

ExecutionProfile
  Skill-owned SubAgent 的最大能力需求

Execution Capability
  Harness Tool / managed private Runtime binding

Optional Stateful Flow
  phase / reducer / requirements / delivery state
```

任何一层存在都不能推导其它层已经 ready。

## 3. Skill Package

Skill Package 是发现、展示和分发单位，可以包含：

- `SKILL.md`；
- references / templates / examples；
- scripts 或 runtime 文件；
- version / source / license；
- runtime dependency declaration；
- execution metadata。

Package 被发现后可以参与 Matcher，并在命中后形成 SkillContext 与 SubAgent ExecutionProfile。

Package 本身：

- 不授予 Tool；
- 不授予 private Runtime；
- 不自动执行 scripts；
- 不绕过 approval；
- 不自动创建 Stateful Flow；
- 不拥有第二 Agent Loop。

## 4. Runtime Pack

Runtime Pack 是受管本地依赖集合，例如：

```text
wenshu-office@1.0.0
```

它负责提供 Python packages、受控脚本和低成本 readiness marker。

Runtime Pack 状态至少区分：

```text
not-required
not-installed
installing
available
broken
unknown
```

Runtime Pack `available` 只说明依赖包可用，不表示某个 Skill-private binding 已经接线完成。

## 5. Skill-private Runtime binding

Private binding 是 SubAgent 可调用的语义执行适配器：

```text
SubAgent semantic action
  -> binding id
  -> Mira-managed adapter / launcher
  -> deterministic result
```

它：

- 只对 active Skill-owned SubAgent 可见；
- 不暴露给 Main Planner；
- 不作为普通用户 Tool 展示；
- 不允许模型选择 executable、PYTHONPATH、shell 或安装命令；
- 独立报告 `ready | pending | unavailable`。

当前登记：

```text
office_document            ready
office_pdf                 ready
office_presentation        ready
office_spreadsheet         ready
wenshu_xlsx_xml_runtime    pending
```

重要区别：

```text
wenshu-office pack available
!= wenshu_xlsx_xml_runtime ready
```

## 6. Harness-facing Tool

Harness Tool 是当前环境注册并暴露给 Agent 的具体能力。Skill 可以声明 `execution.allowedTools`，但真实 Child Tool 面必须求交集：

```text
Skill declared tools
∩ registered/exposed tools
∩ Policy / Approval
```

Private Runtime 不应为了“让 Planner 看见”而伪装成全局 Harness Tool。

## 7. 当前 Office packages

```text
docx -> bundled, no Python Runtime Pack required
xlsx -> runtimeRequirements: wenshu-office@1.0.0
pdf  -> runtimeRequirements: wenshu-office@1.0.0
pptx -> runtimeRequirements: wenshu-office@1.0.0
```

### DOCX

- Node / OOXML deterministic runtime；
- private binding：`office_document`；
- `ready`；
- 不允许 Python 或 terminal fallback。

### PDF

- Python-backed WenShu runtime；
- private binding：`office_pdf`；
- `ready`；
- 需要 `wenshu-office` pack。

### PPTX

- Python-backed PPTD checker / renderer；
- private binding：`office_presentation`；
- `ready`；
- 需要 `wenshu-office` pack。

### XLSX

当前必须拆开描述：

```text
office_spreadsheet
= ready inspection / recalculation / verification compatibility runtime

wenshu_xlsx_xml_runtime
= XML-first create / edit / fix execution bridge
= pending
```

因此不得因为 `office_spreadsheet=ready` 就声称 XML-first XLSX create/edit 已完整接通。需要 XML write path 的任务应返回 capability gap，而不是静默降级到 openpyxl round-trip 或 legacy path。

## 8. WenShu Python launcher

所有 Python-backed WenShu Runtime 必须通过 backend 内部 launcher：

```text
operation-level input
  -> runtime = wenshu-office
  -> registered script id
  -> managed launcher
  -> selected system development Python
  -> managed Runtime Pack PYTHONPATH
  -> bundled script
  -> deterministic result
```

模型只能提交：

- runtime id；
- registered script / operation id；
- structured operation arguments；
- workspace input/output paths。

模型不得提交：

- Python executable；
- shell command；
- `PYTHONPATH`；
- `python -m`；
- `pip install` / `conda install`；
- 任意脚本路径拼接。

`terminal_session` 不是 WenShu launcher。

## 9. 安装模型

Skills Catalog 中可见的 Package 已经存在；“去使用”只检查其 Runtime requirement：

```text
Package visible
  -> inspect runtimeRequirements
  -> pack available: continue
  -> pack missing: install into staging
  -> module probe
  -> write manifest
  -> atomic promote
  -> re-evaluate binding readiness
```

安装失败不得写入 `available` 真值。

即使 Pack 安装成功，仍必须重新检查具体 binding；不能把 Pack 状态直接投影成全部能力 ready。

## 10. User Skill

用户导入 Package 不得因 frontmatter 声明获得 private Runtime 或 Harness Tool：

```text
allowedTools = []
runtimeBindings = []
```

后续若实现用户 Skill capability binding，必须单独设计授权、来源信任、版本、审计和撤销合同。

## 11. Workspace

Runtime Pack 目录不是用户工作区。

```text
runtimeRoot
= dependencies and managed scripts

workspaceRoot
= task input/output files
```

Private Runtime 只能在 binding 允许的 workspace 范围内处理任务文件。

## 12. 与 MicroAPP 的关系

MicroAPP 是操作、调试、安装和验证界面，不等于 Skill 本体。

```text
Skills page
  -> package detail / runtime status / go use

MicroAPP
  -> runtime preparation / domain workbench / diagnostics

Chat Agent
  -> Skill-owned SubAgent / private Runtime execution
```

三个入口可以共享同一 Runtime，但控制权与用户体验不同。

## 13. Current anchors

```text
server/src/skills/registry.ts
server/src/skills/context/scanner.ts
server/src/skills/agent/profiles.ts
server/src/skills/agent/subagent-runtime.ts
server/src/microapps/office-suite/capability-pack.ts
server/src/microapps/office-suite/python-runtime.ts
server/src/routes/microapps/office-suite/capability-pack.ts
desktop/src/features/Settings/pages/Skills/
```

## 14. Hard Rules

1. Skill Package、SkillContext、ExecutionProfile、Runtime Pack、binding readiness 必须分开。
2. Catalog 可见表示 Package 存在，不表示 Runtime ready。
3. Runtime Pack available 不表示所有 private bindings ready。
4. Private Runtime 只对 Skill-owned SubAgent 可见，不暴露给 Main Planner。
5. Skill match 不注册 Tool、不扩大 exposure、不授予权限。
6. 用户 Skill 不继承系统 Runtime 或 Tool。
7. Python-backed Runtime 只能走 managed launcher，禁止 terminal fallback。
8. `wenshu_xlsx_xml_runtime` 当前是 pending，不能描述成已完成。
9. DOCX 不依赖 Python Runtime Pack。
10. 安装失败不得留下虚假 available 状态。