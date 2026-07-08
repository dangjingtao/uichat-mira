import { ImageOff, SearchCode, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Skeleton from "@/shared/ui/Skeleton";
import type {
  ResultMetadata,
  StudioPreviewStatus,
} from "../model/view-model";

interface ResultPreviewCardProps {
  previewStatus: StudioPreviewStatus;
  result: ResultMetadata | null;
}

export default function ResultPreviewCard({
  previewStatus,
  result,
}: ResultPreviewCardProps) {
  const { t } = useTranslation();

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
        <div className="space-y-3">
          <Skeleton className="h-[280px] rounded-ui-panel" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-16 rounded-ui-panel" />
            <Skeleton className="h-16 rounded-ui-panel" />
            <Skeleton className="h-16 rounded-ui-panel" />
          </div>
        </div>
      ) : null}

      {previewStatus === "preview-ready" && result ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-ui-panel border border-border bg-surface-secondary/20">
            {result.previewSrc ? (
              <img
                src={result.previewSrc}
                alt={t("settings.microApps.imageGenerationStudio.results.previewAlt")}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 px-6 text-center">
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.08em] text-text-tertiary">
                {t("settings.microApps.imageGenerationStudio.results.size")}
              </div>
              <div className="mt-1 text-sm font-medium text-text-primary">
                {result.width} × {result.height}
              </div>
            </div>
            <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.08em] text-text-tertiary">
                {t("settings.microApps.imageGenerationStudio.results.source")}
              </div>
              <div className="mt-1 text-sm font-medium text-text-primary">
                {result.artifactFileName ?? result.source}
              </div>
            </div>
            <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.08em] text-text-tertiary">
                {t("settings.microApps.imageGenerationStudio.results.generatedAt")}
              </div>
              <div className="mt-1 text-sm font-medium text-text-primary">
                {new Date(result.generatedAt).toLocaleTimeString()}
              </div>
            </div>
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
