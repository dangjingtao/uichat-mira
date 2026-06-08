export type SegmentMode = "通用" | "问答" | "精细";
export type Availability = "enabled" | "disabled";
export type SyncState = "ready" | "indexing";
export type FilterKey = "all" | "enabled" | "disabled";
export type SortKey = "uploadedAt" | "charCount" | "hits";

export type KnowledgeBaseDocument = {
  id: string;
  name: string;
  type: "xlsx" | "pdf" | "docx" | "md";
  segmentMode: SegmentMode;
  charCount: number;
  hits: number;
  uploadedAt: string;
  availability: Availability;
  syncState: SyncState;
  chunkCount: number;
  source: string;
  owner: string;
  summary: string;
  tags: string[];
  updatedAt: string;
};

export const mockDocuments: KnowledgeBaseDocument[] = [
  {
    id: "doc-001",
    name: "法律法规条款汇总.xlsx",
    type: "xlsx",
    segmentMode: "通用",
    charCount: 195000,
    hits: 8,
    uploadedAt: "2026-06-04 11:59",
    availability: "enabled",
    syncState: "ready",
    chunkCount: 186,
    source: "本地上传",
    owner: "产品团队",
    summary: "汇总政策条例、处罚细则与行业适配条款，适合作为问答与检索的基础法规库。",
    tags: ["法规", "合规", "政策"],
    updatedAt: "2026-06-08 10:24",
  },
  {
    id: "doc-002",
    name: "客服标准问答手册.pdf",
    type: "pdf",
    segmentMode: "问答",
    charCount: 86400,
    hits: 23,
    uploadedAt: "2026-06-03 17:20",
    availability: "enabled",
    syncState: "ready",
    chunkCount: 92,
    source: "Dify 同步",
    owner: "客服团队",
    summary: "整理售前、售后、退款与升级场景的标准答复，用于提升客服问答一致性。",
    tags: ["客服", "FAQ", "服务"],
    updatedAt: "2026-06-08 09:10",
  },
  {
    id: "doc-003",
    name: "产品实施流程说明.docx",
    type: "docx",
    segmentMode: "精细",
    charCount: 142300,
    hits: 5,
    uploadedAt: "2026-06-02 09:14",
    availability: "disabled",
    syncState: "ready",
    chunkCount: 128,
    source: "Chat 插件",
    owner: "实施团队",
    summary: "覆盖项目立项、环境准备、上线验收等流程节点，适合实施顾问快速检索。",
    tags: ["实施", "流程", "项目"],
    updatedAt: "2026-06-07 18:42",
  },
  {
    id: "doc-004",
    name: "版本发布记录.md",
    type: "md",
    segmentMode: "通用",
    charCount: 32780,
    hits: 11,
    uploadedAt: "2026-06-01 20:06",
    availability: "enabled",
    syncState: "indexing",
    chunkCount: 37,
    source: "本地上传",
    owner: "研发团队",
    summary: "记录版本迭代、修复项与影响范围，适合作为变更说明和内部追踪依据。",
    tags: ["版本", "发布", "研发"],
    updatedAt: "2026-06-08 22:30",
  },
];

export const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "enabled", label: "可用" },
  { key: "disabled", label: "停用" },
];

export const sortOptions: { key: SortKey; label: string }[] = [
  { key: "uploadedAt", label: "上传时间" },
  { key: "charCount", label: "字符数" },
  { key: "hits", label: "召回次数" },
];

export function formatCompactNumber(value: number) {
  if (value >= 1000) {
    const number = value / 1000;
    return `${Number.isInteger(number) ? number : number.toFixed(1)}k`;
  }

  return `${value}`;
}

export function getTypeBadge(type: KnowledgeBaseDocument["type"]) {
  const config = {
    xlsx: { label: "XLSX", className: "bg-emerald-50 text-emerald-700" },
    pdf: { label: "PDF", className: "bg-rose-50 text-rose-700" },
    docx: { label: "DOCX", className: "bg-sky-50 text-sky-700" },
    md: { label: "MD", className: "bg-violet-50 text-violet-700" },
  } as const;

  return config[type];
}

export function getDocumentById(id: string | null) {
  if (!id) {
    return null;
  }

  return mockDocuments.find((document) => document.id === id) ?? null;
}
