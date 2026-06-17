import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FolderArchive,
  PackagePlus,
  Play,
  TableProperties,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Card from "@/shared/ui/Card";
import { Button, IconButton } from "@/shared/ui/Button";
import { FileUploadDropzone } from "@/shared/ui/FileUploadDropzone";
import { Modal } from "@/shared/ui/Modal";
import { message } from "@/shared/ui/Message";
import {
  createEvaluationRun,
  getEvaluationRun,
  parseEvaluationDataset,
} from "@/shared/api/evaluation";
import type {
  EvaluationJobStatus,
  EvaluationRunRecord,
  ParsedDataset,
} from "./types";
import MetricGrid from "../../components/Evaluation/MetricGrid";
import StatusBadge from "../../components/Evaluation/StatusBadge";
import EvaluationPackageGeneratorModal from "../../components/Evaluation/EvaluationPackageGeneratorModal";
import { getAppLanguage } from "@/shared/i18n";

type ConsoleTab = "log" | "result";

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage(), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ValidationPill({ status }: { status: "pass" | "warning" | "error" }) {
  const { t } = useTranslation();
  const statusMap = {
    pass: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-danger/10 text-danger",
  } as const;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusMap[status]}`}
    >
      {status === "pass"
        ? t("settings.evaluation.shared.statusPass")
        : status === "warning"
          ? t("settings.evaluation.shared.statusWarning")
          : t("settings.evaluation.shared.statusError")}
    </span>
  );
}

function WorkbenchStateBar({
  status,
  dataset,
  runRecord,
}: {
  status: EvaluationJobStatus;
  dataset: ParsedDataset | null;
  runRecord: EvaluationRunRecord | null;
}) {
  const { t } = useTranslation();
  const summary = dataset?.summary;
  const sampleCount = summary?.sampleCount ?? 0;
  const completedCount =
    status === "completed" || status === "failed"
      ? (runRecord?.sampleResults.length ?? 0)
      : status === "queued"
        ? 0
        : status === "running"
          ? (runRecord?.sampleResults.length ?? 0)
          : 0;

  return (
    <div className="grid gap-2.5 rounded-xl border border-border bg-surface-primary px-3.5 py-3 shadow-shadow-sm sm:grid-cols-2 xl:grid-cols-5">
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
          {t("settings.evaluation.workbench.stateBar.taskStatus")}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge status={status} />
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
          {t("settings.evaluation.workbench.stateBar.dataset")}
        </div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {dataset?.datasetName ??
            t("settings.evaluation.workbench.stateBar.waitingUpload")}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
          {t("settings.evaluation.workbench.stateBar.progress")}
        </div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {completedCount} / {sampleCount || "--"}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
          {t("settings.evaluation.workbench.stateBar.mode")}
        </div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {dataset
            ? dataset.config.mode === "retrieve"
              ? t("settings.evaluation.shared.modeRetrieve")
              : t("settings.evaluation.shared.modeRetrieveGenerate")
            : "--"}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
          {t("settings.evaluation.workbench.stateBar.params")}
        </div>
        <div className="mt-1 text-sm font-medium text-text-primary">
          {dataset ? `K${dataset.config.topK} / N${dataset.config.topN}` : "--"}
        </div>
      </div>
    </div>
  );
}

function DatasetPreviewDrawer({
  open,
  dataset,
  onClose,
}: {
  open: boolean;
  dataset: ParsedDataset | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!open || !dataset) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={t("settings.evaluation.workbench.preview.closeMask")}
        className="absolute inset-0 bg-black/25"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-border bg-surface-primary shadow-shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.evaluation.workbench.preview.title")}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {dataset.datasetName} ·{" "}
              {t("settings.evaluation.shared.sampleCount", {
                count: dataset.summary.sampleCount,
              })}{" "}
              ·{" "}
              {t("settings.evaluation.shared.documentCount", {
                count: dataset.summary.documentCount,
              })}
            </div>
          </div>
          <IconButton
            ariaLabel={t("settings.evaluation.workbench.preview.closeDrawer")}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="stable-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.evaluation.workbench.preview.samplePreview")}
            </div>
            <div className="space-y-2">
              {dataset.previewSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface-primary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                      {sample.id}
                    </span>
                    <div className="text-xs text-text-secondary">
                      {sample.tags.join(" · ")}
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-medium text-text-primary">
                    {sample.question}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">
                    {t("settings.evaluation.workbench.preview.goldSources")}：
                    {sample.goldSources.join("、")}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">
                    {t("settings.evaluation.workbench.preview.reference")}：
                    {sample.expectedAnswer}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.evaluation.workbench.preview.documentPreview")}
            </div>
            <div className="space-y-2">
              {dataset.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text-primary">
                      {document.name}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {document.sizeLabel}
                    </div>
                  </div>
                  <span className="ml-3 rounded-full bg-surface-primary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    {document.type}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

export default function EvaluationWorkbench() {
  const { t } = useTranslation();
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [status, setStatus] = useState<EvaluationJobStatus>("idle");
  const [parsing, setParsing] = useState(false);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("log");
  const [runRecord, setRunRecord] = useState<EvaluationRunRecord | null>(null);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const openPackageGenerator = () => {
    let modalKey = "";
    modalKey = Modal.show({
      title: t("settings.evaluation.packageGenerator.title"),
      width: 820,
      footer: null,
      content: (
        <EvaluationPackageGeneratorModal
          onClose={() => Modal.close(modalKey)}
        />
      ),
    });
  };

  useEffect(() => {
    if (!runRecord) {
      return;
    }

    if (runRecord.status === "completed" || runRecord.status === "failed") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const nextRun = await getEvaluationRun(runRecord.id);
        setRunRecord(nextRun);
        setStatus(nextRun.status);
      } catch {
        // Keep the last visible state and try again on the next tick.
      }
    }, 1500);

    return () => {
      window.clearInterval(timer);
    };
  }, [runRecord]);

  const canRun = Boolean(
    dataset &&
    dataset.validations.every((item) => item.status !== "error") &&
    !parsing &&
    status !== "queued" &&
    status !== "running",
  );

  const progressWidth = useMemo(() => {
    if (!dataset) {
      return 0;
    }

    const sampleCount = dataset.summary.sampleCount || 1;
    const completedCount = runRecord?.sampleResults.length ?? 0;

    if (status === "completed" || status === "failed") {
      return 100;
    }

    if (status === "queued") {
      return 18;
    }

    if (status === "running") {
      return Math.max(24, Math.min(96, (completedCount / sampleCount) * 100));
    }

    return status === "ready" ? 8 : 0;
  }, [dataset, runRecord?.sampleResults.length, status]);

  const handleSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const [file] = Array.from(files);
    if (!file || !file.name.toLowerCase().endsWith(".zip")) {
      message.warning(t("settings.evaluation.workbench.messages.uploadZip"));
      return;
    }

    try {
      setParsing(true);
      setStatus("idle");
      setRunRecord(null);
      setSavedRunId(null);
      setConsoleTab("log");
      const parsed = await parseEvaluationDataset(file);
      setDataset(parsed);
      setStatus("ready");
      message.success(t("settings.evaluation.workbench.messages.parseSuccess"));
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.evaluation.workbench.messages.parseFailed"),
      );
    } finally {
      setParsing(false);
    }
  };

  const handleStartEvaluation = async () => {
    if (!dataset) {
      message.warning(t("settings.evaluation.workbench.messages.uploadFirst"));
      return;
    }

    if (dataset.validations.some((item) => item.status === "error")) {
      message.error(t("settings.evaluation.workbench.messages.validationError"));
      return;
    }

    setStatus("queued");
    setConsoleTab("log");
    const nextRun = await createEvaluationRun({
      datasetId: dataset.id,
    });
    setRunRecord(nextRun);
    setStatus(nextRun.status);
    setSavedRunId(nextRun.id);
    message.success(t("settings.evaluation.workbench.messages.runCreated"));
  };

  return (
    <SettingsPageLayout
      miniTitle={t("settings.evaluation.workbench.page.miniTitle")}
      title={t("settings.evaluation.workbench.page.title")}
      description={t("settings.evaluation.workbench.page.description")}
      slot={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={openPackageGenerator}
          >
            <PackagePlus className="h-4 w-4" />
            {t("settings.evaluation.workbench.actions.generatePackage")}
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={!canRun}
            onClick={() => {
              void handleStartEvaluation();
            }}
          >
            <Play className="h-4 w-4" />
            {t("settings.evaluation.workbench.actions.startEvaluation")}
          </Button>
        </div>
      }
      containerClassName="max-w-none"
      contentClassName="flex flex-col gap-4 pt-6 2xl:h-full"
    >
      <div className="grid gap-4 2xl:min-h-0 2xl:flex-1 2xl:grid-cols-[minmax(340px,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3 2xl:min-h-0 2xl:overflow-y-auto 2xl:pr-1">
          <Card className="space-y-3 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-text-primary">
                  {t("settings.evaluation.workbench.packageCard.title")}
                </div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">
                  {t("settings.evaluation.workbench.packageCard.description")}
                </div>
              </div>
              {dataset ? (
                <StatusBadge status={status === "idle" ? "ready" : status} />
              ) : null}
            </div>

            <FileUploadDropzone
              onSelectFiles={(files) => {
                void handleSelectFiles(files);
              }}
              accept=".zip"
              maxCount={1}
              helperText={
                parsing
                  ? t("settings.evaluation.workbench.packageCard.parsing")
                  : t("settings.evaluation.workbench.packageCard.helper")
              }
              className="px-3 py-3"
              disabled={parsing}
            />

            {dataset ? (
              <>
                <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5 text-xs leading-5 text-text-secondary">
                  <div className="font-medium text-text-primary">
                    {dataset.fileName}
                  </div>
                  <div>
                    {formatFileSize(dataset.fileSize)} ·{" "}
                    {t("settings.evaluation.shared.uploadedAt", {
                      value: formatDate(dataset.uploadedAt),
                    })}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                      {t("settings.evaluation.workbench.packageCard.dataset")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {dataset.datasetName}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {t("settings.evaluation.shared.documentCount", {
                        count: dataset.summary.documentCount,
                      })}{" "}
                      ·{" "}
                      {t("settings.evaluation.shared.sampleCount", {
                        count: dataset.summary.sampleCount,
                      })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
                      {t("settings.evaluation.workbench.packageCard.runtimeConfig")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {dataset.config.mode === "retrieve"
                        ? t("settings.evaluation.shared.modeRetrieve")
                        : t("settings.evaluation.shared.modeRetrieveGenerate")}
                    </div>
                    <div className="mt-1 text-xs text-text-secondary">
                      topK {dataset.config.topK} · topN {dataset.config.topN} ·
                      N {dataset.config.repeat}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="h-4 w-4" />
                    {t("settings.evaluation.workbench.packageCard.openPreview")}
                  </Button>
                  <div className="text-xs text-text-secondary">
                    {t("settings.evaluation.workbench.packageCard.previewHint")}
                  </div>
                </div>
              </>
            ) : null}
          </Card>

          <Card className="space-y-3 p-3.5">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-text-primary">
                {t("settings.evaluation.workbench.validation.title")}
              </div>
              {dataset ? (
                <span className="max-w-full text-xs text-text-secondary sm:text-right">
                  {t("settings.evaluation.workbench.validation.hint")}
                </span>
              ) : null}
            </div>
            {dataset ? (
              <div className="space-y-2">
                {dataset.validations.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-surface-secondary px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-text-primary">
                        {item.label}
                      </div>
                      <ValidationPill status={item.status} />
                    </div>
                    <div className="mt-1 text-xs leading-5 text-text-secondary">
                      {item.detail}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface-secondary px-3 py-5 text-sm text-text-secondary">
                {t("settings.evaluation.workbench.validation.empty")}
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-h-[560px] flex-col gap-3 2xl:min-h-0">
          <WorkbenchStateBar
            status={status}
            dataset={dataset}
            runRecord={runRecord}
          />

          <Card className="flex flex-1 flex-col overflow-hidden p-0 2xl:min-h-0">
            <div className="flex flex-col gap-2 border-b border-border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1 rounded-xl bg-surface-secondary p-1">
                <button
                  type="button"
                  onClick={() => setConsoleTab("log")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    consoleTab === "log"
                      ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                      : "text-text-secondary"
                  }`}
                >
                  {t("settings.evaluation.workbench.console.log")}
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleTab("result")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    consoleTab === "result"
                      ? "bg-surface-primary text-text-primary shadow-shadow-sm"
                      : "text-text-secondary"
                  }`}
                >
                  {t("settings.evaluation.workbench.console.result")}
                </button>
              </div>

              <div className="max-w-full text-xs text-text-secondary sm:text-right">
                {savedRunId
                  ? t("settings.evaluation.workbench.console.savedHint")
                  : t("settings.evaluation.workbench.console.unsavedHint")}
              </div>
            </div>

            <div className="flex-1 overflow-hidden 2xl:min-h-0">
              {consoleTab === "log" ? (
                <div className="flex h-full min-h-[320px] flex-col p-2 sm:min-h-[396px] sm:p-3 2xl:min-h-0">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-secondary px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        <span className="text-xs font-medium tracking-[0.08em] text-text-secondary">
                          LOGS
                        </span>
                      </div>
                      <div className="rounded-md border border-border bg-surface-primary px-2 py-1 font-mono text-[11px] text-text-secondary shadow-shadow-sm">
                        rag-eval-runner
                      </div>
                    </div>
                    <div className="border-b border-border bg-surface-primary px-4 py-2 text-[11px] text-text-secondary">
                      <span className="block sm:inline">Stream:</span>{" "}
                      <span className="break-all font-mono text-text-primary">
                        terminal://rag-eval-runner
                      </span>
                    </div>
                    <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto bg-surface-primary px-4 py-3 font-mono text-[12px] leading-[1.75] text-text-primary">
                      {dataset ? (
                        <>
                          <div className="border-b border-border/60 py-1.5">
                            <span className="mr-2 text-text-tertiary">$</span>
                            load {dataset.fileName}
                          </div>
                          <div className="border-b border-border/60 py-1.5 text-success">
                            manifest parsed: mode={dataset.config.mode} topK=
                            {dataset.config.topK} topN={dataset.config.topN}{" "}
                            repeat={dataset.config.repeat}
                          </div>
                          <div className="border-b border-border/60 py-1.5">
                            samples={dataset.summary.sampleCount} documents=
                            {dataset.summary.documentCount}
                          </div>
                          <div className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                            validation summary
                          </div>
                          {dataset.validations.map((item) => (
                            <div
                              key={item.id}
                              className="border-b border-border/60 py-1.5"
                            >
                              <span className="mr-2 text-text-tertiary">-</span>
                              {item.label} ::{" "}
                              <span
                                className={
                                  item.status === "pass"
                                    ? "text-success"
                                    : item.status === "warning"
                                      ? "text-warning"
                                      : "text-danger"
                                }
                              >
                                {item.status}
                              </span>
                            </div>
                          ))}
                          <div className="py-1.5 pt-3">
                            <span className="mr-2 text-text-tertiary">$</span>
                            ready
                          </div>

                          {status === "queued" ? (
                            <>
                              <div className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                                evaluation queued...
                              </div>
                              <div className="border-b border-border/60 py-1.5">
                                waiting for backend worker to pick up this run
                              </div>
                            </>
                          ) : null}

                          {runRecord ? (
                            <>
                              <div className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                                run summary
                              </div>
                              {runRecord.logs.map((log) => (
                                <div
                                  key={log.id}
                                  className="border-b border-border/60 py-1.5"
                                >
                                  <span className="mr-2 text-text-tertiary">
                                    [{log.timestamp}]
                                  </span>{" "}
                                  {log.text}
                                </div>
                              ))}
                            </>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                          {t("settings.evaluation.workbench.console.emptyLog")}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-border bg-surface-secondary px-4 py-3">
                      <div className="mb-2 flex items-center justify-between text-[11px] text-text-secondary">
                        <span>Progress</span>
                        <span>{Math.round(progressWidth)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${progressWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="stable-scrollbar h-full min-h-[420px] overflow-y-auto px-3.5 py-3 2xl:min-h-0">
                  {runRecord ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">
                            {runRecord.name}
                          </div>
                          <div className="mt-1 text-xs text-text-secondary">
                            {runRecord.dataset.config.mode === "retrieve"
                              ? t("settings.evaluation.shared.modeRetrieve")
                              : t("settings.evaluation.shared.modeRetrieveGenerate")}{" "}
                            ·{" "}
                            {runRecord.completedAt
                              ? t("settings.evaluation.shared.completedAt", {
                                  value: formatDate(runRecord.completedAt),
                                })
                              : t("settings.evaluation.shared.createdAt", {
                                  value: formatDate(runRecord.startedAt),
                                })}{" "}
                            ·{" "}
                            {t("settings.evaluation.workbench.console.resultSummary", {
                              count: runRecord.sampleResults.length,
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={runRecord.status} />
                          {savedRunId ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t("settings.evaluation.status.saved")}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <MetricGrid metrics={runRecord.metrics} />

                      <div className="w-full">
                        <Card className="space-y-2 p-3.5">
                          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                            <TableProperties className="h-4 w-4 text-primary" />
                            {t("settings.evaluation.workbench.console.summary")}
                          </div>
                          <div className="space-y-2">
                            {runRecord.sampleResults.slice(0, 4).map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="whitespace-normal break-all text-text-primary">
                                    {item.question}
                                  </div>
                                  <div className="mt-1 text-xs text-text-secondary">
                                    {item.status === "success"
                                      ? t("settings.evaluation.workbench.console.success")
                                      : item.errorMessage}
                                  </div>
                                </div>
                                <div className="shrink-0 text-xs font-medium text-text-secondary">
                                  {(item.latencyMs / 1000).toFixed(1)}s
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-md rounded-2xl border border-dashed border-border bg-surface-secondary px-5 py-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="mt-3 text-base font-semibold text-text-primary">
                          {t("settings.evaluation.workbench.console.emptyResultTitle")}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                          {t(
                            "settings.evaluation.workbench.console.emptyResultDescription",
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <DatasetPreviewDrawer
        open={previewOpen}
        dataset={dataset}
        onClose={() => setPreviewOpen(false)}
      />
    </SettingsPageLayout>
  );
}
