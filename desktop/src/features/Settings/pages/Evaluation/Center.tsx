import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import MinimalTable from "@/shared/ui/Table";
import { Modal } from "@/shared/ui/Modal";
import {
  deleteEvaluationRun,
  getEvaluationRuns,
} from "@/shared/api/evaluation";
import type { EvaluationRunRecord } from "./types";
import StatusBadge from "../../components/Evaluation/StatusBadge";
import DetailDrawer from "../../components/Evaluation/DetailDrawer";
import { message } from "@/shared/ui/Message";
import type { ColumnDef } from "@tanstack/react-table";
import { downloadEvaluationRunMarkdown } from "./exportMarkdown";
import { getAppLanguage } from "@/shared/i18n";

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatDate = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function EvaluationCenter() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<EvaluationRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedRun, setSelectedRun] = useState<EvaluationRunRecord | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  const loadRuns = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const nextRuns = await getEvaluationRuns();
      setRuns(nextRuns);
      setSelectedRun((current) =>
        current ? nextRuns.find((run) => run.id === current.id) ?? null : null,
      );
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.evaluation.center.messages.loadFailed"),
      );
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  const handleDownloadRun = async (run: EvaluationRunRecord) => {
    try {
      await downloadEvaluationRunMarkdown(run);
      message.success(
        t("settings.evaluation.center.messages.downloadStarted", {
          name: run.name,
        }),
      );
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.evaluation.center.messages.exportFailed"),
      );
    }
  };

  const confirmDeleteRun = (run: EvaluationRunRecord) => {
    const modalKey = Modal.show({
      title: t("settings.evaluation.center.deleteModal.title"),
      width: 460,
      content: (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>
            {t("settings.evaluation.center.deleteModal.description", {
              name: run.name,
            })}
          </p>
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-danger">
            {t("settings.evaluation.center.deleteModal.warning")}
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
            disabled={deletingRunId === run.id}
            onClick={async () => {
              try {
                setDeletingRunId(run.id);
                await deleteEvaluationRun(run.id);
                Modal.close(modalKey);
                setRuns((current) => current.filter((item) => item.id !== run.id));
                setSelectedRun((current) => (current?.id === run.id ? null : current));
                message.success(
                  t("settings.evaluation.center.messages.deleted", {
                    name: run.name,
                  }),
                );
              } catch (error) {
                message.error(
                  error instanceof Error
                    ? error.message
                    : t("settings.evaluation.center.messages.deleteFailed"),
                );
              } finally {
                setDeletingRunId((current) => (current === run.id ? null : current));
              }
            }}
          >
            {deletingRunId === run.id
              ? t("settings.evaluation.center.deleteModal.deleting")
              : t("settings.evaluation.center.deleteModal.confirm")}
          </Button>
        </>
      ),
    });
  };

  const filteredRuns = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return runs;
    }

    return runs.filter((run) =>
      [run.name, run.dataset.datasetName].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [query, runs]);

  const columns = useMemo<ColumnDef<EvaluationRunRecord>[]>(
    () => [
      {
        header: t("settings.evaluation.center.table.name"),
        accessorKey: "name",
        size: 360,
        minSize: 360,
        cell: ({ row }) => (
          <div className="w-[360px] max-w-[360px] min-w-0">
            <div className="stable-scrollbar overflow-x-auto overflow-y-hidden pb-1">
              <div className="w-max whitespace-nowrap font-medium text-text-primary">
                {row.original.name}
              </div>
            </div>
            <div className="mt-1 truncate text-xs text-text-secondary">
              {row.original.dataset.datasetName}
            </div>
          </div>
        ),
      },
      {
        header: t("settings.evaluation.center.table.status"),
        accessorKey: "status",
        size: 120,
        minSize: 120,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        header: t("settings.evaluation.center.table.sampleCount"),
        accessorKey: "sampleCount",
        size: 72,
        minSize: 72,
        cell: ({ row }) => row.original.dataset.summary.sampleCount,
      },
      {
        header: t("settings.evaluation.center.table.keyMetrics"),
        accessorKey: "metrics",
        size: 180,
        minSize: 180,
        cell: ({ row }) => (
          <div className="min-w-[150px] text-sm text-text-primary">
            Hit@K {formatPercent(row.original.metrics.hitAtK)}
            <div className="mt-1 text-xs text-text-secondary">
              Faithfulness {formatPercent(row.original.metrics.faithfulness)}
            </div>
          </div>
        ),
      },
      {
        header: t("settings.evaluation.center.table.completedAt"),
        accessorKey: "completedAt",
        size: 120,
        minSize: 120,
        cell: ({ row }) =>
          formatDate(row.original.completedAt ?? row.original.startedAt),
      },
      {
        header: t("settings.evaluation.center.table.actions"),
        id: "actions",
        size: 220,
        minSize: 220,
        cell: ({ row }) => (
          <div className="flex items-center justify-start gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRun(row.original)}
            >
              {t("common.actions.view")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleDownloadRun(row.original)}
            >
              <Download className="h-3.5 w-3.5" />
              {t("common.actions.download")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger/5 hover:text-danger"
              disabled={
                deletingRunId === row.original.id ||
                row.original.status === "queued" ||
                row.original.status === "running"
              }
              onClick={() => confirmDeleteRun(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("common.actions.delete")}
            </Button>
          </div>
        ),
      },
    ],
    [deletingRunId, t],
  );

  return (
    <SettingsPageLayout
      miniTitle={t("settings.evaluation.center.page.miniTitle")}
      title={t("settings.evaluation.center.page.title")}
      description={t("settings.evaluation.center.page.description")}
      containerClassName="max-w-none"
      contentClassName="flex h-full min-h-0 flex-col gap-4 pt-6"
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-3 border-0 bg-transparent p-0 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="shrink-0 rounded-xl border border-border bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary">
            {t("settings.evaluation.center.recordCount", { count: runs.length })}
          </div>

          <div className="flex min-w-[320px] flex-1 items-center justify-end gap-2 max-md:w-full">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-icon-secondary" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("settings.evaluation.center.searchPlaceholder")}
                className="h-9 w-full rounded-xl border border-border bg-surface-primary pl-9 pr-3 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={refreshing}
              onClick={() => void loadRuns({ silent: true })}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
              {t("common.actions.refresh")}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary text-sm text-text-secondary">
              {t("settings.evaluation.center.loading")}
            </div>
          ) : filteredRuns.length > 0 ? (
            <MinimalTable
              data={filteredRuns}
              columns={columns}
              className="stable-scrollbar h-full"
              stickyHeader
              stickyFirstColumn
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary text-sm text-text-secondary">
              {runs.length === 0
                ? t("settings.evaluation.center.empty")
                : t("settings.evaluation.center.noMatch")}
            </div>
          )}
        </div>
      </Card>

      <DetailDrawer
        open={Boolean(selectedRun)}
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
        onDelete={confirmDeleteRun}
        onDownload={handleDownloadRun}
        deleting={selectedRun ? deletingRunId === selectedRun.id : false}
      />
    </SettingsPageLayout>
  );
}
