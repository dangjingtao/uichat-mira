# 文枢 Skill Package / Domain Runtime 当前实现

Status: Current
Owner: chat / runtime / microapp
Last verified: 2026-07-23
Layer: raw-source
Module: MicroAPP / SKILL
Feature: WenShuCapabilityFoundation
Doc Type: current-contract
Canonical: true
Related:
  - ./office-runtime-task-contract.md
  - ./wenshu-pptx-swarm.md
  - ../skill/README.md
  - ../skill/skill-runtime-design.md
  - ../skill/skill-package-runtime-pack-contract.md

## Purpose

本页描述文枢 **当前已经落地的能力底座**。

必须避免旧表述：

> 当前 PDF / XLSX / PPTX 实现不是完整 Formal Skill Runtime。

当前实际层级：

```text
WenShu MicroAPP
  ├─ Basic Office Runtime
  │    └─ DOCX / XLSX / PPTX 基础 inspect/create/modify 验证
  │
  ├─ Skill Packages
  │    ├─ pdf
  │    ├─ xlsx
  │    └─ pptx
  │
  ├─ Optional Runtime Pack
  │    └─ wenshu-office@1.0.0
  │
  └─ Domain Runtime
       ├─ PDF Runtime
       ├─ Spreadsheet Runtime
       └─ Presentation Runtime
```

正式 Skill Runtime 仍按 `docs/skill/skill-runtime-design.md` 实现：

```text
SkillDefinition
+ SkillInstance
+ internal state / stage
+ Evidence reducer
+ stage-specific tool constraints
+ completion criteria
```

## Skill Package 展示

Skills 页面为 PDF / XLSX / PPTX 提供独立展示区，展示：

- 名称 / 来源 / 分类 / 描述；
- `SKILL.md` 业务方法；
- runtime / reference 文件结构；
- 是否已安装 Runtime Pack；
- 「去使用」入口。

当前定义：

```text
server/src/skills/registry.ts
```

这里的 registry 是 **Package Definition registry**，不是 active SkillInstance registry。

安装一个 Package 不会自动激活 Agent Skill。

## Runtime Pack

PDF / XLSX / PPTX 共用：

```text
wenshu-office@1.0.0
```

原因：三个领域共享 Python 和公共第三方依赖，拆成三个包会重复下载和重复维护。

点击「去使用」时：

```text
检查 wenshu-office
  ├─ installed -> 进入文枢
  └─ not installed
       -> system devkit Python -m pip download/install
       -> staging site-packages
       -> module probe
       -> 写 manifest
       -> 原子替换正式 pack 目录
       -> 进入文枢
```

Python 解释器复用系统开发小套件，不打包第二套 Python。

第三方依赖安装到 Mira 受管目录，不安装到用户全局 Python。

实现：

- `server/src/microapps/office-suite/capability-pack.ts`
- `server/src/microapps/office-suite/runtime-pack-paths.ts`
- `server/tools/wenshu/requirements.txt`

路由：

```text
GET  /microapps/office-suite/skills/catalog
GET  /microapps/office-suite/capability-pack/status
POST /microapps/office-suite/capability-pack/install
```

## Python Runtime

系统开发小套件 Python 解析顺序保持：

1. `MIRA_SYSTEM_DEVKIT_PYTHON`
2. `MIRA_DEVKIT_PYTHON`
3. `UI_CHAT_DEVKIT_PYTHON`
4. `UI_CHAT_PYTHON_BIN`
5. 开发环境 fallback：Windows `python` / POSIX `python3`

`wenshu-office/<version>/site-packages` 通过受管 `PYTHONPATH` 提供给文枢 Python 子进程。

当前依赖覆盖：

- PDF：ReportLab / matplotlib / pdfplumber / pikepdf / markdown2 / xhtml2pdf
- XLSX：openpyxl；`formulas` 可作为可选 recalculation provider
- PPTX：python-pptx / Pillow

## PDF Domain Runtime

实现：

```text
server/tools/wenshu/pdf/pdf_create_runtime.py
server/tools/wenshu/pdf/pdf_runtime.py
```

当前能力：

- structured PDF create
- dynamic TOC
- heading / paragraph / table / image
- chart / equation / code / references
- header / footer / page number
- Markdown -> PDF
- text/table/image extraction
- form info/fill
- merge/split
- rotate/crop
- metadata get/set

## XLSX Domain Runtime

实现：

```text
server/tools/wenshu/xlsx/xlsx_runtime.py
server/tools/wenshu/xlsx/xlsx_finalize.py
server/tools/wenshu/xlsx/xlsx_tools.py
```

当前能力：

- create / modify / inspect / recalc / verify
- formulas
- style / number format
- dimensions / merges / freeze panes
- comments / hyperlinks
- conditional formatting
- charts
- named ranges
- Sources citations
- workbook metadata finalize
- finance semantics：three-statement / DCF / comps

`xlsx_tools.py` 的许可文件保留在：

```text
server/tools/wenshu/xlsx/LICENSE.txt
```

## PPTX Domain Runtime

实现：

```text
server/tools/wenshu/pptx/pptx_runtime.py
```

当前能力：

- structured PPTD-like AST
- validate
- create
- inspect
- text / shape / image / icon / table / chart
- editable native PowerPoint objects where supported
- create_batch for long/multiple decks

用户提供的原 PPT 包引用 `kimi_ppt_dsl` converter，但未包含该转换引擎源码/许可，因此文枢使用独立实现，不复制缺失 converter。

当前不承诺任意复杂既有 PPTX 的无损修改。

## PPTX Swarm 语义

20+ 页或多份批量演示：

```text
complete all specs
  -> validate all
  -> create all
  -> inspect all
  -> deliver batch
```

这只是业务执行语义。

**不新增 Nested Agent Loop。Parent Agent 仍是唯一控制循环。**

## MicroAPP Workbench

文枢保留完整 Domain Runtime 调试/验证工作台：

```text
GET  /microapps/office-suite/runtime/status
POST /microapps/office-suite/skill-task?domain=pdf|xlsx|pptx
```

支持：

- Python 依赖状态
- JSON task
- 文件上传
- PDF 多文件处理
- 单产物下载
- 多产物 ZIP
- PPT batch create

这套工作台是 Runtime 验证面，不等于 Agent Skill Runtime。

## Agent / Harness 当前状态

PDF / XLSX / PPTX 当前 **不通过 Skill Package 自动接入 Harness**。

特别禁止旧实现：

```text
SkillResolver 命中
  -> 直接把 office_* push 进 toolExposure
```

原因：这会违反正式 Skill 合同“只能收窄、不能扩大 Harness eligible tools”的规则。

当前 `prepare-context` 不注入 WenShu Package 语义，Harness bootstrap 也不注册 PDF / XLSX / PPTX 三个文枢 task-level capability。

对应实现文件可以继续存在，供未来正式 Skill Runtime 接线和测试复用。

## 正式 Skill Runtime 接线条件

满足以下条件后，可以立即接 Agent / Harness：

1. versioned SkillDefinition；
2. active SkillInstance；
3. state / stage；
4. accepted Evidence 驱动 reducer；
5. stage-specific allowedToolIds；
6. completion criteria evaluation；
7. lifecycle/version binding。

届时必须遵守：

```text
Harness eligible tools
  ∩ Skill current allowedToolIds
  ∩ Policy / environment
  -> state.toolExposure
  -> Planner
```

Tool 调用仍走：

```text
Planner -> Normalize -> Policy -> Tool -> Evidence
```

## Hard Rules

1. Skill Package 不等于 Formal Skill Runtime。
2. Runtime Pack 安装不等于 Agent 激活。
3. PDF / XLSX / PPTX 当前先通过 MicroAPP 使用和验证。
4. Runtime Pack 不污染用户全局 Python。
5. Domain Runtime 不拆成几十个 Agent 原子工具。
6. 正式 Skill Runtime 接线前不得通过 Package selection 扩大 `toolExposure`。
7. 当前上位真相源仍是 `docs/skill/README.md` 与 `docs/skill/skill-runtime-design.md`。

## Code Anchors

- `desktop/src/features/Settings/pages/Skills/`
- `server/src/skills/registry.ts`
- `server/src/microapps/office-suite/capability-pack.ts`
- `server/src/microapps/office-suite/runtime-pack-paths.ts`
- `server/src/routes/microapps/office-suite/capability-pack.ts`
- `server/src/routes/microapps/office-suite/skill-task.ts`
- `server/src/microapps/office-suite/skill-runtime.ts`
- `server/tools/wenshu/`
