export type BuiltInSkillPackageId = "docx" | "pdf" | "xlsx" | "pptx";

export type BuiltInSkillPackageDefinition = {
  id: BuiltInSkillPackageId;
  version: string;
  name: string;
  source: string;
  category: string;
  description: string;
  bundled?: boolean;
  runtimePack?: {
    id: "wenshu-office";
    version: string;
    required: true;
  };
  runtimeCapabilities: string[];
  packageFiles: string[];
  agentIntegration: {
    status: "deferred";
    reason: string;
    requiredContracts: string[];
  };
};

const AGENT_INTEGRATION_REQUIREMENTS = [
  "SkillDefinition version binding",
  "SkillInstance state/stage",
  "Evidence-driven reducer",
  "stage-specific tool constraints",
  "completion criteria evaluation",
] as const;

const deferredAgentIntegration = () => ({
  status: "deferred" as const,
  reason: "The formal Skill Runtime lifecycle is not implemented yet.",
  requiredContracts: [...AGENT_INTEGRATION_REQUIREMENTS],
});

/**
 * These are installable/discoverable Skill packages, not active SkillInstances.
 *
 * A package may contain SKILL.md, references and runtime implementation metadata.
 * Bundled packages can use capabilities already shipped with Mira; installable
 * packages can additionally depend on an optional Runtime Pack. Neither form
 * creates Skill state, injects Planner semantics, or registers/expands Harness
 * tools. Formal Agent integration waits for the Skill Runtime contract:
 * SkillDefinition + SkillInstance + state reducer + stage-specific constraints.
 */
const BUILT_IN_SKILL_PACKAGES: BuiltInSkillPackageDefinition[] = [
  {
    id: "docx",
    version: "1.0.0",
    name: "Word 文档处理",
    source: "Mira WenShu",
    category: "办公效率",
    description:
      "创建和审阅 Word DOCX：结构化文档生成、非破坏性副本、原生批注与 Track Changes 修订，并保留复杂文档的安全编辑边界。",
    bundled: true,
    runtimeCapabilities: ["office_document"],
    packageFiles: [
      "SKILL.md",
      "references/office-runtime-reference.md",
      "runtime/create.ts",
      "runtime/document-review.ts",
      "runtime/document.ts",
      "runtime/runtime.ts",
      "runtime/contract.ts",
    ],
    agentIntegration: deferredAgentIntegration(),
  },
  {
    id: "xlsx",
    version: "1.0.0",
    name: "Excel 处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description:
      "电子表格高级处理工具，支持公式驱动模型、格式、图表、校验，以及三表模型、DCF 和可比公司分析等财务建模方法。",
    runtimePack: { id: "wenshu-office", version: "1.0.0", required: true },
    runtimeCapabilities: ["office_spreadsheet"],
    packageFiles: [
      "SKILL.md",
      "reference/3_statement_model.md",
      "reference/DCF_SKILL.md",
      "reference/COMPS_SKILL.md",
      "runtime/xlsx_runtime.py",
      "runtime/xlsx_finalize.py",
      "runtime/xlsx_tools.py",
      "LICENSE.txt",
    ],
    agentIntegration: deferredAgentIntegration(),
  },
  {
    id: "pdf",
    version: "1.0.0",
    name: "PDF 文档处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description:
      "专业 PDF 创建与处理：结构化报告、目录、图表、公式、引用，以及提取、表单、合并拆分、旋转裁切和元数据操作。",
    runtimePack: { id: "wenshu-office", version: "1.0.0", required: true },
    runtimeCapabilities: ["office_pdf"],
    packageFiles: [
      "SKILL.md",
      "runtime/pdf_create_runtime.py",
      "runtime/pdf_runtime.py",
    ],
    agentIntegration: deferredAgentIntegration(),
  },
  {
    id: "pptx",
    version: "1.0.0",
    name: "PowerPoint 处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description:
      "结构化生成可编辑 PowerPoint，支持主题、文本、形状、图片、表格和图表，并在生成前执行布局校验。",
    runtimePack: { id: "wenshu-office", version: "1.0.0", required: true },
    runtimeCapabilities: ["office_presentation"],
    packageFiles: [
      "SKILL.md",
      "reference/pptx-swarm.md",
      "runtime/pptx_runtime.py",
    ],
    agentIntegration: deferredAgentIntegration(),
  },
];

export const listBuiltInSkillPackages = (): BuiltInSkillPackageDefinition[] =>
  BUILT_IN_SKILL_PACKAGES.map((definition) => ({
    ...definition,
    ...(definition.runtimePack ? { runtimePack: { ...definition.runtimePack } } : {}),
    runtimeCapabilities: [...definition.runtimeCapabilities],
    packageFiles: [...definition.packageFiles],
    agentIntegration: {
      ...definition.agentIntegration,
      requiredContracts: [...definition.agentIntegration.requiredContracts],
    },
  }));

export const getBuiltInSkillPackage = (id: string) =>
  listBuiltInSkillPackages().find((definition) => definition.id === id) ?? null;
