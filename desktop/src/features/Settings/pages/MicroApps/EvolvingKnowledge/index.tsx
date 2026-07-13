import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BrainCircuit,
  FileText,
  Image,
  Search,
  Sparkles,
  X,
  Zap,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Lightbulb,
  Trash2,
  Link2,
  Pin,
} from "lucide-react";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Button, Result, Skeleton } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  listCaptures,
  listInsights,
  dismissInsight,
  getStats,
  deleteCapture,
  searchCaptures,
  getCaptureRelations,
  type KnowledgeCapture,
  type KnowledgeInsight,
  type KnowledgeRelation,
} from "@/shared/api/evolvingKnowledge";

const contentTypeIcons: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
};

const contentTypeLabels: Record<string, string> = {
  text: "文本",
  image: "图片",
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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [captures, setCaptures] = useState<KnowledgeCapture[]>([]);
  const [insights, setInsights] = useState<KnowledgeInsight[]>([]);
  const [stats, setStats] = useState<{
    totalCaptures: number;
    totalInsights: number;
    totalTags: number;
    byContentType: Record<string, number>;
    topTags: Array<{ tagName: string; usageCount: number }>;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [featuredInsightIndex, setFeaturedInsightIndex] = useState(0);
  const [pinnedInsightIds, setPinnedInsightIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedCaptureId, setExpandedCaptureId] = useState<string | null>(null);
  const [captureRelations, setCaptureRelations] = useState<
    Record<string, KnowledgeRelation[]>
  >({});
  const [relationsLoadingId, setRelationsLoadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [capturesRes, insightsRes, statsRes] = await Promise.all([
        listCaptures({ limit: 50 }),
        listInsights(),
        getStats(),
      ]);
      setCaptures(capturesRes ?? []);
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

  const filteredCaptures = useMemo(() => {
    let result = captures;
    if (activeFilter) {
      result = result.filter((c) => c.contentType === activeFilter);
    }
    return result;
  }, [captures, activeFilter]);

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

  const handleDeleteCapture = async (id: string) => {
    try {
      await deleteCapture(id);
      setCaptures((prev) => prev.filter((c) => c.id !== id));
      message.success("已删除");
    } catch {
      message.error("删除失败");
    }
  };

  const featuredInsight = visibleInsights.length
    ? visibleInsights[Math.min(featuredInsightIndex, visibleInsights.length - 1)]
    : null;
  const hasTimelineContent = loading || filteredCaptures.length > 0;

  return (
    <MicroAppPageLayout
      miniTitle="智识进化库"
      title="智识进化库"
      description="多媒体知识捕获与 AI 自我整理。捕获内容后，AI 自动重写、标签、发现概念关联与跨时间洞见。"
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
          <h2 className="max-w-2xl text-xl font-semibold leading-snug text-text-inverted">{featuredInsight.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-inverted/65">{featuredInsight.description}</p>
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
            {(["text", "image"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveFilter((prev) => (prev === type ? null : type))}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeFilter === type
                    ? "border border-text-primary bg-text-primary text-text-inverted"
                    : "border border-border bg-transparent text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                {contentTypeIcons[type]}
                {contentTypeLabels[type]}
                {stats?.byContentType[type] ? ` (${stats.byContentType[type]})` : ""}
              </button>
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
                        onClick={() => void handleDeleteCapture(capture.id)}
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
  );
}
