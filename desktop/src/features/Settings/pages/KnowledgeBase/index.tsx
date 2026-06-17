import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowDownUp,
  DatabaseZap,
  Ellipsis,
  FilePlus2,
  Filter,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";
import IconButton from "@/shared/ui/IconButton";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { Select } from "@/shared/ui/Select";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import {
  deleteKnowledgeBaseDocument,
  getKnowledgeBase,
  listKnowledgeBaseDocuments,
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
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import SettingsPageLayout from "../../components/SettingsPageLayout";

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("uploadedAt");
  const [sortDescending, setSortDescending] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { modelAccessStatus, refresh: refreshRoleModelConfigs } =
    useRoleModelConfigs();

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest("[data-kb-action-menu]")) {
        return;
      }

      setOpenActionMenuId(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

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
        search: debouncedSearchText.trim() || undefined,
        enabled: filter === "enabled" ? true : filter === "disabled" ? false : undefined,
        sortBy,
        sortOrder: sortDescending ? "desc" : "asc",
      });
      setDocuments(data.map(toDocumentRow));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchText, filter, sortDescending, sortKey]);

  useEffect(() => {
    void loadKnowledgeBase();
  }, [loadKnowledgeBase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchText]);

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
  const enabledCount = filteredDocuments.filter(
    (document) => document.availability === "enabled",
  ).length;
  const totalChunks = filteredDocuments.reduce(
    (sum, document) => sum + document.chunkCount,
    0,
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadKnowledgeBase(),
      loadDocuments(),
      refreshRoleModelConfigs(),
    ]);
  }, [loadDocuments, loadKnowledgeBase, refreshRoleModelConfigs]);

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
      title: t("settings.knowledgeBase.metadataModal.title"),
      width: 720,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card
              label={t("settings.knowledgeBase.metadataModal.totalDocuments")}
              value={`${knowledgeBase?.documentCount ?? documents.length}`}
              description={t("settings.knowledgeBase.metadataModal.totalDocumentsDescription")}
            />
            <Card
              label={t("settings.knowledgeBase.metadataModal.enabledDocuments")}
              value={`${knowledgeBase?.enabledDocumentCount ?? enabledCount}`}
              description={t("settings.knowledgeBase.metadataModal.enabledDocumentsDescription")}
            />
            <Card
              label={t("settings.knowledgeBase.metadataModal.totalChunks")}
              value={`${totalChunks}`}
              description={t("settings.knowledgeBase.metadataModal.totalChunksDescription")}
            />
          </div>
          <div className="rounded-xl border border-border bg-surface-secondary p-4 text-sm leading-6 text-text-secondary">
            {t("settings.knowledgeBase.metadataModal.summary")}
          </div>
        </div>
      ),
    });
  };

  const confirmRebuildIndex = (document: DocumentRow) => {
    const modalKey = Modal.show({
      title: t("settings.knowledgeBase.rebuildModal.title"),
      width: 460,
      content: (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            {t("settings.knowledgeBase.rebuildModal.description", {
              name: document.name,
            })}
          </p>
          <div className="rounded-xl border border-border bg-surface-secondary px-3.5 py-3">
            {t("settings.knowledgeBase.rebuildModal.warning")}
          </div>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={() => Modal.close(modalKey)}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={() => {
              Modal.close(modalKey);
              message.info(
                t("settings.knowledgeBase.messages.rebuildPending", {
                  name: document.name,
                }),
              );
            }}
          >
            {t("settings.knowledgeBase.actions.confirmRebuild")}
          </Button>
        </>
      ),
    });
  };

  const confirmDeleteDocument = (document: DocumentRow) => {
    const modalKey = Modal.show({
      title: t("settings.knowledgeBase.actions.deleteDocument"),
      width: 460,
      content: (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            {t("settings.knowledgeBase.deleteModal.description", {
              name: document.name,
            })}
          </p>
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-danger">
            {t("settings.knowledgeBase.deleteModal.warning")}
          </div>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={() => Modal.close(modalKey)}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await deleteKnowledgeBaseDocument(document.id);
                Modal.close(modalKey);
                message.success(
                  t("settings.knowledgeBase.messages.deleted", {
                    name: document.name,
                  }),
                );
                setSelectedIds((current) => current.filter((item) => item !== document.id));
                await refreshAll();
              } catch (error) {
                message.error(
                  error instanceof Error
                    ? error.message
                    : t("settings.knowledgeBase.messages.deleteFailed"),
                );
              }
            }}
          >
            {t("settings.knowledgeBase.actions.confirmDelete")}
          </Button>
        </>
      ),
    });
  };

  const openAddDocumentModal = () => {
    if (!modelAccessStatus?.embeddingConnected) {
      message.warning(t("settings.knowledgeBase.messages.uploadRequiresEmbedding"));
      return;
    }
    navigate("/settings/knowledge-base/add?step=1");
  };

  if (loading && documents.length === 0) {
    return <FullPageStatus message={t("settings.knowledgeBase.messages.loadingDocuments")} />;
  }

  const canUploadDocument = modelAccessStatus?.embeddingConnected ?? false;
  const headerDescription =
    knowledgeBase?.description ||
    t("settings.knowledgeBase.page.descriptionFallback");

  return (
    <SettingsPageLayout
      miniTitle={t("settings.knowledgeBase.page.miniTitle")}
      title={t("settings.knowledgeBase.page.title")}
      description={headerDescription}
      slot={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={openMetadataModal}
            className="gap-2 self-start"
          >
            <DatabaseZap className="h-4 w-4" />
            {t("settings.knowledgeBase.actions.metadata")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canUploadDocument}
            onClick={openAddDocumentModal}
            className="gap-2 self-start"
          >
            <FilePlus2 className="h-4 w-4" />
            {t("settings.knowledgeBase.actions.addFile")}
          </Button>
        </div>
      }
      bodyClassName="overflow-hidden"
      contentClassName="space-y-4 pt-6"
    >
      {modelAccessStatus && !modelAccessStatus.embeddingConnected ? (
        <div className="shrink-0 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-2">
              <div className="font-medium">
                {t("settings.knowledgeBase.banner")}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-3.5 md:p-4">
        <div className="shrink-0 space-y-3">
          <div className="stable-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="inline-flex shrink-0 rounded-xl border border-border bg-surface-secondary p-1">
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilter(option.key)}
                    className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 ${
                      filter === option.key
                        ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-icon-secondary" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={t("settings.knowledgeBase.filters.searchPlaceholder")}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSortDescending((current) => !current)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-surface-primary px-2.5 text-sm text-text-secondary shadow-shadow-sm transition-all duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary"
              >
                <Filter className="h-4 w-4" />
                {t("settings.knowledgeBase.filters.sortPrefix")}
                <span className="font-medium text-text-primary">
                  {sortOptions.find((option) => option.key === sortKey)?.label}
                </span>
                <ArrowDownUp className="h-4 w-4" />
              </button>

              <div className="min-w-[116px]">
                <Select
                  value={sortKey}
                  onChange={(value) => setSortKey(value as SortKey)}
                  options={sortOptions.map((option) => ({
                    value: option.key,
                    label: option.label,
                  }))}
                  compact
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface-primary shadow-shadow-sm">
          <div className="stable-scrollbar h-full overflow-auto">
            <table className="w-full table-fixed">
              <thead className="sticky top-0 z-10 bg-surface-secondary">
                <tr className="border-b border-border">
                  <th className="w-12 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    <input
                      type="checkbox"
                      aria-label={t("settings.knowledgeBase.filters.selectAllAria")}
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                  </th>
                  <th className="w-12 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    #
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    {t("settings.knowledgeBase.table.name")}
                  </th>
                  <th className="w-24 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    {t("settings.knowledgeBase.table.segmentMode")}
                  </th>
                  <th className="w-20 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    {t("settings.knowledgeBase.table.charCount")}
                  </th>
                  <th className="w-24 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    {t("settings.knowledgeBase.table.hits")}
                  </th>
                  <th className="w-40 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    {t("settings.knowledgeBase.table.uploadedAt")}
                  </th>
                  <th className="w-24 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    {t("settings.knowledgeBase.table.status")}
                  </th>
                  <th className="w-14 pl-2 pr-3 py-2.5 text-right text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    {t("settings.knowledgeBase.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-text-secondary">
                      {t("settings.knowledgeBase.table.empty")}
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((document, index) => {
                    const badge = getTypeBadge(document.type);
                    const status =
                      document.syncState === "indexing"
                        ? {
                            indicator: "unknown" as const,
                            label: t("settings.knowledgeBase.status.processing"),
                          }
                        : document.availability === "enabled"
                          ? {
                              indicator: "running" as const,
                              label: t("settings.knowledgeBase.status.enabled"),
                            }
                          : {
                              indicator: "stopped" as const,
                              label: t("settings.knowledgeBase.status.disabled"),
                            };

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
                            aria-label={t("settings.knowledgeBase.filters.rowSelectAria", {
                              name: document.name,
                            })}
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
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            <div className="truncate font-medium text-text-primary">
                              {document.name}
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
                        <td className="pl-2 pr-3 py-2.5 text-sm text-text-primary">
                          <div
                            className="relative flex items-center justify-end"
                            onClick={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                            data-kb-action-menu
                          >
                            <div className="relative" data-kb-action-menu>
                              <IconButton
                                className="h-8 w-8 rounded-md"
                                onClick={() =>
                                  setOpenActionMenuId((current) =>
                                    current === document.id ? null : document.id,
                                  )
                                }
                                ariaLabel={t(
                                  "settings.knowledgeBase.filters.moreActionsAria",
                                  { name: document.name },
                                )}
                              >
                                <Ellipsis className="h-4 w-4" />
                              </IconButton>

                              <div
                                className={`absolute right-0 top-full z-20 mt-1.5 min-w-[144px] rounded-xl border border-border bg-surface-primary p-1.5 shadow-shadow-md transition-all duration-150 ${
                                  openActionMenuId === document.id
                                    ? "visible opacity-100"
                                    : "invisible opacity-0 pointer-events-none"
                                }`}
                                data-kb-action-menu
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-secondary"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    confirmRebuildIndex(document);
                                  }}
                                >
                                  <RotateCcw className="h-4 w-4 text-icon-secondary" />
                                  {t("settings.knowledgeBase.actions.rebuildIndex")}
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/5"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    confirmDeleteDocument(document);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {t("common.actions.delete")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 shrink-0 rounded-xl border border-dashed border-border bg-surface-secondary/60 px-4 py-2.5 text-sm text-text-secondary">
          {t("settings.knowledgeBase.table.tip")}
        </div>

        <div className="mt-3 shrink-0 flex flex-col gap-1.5 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <div>
            {t("settings.knowledgeBase.table.summary", {
              total: knowledgeBase?.documentCount ?? documents.length,
              visible: filteredDocuments.length,
            })}
          </div>
          <div>
            {t("settings.knowledgeBase.table.stats", {
              enabled: enabledCount,
              chunks: totalChunks,
            })}
          </div>
        </div>
      </Card>
    </SettingsPageLayout>
  );
}
