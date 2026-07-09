import { ImageOff, SearchCode, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import type {
  ResultProgressMetadata,
  ResultMetadata,
  StudioPreviewStatus,
} from "../model/view-model";

interface ResultPreviewCardProps {
  previewStatus: StudioPreviewStatus;
  result: ResultMetadata | null;
  progress?: ResultProgressMetadata;
}

export default function ResultPreviewCard({
  previewStatus,
  result,
  progress = {
    status: null,
    progressPercent: 0,
    stage: "",
  },
}: ResultPreviewCardProps) {
  const { t } = useTranslation();
  const normalizedPercent = Math.max(0, Math.min(100, progress.progressPercent));
  const progressLabel =
    progress.status === "queued"
      ? "准备中"
      : progress.status === "running"
        ? "生成中"
        : progress.status === "succeeded"
          ? "已完成"
          : progress.status === "failed"
            ? "失败"
            : progress.status === "blocked"
              ? "阻塞"
              : progress.status === "cancelled"
                ? "已取消"
                : "处理中";

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.preview.title")}
        </div>
      </div>

      {previewStatus === "empty" ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-6 text-center">
          <ImageOff className="h-10 w-10 text-icon-secondary" />
          <div className="text-sm font-medium text-text-primary">
            {t("settings.microApps.imageGenerationStudio.results.emptyTitle")}
          </div>
          <div className="max-w-md text-sm leading-6 text-text-secondary">
            {t("settings.microApps.imageGenerationStudio.results.emptyDescription")}
          </div>
        </div>
      ) : null}

      {previewStatus === "preview-loading" ? (
        <div className="space-y-5 rounded-ui-panel border border-border bg-surface-secondary/20 p-5">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-text-primary">
                {progressLabel}
              </div>
              <div className="text-xs text-text-secondary">
                {progress.message || progress.stage || "等待返回结果"}
              </div>
            </div>
            <div className="text-2xl font-semibold text-text-primary tabular-nums">
              {normalizedPercent}%
            </div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-tertiary/80">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${normalizedPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {previewStatus === "preview-ready" && result ? (
        <div>
          <div className="overflow-hidden rounded-ui-panel border border-border bg-surface-secondary/20">
            {result.previewSrc ? (
              <img
                src={result.previewSrc}
                alt={t("settings.microApps.imageGenerationStudio.results.previewAlt")}
                className="block h-auto w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Sparkles className="h-9 w-9 text-icon-secondary" />
                <div className="text-sm font-medium text-text-primary">
                  {t("settings.microApps.imageGenerationStudio.results.previewUnavailableTitle")}
                </div>
                <div className="max-w-md text-sm leading-6 text-text-secondary">
                  {t(
                    result.previewUnavailableReason ??
                      "settings.microApps.imageGenerationStudio.results.previewUnavailableNoUrl",
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {previewStatus === "preview-failed" && result ? (
        <div className="flex min-h-[280px] flex-col justify-between rounded-ui-panel border border-danger-border bg-danger-soft p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-danger-text">
              <SearchCode className="h-5 w-5" />
              <div className="text-base font-semibold">
                {t("settings.microApps.imageGenerationStudio.results.failedTitle")}
              </div>
            </div>
            {result.errorMessage ? (
              <div className="px-1 py-1 text-sm leading-7 whitespace-pre-wrap break-words text-danger-text">
                {result.errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
