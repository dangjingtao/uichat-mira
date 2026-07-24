export type BuiltInSkillPackageId = "docx" | "pdf" | "xlsx" | "pptx";

export type BuiltInSkillPackageDefinition = {
  id: BuiltInSkillPackageId;
  version: string;
  name: string;
  source: string;
  category: string;
  description: string;
  bundled?: boolean;
  featured?: boolean;
  license?: string;
  runtimePack?: {
    id: "wenshu-office";
    version: string;
    required: true;
  };
  runtimeCapabilities: string[];
  packageFiles: string[];
  contextIntegration: {
    status: "ready";
    mode: "progressive-disclosure";
  };
  statefulRuntime: {
    status: "deferred";
    reason: string;
    requiredContracts: string[];
  };
};

export type ListedBuiltInSkillPackageDefinition = Omit<
  BuiltInSkillPackageDefinition,
  "id"
> & {
  id: string;
};

const STATEFUL_RUNTIME_REQUIREMENTS = [
  "SkillDefinition version binding",
  "SkillInstance state/stage",
  "Evidence-driven reducer",
  "stage-specific tool constraints",
  "completion criteria evaluation",
] as const;

const progressiveContextIntegration = () => ({
  status: "ready" as const,
  mode: "progressive-disclosure" as const,
});

const deferredStatefulRuntime = () => ({
  status: "deferred" as const,
  reason:
    "Basic SkillContext is available now; optional Stateful Skill Runtime is deferred until a real business workflow needs lifecycle/state/reducer contracts.",
  requiredContracts: [...STATEFUL_RUNTIME_REQUIREMENTS],
});

/**
 * Built-in Skill packages are context/distribution packages, not Tool aliases.
 *
 * A package may contain SKILL.md, references and runtime dependency metadata.
 * The basic Skill system may discover a package, match one primary Skill and
 * inject its semantic context progressively without creating SkillInstance.
 *
 * SkillContext injection never registers or expands Harness toolExposure.
 * Execution capabilities are reconciled independently from environment/runtime
 * readiness; optional Stateful Skill Runtime remains a separate higher-level
 * contract for workflows that truly need lifecycle/state/reducers.
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
    featured: true,
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
    contextIntegration: progressiveContextIntegration(),
    statefulRuntime: deferredStatefulRuntime(),
  },
  {
    id: "xlsx",
    version: "1.0.0",
    name: "Excel 处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description:
      "电子表格高级处理工具，支持公式驱动模型、格式、图表、校验，以及三表模型、DCF 和可比公司分析等财务建模方法。",
    featured: true,
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
    contextIntegration: progressiveContextIntegration(),
    statefulRuntime: deferredStatefulRuntime(),
  },
  {
    id: "pdf",
    version: "1.0.0",
    name: "PDF 文档处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description:
      "专业 PDF 创建与处理：结构化报告、目录、图表、公式、引用，以及提取、表单、合并拆分、旋转裁切和元数据操作。",
    featured: true,
    runtimePack: { id: "wenshu-office", version: "1.0.0", required: true },
    runtimeCapabilities: ["office_pdf"],
    packageFiles: [
      "SKILL.md",
      "runtime/pdf_create_runtime.py",
      "runtime/pdf_runtime.py",
    ],
    contextIntegration: progressiveContextIntegration(),
    statefulRuntime: deferredStatefulRuntime(),
  },
  {
    id: "pptx",
    version: "1.0.0",
    name: "PowerPoint 处理",
    source: "Kimi / WenShu",
    category: "办公效率",
    description:
      "结构化生成可编辑 PowerPoint，支持主题、文本、形状、图片、表格和图表，并在生成前执行布局校验。",
    featured: true,
    runtimePack: { id: "wenshu-office", version: "1.0.0", required: true },
    runtimeCapabilities: ["office_presentation"],
    packageFiles: [
      "SKILL.md",
      "reference/pptx-swarm.md",
      "runtime/pptx_runtime.py",
    ],
    contextIntegration: progressiveContextIntegration(),
    statefulRuntime: deferredStatefulRuntime(),
  },
];

export const listBuiltInSkillPackages = (): ListedBuiltInSkillPackageDefinition[] =>
  BUILT_IN_SKILL_PACKAGES.map((definition) => ({
    ...definition,
    id: definition.id,
    ...(definition.runtimePack ? { runtimePack: { ...definition.runtimePack } } : {}),
    runtimeCapabilities: [...definition.runtimeCapabilities],
    packageFiles: [...definition.packageFiles],
    contextIntegration: { ...definition.contextIntegration },
    statefulRuntime: {
      ...definition.statefulRuntime,
      requiredContracts: [...definition.statefulRuntime.requiredContracts],
    },
  }));

export const getBuiltInSkillPackage = (id: string) =>
  listBuiltInSkillPackages().find((definition) => definition.id === id) ?? null;
