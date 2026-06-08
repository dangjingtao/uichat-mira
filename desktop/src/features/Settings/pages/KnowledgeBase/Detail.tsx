import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  Hash,
  Layers3,
  RefreshCcw,
  ScanSearch,
  Tags,
  UserRound,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { FileIcon } from "@/shared/ui/FileIcon";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";
import { message } from "@/shared/ui/Message";
import {
  getKnowledgeBaseDocument,
  type KnowledgeBaseDocumentDetail,
} from "@/shared/api/knowledgeBase";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import { DEFAULT_SEGMENT_MODE, formatCompactNumber, getTypeBadge } from "./mockData";

export default function KnowledgeBaseDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("id");
  const [document, setDocument] = useState<KnowledgeBaseDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!documentId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        const data = await getKnowledgeBaseDocument(documentId);
        setDocument(data);
        setNotFound(false);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [documentId]);

  const previewChunks = useMemo(() => document?.chunks ?? [], [document]);

  if (loading) {
    return <FullPageStatus message="正在加载文档详情..." />;
  }

  if (notFound || !document) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => navigate("/settings/knowledge-base")}
        >
          <ArrowLeft className="h-4 w-4" />
          返回知识库
        </Button>

        <Card className="p-5">
          <div className="space-y-1.5">
            <div className="text-base font-semibold text-text-primary">未找到对应文档</div>
            <p className="text-sm leading-6 text-text-secondary">
              当前 query 参数中的 `id` 无法匹配到实际数据，请从列表页重新进入。
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const badge = getTypeBadge(document.fileExt);
  const status =
    document.indexStatus === "processing"
      ? { indicator: "unknown" as const, label: "同步中" }
      : document.enabled
        ? { indicator: "running" as const, label: "可用" }
        : { indicator: "stopped" as const, label: "停用" };
  const summary =
    previewChunks[0]?.content ||
    document.contentText.slice(0, 160) ||
    "当前文档暂无可展示的内容摘要。";
  const tags = [document.fileExt.toUpperCase(), document.sourceType, document.indexStatus];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5">
      <section className="flex flex-col gap-3">
        <Button
          variant="ghost"
          className="w-fit"
          onClick={() => navigate("/settings/knowledge-base")}
        >
          <ArrowLeft className="h-4 w-4" />
          返回知识库
        </Button>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-primary p-4 shadow-shadow-sm xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
              <FileIcon extension={document.fileExt} className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
                <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {DEFAULT_SEGMENT_MODE}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
                  <StatusIndicator status={status.indicator} size="sm" />
                  {status.label}
                </span>
              </div>

              <div>
                <h1 className="break-all text-xl font-semibold text-text-primary">
                  {document.name}
                </h1>
                <p className="mt-1.5 max-w-4xl text-sm leading-6 text-text-secondary">
                  {summary}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={() => message.info(`重建索引接口将在下一步接入：${document.name}`)}
            >
              <RefreshCcw className="h-4 w-4" />
              重建索引
            </Button>
            <Button onClick={() => message.success(`已开始测试 ${document.name} 的检索效果`)}>
              <ScanSearch className="h-4 w-4" />
              立即测试检索
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-secondary">
                <Layers3 className="h-4.5 w-4.5 text-icon-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">文档分段预览</h2>
                <p className="text-sm text-text-secondary">
                  当前已展示后端真实切分结果，可直接用于后续引用片段和检索验证。
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {previewChunks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-secondary p-4 text-sm text-text-secondary">
                  当前文档还没有切分结果。
                </div>
              ) : (
                previewChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-xl border border-border bg-surface-secondary p-3.5"
                  >
                    <div className="mb-1.5 text-sm font-medium text-text-primary">
                      分段 {chunk.chunkIndex}
                    </div>
                    <p className="text-sm leading-6 text-text-secondary">{chunk.content}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 text-base font-semibold text-text-primary">基础信息</div>
            <div className="grid gap-2.5">
              <div className="rounded-xl border border-border bg-surface-secondary p-3.5">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <Hash className="h-3.5 w-3.5" />
                  文档 ID
                </div>
                <div className="text-sm font-medium text-text-primary">{document.id}</div>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary p-3.5">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <UserRound className="h-3.5 w-3.5" />
                  来源 / 类型
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {document.sourceLabel || document.sourceType} · {document.fileExt.toUpperCase()}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary p-3.5">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <Clock3 className="h-3.5 w-3.5" />
                  创建 / 更新时间
                </div>
                <div className="text-sm font-medium text-text-primary">
                  {document.createdAt.replace("T", " ").slice(0, 16)} ·{" "}
                  {document.updatedAt.replace("T", " ").slice(0, 16)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary p-3.5">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <Tags className="h-3.5 w-3.5" />
                  标签
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
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

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Card
              label="字符数"
              value={formatCompactNumber(document.charCount)}
              description="当前文档已入库字符规模"
            />
            <Card
              label="分段数"
              value={`${document.chunkCount}`}
              description="来源于真实切分结果"
            />
            <Card
              label="文件大小"
              value={document.fileSize ? formatCompactNumber(document.fileSize) : "--"}
              description="上传时记录的原始大小"
            />
            <Card
              label="状态"
              value={status.label}
              description="来源于当前文档索引状态"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
