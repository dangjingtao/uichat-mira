import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Ellipsis,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { FileIcon } from "@/shared/ui/FileIcon";
import IconButton from "@/shared/ui/IconButton";
import Skeleton from "@/shared/ui/Skeleton";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import Switch from "@/shared/ui/Switch";
import Table from "@/shared/ui/Table";
import type { ColumnMeta } from "@/shared/ui/Table";
import type { DocumentRow, DocumentSortKey } from "../hooks/useKnowledgeBase";

type DocumentTableProps = {
  data: DocumentRow[];
  selectedRowIds: string[];
  onSelectedRowIdsChange: (ids: string[]) => void;
  sortBy: DocumentSortKey;
  sortOrder: "asc" | "desc";
  onToggleSort: (key: DocumentSortKey) => void;
  togglingDocumentIds: string[];
  openActionMenuId: string | null;
  onOpenActionMenuChange: (id: string | null) => void;
  onToggleDocumentEnabled: (document: DocumentRow) => void;
  onRebuildIndex: (document: DocumentRow) => void;
  onDeleteDocument: (document: DocumentRow) => void;
  onGoToDetail: (document: DocumentRow) => void;
  emptyState: string;
  selectedKnowledgeBaseId: string | null;
  tableScrollRef: React.RefObject<HTMLDivElement>;
  loading?: boolean;
};

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

export default function DocumentTable({
  data,
  selectedRowIds,
  onSelectedRowIdsChange,
  sortBy,
  sortOrder,
  onToggleSort,
  togglingDocumentIds,
  openActionMenuId,
  onOpenActionMenuChange,
  onToggleDocumentEnabled,
  onRebuildIndex,
  onDeleteDocument,
  onGoToDetail,
  emptyState,
  selectedKnowledgeBaseId,
  tableScrollRef,
  loading = false,
}: DocumentTableProps) {
  const { t } = useTranslation();

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
        accessorKey: "name",
        size: 200,
        minSize: 200,
        maxSize: 200,
        meta: {
          width: 200,
          sticky: "left",
          ellipsisTooltip: true,
        } satisfies ColumnMeta<DocumentRow>,
        header: () => (
          <button
            type="button"
            className={`inline-flex items-center gap-1 text-[11px] font-medium tracking-[0.02em] ${
              sortBy === "name" ? "text-text-primary" : "text-text-tertiary"
            }`}
            onClick={() => onToggleSort("name")}
          >
            {t("settings.knowledgeBase.table.name")}
            {renderSortIcon("name")}
          </button>
        ),
        sortingFn: "alphanumeric",
        cell: ({ row }) => (
          <div className="flex min-w-0 max-w-[200px] items-center gap-2">
            <FileIcon
              extension={row.original.type}
              className="h-4 w-4 shrink-0"
            />
            <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-text-primary">
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
            onClick={() => onToggleSort("updatedAt")}
          >
            {t("settings.knowledgeBase.table.updatedAt")}
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
            onClick={() => onToggleSort("status")}
          >
            {t("settings.knowledgeBase.table.status")}
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
            {t("settings.knowledgeBase.table.actions")}
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
                onToggleDocumentEnabled(row.original);
              }}
              disabled={togglingDocumentIds.includes(row.original.id)}
              size="sm"
              ariaLabel={
                row.original.enabled
                  ? t("settings.knowledgeBase.actions.disableDocument")
                  : t("settings.knowledgeBase.actions.enableDocument")
              }
            />
            <div className="relative" data-kb-action-menu>
              <IconButton
                className="h-7 w-7 rounded-sm"
                onClick={() =>
                  onOpenActionMenuChange(
                    openActionMenuId === row.original.id
                      ? null
                      : row.original.id,
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
                    onOpenActionMenuChange(null);
                    onRebuildIndex(row.original);
                  }}
                >
                  <RotateCcw className="h-4 w-4 text-icon-secondary" />
                  {t("settings.knowledgeBase.actions.rebuildIndex")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-danger-text transition-colors hover:bg-danger-soft"
                  onClick={() => {
                    onOpenActionMenuChange(null);
                    onDeleteDocument(row.original);
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
      openActionMenuId,
      sortBy,
      sortOrder,
      t,
      togglingDocumentIds,
      onToggleSort,
      onOpenActionMenuChange,
      onToggleDocumentEnabled,
      onRebuildIndex,
      onDeleteDocument,
      renderSortIcon,
    ],
  );

  return (
    <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
      {loading ? (
        <div className="min-h-full bg-surface-primary">
          <div className="grid grid-cols-[32px_minmax(200px,1.4fr)_96px_112px_88px] items-center gap-0 border-b border-border px-3 py-2">
            <Skeleton height={12} width={14} />
            <Skeleton height={12} width={72} />
            <Skeleton height={12} width={52} />
            <Skeleton height={12} width={44} />
            <Skeleton height={12} width={38} className="justify-self-end" />
          </div>
          <div className="px-3 py-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[32px_minmax(200px,1.4fr)_96px_112px_88px] items-center gap-0 border-b border-border/70 py-3 last:border-b-0"
              >
                <Skeleton height={14} width={14} />
                <div className="flex min-w-0 items-center gap-2">
                  <Skeleton height={16} width={16} className="shrink-0" />
                  <Skeleton
                    height={16}
                    width={`${46 + ((index % 3) + 1) * 10}%`}
                    className="max-w-[180px]"
                  />
                </div>
                <Skeleton height={14} width={54} />
                <div className="flex items-center gap-2">
                  <Skeleton.Circle size={8} />
                  <Skeleton height={14} width={48} />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Skeleton height={20} width={30} className="rounded-full" />
                  <Skeleton height={28} width={28} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Table
          key={selectedKnowledgeBaseId ?? "empty"}
          data={data}
          columns={columns}
          rowSelection={{
            selectedRowIds,
            onSelectedRowIdsChange,
            getRowId: (row) => row.id,
            ariaLabel: (row) => row.name,
            selectAllAriaLabel: "Select all documents",
          }}
          compact
          stickyHeader
          className="rounded-none border-0 shadow-none"
          emptyState={emptyState}
          getRowProps={(row) => ({
            onDoubleClick: () => onGoToDetail(row.original),
          })}
        />
      )}
    </div>
  );
}
