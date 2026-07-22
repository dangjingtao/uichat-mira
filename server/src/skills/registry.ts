export type BuiltInSkillPackageId = "pdf" | "xlsx" | "pptx";

export type BuiltInSkillPackageDefinition = {
  id: BuiltInSkillPackageId;
  version: string;
  name: string;
  source: string;
  category: string;
  description: string;
  runtimePack: {
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

/**
 * These are installable/discoverable Skill packages, not active SkillInstances.
 *
 * A package may contain SKILL.md, references and runtime scripts, but installing
 * it only makes deterministic domain runtime dependencies available. It does
 * not create Skill state, inject Planner semantics, or register/expand Harness
 * tools. Formal Agent integration waits for the Skill Runtime contract:
 * SkillDefinition + SkillInstance + state reducer + stage-specific constraints.
 */
const BUILT_IN_SKILL_PACKAGES: BuiltInSkillPackageDefinition[] = [
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
    agentIntegration: {
      status: "deferred",
      reason: "The formal Skill Runtime lifecycle is not implemented yet.",
      requiredContracts: [
        "SkillDefinition version binding",
        "SkillInstance state/stage",
        "Evidence-driven reducer",
        "stage-specific tool constraints",
        "completion criteria evaluation",
      ],
    },
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
    agentIntegration: {
      status: "deferred",
      reason: "The formal Skill Runtime lifecycle is not implemented yet.",
      requiredContracts: [
        "SkillDefinition version binding",
        "SkillInstance state/stage",
        "Evidence-driven reducer",
        "stage-specific tool constraints",
        "completion criteria evaluation",
      ],
    },
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
    agentIntegration: {
      status: "deferred",
      reason: "The formal Skill Runtime lifecycle is not implemented yet.",
      requiredContracts: [
        "SkillDefinition version binding",
        "SkillInstance state/stage",
        "Evidence-driven reducer",
        "stage-specific tool constraints",
        "completion criteria evaluation",
      ],
    },
  },
];

export const listBuiltInSkillPackages = (): BuiltInSkillPackageDefinition[] =>
  BUILT_IN_SKILL_PACKAGES.map((definition) => ({
    ...definition,
    runtimePack: { ...definition.runtimePack },
    runtimeCapabilities: [...definition.runtimeCapabilities],
    packageFiles: [...definition.packageFiles],
    agentIntegration: {
      ...definition.agentIntegration,
      requiredContracts: [...definition.agentIntegration.requiredContracts],
    },
  }));

export const getBuiltInSkillPackage = (id: string) =>
  listBuiltInSkillPackages().find((definition) => definition.id === id) ?? null;
