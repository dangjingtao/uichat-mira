import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  FileSpreadsheet,
  Hash,
  Layers3,
  RefreshCcw,
  ScanSearch,
  Tags,
  UserRound,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import {
  formatCompactNumber,
  getDocumentById,
  getTypeBadge,
} from "./mockData";

export default function KnowledgeBaseDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("id");
  const document = getDocumentById(documentId);

  const previewChunks = useMemo(() => {
    if (!document) {
      return [];
    }

    return Array.from({ length: 4 }, (_, index) => ({
      id: `${document.id}-chunk-${index + 1}`,
      title: `分段 ${index + 1}`,
      content: `${document.summary} 这是用于详情页展示的模拟分段内容，第 ${index + 1} 段可替换为真实 chunk、embedding 或召回预览。`,
    }));
  }, [document]);

  if (!document) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => navigate("/settings/knowledge-base")}
        >
          <ArrowLeft className="h-4 w-4" />
          返回知识库
        </Button>

        <Card className="p-6">
          <div className="space-y-2">
            <div className="text-lg font-semibold text-text-primary">
              未找到对应知识库
            </div>
            <p className="text-sm leading-6 text-text-secondary">
              当前 query 参数中的 `id` 无法匹配到假数据，请从列表页重新双击进入。
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const badge = getTypeBadge(document.type);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <section className="flex flex-col gap-4">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => navigate("/settings/knowledge-base")}
        >
          <ArrowLeft className="h-4 w-4" />
          返回知识库
        </Button>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-primary p-5 shadow-shadow-sm xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-secondary">
              <FileSpreadsheet className="h-5 w-5 text-icon-primary" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {document.segmentMode}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
                  <StatusIndicator
                    status={
                      document.availability === "enabled" ? "running" : "stopped"
                    }
                    size="sm"
                  />
                  {document.syncState === "indexing"
                    ? "同步中"
                    : document.availability === "enabled"
                      ? "可用"
                      : "停用"}
                </span>
              </div>

              <div>
                <h1 className="break-all text-2xl font-semibold text-text-primary">
                  {document.name}
                </h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-text-secondary">
                  {document.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary">
              <RefreshCcw className="h-4 w-4" />
              重建索引
            </Button>
            <Button>
              <ScanSearch className="h-4 w-4" />
              立即测试检索
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
                <Layers3 className="h-5 w-5 text-icon-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  文档分段预览
                </h2>
                <p className="text-sm text-text-secondary">
                  当前使用 query 参数中的 `id` 加载详情，后续可替换为真实 chunk 数据。
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {previewChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="rounded-xl border border-border bg-surface-secondary p-4"
                >
                  <div className="mb-2 text-sm font-medium text-text-primary">
                    {chunk.title}
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 text-lg font-semibold text-text-primary">
              基础信息
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl border border-border bg-surface-secondary p-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <Hash className="h-3.5 w-3.5" />
                  文档 ID
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {document.id}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary p-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <UserRound className="h-3.5 w-3.5" />
                  维护人 / 来源
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {document.owner} · {document.source}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary p-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <Clock3 className="h-3.5 w-3.5" />
                  上传 / 更新时间
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {document.uploadedAt} · {document.updatedAt}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary p-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <Tags className="h-3.5 w-3.5" />
                  标签
                </div>
                <div className="flex flex-wrap gap-2">
                  {document.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-surface-primary px-2.5 py-1 text-xs font-medium text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card
              label="字符数"
              value={formatCompactNumber(document.charCount)}
              description="当前文档已入库字符规模"
            />
            <Card
              label="分段数"
              value={`${document.chunkCount}`}
              description="用于展示分段策略结果"
            />
            <Card
              label="召回次数"
              value={`${document.hits}`}
              description="后续可接真实检索质量指标"
            />
            <Card
              label="状态"
              value={document.syncState === "indexing" ? "同步中" : "已完成"}
              description="来源于当前假数据字段"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
