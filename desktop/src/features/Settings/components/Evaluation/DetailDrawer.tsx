import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, IconButton } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import type { EvaluationRunRecord } from "@/features/Settings/pages/Evaluation/types";
import StatusBadge from "./StatusBadge";
import MetricGrid from "./MetricGrid";
import { getAppLanguage } from "@/shared/i18n";

const formatTime = (value: string) =>
  new Date(value).toLocaleString(getAppLanguage(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export function DetailDrawer({
  open,
  run,
  onClose,
  onDelete,
  onDownload,
  deleting = false,
}: {
  open: boolean;
  run: EvaluationRunRecord | null;
  onClose: () => void;
  onDelete?: (run: EvaluationRunRecord) => void;
  onDownload?: (run: EvaluationRunRecord) => void;
  deleting?: boolean;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(open && Boolean(run));
  const [visible, setVisible] = useState(open && Boolean(run));

  useEffect(() => {
    if (open && run) {
      setMounted(true);
      const timer = window.setTimeout(() => {
        setVisible(true);
      }, 16);

      return () => window.clearTimeout(timer);
    }

    setVisible(false);
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [open, run]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  if (!mounted || !run) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={t("settings.evaluation.detailDrawer.closeMask")}
        className={`absolute inset-0 transition-opacity duration-300 ${
          visible
            ? "bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.28)_40%,rgba(15,23,42,0.5)_100%)] opacity-100"
            : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[760px] flex-col border-l border-border bg-surface-primary shadow-shadow-xl transition-transform duration-300 ease-out before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-sky-400/0 before:via-sky-400/80 before:to-cyan-400/0 ${
          visible ? "translate-x-0" : "translate-x-8"
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-text-primary">{run.name}</div>
              <StatusBadge status={run.status} />
            </div>
            <div className="text-xs text-text-secondary">
              {run.dataset.datasetName} ·{" "}
              {t("settings.evaluation.shared.sampleCount", {
                count: run.dataset.summary.sampleCount,
              })}{" "}
              ·
              {run.completedAt
                ? t("settings.evaluation.shared.completedAt", {
                    value: formatTime(run.completedAt),
                  })
                : t("settings.evaluation.shared.createdAt", {
                    value: formatTime(run.startedAt),
                  })}
            </div>
          </div>
          <IconButton
            ariaLabel={t("settings.evaluation.detailDrawer.closeDrawer")}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="stable-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <MetricGrid metrics={run.metrics} compact />

          <div className="grid gap-3 md:grid-cols-2">
            <Card
              label={t("settings.evaluation.detailDrawer.runtimeConfig")}
              value={`topK ${run.dataset.config.topK} / topN ${run.dataset.config.topN}`}
              description={t("settings.evaluation.detailDrawer.modeRepeat", {
                mode: t(
                  run.dataset.config.mode === "retrieve"
                    ? "settings.evaluation.shared.modeRetrieve"
                    : "settings.evaluation.shared.modeRetrieveGenerate",
                ),
                count: run.dataset.config.repeat,
              })}
              className="px-3.5 py-3"
            />
            <Card
              label={t("settings.evaluation.detailDrawer.dataset")}
              value={run.dataset.datasetName}
              description={t("settings.evaluation.detailDrawer.datasetSummary", {
                documents: run.dataset.summary.documentCount,
                samples: run.dataset.summary.sampleCount,
              })}
              className="px-3.5 py-3"
            />
          </div>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.evaluation.detailDrawer.validations")}
            </div>
            <div className="space-y-2">
              {run.dataset.validations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-surface-secondary px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-text-primary">{item.label}</div>
                    <StatusBadge
                      status={
                        item.status === "pass"
                          ? "completed"
                          : item.status === "warning"
                            ? "running"
                            : "failed"
                      }
                    />
                  </div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">{item.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.evaluation.detailDrawer.sampleDetails")}
            </div>
            <div className="space-y-3">
              {run.sampleResults.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-surface-secondary p-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary">
                        {item.question}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        {t("settings.evaluation.detailDrawer.sampleStatusLine", {
                          id: item.id,
                          status: t(
                            item.status === "success"
                              ? "settings.evaluation.detailDrawer.success"
                              : "settings.evaluation.detailDrawer.failure",
                          ),
                          latency: `${(item.latencyMs / 1000).toFixed(1)}s`,
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status === "success" ? "completed" : "failed"} />
                      <span className="rounded-full bg-surface-primary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                        {t("settings.evaluation.detailDrawer.recall")}{" "}
                        {formatPercent(item.recall)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-text-secondary md:grid-cols-2">
                    <div>
                      <span className="font-medium text-text-primary">
                        {t("settings.evaluation.detailDrawer.goldSources")}：
                      </span>
                      {item.goldSources.length > 0
                        ? item.goldSources.join("、")
                        : t("settings.evaluation.shared.noValue")}
                    </div>
                    <div>
                      <span className="font-medium text-text-primary">
                        {t("settings.evaluation.detailDrawer.matchedSources")}：
                      </span>
                      {item.matchedGoldSources.length > 0
                        ? item.matchedGoldSources.join("、")
                        : t("settings.evaluation.shared.noValue")}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-text-secondary md:grid-cols-3">
                    <div>
                      <span className="font-medium text-text-primary">
                        {t("settings.evaluation.detailDrawer.faithfulness")}：
                      </span>
                      {formatPercent(item.faithfulness)}
                    </div>
                    <div>
                      <span className="font-medium text-text-primary">
                        {t("settings.evaluation.detailDrawer.relevance")}：
                      </span>
                      {formatPercent(item.answerRelevance)}
                    </div>
                    <div>
                      <span className="font-medium text-text-primary">
                        {t("settings.evaluation.detailDrawer.completeness")}：
                      </span>
                      {formatPercent(item.answerCompleteness)}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      {t("settings.evaluation.detailDrawer.retrievedSources")}
                    </div>
                    {item.retrievedSources.length > 0 ? (
                      <div className="space-y-2">
                        {item.retrievedSources.map((source, index) => (
                          <div
                            key={`${item.id}-${source.documentName}-${index}`}
                            className="rounded-lg border border-border bg-surface-primary px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium text-text-primary">
                                {source.documentName}
                              </span>
                              {typeof source.score === "number" ? (
                                <span className="text-text-secondary">
                                  score {source.score.toFixed(3)}
                                </span>
                              ) : null}
                            </div>
                            {source.contentPreview ? (
                              <div className="mt-1 text-xs leading-5 text-text-secondary">
                                {source.contentPreview}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-text-secondary">
                        {t("settings.evaluation.detailDrawer.noRetrievedSources")}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      {t("settings.evaluation.detailDrawer.attempts")}
                    </div>
                    <div className="space-y-2">
                      {item.attempts.map((attempt) => (
                        <div
                          key={`${item.id}-attempt-${attempt.attempt}`}
                          className="rounded-lg border border-border bg-surface-primary px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-text-primary">
                              {t("settings.evaluation.detailDrawer.attempt", {
                                count: attempt.attempt,
                              })}
                            </span>
                            <span className="text-text-secondary">
                              {t(
                                attempt.status === "success"
                                  ? "settings.evaluation.detailDrawer.success"
                                  : "settings.evaluation.detailDrawer.failure",
                              )}
                            </span>
                            <span className="text-text-secondary">
                              {(attempt.latencyMs / 1000).toFixed(1)}s
                            </span>
                            <span className="text-text-secondary">
                              {t("settings.evaluation.detailDrawer.attemptRecall", {
                                value: formatPercent(attempt.recall),
                              })}
                            </span>
                            <span className="text-text-secondary">
                              {t(
                                "settings.evaluation.detailDrawer.attemptRelevance",
                                {
                                  value: formatPercent(attempt.answerRelevance),
                                },
                              )}
                            </span>
                            <span className="text-text-secondary">
                              {t(
                                "settings.evaluation.detailDrawer.attemptCompleteness",
                                {
                                  value: formatPercent(attempt.answerCompleteness),
                                },
                              )}
                            </span>
                          </div>
                          {attempt.errorMessage ? (
                            <div className="mt-1 text-xs leading-5 text-danger">
                              {attempt.errorMessage}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {item.errorMessage ? (
                    <div className="mt-3 text-xs leading-5 text-danger">
                      {item.errorMessage}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.evaluation.detailDrawer.runLogs")}
            </div>
            <div className="rounded-xl border border-border bg-[#0d1320] px-3.5 py-3 font-mono text-xs leading-6 text-slate-200">
              {run.logs.map((log) => (
                <div key={log.id}>
                  <span className="text-slate-400">[{log.timestamp}]</span> {log.text}
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {onDelete ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:bg-danger/5 hover:text-danger"
              disabled={deleting}
              onClick={() => onDelete(run)}
            >
              {deleting
                ? t("settings.evaluation.detailDrawer.deleting")
                : t("settings.evaluation.detailDrawer.deleteRecord")}
            </Button>
          ) : null}
          {onDownload ? (
            <Button variant="secondary" onClick={() => onDownload(run)}>
              <Download className="h-4 w-4" />
              {t("settings.evaluation.detailDrawer.downloadMarkdown")}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            {t("common.actions.close")}
          </Button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

export default DetailDrawer;
