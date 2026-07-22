# 文枢 Skill Runtime 当前实现

Status: Current
Owner: chat / runtime / microapp
Last verified: 2026-07-23
Layer: raw-source
Module: MicroAPP / SKILL
Feature: WenShuSkillRuntime
Doc Type: current-contract
Canonical: true
Related:
  - ./office-runtime-task-contract.md
  - ../skill/README.md
  - ../skill/docx-skill-current.md

## Purpose

文枢现在同时包含两层能力：

```text
WenShu MicroAPP
  ├─ Basic Office Runtime
  │    └─ 既有 DOCX / XLSX / PPTX inspect/create/basic modify 验证合同
  │
  └─ Skill Runtime
       ├─ docx  -> office_document
       ├─ pdf   -> office_pdf
       ├─ xlsx  -> office_spreadsheet
       └─ pptx  -> office_presentation
```

Skill Runtime 是当前完整业务能力入口。基础 Office Runtime 继续保留作为稳定底层与回归验证面，不为了“统一”而强行扩成一个巨大 Office schema。

## Python Runtime

PDF / XLSX / PPTX Python 执行不再打包第二套 Python。

文枢通过 `server/src/microapps/office-suite/python-runtime.ts` 解析 Mira 系统开发小套件提供的 Python：

1. `MIRA_SYSTEM_DEVKIT_PYTHON`
2. `MIRA_DEVKIT_PYTHON`
3. `UI_CHAT_DEVKIT_PYTHON`
4. `UI_CHAT_PYTHON_BIN`
5. 开发环境兼容 fallback：Windows `python` / POSIX `python3`

正式产品配置应优先提供系统开发小套件 Python 路径，不依赖全局 Python。

Python 依赖声明：

```text
server/tools/wenshu/requirements.txt
```

Runtime 状态接口会检查依赖是否齐备，不会把缺依赖伪装成可用。

构建时 `server/tools` 继续由现有 server build 的 `copyToolsDir()` 一并进入后端产物。

## PDF Skill

Package:

```text
server/src/skills/pdf/SKILL.md
```

Agent 高层能力：

```text
office_pdf
```

当前操作：

- create
- md2pdf
- extract_text
- extract_tables
- extract_images
- form_info
- form_fill
- merge
- split
- rotate
- crop
- meta_get
- meta_set

实现：

```text
server/tools/wenshu/pdf/pdf_runtime.py
```

## XLSX Skill

Package:

```text
server/src/skills/xlsx/SKILL.md
```

Agent 高层能力：

```text
office_spreadsheet
```

当前操作：

- create
- modify
- inspect
- recalc
- verify

Workbook spec 支持：

- sheets / rows / addressed cells
- Excel formulas
- font / fill / alignment / border / number format
- column width / row height / freeze panes / merges
- comments / hyperlinks
- conditional formatting
- editable charts
- named ranges
- Sources sheet citations

Finance 语义写在 Skill 层，Runtime 保持确定性执行。派生/预测/估值结果应优先保留为 Excel 公式，不应由 Python 计算后硬编码进交付工作簿。

复用的 `xlsx_tools.py` 来自用户提供包中的 Modified MIT 代码，原许可证保留在：

```text
server/tools/wenshu/xlsx/LICENSE.txt
```

## PPTX Skill

Package:

```text
server/src/skills/pptx/SKILL.md
```

Agent 高层能力：

```text
office_presentation
```

当前操作：

- validate
- create
- inspect

创建使用文枢自己实现的 PPTD-like JSON AST：

```text
size
  + theme
  + pages[]
      + text
      + shape
      + image
      + icon
      + table
      + chart
```

Runtime：

```text
server/tools/wenshu/pptx/pptx_runtime.py
```

用户提供的 PPT Skill 包中引用了 `kimi_ppt_dsl` converter，但没有包含该转换引擎源码，也没有附带该包的许可证。因此文枢没有复制缺失/权利不明的 converter，而是独立实现等价的结构化 AST -> editable PPTX Runtime。

当前不承诺任意复杂既有 PPTX 的无损修改。

## Agent integration

Skill Resolver：

```text
server/src/skills/registry.ts
```

当前规则：

1. 从当前用户目标和当前附件 filename / MIME 选择 active Skill。
2. 只把该 Skill 所需的真实高层能力并入唯一 `state.toolExposure`。
3. Skill 业务语义只注入对应 `office_*` 任务级工具。
4. Planner 仍只产生现有 `use_tool`。
5. Normalize / Policy / approval / ToolNode / Evidence 合同不变。
6. 不新增 `use_skill` action，不建立第二 Agent Loop。

## MicroAPP workbench

文枢设置页新增：

```text
Skill Runtime 全能力工作台
```

后端：

```text
GET  /microapps/office-suite/runtime/status
POST /microapps/office-suite/skill-task?domain=pdf|xlsx|pptx
```

工作台支持：

- Runtime / Python 依赖状态
- JSON task 输入
- 多文件上传（例如 PDF merge）
- JSON 结果查看
- 单产物直接下载
- 多产物 ZIP 下载

原 Basic Office Runtime 验证 UI 保留，不被重写。

## Hard Rules

1. 文枢只向 Agent 暴露任务级 `office_*` 能力，不暴露几十个 Office SDK 原子操作。
2. Python 复用系统开发小套件，不打包独立 Python Runtime。
3. 大文件仍走 workspace / artifact 边界，不塞进 Planner 语义上下文。
4. Existing-file modification 默认非破坏性输出新 artifact。
5. XLSX 派生模型优先使用公式，外部数据必须保留来源。
6. PPT 必须先 validation，再 create，再 inspect。
7. 不因为底层库能操作 OOXML/ZIP 就夸大为任意复杂 Office 文件无损编辑。

## Code Anchors

- `server/src/skills/registry.ts`
- `server/src/skills/docx/SKILL.md`
- `server/src/skills/pdf/SKILL.md`
- `server/src/skills/xlsx/SKILL.md`
- `server/src/skills/pptx/SKILL.md`
- `server/src/mcp/tools/office-document.tool.ts`
- `server/src/mcp/tools/office-pdf.tool.ts`
- `server/src/mcp/tools/office-spreadsheet.tool.ts`
- `server/src/mcp/tools/office-presentation.tool.ts`
- `server/src/microapps/office-suite/python-runtime.ts`
- `server/src/microapps/office-suite/skill-runtime.ts`
- `server/src/routes/microapps/office-suite/skill-task.ts`
- `desktop/src/features/Settings/pages/MicroApps/OfficeSuite/components/SkillRuntimePanel.tsx`
