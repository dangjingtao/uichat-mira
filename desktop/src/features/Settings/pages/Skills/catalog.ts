export type SkillIconKind = "spreadsheet" | "pdf" | "word" | "presentation" | "code";

export type SkillPresentation = {
  id: string;
  name: string;
  source: string;
  category: string;
  description: string;
  icon: SkillIconKind;
  bundled?: boolean;
  runtimePack?: "wenshu-office";
  usePath?: string;
  content: string;
  files: string[];
  fileContents: Record<string, string>;
};

const runtimeSource = (path: string, description: string) => `# ${path.split("/").pop()}

${description}

运行时源码路径：\`${path}\`

该文件属于文枢确定性 Domain Runtime。安装技能依赖包只提供其 Python 依赖，不会自动把此能力注册到 Agent / Harness。`;

export const skillPresentations: SkillPresentation[] = [
  {
    id: "xlsx",
    name: "Excel 处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description: "电子表格高级处理工具，支持公式驱动模型、格式、图表、校验，以及三表模型、DCF 估值和可比公司分析等财务建模方法。",
    icon: "spreadsheet",
    runtimePack: "wenshu-office",
    usePath: "/settings/micro-apps/office-suite",
    content: `---
name: xlsx
description: Create, modify and validate Excel workbooks through Mira WenShu.
---

# Routing

用于 .xlsx 创建、修改、检查、重计算准备与验证。

当前 Domain Runtime 能力：
- create
- modify
- inspect
- recalc
- verify

# Workbook specification

支持工作簿 metadata、工作表、行/单元格、原生 Excel 公式、字体/填充/对齐/边框/数字格式、列宽行高、冻结窗格、合并单元格、批注、超链接、条件格式、图表、命名区域与 Sources 引用。

# Formula rule — mandatory

能由工作簿公式推导的值，应保留为 Excel 公式。历史原始数据、用户输入和明确假设可以硬编码；预测、滚动、分配、关联和估值输出不得由 Python 算完后贴死数值。

# Finance routing

同一 Runtime 支持三表、DCF 与 Comps，但遵循更严格的财务建模语义：历史映射先对账、预测保持公式联动、Balance Check 可见、现金与留存收益滚动必须可核验，外部数据必须保留来源。

# Completion

产物存在且可读；要求的公式、工作表、格式和图表存在；重计算准备完成；验证没有未解决的阻塞错误；外部数据有来源；财务模型检查已完成。`,
    files: ["SKILL.md", "runtime/xlsx_runtime.py", "runtime/xlsx_finalize.py", "runtime/xlsx_tools.py", "LICENSE.txt"],
    fileContents: {
      "runtime/xlsx_runtime.py": runtimeSource("server/tools/wenshu/xlsx/xlsx_runtime.py", "Excel 工作簿 create / modify / inspect / verify 的确定性执行层。"),
      "runtime/xlsx_finalize.py": runtimeSource("server/tools/wenshu/xlsx/xlsx_finalize.py", "负责真实 OOXML metadata、计算属性和新建工作簿视图的 finalize。"),
      "runtime/xlsx_tools.py": runtimeSource("server/tools/wenshu/xlsx/xlsx_tools.py", "复用并保留许可声明的 XLSX 辅助实现，用于重计算准备与校验。"),
      "LICENSE.txt": "该复用辅助代码的原许可文件保存在 server/tools/wenshu/xlsx/LICENSE.txt。文枢保留原始许可声明。",
    },
  },
  {
    id: "pdf",
    name: "PDF 文档处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description: "专业 PDF 创建与处理：结构化报告、目录、图表、公式、引用，以及提取、表单、合并拆分、旋转裁切和元数据操作。",
    icon: "pdf",
    runtimePack: "wenshu-office",
    usePath: "/settings/micro-apps/office-suite",
    content: `---
name: pdf
description: Create and process PDF files through Mira WenShu.
---

# Routing

## Route A — Create
默认使用结构化 PDF 创建能力，可生成封面信息、A4/LETTER、横竖版、页边距与样式、动态目录、页眉页脚页码，以及 heading / paragraph / table / image / chart / equation / code / reference 等内容块。

## Route B — Markdown conversion
当真实来源就是 Markdown 且用户需要转换时使用 md2pdf；不要因为 Markdown 方便就把所有 PDF 创建都降级为转换。

## Route C — Process existing PDF
支持 extract_text、extract_tables、extract_images、form_info、form_fill、merge、split、rotate、crop、meta_get、meta_set。

# Quality rules

保持清晰层级；图表必须基于真实数据；表格保证可读；需要引用时来源必须真实可核验；本地图片必须位于工作区边界内。

# Completion

提取/检查结果进入证据；生成或修改的 PDF 存在且可读；要求的结构和页面/表单/元数据操作已反映到结果；多产物操作报告输出；默认保留源文件。`,
    files: ["SKILL.md", "runtime/pdf_create_runtime.py", "runtime/pdf_runtime.py"],
    fileContents: {
      "runtime/pdf_create_runtime.py": runtimeSource("server/tools/wenshu/pdf/pdf_create_runtime.py", "ReportLab 结构化 PDF 生成器，负责目录、表格、图表、公式、代码块和页眉页脚等。"),
      "runtime/pdf_runtime.py": runtimeSource("server/tools/wenshu/pdf/pdf_runtime.py", "PDF 提取、表单、合并拆分、旋转裁切和元数据等确定性处理能力。"),
    },
  },
  {
    id: "pptx",
    name: "PowerPoint 处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description: "结构化生成可编辑 PowerPoint，支持主题、文本、形状、图片、表格和图表，并在生成前执行布局校验。",
    icon: "presentation",
    runtimePack: "wenshu-office",
    usePath: "/settings/micro-apps/office-suite",
    content: `---
name: pptx
description: Create PowerPoint presentations through Mira WenShu using a structured presentation AST.
---

# Presentation AST

先建立完整演示文稿规格：size、theme.colors、theme.textStyles、pages[]。每页包含 background 与定位 elements；支持 text、shape、image、icon、table、chart，所有定位元素使用 bounds: [x, y, width, height]。

# Workflow

理解目标、受众、页数和内容层级 → 完成整套 deck 结构 → 统一主题与布局 → 生成完整 AST → validate → 修复 blocking layout 问题 → create → inspect。

20+ 页或批量多份演示采用 pptx-swarm 的“全量规格先完成、统一校验、再批量创建/检查”语义，但不创建第二套 Agent Loop。

# Current boundary

当前能力创建新 PPTX 并检查 PPTX，不承诺任意复杂既有 PPTX 的无损修改。文本、形状、表格与图表尽量保持为可编辑 PowerPoint 原生对象。

# Completion

规格无阻塞校验错误；生成 .pptx 存在且可检查；页数与内容结构符合任务；重要布局警告已修复或明确报告。`,
    files: ["SKILL.md", "reference/pptx-swarm.md", "runtime/pptx_runtime.py"],
    fileContents: {
      "reference/pptx-swarm.md": "# PPTX Swarm\n\n用于 20+ 页长 deck 或多份演示批量创建。Parent Agent 仍是唯一控制循环；必须先完成所有规格，再统一 validate，随后 create / inspect / deliver。",
      "runtime/pptx_runtime.py": runtimeSource("server/tools/wenshu/pptx/pptx_runtime.py", "文枢独立实现的结构化 AST → editable PPTX Runtime，支持校验、创建和检查。"),
    },
  },
  {
    id: "word",
    name: "Word 文档处理",
    source: "Mira WenShu",
    category: "办公效率",
    description: "创建和编辑 Word 文档，支持非破坏性副本、原生批注与 Track Changes 修订。",
    icon: "word",
    bundled: true,
    usePath: "/settings/micro-apps/office-suite",
    content: "Word 当前由文枢基础 Office Runtime 提供本地能力。DOCX Skill 的正式 SkillInstance / reducer 合同仍与其它 Skill Runtime 一起按设计文档推进。",
    files: ["SKILL.md"],
    fileContents: {},
  },
  {
    id: "research",
    name: "研究资料整理",
    source: "Mira 社区",
    category: "学术研究",
    description: "把零散研究资料整理成结构化摘要，快速提炼论点、证据和待验证问题。",
    icon: "code",
    content: "该社区技能仍为展示条目，尚未安装。",
    files: ["SKILL.md", "templates/research-note.md"],
    fileContents: {
      "templates/research-note.md": "# Research note template\n\n社区技能展示模板。",
    },
  },
];
