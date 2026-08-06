---
status: current
owner: skill-runtime / office-runtime / microapp
last_verified: 2026-08-06
layer: raw-source
module: MicroAPP / SKILL
feature: WenShuSkillRuntime
doc_type: current-contract
canonical: true
related:
  - ../skill/README.md
  - ../skill/skill-context-design.md
  - ../skill/pi-skill-agent-execution.md
  - ../skill/skill-package-runtime-contract.md
  - ./office-runtime-task-contract.md
---

# 文枢 Skill / Domain Runtime 当前实现

## 1. Purpose

本页记录 DOCX / XLSX / PDF / PPTX 四个 Office Skill 的当前执行模型、Runtime Pack、private binding 和 MicroAPP 边界。

当前统一链路：

```text
Skill Package
  -> primary match
  -> progressive SkillContext
  -> forked Skill-owned SubAgent
  -> ready private Runtime binding
  -> deterministic Domain Runtime
  -> Evidence + Artifact
  -> Parent delivery
```

Office Runtime 不再描述为 Main Planner 直接调用的全局 Tool。

## 2. 四个 Office Skill

```text
docx
xlsx
pdf
pptx
```

它们共享：

- single primary Skill；
- progressive disclosure；
- one Skill-owned SubAgent；
- workspace-bound execution；
- deterministic Runtime result；
- Evidence / Artifact completion；
- private Runtime 不暴露给 Main Planner。

它们不共享同一个底层实现。

## 3. Execution profiles

当前 compatibility profile：

| Skill | Harness read tools | Private Runtime bindings | Workspace |
| --- | --- | --- | --- |
| docx | `read_open`, `read_extract` | `office_document` | required |
| pdf | `read_open`, `read_extract` | `office_pdf` | required |
| pptx | `read_open`, `read_extract` | `office_presentation` | required |
| xlsx | `read_open`, `read_extract` | `office_spreadsheet`, `wenshu_xlsx_xml_runtime` | required |

真实 Harness read Tool 仍取决于当前 exposure / Policy。Private Runtime readiness 独立解析。

## 4. Runtime readiness

```text
office_document            ready
office_pdf                 ready
office_presentation        ready
office_spreadsheet         ready
wenshu_xlsx_xml_runtime    pending
```

### DOCX

- Node / OOXML Domain Runtime；
- 不依赖 Python Runtime Pack；
- `office_document=ready`。

### PDF

- ReportLab / PDF processing Runtime；
- 依赖 `wenshu-office@1.0.0`；
- `office_pdf=ready`。

### PPTX

- PPTD checker / renderer Runtime；
- 依赖 `wenshu-office@1.0.0`；
- `office_presentation=ready`。

### XLSX

必须拆开：

```text
office_spreadsheet
= ready compatibility runtime for inspection / recalculation / verification

wenshu_xlsx_xml_runtime
= XML-first create / edit / fix bridge
= pending
```

因此当前不能把 XLSX XML-first write path 描述为已经完整 ready。需要该 path 的任务应返回 capability gap，禁止静默回退到 openpyxl round-trip 或把 ready compatibility runtime 冒充成 XML write binding。

## 5. Runtime Pack

```text
docx -> no Python pack
xlsx/pdf/pptx -> wenshu-office@1.0.0
```

Pack 安装：

```text
staging install
-> module probe
-> manifest write
-> atomic promote
-> pack available
-> re-evaluate each private binding
```

Pack available 不等于全部 binding ready。

## 6. Managed Python invocation

Python-backed Runtime 只能通过 backend managed launcher：

```text
semantic operation
-> runtime id
-> registered script id
-> structured args
-> workspace paths
-> managed Python / PYTHONPATH
-> deterministic result
```

模型不得提供 executable、shell、`PYTHONPATH`、`python -m`、pip 或 conda。`terminal_session` 不是文枢 launcher。

## 7. Progressive disclosure

### L0

Scanner bounded 读取 frontmatter。

### L1

primary 命中后加载 `SKILL.md`。

### L2

按需读取 `skill://` resources，不全量注入。

示例：

```text
skill://docx/references/office-runtime-reference.md
skill://xlsx/references/create.md
skill://xlsx/references/edit.md
skill://pdf/references/toc-layout.md
skill://pptx/references/pptd-project-contract.md
```

Resource 不改变 Tool 或 Runtime readiness。

## 8. 当前执行链

```text
Parent
  -> resolve primary Office Skill
  -> resolve SubAgent profile
  -> verify workspace
  -> intersect Harness read tools
  -> resolve private Runtime readiness
  -> fork Skill-owned SubAgent
  -> local planning / Runtime action / repair
  -> Evidence + Artifact + terminal status
  -> Parent freezes delivery
  -> Generate
```

Parent 不应在 completed 后重新施工 Office artifact。

## 9. Completion truth

Office task 的完成真相优先来自：

- deterministic Runtime success；
- final Artifact existence；
- route-specific validation；
- source preservation where required；
- explicit failure for unsupported input。

不得让 LLM 的“看起来应该成功”覆盖 checker / renderer / runtime failure。

## 10. MicroAPP boundary

```text
Skills page
= package detail / runtime requirement / go use

WenShu MicroAPP
= installation / workbench / diagnostics / manual verification

Chat Skill execution
= Skill-owned SubAgent + private Runtime
```

MicroAPP 与 Chat 可以复用 Domain Runtime，但不是同一个控制面。

## 11. Trace

应记录：

```text
primary Office Skill
match / disclosure
SubAgent profile
workspace binding
Harness read tool resolution
private Runtime bindings and readiness
managed runtime actions
artifacts
validation
terminal status
```

## 12. Domain anchors

### DOCX

```text
server/src/microapps/office-suite/create.ts
server/src/microapps/office-suite/document-review.ts
server/src/microapps/office-suite/document.ts
server/src/microapps/office-suite/runtime.ts
```

### XLSX

```text
server/tools/wenshu/xlsx/
server/src/skills/xlsx/
```

### PDF

```text
server/tools/wenshu/pdf/
server/src/skills/pdf/
```

### PPTX

```text
server/tools/wenshu/pptx/
server/src/skills/pptx/
```

### SubAgent / binding

```text
server/src/skills/agent/profiles.ts
server/src/skills/agent/subagent-runtime.ts
```

## 13. Build / distribution

构建产物必须同时保留：

- `SKILL.md` 和 references；
- Registry package metadata；
- managed runtime scripts；
- Runtime Pack install/probe logic；
- private binding adapters。

Catalog 能看到脚本文件不等于 binding 已 ready。

## 14. Hard Rules

1. 四个 Office Skill 当前都通过 Skill-owned SubAgent 执行。
2. Private Runtime 不暴露给 Main Planner。
3. SkillContext 不注册 Tool、不扩大 exposure。
4. Runtime Pack available 与 binding ready 分离。
5. DOCX 不依赖 Python Pack。
6. Python-backed Runtime 禁止 terminal fallback。
7. `wenshu_xlsx_xml_runtime` 当前 pending。
8. Deterministic Runtime / checker 是 execution truth。
9. completed Artifact 不由 Parent 重做。
10. Workspace 缺失时必须返回结构化缺口。