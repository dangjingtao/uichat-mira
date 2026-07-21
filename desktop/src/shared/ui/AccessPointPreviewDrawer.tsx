import { ExternalLink } from "lucide-react";
import Drawer from "./Drawer";
import Badge from "./Badge";
import { Button } from "./Button";
import type { AccessPointPreview } from "../types/access-point-preview";

const typeLabels: Record<AccessPointPreview["resourceType"], string> = {
  document: "文档",
  table: "表格",
  collection: "集合",
};

export default function AccessPointPreviewDrawer({ open, preview, loading, error, onClose }: { open: boolean; preview: AccessPointPreview | null; loading?: boolean; error?: string | null; onClose: () => void }) {
  return <Drawer open={open} onClose={onClose} width={620} closeLabel="关闭接入点预览" closeMaskLabel="关闭接入点预览" header={<div><div className="text-base font-semibold text-text-primary">接入点预览</div>{preview ? <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary"><span>{preview.name}</span><Badge variant="muted">{typeLabels[preview.resourceType]}</Badge><span>{preview.source}</span></div> : null}</div>} footer={preview?.openUrl ? <Button variant="secondary" onClick={() => window.open(preview.openUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="h-4 w-4" />原站打开</Button> : null}>
    {loading ? <div className="py-12 text-center text-sm text-text-secondary">正在加载预览...</div> : null}
    {!loading && error ? <div className="rounded-ui-panel border border-danger-border bg-danger-soft px-3.5 py-3 text-sm leading-6 text-danger-text">{error}</div> : null}
    {!loading && !error && preview ? <div className="space-y-5">
      <PreviewSection title="权限范围"><div className="flex flex-wrap gap-1.5">{preview.permissions.length > 0 ? preview.permissions.map((permission) => <Badge key={permission} variant="neutral">{permission}</Badge>) : <span className="text-xs text-text-secondary">未配置动作</span>}</div></PreviewSection>
      <PreviewSection title="资源信息"><div className="grid gap-2 sm:grid-cols-2">{Object.entries(preview.metadata).map(([key, value]) => <div key={key} className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2"><div className="text-[11px] text-text-tertiary">{key}</div><div className="mt-1 break-all text-xs text-text-secondary">{value}</div></div>)}</div></PreviewSection>
      {preview.fields?.length ? <PreviewSection title="字段"><div className="divide-y divide-border rounded-ui-control border border-border">{preview.fields.map((field) => <div key={field.name} className="flex items-center justify-between gap-3 px-3 py-2 text-xs"><span className="font-medium text-text-primary">{field.name}</span><span className="text-text-tertiary">{field.type}</span></div>)}</div></PreviewSection> : null}
      {preview.samples?.length ? <PreviewSection title="示例数据"><div className="space-y-2">{preview.samples.map((sample, index) => <div key={index} className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-xs"><div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">{Object.entries(sample).map(([key, value]) => <div key={key} className="min-w-0"><span className="text-text-tertiary">{key}：</span><span className="break-words text-text-secondary">{String(value ?? "-")}</span></div>)}</div></div>)}</div></PreviewSection> : null}
      {preview.excerpt ? <PreviewSection title="正文摘要"><div className="whitespace-pre-wrap rounded-ui-control border border-border bg-surface-secondary px-3 py-3 text-sm leading-6 text-text-secondary">{preview.excerpt}</div></PreviewSection> : null}
    </div> : null}
  </Drawer>;
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="text-sm font-semibold text-text-primary">{title}</h3>{children}</section>;
}
