import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Search,
  Sparkles,
  X,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Lightbulb,
  Trash2,
  Link2,
  Pin,
  RefreshCw,
} from "lucide-react";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import Badge from "@/shared/ui/Badge";
import { Button, Drawer, MarkdownText, Modal, Result, Skeleton } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  listCaptures,
  listInsights,
  dismissInsight,
  getStats,
  deleteCapture,
  searchCaptures,
  getCaptureRelations,
  getCapture,
  rebuildKnowledge,
  type KnowledgeCapture,
  type KnowledgeInsight,
  type KnowledgeRelation,
} from "@/shared/api/evolvingKnowledge";
import { resolveAttachmentUrl } from "@/shared/api/attachments";

const resolveCaptureMarkdown = (content: string) =>
  content.replace(/(!\[[^\]]*\]\()((?:\/attachments\/)[^\s)]+)(\))/g, (_match, prefix, url, suffix) =>
    `${prefix}${resolveAttachmentUrl(url)}${suffix}`,
  );

const contentTypeIcons: Record<string, React.ReactNode> = {
  webpage: <FileText className="h-4 w-4" />,
};

const contentTypeLabels: Record<string, string> = {
  webpage: "网页",
};

const insightTypeConfig: Record<
  string,
  { icon: React.ReactNode; tone: string; label: string }
> = {
  synthesis: {
    icon: <Sparkles className="h-4 w-4" />,
    tone: "primary",
    label: "主题聚合",
  },
  contradiction: {
    icon: <AlertTriangle className="h-4 w-4" />,
    tone: "danger",
    label: "知识冲突",
  },
  resurfacing: {
    icon: <Clock className="h-4 w-4" />,
    tone: "warning",
    label: "跨时间回响",
  },
  gap: {
    icon: <Lightbulb className="h-4 w-4" />,
    tone: "info",
    label: "知识缺口",
  },
};

export default function EvolvingKnowledgeStudioPage() {
  const [loading, setLoading] = useState(true);
  const [captures, setCaptures] = useState<KnowledgeCapture[]>([]);
  const latestCaptureIdRef = useRef<string | null>(null);
  const [insights, setInsights] = useState<KnowledgeInsight[]>([]);
  const [stats, setStats] = useState<{
    totalCaptures: number;
    totalInsights: number;
    totalTags: number;
    byContentType: Record<string, number>;
    topTags: Array<{ tagName: string; usageCount: number }>;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [featuredInsightIndex, setFeaturedInsightIndex] = useState(0);
  const [selectedInsight, setSelectedInsight] = useState<KnowledgeInsight | null>(null);
  const [selectedCapture, setSelectedCapture] = useState<KnowledgeCapture | null>(null);
  const [insightDetailCapture, setInsightDetailCapture] = useState<KnowledgeCapture | null>(null);
  const [insightDetailLoading, setInsightDetailLoading] = useState(false);
  const [pinnedInsightIds, setPinnedInsightIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedCaptureId, setExpandedCaptureId] = useState<string | null>(null);
  const [captureRelations, setCaptureRelations] = useState<
    Record<string, KnowledgeRelation[]>
  >({});
  const [relationsLoadingId, setRelationsLoadingId] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [capturesRes, insightsRes, statsRes] = await Promise.all([
        listCaptures({ limit: 50 }),
        listInsights(),
        getStats(),
      ]);
      setCaptures(capturesRes ?? []);
      latestCaptureIdRef.current = capturesRes?.[0]?.id ?? null;
      setInsights(insightsRes ?? []);
      setStats(statsRes);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "加载失败",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const batchSize = 25;
      let offset = 0;
      let capturesScanned = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await rebuildKnowledge({ limit: batchSize, offset });
        capturesScanned += result.capturesScanned;
        offset = result.nextOffset;
        hasMore = result.hasMore;
      }

      message.success(`重建完成，已扫描 ${capturesScanned} 条捕获`);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "重建失败");
    } finally {
      setRebuilding(false);
    }
  };

  useEffect(() => {
    let refreshInFlight = false;

    const refreshWhenChanged = async () => {
      if (document.hidden || refreshInFlight) return;
      refreshInFlight = true;
      try {
        const nextCaptures = await listCaptures({ limit: 50 });
        const nextLatestCaptureId = nextCaptures?.[0]?.id ?? null;
        if (nextLatestCaptureId === latestCaptureIdRef.current) return;

        latestCaptureIdRef.current = nextLatestCaptureId;
        setCaptures(nextCaptures ?? []);
        const [nextInsights, nextStats] = await Promise.all([
          listInsights(),
          getStats(),
        ]);
        setInsights(nextInsights ?? []);
        setStats(nextStats);
      } catch {
        // 后台静默刷新失败不打断当前页面，下一轮继续检查。
      } finally {
        refreshInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) void refreshWhenChanged();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const timer = window.setInterval(() => void refreshWhenChanged(), 5000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(timer);
    };
  }, []);

  const filteredCaptures = useMemo(() => {
    return captures;
  }, [captures]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await load();
      return;
    }
    setLoading(true);
    try {
      const res = await searchCaptures(searchQuery.trim());
      setCaptures(res ?? []);
    } catch (error) {
      message.error("搜索失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDismissInsight = async (id: string) => {
    try {
      await dismissInsight(id);
      setInsights((prev) => prev.filter((i) => i.id !== id));
      setPinnedInsightIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      message.error("关闭失败");
    }
  };

  const toggleInsightPin = (id: string) => {
    setPinnedInsightIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openInsightDetails = async (insight: KnowledgeInsight) => {
    setSelectedCapture(null);
    setSelectedInsight(insight);
    setInsightDetailCapture(null);
    if (!insight.triggerCaptureId) return;

    setInsightDetailLoading(true);
    try {
      const capture = await getCapture(insight.triggerCaptureId);
      setInsightDetailCapture(capture);
    } catch {
      message.error("洞见来源加载失败");
    } finally {
      setInsightDetailLoading(false);
    }
  };

  const openCaptureDetails = (capture: KnowledgeCapture) => {
    setSelectedInsight(null);
    setSelectedCapture(capture);
  };

  const closeDetails = () => {
    setSelectedInsight(null);
    setSelectedCapture(null);
  };

  const toggleCaptureRelations = async (captureId: string) => {
    if (expandedCaptureId === captureId) {
      setExpandedCaptureId(null);
      return;
    }

    setExpandedCaptureId(captureId);
    if (captureRelations[captureId]) return;

    setRelationsLoadingId(captureId);
    try {
      const relations = await getCaptureRelations(captureId);
      setCaptureRelations((prev) => ({ ...prev, [captureId]: relations ?? [] }));
    } catch {
      message.error("关联内容加载失败");
    } finally {
      setRelationsLoadingId(null);
    }
  };

  const visibleInsights = useMemo(
    () =>
      [...insights].sort(
        (a, b) =>
          Number(pinnedInsightIds.has(b.id)) - Number(pinnedInsightIds.has(a.id)),
      ),
    [insights, pinnedInsightIds],
  );

  const handleDeleteCapture = (capture: KnowledgeCapture) => {
    Modal.confirm({
      title: "删除捕获内容",
      description: `删除“${capture.title || "无标题"}”后，原文、附件和相关派生数据都会被永久移除，此操作不可恢复。`,
      tone: "danger",
      confirmText: "确认删除",
      cancelText: "取消",
      loadingText: "删除中...",
      onConfirm: async () => {
        await deleteCapture(capture.id);
        message.success("已删除");
        await load();
      },
    });
  };

  const featuredInsight = visibleInsights.length
    ? visibleInsights[Math.min(featuredInsightIndex, visibleInsights.length - 1)]
    : null;
  const hasTimelineContent = loading || filteredCaptures.length > 0;

  return (
    <>
      <MicroAppPageLayout
        miniTitle="洞见"
        title="洞见"
        description="多媒体知识捕获。默认只保存原文和图片；勾选后才生成 AI 摘要、标签和实体，关联与洞见需要单独触发。"
        slot={
          <Button
            size="sm"
            disabled={rebuilding}
            onClick={() => void handleRebuild()}
          >
            <RefreshCw className={rebuilding ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {rebuilding ? "重建中..." : "手动重建"}
          </Button>
        }
        contentClassName="h-full min-h-0 space-y-6 pt-6"
        enableSticky
      >
      {stats && (
        <div className="shrink-0 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-border py-4">
          <div className="flex items-baseline gap-2"><span className="text-xl font-semibold text-text-primary">{stats.totalCaptures}</span><span className="text-xs text-text-secondary">捕获总数</span></div>
          <div className="flex items-baseline gap-2"><span className="text-xl font-semibold text-text-primary">{stats.totalInsights}</span><span className="text-xs text-text-secondary">活跃洞见</span></div>
          <div className="flex items-baseline gap-2"><span className="text-xl font-semibold text-text-primary">{stats.totalTags}</span><span className="text-xs text-text-secondary">动态标签</span></div>
          <div className="flex items-baseline gap-2"><span className="text-sm font-medium text-primary">#{stats.topTags[0]?.tagName ?? "暂无"}</span><span className="text-xs text-text-secondary">最热标签</span></div>
        </div>
      )}

      {featuredInsight && (
        <div className="relative shrink-0 rounded-ui-panel bg-text-primary p-6 text-text-inverted">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs text-text-inverted/60">
            <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-warning">
              {insightTypeConfig[featuredInsight.insightType]?.icon ?? <Sparkles className="h-4 w-4" />}
            </span>
            <span>
              今日焦点 · {insightTypeConfig[featuredInsight.insightType]?.label ?? featuredInsight.insightType}
              {" · "}置信度 {(featuredInsight.confidence * 100).toFixed(0)}%
            </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="上一条洞见"
                onClick={() => setFeaturedInsightIndex((index) => (index - 1 + visibleInsights.length) % visibleInsights.length)}
                className="rounded-ui-control p-1 text-text-inverted/60 hover:bg-white/10 hover:text-text-inverted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center text-[11px] text-text-inverted/60">
                {featuredInsightIndex + 1} / {visibleInsights.length}
              </span>
              <button
                type="button"
                aria-label="下一条洞见"
                onClick={() => setFeaturedInsightIndex((index) => (index + 1) % visibleInsights.length)}
                className="rounded-ui-control p-1 text-text-inverted/60 hover:bg-white/10 hover:text-text-inverted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void openInsightDetails(featuredInsight)}
            className="block max-w-2xl text-left"
          >
            <h2 className="text-xl font-semibold leading-snug text-text-inverted">{featuredInsight.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-inverted/65">{featuredInsight.description}</p>
          </button>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {visibleInsights.map((insight, index) => (
                <button
                  key={insight.id}
                  type="button"
                  aria-label={`查看第 ${index + 1} 条洞见`}
                  onClick={() => setFeaturedInsightIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${index === featuredInsightIndex ? "w-6 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/60"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void openInsightDetails(featuredInsight)}
                className="inline-flex items-center gap-1 rounded-ui-control px-2 py-1 text-xs text-text-inverted/70 hover:bg-white/10 hover:text-text-inverted"
              >
                查看详情
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={pinnedInsightIds.has(featuredInsight.id) ? "取消置顶洞见" : "置顶洞见"}
                onClick={() => toggleInsightPin(featuredInsight.id)}
                className={`rounded-ui-control p-1.5 ${pinnedInsightIds.has(featuredInsight.id) ? "text-primary" : "text-text-inverted/60 hover:text-text-inverted"}`}
              >
                <Pin className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="关闭洞见"
                onClick={() => void handleDismissInsight(featuredInsight.id)}
                className="rounded-ui-control p-1.5 text-text-inverted/60 hover:text-text-inverted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 捕获时间线 */}
      <div
        className={
          hasTimelineContent
            ? "min-w-0 space-y-3"
            : "flex min-h-0 min-w-0 flex-1 flex-col gap-3"
        }
      >
        <div className="sticky top-0 z-20 -mx-2 block w-full self-start space-y-3 border-b border-border bg-surface-secondary px-2 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="搜索捕获…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSearch();
                }}
                className="h-10 w-full rounded-ui-control border border-border bg-surface-secondary pl-9 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <Button variant="primary" size="sm" onClick={() => void handleSearch()}>
              搜索
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["webpage"] as const).map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 rounded-full border border-text-primary bg-text-primary px-3 py-1.5 text-xs font-medium text-text-inverted"
              >
                {contentTypeIcons[type]}
                {contentTypeLabels[type]}
                {stats?.byContentType[type] ? ` (${stats.byContentType[type]})` : ""}
              </span>
            ))}
          </div>
        </div>

        <Result
          type={hasTimelineContent ? "content" : "empty"}
          title="暂无捕获内容"
          description="通过 Chrome 插件捕获网页和图片后，内容会出现在这里。"
        >
          {loading && captures.length === 0 ? (
          <div className="min-h-full space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-border py-4">
                <Skeleton.Circle size={36} />
                <div className="flex-1 space-y-2">
                  <Skeleton height={16} width="40%" />
                  <Skeleton.Text lines={2} lastLineWidth="60%" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCaptures.length === 0 ? (
          undefined
        ) : (
          <div>
            {filteredCaptures.map((capture) => (
              <div key={capture.id} className="group flex items-start gap-3 border-b border-border py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {contentTypeIcons[capture.contentType] ?? <FileText className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-sm font-semibold text-text-primary">
                        <a
                          href={capture.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline"
                        >
                          {capture.title || "无标题"}
                        </a>
                      </div>
                      <button
                        type="button"
                        aria-label="删除捕获"
                        onClick={() => handleDeleteCapture(capture)}
                        className="shrink-0 text-text-tertiary opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                      <span>{contentTypeLabels[capture.contentType] ?? capture.contentType}</span>
                      <span>·</span>
                      <span>
                        {new Date(capture.capturedAt).toLocaleDateString("zh-CN")}
                      </span>
                      {capture.userEdited && <span>· 用户编辑</span>}
                    </div>

                    <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-secondary">
                      {capture.rewrittenSummary}
                    </div>

                    {capture.aiTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {capture.aiTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setSearchQuery(tag)}
                            className="inline-flex"
                          >
                            <Badge variant="primary" size="sm">
                              {tag}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void toggleCaptureRelations(capture.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {expandedCaptureId === capture.id ? "收起关联" : "查看关联"}
                    </button>

                    <button
                      type="button"
                      onClick={() => openCaptureDetails(capture)}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      查看详情
                    </button>

                    {expandedCaptureId === capture.id && (
                      <div className="space-y-2 border-l-2 border-primary/20 pl-3">
                        {relationsLoadingId === capture.id ? (
                          <div className="text-xs text-text-tertiary">正在加载关联...</div>
                        ) : captureRelations[capture.id]?.length ? (
                          captureRelations[capture.id].map((relation) => {
                            const relatedId =
                              relation.sourceCaptureId === capture.id
                                ? relation.targetCaptureId
                                : relation.sourceCaptureId;
                            const relatedCapture = captures.find((item) => item.id === relatedId);
                            return (
                              <div key={relation.id} className="text-xs text-text-secondary">
                                <span className="font-medium text-text-primary">
                                  {relatedCapture?.title ?? relatedId}
                                </span>
                                <span className="ml-2">{relation.aiReasoning}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-text-tertiary">暂无关联内容</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}
        </Result>
      </div>
      </MicroAppPageLayout>

      <Drawer
        open={selectedInsight !== null || selectedCapture !== null}
        onClose={closeDetails}
        width={720}
        closeLabel="关闭详情"
        closeMaskLabel="关闭详情"
        header={
          selectedInsight ? (
            <div className="space-y-1">
              <div className="text-xs text-text-tertiary">
                {insightTypeConfig[selectedInsight.insightType]?.label ?? selectedInsight.insightType}
                {" · "}
                置信度 {(selectedInsight.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-base font-semibold text-text-primary">{selectedInsight.title}</div>
            </div>
          ) : selectedCapture ? (
            <div className="space-y-1">
              <div className="text-xs text-text-tertiary">网页 · {new Date(selectedCapture.capturedAt).toLocaleDateString("zh-CN")}</div>
              <div className="truncate text-base font-semibold text-text-primary">{selectedCapture.title || "无标题"}</div>
            </div>
          ) : null
        }
      >
        {selectedInsight ? (
          <div className="space-y-6">
            <section>
              <div className="mb-2 text-sm font-medium text-text-primary">洞见</div>
              <MarkdownText className="text-sm leading-7">
                {selectedInsight.description}
              </MarkdownText>
            </section>

            <section className="border-t border-border pt-5">
              <div className="mb-3 text-sm font-medium text-text-primary">来源内容</div>
              {insightDetailLoading ? (
                <Skeleton.Text lines={5} />
              ) : insightDetailCapture ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{insightDetailCapture.title}</div>
                    <a
                      href={insightDetailCapture.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-xs text-text-tertiary hover:text-primary hover:underline"
                    >
                      {insightDetailCapture.sourceUrl}
                    </a>
                  </div>
                  <MarkdownText className="text-sm leading-7">
                    {resolveCaptureMarkdown(insightDetailCapture.rawContent)}
                  </MarkdownText>
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">暂无来源内容</p>
              )}
            </section>
          </div>
        ) : selectedCapture ? (
          <div className="space-y-4">
            <div>
              <a
                href={selectedCapture.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-xs text-text-tertiary hover:text-primary hover:underline"
              >
                {selectedCapture.sourceUrl}
              </a>
            </div>
            <MarkdownText className="text-sm leading-7">
              {resolveCaptureMarkdown(selectedCapture.rawContent)}
            </MarkdownText>
          </div>
        ) : null}
      </Drawer>

    </>
  );
}
