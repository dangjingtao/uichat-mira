import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronDown,
  DatabaseZap,
  Ellipsis,
  ExternalLink,
  FilePlus2,
  Filter,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { FileIcon } from "@/shared/ui/FileIcon";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";
import IconButton from "@/shared/ui/IconButton";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import Switch from "@/shared/ui/Switch";
import Tooltip from "@/shared/ui/Tooltip";
import {
  deleteKnowledgeBaseDocument,
  getKnowledgeBase,
  listKnowledgeBaseDocuments,
  updateKnowledgeBaseDocument,
  type KnowledgeBaseDocument,
  type KnowledgeBaseSummary,
} from "@/shared/api/knowledgeBase";
import {
  DEFAULT_SEGMENT_MODE,
  type FilterKey,
  type SortKey,
  filterOptions,
  formatCompactNumber,
  getTypeBadge,
  sortOptions,
} from "./mockData";

const inputClassName =
  "h-9 w-full rounded-xl border border-border bg-surface-primary pl-9 pr-3 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type DocumentRow = {
  id: string;
  name: string;
  type: string;
  segmentMode: typeof DEFAULT_SEGMENT_MODE;
  charCount: number;
  hits: number;
  uploadedAt: string;
  availability: "enabled" | "disabled";
  syncState: "ready" | "indexing";
  chunkCount: number;
  source: string;
  updatedAt: string;
  indexStatus: KnowledgeBaseDocument["indexStatus"];
  raw: KnowledgeBaseDocument;
};

function toDocumentRow(document: KnowledgeBaseDocument): DocumentRow {
  return {
    id: document.id,
    name: document.name,
    type: document.fileExt,
    segmentMode: DEFAULT_SEGMENT_MODE,
    charCount: document.charCount,
    hits: 0,
    uploadedAt: document.createdAt.replace("T", " ").slice(0, 16),
    availability: document.enabled ? "enabled" : "disabled",
    syncState: document.indexStatus === "processing" ? "indexing" : "ready",
    chunkCount: document.chunkCount,
    source: document.sourceLabel || document.sourceType,
    updatedAt: document.updatedAt.replace("T", " ").slice(0, 16),
    indexStatus: document.indexStatus,
    raw: document,
  };
}

function SegmentBadge({ mode }: { mode: typeof DEFAULT_SEGMENT_MODE }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
      {mode}
    </span>
  );
}

export default function KnowledgeBaseSettings() {
  const navigate = useNavigate();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("uploadedAt");
  const [sortDescending, setSortDescending] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadKnowledgeBase = useCallback(async () => {
    const data = await getKnowledgeBase();
    setKnowledgeBase(data);
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const sortBy =
        sortKey === "uploadedAt"
          ? "createdAt"
          : sortKey === "charCount"
            ? "charCount"
            : undefined;
      const data = await listKnowledgeBaseDocuments({
        search: searchText.trim() || undefined,
        enabled:
          filter === "enabled" ? true : filter === "disabled" ? false : undefined,
        sortBy,
        sortOrder: sortDescending ? "desc" : "asc",
      });
      setDocuments(data.map(toDocumentRow));
    } finally {
      setLoading(false);
    }
  }, [filter, searchText, sortDescending, sortKey]);

  useEffect(() => {
    void loadKnowledgeBase();
  }, [loadKnowledgeBase]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    if (sortKey !== "hits") {
      return documents;
    }

    return [...documents].sort((left, right) =>
      (left.hits - right.hits) * (sortDescending ? -1 : 1),
    );
  }, [documents, sortDescending, sortKey]);

  const visibleIds = filteredDocuments.map((document) => document.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedDocuments = filteredDocuments.filter((document) =>
    selectedIds.includes(document.id),
  );
  const enabledCount = filteredDocuments.filter(
    (document) => document.availability === "enabled",
  ).length;
  const totalChunks = filteredDocuments.reduce(
    (sum, document) => sum + document.chunkCount,
    0,
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([loadKnowledgeBase(), loadDocuments()]);
  }, [loadDocuments, loadKnowledgeBase]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };

  const goToDetail = (document: DocumentRow) => {
    navigate(`/settings/knowledge-base/detail?id=${encodeURIComponent(document.id)}`);
  };

  const openMetadataModal = () => {
    Modal.show({
      title: "元数据概览",
      width: 720,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card
              label="文档总数"
              value={`${knowledgeBase?.documentCount ?? documents.length}`}
              description="当前知识库中的文档数"
            />
            <Card
              label="可用文档"
              value={`${knowledgeBase?.enabledDocumentCount ?? enabledCount}`}
              description="正在参与检索"
            />
            <Card
              label="总文本分块"
              value={`${totalChunks}`}
              description="基于当前文档切分结果"
            />
          </div>
          <div className="rounded-xl border border-border bg-surface-secondary p-4 text-sm leading-6 text-text-secondary">
            当前已经接入真实知识库接口。后续可以继续补充向量索引状态、检索质量指标和引用统计。
          </div>
        </div>
      ),
    });
  };

  const openAddDocumentModal = () => {
    navigate("/settings/knowledge-base/add?step=1");
  };

  const openDocumentSettings = (document: DocumentRow) => {
    const modalKey = Modal.show({
      title: `文档设置 · ${document.name}`,
      width: 680,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card label="分段模式" value={document.segmentMode} description={`${document.chunkCount} 个分段`} />
            <Card label="同步来源" value={document.source} description={`状态：${document.indexStatus}`} />
            <Card label="字符数" value={formatCompactNumber(document.charCount)} description="当前已入库字符数" />
            <Card label="文件类型" value={document.type.toUpperCase()} description={`创建于 ${document.uploadedAt}`} />
          </div>
          <div className="rounded-xl border border-border bg-surface-secondary p-4 text-sm leading-6 text-text-secondary">
            当前 MVP 已支持文档启停、重命名和删除。更细的分段策略与索引配置后续可以继续接入。
          </div>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={() => Modal.close(modalKey)}>
            关闭
          </Button>
          <Button
            onClick={async () => {
              try {
                await updateKnowledgeBaseDocument(document.id, {
                  name: document.name,
                });
                Modal.close(modalKey);
                message.success(`已保存 ${document.name} 的配置`);
              } catch (error) {
                message.error(
                  error instanceof Error ? error.message : "保存文档配置失败",
                );
              }
            }}
          >
            保存设置
          </Button>
        </>
      ),
    });
  };

  const openMoreActions = (document: DocumentRow) => {
    const modalKey = Modal.show({
      title: `更多操作 · ${document.name}`,
      width: 560,
      content: (
        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-primary px-4 py-3 text-left transition-all duration-150 hover:bg-surface-secondary"
            onClick={() => {
              Modal.close(modalKey);
              message.info(`重建索引接口将在下一步接入，当前文档为 ${document.name}`);
            }}
          >
            <div>
              <div className="text-sm font-medium text-text-primary">重建索引</div>
              <div className="text-sm text-text-secondary">后续用于重新分段与重新向量化</div>
            </div>
            <ArrowDownUp className="h-4 w-4 text-icon-secondary" />
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-primary px-4 py-3 text-left transition-all duration-150 hover:bg-surface-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}${window.location.pathname}#/settings/knowledge-base/detail?id=${document.id}`,
                );
                Modal.close(modalKey);
                message.success(`已复制 ${document.name} 的详情链接`);
              } catch {
                message.error("复制链接失败");
              }
            }}
          >
            <div>
              <div className="text-sm font-medium text-text-primary">复制外链</div>
              <div className="text-sm text-text-secondary">复制当前文档的详情页地址</div>
            </div>
            <ExternalLink className="h-4 w-4 text-icon-secondary" />
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-left transition-all duration-150 hover:bg-danger/10"
            onClick={async () => {
              try {
                await deleteKnowledgeBaseDocument(document.id);
                Modal.close(modalKey);
                message.success(`已删除 ${document.name}`);
                setSelectedIds((current) => current.filter((item) => item !== document.id));
                await refreshAll();
              } catch (error) {
                message.error(
                  error instanceof Error ? error.message : "删除文档失败",
                );
              }
            }}
          >
            <div>
              <div className="text-sm font-medium text-danger">删除文档</div>
              <div className="text-sm text-text-secondary">会同时删除该文档的分块数据</div>
            </div>
            <Trash2 className="h-4 w-4 text-danger" />
          </button>
        </div>
      ),
      footer: null,
    });
  };

  if (loading && documents.length === 0) {
    return <FullPageStatus message="正在加载知识库文档..." />;
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5">
      <section className="space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
          Knowledge Base
        </div>
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-text-primary">
              {knowledgeBase?.name ?? "知识库"}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-text-secondary">
              {knowledgeBase?.description ||
                "知识库中的所有文件会展示在这里。双击任意数据行可进入详情页，点击添加文件会进入分步上传表单。"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" onClick={openMetadataModal}>
              <DatabaseZap className="h-4 w-4" />
              元数据
            </Button>
            <Button onClick={openAddDocumentModal}>
              <FilePlus2 className="h-4 w-4" />
              添加文件
            </Button>
          </div>
        </div>
      </section>

      <Card className="space-y-3 p-3.5 md:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="inline-flex rounded-xl border border-border bg-surface-secondary p-1">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                    filter === option.key
                      ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-icon-secondary" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索文档名称、来源或维护人"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSortDescending((current) => !current)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-primary px-3 text-sm text-text-secondary shadow-shadow-sm transition-all duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
            >
              <Filter className="h-4 w-4" />
              排序：
              <span className="font-medium text-text-primary">
                {sortOptions.find((option) => option.key === sortKey)?.label}
              </span>
              <ArrowDownUp className="h-4 w-4" />
            </button>

            <div className="relative">
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="h-9 min-w-[124px] appearance-none rounded-xl border border-border bg-surface-primary pl-3 pr-9 text-sm text-text-primary shadow-shadow-sm transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {sortOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-icon-secondary" />
            </div>
          </div>
        </div>

        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border bg-surface-secondary px-4 py-2.5">
            <div className="text-sm text-text-secondary">
              已选择
              <span className="mx-1 font-semibold text-text-primary">{selectedIds.length}</span>
              个文档
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedIds([]);
                  message.info("已清空选择");
                }}
              >
                取消选择
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  Modal.show({
                    title: "批量操作",
                    content: (
                      <div className="space-y-3 text-sm text-text-secondary">
                        <p>当前已接入真实列表接口，已选文档如下：</p>
                        <div className="rounded-xl border border-border bg-surface-secondary p-3 text-text-primary">
                          {selectedDocuments.map((document) => document.name).join("、")}
                        </div>
                      </div>
                    ),
                  });
                }}
              >
                批量操作
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-border bg-surface-primary shadow-shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="w-12 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  <input
                    type="checkbox"
                    aria-label="全选当前列表"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  />
                </th>
                <th className="w-12 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  #
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  名称
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  分段模式
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  字符数
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  召回次数
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  上传时间
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  状态
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((document, index) => {
                const badge = getTypeBadge(document.type);
                const status =
                  document.syncState === "indexing"
                    ? { indicator: "unknown" as const, label: "同步中" }
                    : document.availability === "enabled"
                      ? { indicator: "running" as const, label: "可用" }
                      : { indicator: "stopped" as const, label: "停用" };

                return (
                  <tr
                    key={document.id}
                    onDoubleClick={() => goToDetail(document)}
                    className={`cursor-pointer transition-colors duration-150 hover:bg-surface-secondary/80 ${
                      index > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${document.name}`}
                        checked={selectedIds.includes(document.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelection(document.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-text-secondary">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-primary">
                      <div className="flex min-w-[260px] items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary">
                          <FileIcon extension={document.type} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="truncate font-medium text-text-primary">
                            {document.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-xs text-text-tertiary">{document.source}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-text-primary">
                      <SegmentBadge mode={document.segmentMode} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-text-primary">
                      {formatCompactNumber(document.charCount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-text-primary">
                      {document.hits}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-text-primary">
                      {document.uploadedAt}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-text-primary">
                      <div className="inline-flex items-center gap-2">
                        <StatusIndicator status={status.indicator} size="sm" />
                        <span
                          className={`text-sm font-medium ${
                            status.indicator === "running"
                              ? "text-success"
                              : status.indicator === "unknown"
                                ? "text-warning"
                                : "text-text-secondary"
                          }`}
                        >
                          {status.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-primary">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                      >
                        <Tooltip
                          text={document.availability === "enabled" ? "停用文档" : "启用文档"}
                          placement="top"
                        >
                          <div>
                            <Switch
                              checked={document.availability === "enabled"}
                              disabled={document.syncState === "indexing"}
                              ariaLabel={document.availability === "enabled" ? "停用文档" : "启用文档"}
                              onChange={async () => {
                                try {
                                  await updateKnowledgeBaseDocument(document.id, {
                                    enabled: document.availability !== "enabled",
                                  });
                                  message.success(
                                    document.availability === "enabled"
                                      ? `已停用 ${document.name}`
                                      : `已启用 ${document.name}`,
                                  );
                                  await refreshAll();
                                } catch (error) {
                                  message.error(
                                    error instanceof Error ? error.message : "更新文档状态失败",
                                  );
                                }
                              }}
                            />
                          </div>
                        </Tooltip>

                        <Tooltip text="文档设置" placement="top">
                          <IconButton
                            onClick={() => openDocumentSettings(document)}
                            ariaLabel={`打开 ${document.name} 的文档设置`}
                          >
                            <Settings2 className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip text="更多操作" placement="top">
                          <IconButton
                            onClick={() => openMoreActions(document)}
                            ariaLabel={`打开 ${document.name} 的更多操作`}
                          >
                            <Ellipsis className="h-4 w-4" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-surface-secondary/60 px-4 py-2.5 text-sm text-text-secondary">
          提示：双击任意数据行可进入文档详情页，点击“添加文件”会进入分步上传表单。
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <div>
            共{" "}
            <span className="font-medium text-text-primary">
              {knowledgeBase?.documentCount ?? documents.length}
            </span>{" "}
            个文档，当前显示{" "}
            <span className="font-medium text-text-primary">{filteredDocuments.length}</span> 个
          </div>
          <div>
            可用文档 <span className="font-medium text-text-primary">{enabledCount}</span> 个 ·
            总分块 <span className="font-medium text-text-primary">{totalChunks}</span> 个
          </div>
        </div>
      </Card>
    </div>
  );
}
