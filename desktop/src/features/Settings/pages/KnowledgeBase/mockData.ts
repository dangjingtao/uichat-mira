export type SegmentMode = "通用";
export type Availability = "enabled" | "disabled";
export type SyncState = "ready" | "indexing";
export type FilterKey = "all" | "enabled" | "disabled";
export type SortKey = "uploadedAt" | "charCount" | "hits";

export const DEFAULT_SEGMENT_MODE: SegmentMode = "通用";

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

export function getTypeBadge(type: string) {
  const ext = type.toLowerCase();
  const config = {
    xlsx: { label: "XLSX", className: "bg-emerald-50 text-emerald-700" },
    xls: { label: "XLS", className: "bg-emerald-50 text-emerald-700" },
    pdf: { label: "PDF", className: "bg-rose-50 text-rose-700" },
    docx: { label: "DOCX", className: "bg-sky-50 text-sky-700" },
    md: { label: "MD", className: "bg-violet-50 text-violet-700" },
    txt: { label: "TXT", className: "bg-slate-100 text-slate-700" },
  } as const;

  return config[ext as keyof typeof config] ?? {
    label: ext.toUpperCase(),
    className: "bg-slate-100 text-slate-700",
  };
}
