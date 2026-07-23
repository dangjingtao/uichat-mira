export type SkillIconKind = "spreadsheet" | "pdf" | "word" | "presentation" | "markdown";

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

const bundledRuntimeSource = (path: string, description: string) => `# ${path.split("/").pop()}

${description}

内置运行时源码路径：\`${path}\`

该能力随 Mira / 文枢一起提供，不依赖 \`wenshu-office\` Python Runtime Pack。它目前属于确定性 Domain Runtime；正式 Agent Skill Runtime 仍等待 SkillInstance / reducer / stage constraints 合同接入。`;

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
    files: [
      "SKILL.md",
      "reference/3_statement_model.md",
      "reference/DCF_SKILL.md",
      "reference/COMPS_SKILL.md",
      "runtime/xlsx_runtime.py",
      "runtime/xlsx_finalize.py",
      "runtime/xlsx_tools.py",
      "LICENSE.txt",
    ],
    fileContents: {
      "reference/3_statement_model.md": `# Three-Statement Model Reference

三表模型要求 Income Statement / Balance Sheet / Cash Flow 全程公式联动。历史映射先与披露数据对账，再进入预测；现金流期末现金必须与资产负债表现金逐期一致；留存收益滚动必须对账，并保留可见的 Balance Check。

只允许历史原始值、用户输入和明确假设硬编码。预测、滚动、分配和派生结果必须保留为 Excel 公式。`,
      "reference/DCF_SKILL.md": `# DCF Modeling Reference

核心链路：经营预测 → EBIT → NOPAT → UFCF → WACC → 显性期折现 → Terminal Value → Enterprise Value → Equity Value → implied share price。

WACC、终值假设和 EV-to-Equity bridge 必须可见；估值计算保持公式联动；需要时提供 WACC / terminal growth 或 exit multiple 敏感性分析；外部市场数据必须保留来源。`,
      "reference/COMPS_SKILL.md": `# Comparable Companies Reference

建立有选择逻辑的 peer set，保留市场数据来源、日期和口径，使用一致的经营指标计算 EV/Revenue、EV/EBITDA、P/E 等适用倍数。

倍数、统计区间和 implied valuation 保持 Excel 公式；异常值或排除项显式说明，不静默删除；Sources 中保留真实来源 URL。`,
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
    id: "docx",
    name: "Word 文档处理",
    source: "Mira WenShu",
    category: "办公效率",
    description: "创建和审阅 Word DOCX：结构化文档生成、非破坏性副本、原生批注与 Track Changes 修订，并保留复杂文档的安全编辑边界。",
    icon: "word",
    bundled: true,
    usePath: "/settings/micro-apps/office-suite",
    content: `---
name: docx
description: Create and review Word documents (.docx) through Mira WenShu.
---

# Routing

## Route A — Existing DOCX whose formatting matters

以原 DOCX 为基础做非破坏性审阅。支持原生 Word 批注、Track Changes 建议替换，以及输出新的 .docx 副本。精确编辑目标必须能定位到安全的可见文本 run；复杂 run 无法安全修改时拒绝有损重写。

## Route B — DOCX used only as a content source

如果 DOCX 只是内容来源而不需要交付新的 Word 文档，则使用正常 Read 能力读取，不额外生成修改副本。

## Route C — Create a new DOCX

支持高层结构化创建：title、title/heading1/heading2/heading3/body 段落、bold 与简单表格。

# Execution boundary

文枢当前 DOCX 确定性 Runtime 包含：
- docx@9 结构化新建文档；
- OOXML package inspect / append-copy；
- 原生 comments.xml 批注关系与锚点；
- w:trackRevisions；
- w:ins / w:del / w:delText 修订；
- 非破坏性输出新副本。

# Hard Rules

1. 审阅不覆盖源 DOCX。
2. 不用文本编辑工具直接修改 DOCX 二进制。
3. 不把复杂 run 强行降级重写。
4. 产物必须经过回读/验证后才能视为完成。
5. 当前实现不是任意复杂 DOCX 的无损通用编辑器。

# Completion

输出文件存在且可读；请求内容或审阅语义存在；批注/修订使用 Word 原生结构；源文件在审阅任务中保持不变。`,
    files: [
      "SKILL.md",
      "references/office-runtime-reference.md",
      "runtime/create.ts",
      "runtime/document-review.ts",
      "runtime/document.ts",
      "runtime/runtime.ts",
      "runtime/contract.ts",
    ],
    fileContents: {
      "references/office-runtime-reference.md": `# DOCX Skill — WenShu Runtime Reference

## Create
结构化新建由文枢 Office Runtime 调用 docx@9 完成。支持标题、语义段落、粗体与简单表格，输出原生 .docx。

## Review
审阅采用非破坏性新副本：原生 comments.xml 批注、comment range/reference、Track Changes 插入/删除。目标文本当前必须能安全定位到单个简单 Word text run。

## Current editing boundary
复杂 run、field、drawing 或其它无法安全局部重写的结构不会被强制修改。这个限制是保护格式和文档完整性的安全边界，不代表任意 DOCX 无损编辑已经完成。

## Verification
创建或审阅后，应重新打开产物确认内容、批注或修订存在，再宣布任务完成。`,
      "runtime/create.ts": bundledRuntimeSource("server/src/microapps/office-suite/create.ts", "DOCX 结构化创建入口。使用 docx@9 生成标题、语义段落、粗体和简单表格，并由统一 Office Runtime 返回 artifact。"),
      "runtime/document-review.ts": bundledRuntimeSource("server/src/microapps/office-suite/document-review.ts", "DOCX OOXML 审阅引擎。负责 comments.xml / relationships / content types、原生批注锚点、trackRevisions、w:ins / w:del 修订，并拒绝复杂 run 的有损重写。"),
      "runtime/document.ts": bundledRuntimeSource("server/src/microapps/office-suite/document.ts", "DOCX 包级非破坏性副本修改辅助层，目前保留段落追加验证能力，并维护 sectPr 前的安全插入位置。"),
      "runtime/runtime.ts": bundledRuntimeSource("server/src/microapps/office-suite/runtime.ts", "统一 Office Runtime task executor。负责校验 task、分发 Word create/review/modify、构建 artifact 与错误合同。"),
      "runtime/contract.ts": bundledRuntimeSource("server/src/microapps/office-suite/contract.ts", "office-runtime.v1 的任务合同与 Word create/review request 类型定义，是文枢 DOCX 确定性执行面的稳定边界。"),
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
    id: "research",
    name: "研究资料整理",
    source: "Mira 社区",
    category: "学术研究",
    description: "把零散研究资料整理成结构化摘要，快速提炼论点、证据和待验证问题。",
    icon: "markdown",
    content: "该社区技能仍为展示条目，尚未安装。",
    files: ["SKILL.md", "templates/research-note.md"],
    fileContents: {
      "templates/research-note.md": "# Research note template\n\n社区技能展示模板。",
    },
  },
];
