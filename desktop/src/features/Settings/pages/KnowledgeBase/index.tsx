import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Ellipsis,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { FileIcon } from "@/shared/ui/FileIcon";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";
import IconButton from "@/shared/ui/IconButton";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import Switch from "@/shared/ui/Switch";
import Table from "@/shared/ui/Table";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKnowledgeBaseDocument,
  getKnowledgeBaseById,
  listKnowledgeBases,
  listKnowledgeBaseDocuments,
  updateKnowledgeBaseDocument,
  updateKnowledgeBase,
  type KnowledgeBaseDocument,
  type KnowledgeBaseSummary,
} from "@/shared/api/knowledgeBase";
import { type FilterKey, filterOptions } from "./mockData";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import KnowledgeBaseEditorForm from "./KnowledgeBaseEditorForm";
import KnowledgeBaseMetadataContent from "./KnowledgeBaseMetadataContent";
import KnowledgeBaseSidebar from "./KnowledgeBaseSidebar";
import KnowledgeBaseToolbar from "./KnowledgeBaseToolbar";

type DocumentRow = {
  id: string;
  name: string;
  type: string;
  source: string;
  enabled: boolean;
  updatedAt: string;
  availability: "enabled" | "disabled";
  syncState: "ready" | "indexing";
  indexStatus: KnowledgeBaseDocument["indexStatus"];
};

type DocumentSortKey = "name" | "source" | "updatedAt" | "status";
type DocumentSortOrder = "asc" | "desc";

function toDocumentRow(document: KnowledgeBaseDocument): DocumentRow {
  return {
    id: document.id,
    name: document.name,
    type: document.fileExt,
    source: document.sourceLabel || document.sourceType,
    enabled: document.enabled,
    updatedAt: document.updatedAt.replace("T", " ").slice(5, 10),
    availability: document.enabled ? "enabled" : "disabled",
    syncState: document.indexStatus === "processing" ? "indexing" : "ready",
    indexStatus: document.indexStatus,
  };
}

function getIndexStatusLabel(
  t: ReturnType<typeof useTranslation>["t"],
  document: DocumentRow,
) {
  if (document.syncState === "indexing") {
    return {
      indicator: "unknown" as const,
      label: t("settings.knowledgeBase.status.processing"),
      className: "text-warning",
    };
  }

  if (document.availability === "enabled") {
    return {
      indicator: "running" as const,
      label: t("settings.knowledgeBase.status.enabled"),
      className: "text-success",
    };
  }

  return {
    indicator: "stopped" as const,
    label: t("settings.knowledgeBase.status.disabled"),
    className: "text-text-secondary",
  };
}

export default function KnowledgeBaseSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedKnowledgeBaseIdFromQuery =
    searchParams.get("knowledgeBaseId") || null;
  const [knowledgeBase, setKnowledgeBase] =
    useState<KnowledgeBaseSummary | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>(
    [],
  );
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<
    string | null
  >(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [knowledgeBaseSearchText, setKnowledgeBaseSearchText] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<DocumentSortKey>("updatedAt");
  const [sortOrder, setSortOrder] = useState<DocumentSortOrder>("desc");
  const [togglingDocumentIds, setTogglingDocumentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
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

  const loadKnowledgeBases = useCallback(async () => {
    const data = await listKnowledgeBases();
    setKnowledgeBases(data);
    setSelectedKnowledgeBaseId(
      (current) =>
        current ?? selectedKnowledgeBaseIdFromQuery ?? data[0]?.id ?? null,
    );
  }, [selectedKnowledgeBaseIdFromQuery]);

  const loadKnowledgeBase = useCallback(async (knowledgeBaseId: string) => {
    const data = await getKnowledgeBaseById(knowledgeBaseId);
    setKnowledgeBase(data);
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!selectedKnowledgeBaseId) {
      setDocuments([]);
      setSelectedDocumentIds([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const apiSortBy =
        sortBy === "updatedAt"
          ? "updatedAt"
          : sortBy === "name"
            ? "createdAt"
            : undefined;
      const data = await listKnowledgeBaseDocuments(selectedKnowledgeBaseId, {
        search: debouncedSearchText.trim() || undefined,
        enabled:
          filter === "enabled"
            ? true
            : filter === "disabled"
              ? false
              : undefined,
        sortBy: apiSortBy,
        sortOrder,
      });
      const rows = data.map(toDocumentRow);

      if (sortBy === "name") {
        rows.sort((left, right) =>
          sortOrder === "asc"
            ? left.name.localeCompare(right.name, "zh-CN")
            : right.name.localeCompare(left.name, "zh-CN"),
        );
      } else if (sortBy === "source") {
        rows.sort((left, right) =>
          sortOrder === "asc"
            ? left.source.localeCompare(right.source, "zh-CN")
            : right.source.localeCompare(left.source, "zh-CN"),
        );
      } else if (sortBy === "status") {
        rows.sort((left, right) =>
          sortOrder === "asc"
            ? left.indexStatus.localeCompare(right.indexStatus, "zh-CN")
            : right.indexStatus.localeCompare(left.indexStatus, "zh-CN"),
        );
      }

      setDocuments(rows);
      setSelectedDocumentIds((current) =>
        current.filter((id) => rows.some((row) => row.id === id)),
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchText, filter, selectedKnowledgeBaseId, sortBy, sortOrder]);

  useEffect(() => {
    void loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId) {
      setKnowledgeBase(null);
      return;
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("knowledgeBaseId", selectedKnowledgeBaseId);
        return next;
      },
      { replace: true },
    );

    void loadKnowledgeBase(selectedKnowledgeBaseId);
  }, [loadKnowledgeBase, selectedKnowledgeBaseId, setSearchParams]);

  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedKnowledgeBaseId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchText]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadKnowledgeBases(),
      loadDocuments(),
      refreshRoleModelConfigs(),
    ]);
  }, [loadDocuments, loadKnowledgeBases, refreshRoleModelConfigs]);

  const visibleDocuments = useMemo(() => documents, [documents]);
  const allVisibleSelected =
    visibleDocuments.length > 0 &&
    visibleDocuments.every((item) => selectedDocumentIds.includes(item.id));
  const selectedDocumentCount = selectedDocumentIds.length;
  const filteredKnowledgeBases = useMemo(() => {
    const keyword = knowledgeBaseSearchText.trim().toLowerCase();
    if (!keyword) {
      return knowledgeBases;
    }

    return knowledgeBases.filter((item) =>
      item.name.toLowerCase().includes(keyword),
    );
  }, [knowledgeBaseSearchText, knowledgeBases]);

  const resetDocumentViewState = useCallback(() => {
    setFilter("all");
    setSearchText("");
    setDebouncedSearchText("");
    setSelectedDocumentIds([]);
    setOpenActionMenuId(null);
    setSortBy("updatedAt");
    setSortOrder("desc");
  }, []);

  const handleSelectKnowledgeBase = useCallback(
    (knowledgeBaseId: string) => {
      if (knowledgeBaseId === selectedKnowledgeBaseId) {
        return;
      }

      resetDocumentViewState();
      setSelectedKnowledgeBaseId(knowledgeBaseId);
    },
    [resetDocumentViewState, selectedKnowledgeBaseId],
  );

  const toggleSort = useCallback((nextSortBy: DocumentSortKey) => {
    setSortBy((currentSortBy) => {
      if (currentSortBy === nextSortBy) {
        setSortOrder((currentOrder) =>
          currentOrder === "asc" ? "desc" : "asc",
        );
        return currentSortBy;
      }

      setSortOrder(nextSortBy === "updatedAt" ? "desc" : "asc");
      return nextSortBy;
    });
  }, []);

  const renderSortIcon = useCallback(
    (column: DocumentSortKey) => {
      if (sortBy !== column) {
        return <ArrowDownUp className="h-3 w-3 text-icon-tertiary" />;
      }

      return sortOrder === "asc" ? (
        <ArrowUp className="h-3 w-3 text-primary" />
      ) : (
        <ArrowDown className="h-3 w-3 text-primary" />
      );
    },
    [sortBy, sortOrder],
  );

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: "select",
        size: 40,
        header: () => (
          <input
            type="checkbox"
            checked={allVisibleSelected}
            aria-label="Select all documents"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
            onChange={(event) => {
              setSelectedDocumentIds(
                event.target.checked
                  ? visibleDocuments.map((item) => item.id)
                  : [],
              );
            }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={row.original.name}
            checked={selectedDocumentIds.includes(row.original.id)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              setSelectedDocumentIds((current) =>
                event.target.checked
                  ? [...current, row.original.id]
                  : current.filter((id) => id !== row.original.id),
              );
            }}
          />
        ),
      },
      {
        accessorKey: "name",
        header: () => (
          <button
            type="button"
            className={`inline-flex items-center gap-1 text-[11px] font-medium tracking-[0.02em] ${
              sortBy === "name" ? "text-text-primary" : "text-text-tertiary"
            }`}
            onClick={() => toggleSort("name")}
          >
            {t("settings.knowledgeBase.table.name")}
            {renderSortIcon("name")}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <FileIcon
              extension={row.original.type}
              className="h-4 w-4 shrink-0"
            />
            <div className="min-w-0 truncate font-medium text-text-primary">
              {row.original.name}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: () => (
          <button
            type="button"
            className={`inline-flex items-center gap-1 text-[11px] font-medium tracking-[0.02em] ${
              sortBy === "updatedAt"
                ? "text-text-primary"
                : "text-text-tertiary"
            }`}
            onClick={() => toggleSort("updatedAt")}
          >
            更新时间
            {renderSortIcon("updatedAt")}
          </button>
        ),
        size: 96,
      },
      {
        id: "status",
        header: () => (
          <button
            type="button"
            className={`inline-flex items-center gap-1 text-[11px] font-medium tracking-[0.02em] ${
              sortBy === "status" ? "text-text-primary" : "text-text-tertiary"
            }`}
            onClick={() => toggleSort("status")}
          >
            状态
            {renderSortIcon("status")}
          </button>
        ),
        size: 112,
        cell: ({ row }) => {
          const status = getIndexStatusLabel(t, row.original);

          return (
            <div className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5">
              <StatusIndicator status={status.indicator} size="sm" />
              <span
                className={`text-[12px] font-medium leading-5 ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div className="text-center text-[11px] font-medium tracking-[0.02em] text-text-tertiary">
            操作
          </div>
        ),
        size: 88,
        cell: ({ row }) => (
          <div
            className="relative flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            data-kb-action-menu
          >
            <Switch
              checked={row.original.enabled}
              onChange={() => {
                void handleToggleDocumentEnabled(row.original);
              }}
              disabled={togglingDocumentIds.includes(row.original.id)}
              size="sm"
              ariaLabel={row.original.enabled ? "停用文档" : "启用文档"}
            />
            <div className="relative" data-kb-action-menu>
              <IconButton
                className="h-7 w-7 rounded-sm"
                onClick={() =>
                  setOpenActionMenuId((current) =>
                    current === row.original.id ? null : row.original.id,
                  )
                }
                ariaLabel={t("settings.knowledgeBase.filters.moreActionsAria", {
                  name: row.original.name,
                })}
              >
                <Ellipsis className="h-4 w-4" />
              </IconButton>

              <div
                className={`absolute right-0 top-full z-20 mt-2 min-w-[150px] rounded-md border border-border bg-surface-elevated p-1 shadow-shadow-md transition-all duration-150 ${
                  openActionMenuId === row.original.id
                    ? "visible opacity-100"
                    : "invisible pointer-events-none opacity-0"
                }`}
                data-kb-action-menu
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-secondary"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    confirmRebuildIndex(row.original);
                  }}
                >
                  <RotateCcw className="h-4 w-4 text-icon-secondary" />
                  {t("settings.knowledgeBase.actions.rebuildIndex")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-danger-text transition-colors hover:bg-danger-soft"
                  onClick={() => {
                    setOpenActionMenuId(null);
                    confirmDeleteDocument(row.original);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("common.actions.delete")}
                </button>
              </div>
            </div>
          </div>
        ),
      },
    ],
    [
      allVisibleSelected,
      openActionMenuId,
      selectedDocumentIds,
      t,
      togglingDocumentIds,
      visibleDocuments,
    ],
  );

  const openMetadataModal = () => {
    Modal.show({
      title: t("settings.knowledgeBase.metadataModal.title"),
      width: 720,
      content: (
        <KnowledgeBaseMetadataContent
          metadata={knowledgeBase?.metadata ?? null}
          documentCount={knowledgeBase?.documentCount ?? visibleDocuments.length}
          enabledDocumentCount={knowledgeBase?.enabledDocumentCount ?? 0}
          totalChunks={knowledgeBase?.totalChunkCount ?? 0}
        />
      ),
    });
  };

  const confirmRebuildIndex = (document: DocumentRow) => {
    Modal.confirm({
      title: t("settings.knowledgeBase.rebuildModal.title"),
      description: `${t("settings.knowledgeBase.rebuildModal.description", {
        name: document.name,
      })} ${t("settings.knowledgeBase.rebuildModal.warning")}`,
      width: 440,
      tone: "warning",
      confirmText: t("settings.knowledgeBase.actions.confirmRebuild"),
      onConfirm: async () => {
        message.info(
          t("settings.knowledgeBase.messages.rebuildPending", {
            name: document.name,
          }),
        );
      },
    });
  };

  const confirmDeleteDocument = (document: DocumentRow) => {
    Modal.confirm({
      title: t("settings.knowledgeBase.actions.deleteDocument"),
      description: `${t("settings.knowledgeBase.deleteModal.description", {
        name: document.name,
      })} ${t("settings.knowledgeBase.deleteModal.warning")}`,
      width: 440,
      tone: "danger",
      confirmText: t("settings.knowledgeBase.actions.confirmDelete"),
      onConfirm: async () => {
        try {
          if (selectedKnowledgeBaseId) {
            await deleteKnowledgeBaseDocument(
              selectedKnowledgeBaseId,
              document.id,
            );
          } else {
            await deleteKnowledgeBaseDocument(document.id);
          }
          message.success(
            t("settings.knowledgeBase.messages.deleted", {
              name: document.name,
            }),
          );
          await refreshAll();
        } catch (error) {
          throw new Error(
            error instanceof Error
              ? error.message
              : t("settings.knowledgeBase.messages.deleteFailed"),
          );
        }
      },
    });
  };

  const confirmBatchDeleteDocuments = () => {
    if (!selectedKnowledgeBaseId || selectedDocumentIds.length === 0) {
      return;
    }

    Modal.confirm({
      title: "批量删除文档",
      description: `将删除已选中的 ${selectedDocumentIds.length} 个文档。此操作不可撤销，请确认后继续。`,
      width: 440,
      tone: "danger",
      confirmText: "确认删除",
      onConfirm: async () => {
        try {
          await Promise.all(
            selectedDocumentIds.map((id) =>
              deleteKnowledgeBaseDocument(selectedKnowledgeBaseId, id),
            ),
          );
          setSelectedDocumentIds([]);
          message.success(`已删除 ${selectedDocumentIds.length} 个文档`);
          await refreshAll();
        } catch (error) {
          throw new Error(
            error instanceof Error ? error.message : "批量删除失败",
          );
        }
      },
    });
  };

  const handleToggleDocumentEnabled = async (document: DocumentRow) => {
    try {
      setTogglingDocumentIds((current) => [...current, document.id]);
      await updateKnowledgeBaseDocument(document.id, {
        enabled: !document.enabled,
      });
      message.success(document.enabled ? "文档已停用" : "文档已启用");
      await refreshAll();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setTogglingDocumentIds((current) =>
        current.filter((id) => id !== document.id),
      );
    }
  };

  const goToDetail = (document: DocumentRow) => {
    const params = new URLSearchParams({
      id: document.id,
    });
    if (selectedKnowledgeBaseId) {
      params.set("knowledgeBaseId", selectedKnowledgeBaseId);
    }

    navigate(`/settings/knowledge-base/detail?${params.toString()}`);
  };

  const openAddDocument = () => {
    if (!modelAccessStatus?.embeddingConnected) {
      message.warning(
        t("settings.knowledgeBase.messages.uploadRequiresEmbedding"),
      );
      return;
    }

    const params = new URLSearchParams({ step: "1" });
    if (selectedKnowledgeBaseId) {
      params.set("knowledgeBaseId", selectedKnowledgeBaseId);
    }
    navigate(`/settings/knowledge-base/add?${params.toString()}`);
  };

  const handleCreateKnowledgeBase = () => {
    const modalKey = Modal.show({
      title: "新建知识库",
      width: 420,
      content: (
        <KnowledgeBaseEditorForm
          title="新建知识库"
          confirmLabel="创建"
          onCancel={() => Modal.close(modalKey)}
          onSubmit={async ({ name, description, persona, scenario, tags }) => {
            const trimmedName = name.trim();
            if (!trimmedName) {
              message.warning("请输入知识库名称");
              return;
            }

            try {
              const created = await createKnowledgeBase({
                name: trimmedName,
                description: description.trim() || null,
                metadata: {
                  persona: persona.trim() || null,
                  scenario: scenario.trim() || null,
                  tags: tags
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
              });
              Modal.close(modalKey);
              await loadKnowledgeBases();
              setSelectedKnowledgeBaseId(created.id);
              message.success("知识库已创建");
            } catch (error) {
              message.error(
                error instanceof Error ? error.message : "创建知识库失败",
              );
            }
          }}
        />
      ),
      footer: null,
    });
  };

  const handleEditKnowledgeBase = () => {
    if (!knowledgeBase) {
      return;
    }

    const modalKey = Modal.show({
      title: "编辑知识库",
      width: 480,
      content: (
        <KnowledgeBaseEditorForm
          title="编辑知识库"
          confirmLabel="保存"
          initialName={knowledgeBase.name}
          initialDescription={knowledgeBase.description ?? ""}
          initialPersona={knowledgeBase.metadata.persona ?? ""}
          initialScenario={knowledgeBase.metadata.scenario ?? ""}
          initialTags={knowledgeBase.metadata.tags.join(", ")}
          onCancel={() => Modal.close(modalKey)}
          onSubmit={async ({ name, description, persona, scenario, tags }) => {
            const trimmedName = name.trim();
            if (!trimmedName) {
              message.warning("请输入知识库名称");
              return;
            }

            try {
              await updateKnowledgeBase(knowledgeBase.id, {
                name: trimmedName,
                description: description.trim() || null,
                metadata: {
                  persona: persona.trim() || null,
                  scenario: scenario.trim() || null,
                  tags: tags
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                },
              });
              Modal.close(modalKey);
              await Promise.all([
                loadKnowledgeBases(),
                loadKnowledgeBase(knowledgeBase.id),
              ]);
              message.success("知识库已更新");
            } catch (error) {
              message.error(
                error instanceof Error ? error.message : "更新知识库失败",
              );
            }
          }}
        />
      ),
      footer: null,
    });
  };

  const handleDeleteKnowledgeBase = () => {
    if (!knowledgeBase) {
      return;
    }

    Modal.confirm({
      title: "删除知识库",
      description: `将删除知识库“${knowledgeBase.name}”及其下全部文档、分块与索引数据。此操作不可撤销，请确认后继续。`,
      width: 440,
      tone: "danger",
      confirmText: "确认删除",
      onConfirm: async () => {
        try {
          await deleteKnowledgeBase(knowledgeBase.id);
          resetDocumentViewState();
          await loadKnowledgeBases();
          setKnowledgeBase(null);
          message.success("知识库已删除");
        } catch (error) {
          throw new Error(
            error instanceof Error ? error.message : "删除知识库失败",
          );
        }
      },
    });
  };

  if (loading && visibleDocuments.length === 0 && !knowledgeBase) {
    return (
      <FullPageStatus
        message={t("settings.knowledgeBase.messages.loadingDocuments")}
      />
    );
  }

  return (
    <SettingsPageLayout
      miniTitle={t("settings.knowledgeBase.page.miniTitle")}
      title={t("settings.knowledgeBase.page.title")}
      description={t("settings.knowledgeBase.page.descriptionFallback")}
      bodyClassName="overflow-hidden"
      containerClassName="max-w-none"
      contentClassName="flex h-full min-h-0 flex-col gap-3 pt-4 px-0"
      scrollBody={false}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-0 bg-transparent p-0 shadow-none">
        {modelAccessStatus && !modelAccessStatus.embeddingConnected ? (
          <div className="rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-text">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="font-medium">
                {t("settings.knowledgeBase.banner")}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
          <KnowledgeBaseSidebar
            searchText={knowledgeBaseSearchText}
            onSearchTextChange={setKnowledgeBaseSearchText}
            onCreate={handleCreateKnowledgeBase}
            knowledgeBases={filteredKnowledgeBases}
            selectedKnowledgeBaseId={selectedKnowledgeBaseId}
            onSelectKnowledgeBase={handleSelectKnowledgeBase}
          />
          <section className="flex min-h-0 flex-col gap-3">
            <KnowledgeBaseToolbar
              knowledgeBaseName={knowledgeBase?.name ?? "默认知识库"}
              knowledgeBaseDescription={knowledgeBase?.description}
              filter={filter}
              selectedDocumentCount={selectedDocumentCount}
              onDeleteKnowledgeBase={handleDeleteKnowledgeBase}
              onEditKnowledgeBase={handleEditKnowledgeBase}
              onOpenMetadata={openMetadataModal}
              onOpenAddDocument={openAddDocument}
              onBatchDelete={confirmBatchDeleteDocuments}
              onFilterChange={setFilter}
              filterOptions={filterOptions}
            />

            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-primary">
              <div className="flex h-full min-h-0 flex-col">
                <div
                  ref={tableScrollRef}
                  className="min-h-0 flex-1 overflow-auto"
                >
                  <Table
                    key={selectedKnowledgeBaseId ?? "empty"}
                    data={visibleDocuments}
                    columns={columns}
                    compact
                    stickyHeader
                    className="rounded-none border-0 shadow-none"
                    emptyState={t("settings.knowledgeBase.table.empty")}
                    getRowProps={(row) => ({
                      onDoubleClick: () => goToDetail(row.original),
                    })}
                  />
                </div>

                <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-1.5 text-body-small text-sm text-text-secondary">
                  <div>
                    共 {knowledgeBase?.documentCount ?? visibleDocuments.length}{" "}
                    个文件
                  </div>
                  <div>总分块 {knowledgeBase?.totalChunkCount ?? 0}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </SettingsPageLayout>
  );
}
