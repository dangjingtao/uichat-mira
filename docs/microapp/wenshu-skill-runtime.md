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
  - ./wenshu-pptx-swarm.md
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
       ├─ docx        -> office_document
       ├─ pdf         -> office_pdf
       ├─ xlsx        -> office_spreadsheet
       ├─ pptx        -> office_presentation
       └─ pptx-swarm  -> office_presentation(create_batch)
```

Skill Runtime 是当前完整业务能力入口。基础 Office Runtime 继续保留作为稳定底层与回归验证面，不为了“统一”而强行扩成一个巨大 Office schema。

## Python Runtime

PDF / XLSX / PPTX Python 执行不打包第二套 Python。

`server/src/microapps/office-suite/python-runtime.ts` 优先解析 Mira 系统开发小套件提供的 Python：

1. `MIRA_SYSTEM_DEVKIT_PYTHON`
2. `MIRA_DEVKIT_PYTHON`
3. `UI_CHAT_DEVKIT_PYTHON`
4. `UI_CHAT_PYTHON_BIN`
5. 开发环境兼容 fallback：Windows `python` / POSIX `python3`

正式产品配置应优先提供系统开发小套件 Python 路径，不依赖用户全局 Python。

Python 依赖声明：

```text
server/tools/wenshu/requirements.txt
```

当前依赖覆盖：

- PDF：ReportLab / matplotlib / pdfplumber / pikepdf / markdown2 / xhtml2pdf
- XLSX：openpyxl；`formulas` 为可选 recalculation provider
- PPTX：python-pptx / Pillow

Runtime 状态接口会探测必需模块，不把缺依赖伪装成 Ready。
构建时 `server/tools` 由现有 `server/build.js -> copyToolsDir()` 一并进入后端产物。

## PDF Skill

Package:

```text
server/src/skills/pdf/SKILL.md
```

高层能力：

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

Create 支持：

- cover/title/subtitle/author/date
- A4/LETTER、portrait/landscape、margins/styles
- dynamic TOC from heading1/2/3
- header/footer/page numbers
- paragraphs/headings/references
- three-line style tables
- workspace-bound images
- matplotlib bar/line/pie charts
- mathtext equations
- code blocks
- page breaks/spacers
- references with real URLs

实现：

```text
server/tools/wenshu/pdf/pdf_create_runtime.py  # full creation
server/tools/wenshu/pdf/pdf_runtime.py         # processing + md2pdf
```

## XLSX Skill

Package:

```text
server/src/skills/xlsx/SKILL.md
```

高层能力：

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

- metadata / real OOXML core properties
- sheets / rows / addressed cells
- Excel formulas
- font / fill / alignment / border / number format
- column width / row height / freeze panes / merges / gridline settings
- comments / hyperlinks
- conditional formatting
- editable charts
- named ranges
- Sources sheet citations

新建工作簿默认隐藏 gridlines；修改既有工作簿不擅自改变用户原视图。

Finance 语义写在 Skill 层，Runtime 保持确定性执行。历史/raw inputs 与明确 assumptions 可以硬编码；派生、预测、roll-forward、valuation 输出优先保留为 Excel 公式，不能由 Python 算完后粘成最终值。

Create / Modify 链路：

```text
xlsx_runtime
  -> xlsx_finalize
  -> recalculation preparation
  -> verify
```

复用的 `xlsx_tools.py` 来自用户提供包中的 Modified MIT 代码，原许可证保留在：

```text
server/tools/wenshu/xlsx/LICENSE.txt
```

## PPTX / PPTX Swarm Skill

Packages:

```text
server/src/skills/pptx/SKILL.md
server/src/skills/pptx-swarm/SKILL.md
```

高层能力统一为：

```text
office_presentation
```

当前操作：

- validate
- create
- create_batch
- inspect

普通/短 deck 进入 `pptx`。
明确 20+ 页长 deck 或批量多份演示文稿进入 `pptx-swarm`。

`pptx-swarm` 不新增 Nested Agent Loop。Mira 保留唯一 Parent Agent：所有完整 deck spec 先生成，再全量 validate，然后 create / inspect / deliver。

创建使用文枢独立实现的 PPTD-like JSON AST：

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

用户提供的 PPT Skill 包引用 `kimi_ppt_dsl` converter，但包内没有该转换引擎源码，也没有附带该 converter 的许可证。因此文枢没有复制缺失/权利不明的 converter，而是独立实现结构化 AST -> editable PPTX Runtime。

当前不承诺任意复杂既有 PPTX 的无损修改。

## Agent integration

Skill Resolver：

```text
server/src/skills/registry.ts
```

规则：

1. 优先根据当前用户目标和当前附件 filename / MIME 选择 active Skill，避免旧历史文件劫持新任务。
2. 只把该 Skill 所需的真实高层能力并入唯一 `state.toolExposure`。
3. Skill 业务语义只注入对应 `office_*` 任务级工具，不污染 Read primitive。
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
- PPT batch create -> ZIP

原 Basic Office Runtime 验证 UI 保留，主页面只做最小增量接入，不重写原界面。

## Hard Rules

1. 文枢只向 Agent 暴露任务级 `office_*` 能力，不暴露几十个 Office SDK 原子操作。
2. Python 复用系统开发小套件，不打包独立 Python Runtime。
3. 大文件仍走 workspace / artifact 边界，不塞进 Planner 语义上下文。
4. Existing-file modification 默认非破坏性输出新 artifact。
5. PDF/PPT 本地素材路径必须经过 workspace 边界解析后才能进入 Agent Runtime。
6. XLSX 派生模型优先使用公式，外部数据必须保留来源。
7. PPT 必须先 validation，再 create，再 inspect；batch 必须全部 spec 先存在、全部 validate 后再 create。
8. 不因为底层库能操作 OOXML/ZIP 就夸大为任意复杂 Office 文件无损编辑。

## Validation status

当前已补 Skill resolver 回归测试与 Runtime 合同测试文件，但本次执行环境无法连接 GitHub（DNS 失败），仓库也没有为该 Draft PR 自动触发 CI，因此不能把 typecheck/test 声称为已通过。

## Code Anchors

- `server/src/skills/registry.ts`
- `server/src/skills/docx/SKILL.md`
- `server/src/skills/pdf/SKILL.md`
- `server/src/skills/xlsx/SKILL.md`
- `server/src/skills/pptx/SKILL.md`
- `server/src/skills/pptx-swarm/SKILL.md`
- `server/src/mcp/tools/office-document.tool.ts`
- `server/src/mcp/tools/office-pdf.tool.ts`
- `server/src/mcp/tools/office-spreadsheet.tool.ts`
- `server/src/mcp/tools/office-presentation.tool.ts`
- `server/src/microapps/office-suite/python-runtime.ts`
- `server/src/microapps/office-suite/skill-runtime.ts`
- `server/src/routes/microapps/office-suite/skill-task.ts`
- `desktop/src/features/Settings/pages/MicroApps/OfficeSuite/components/SkillRuntimePanel.tsx`
