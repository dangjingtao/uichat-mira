import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import type { SubmittedSnapshot, ResultMetadata } from "../model/view-model";

interface RequestSummaryCardProps {
  submittedSnapshot: SubmittedSnapshot | null;
  result: ResultMetadata | null;
}

const SummaryRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-2.5">
    <div className="text-xs uppercase tracking-[0.08em] text-text-tertiary">
      {label}
    </div>
    <div className="mt-1 break-words text-sm text-text-primary">{value}</div>
  </div>
);

export default function RequestSummaryCard({
  submittedSnapshot,
  result,
}: RequestSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.requestSummary.title")}
        </div>
        <div className="text-sm text-text-secondary">
          {t(
            "settings.microApps.imageGenerationStudio.cards.requestSummary.description",
          )}
        </div>
      </div>

      {!submittedSnapshot ? (
        <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-4 py-6 text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.summary.empty")}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.provider")}
            value={submittedSnapshot.provider}
          />
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.model")}
            value={submittedSnapshot.model}
          />
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.mode")}
            value={t(
              `settings.microApps.imageGenerationStudio.modes.${submittedSnapshot.mode}`,
            )}
          />
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.size")}
            value={submittedSnapshot.size}
          />
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.stylePreset")}
            value={submittedSnapshot.stylePreset}
          />
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.seed")}
            value={submittedSnapshot.seed || t("settings.microApps.imageGenerationStudio.summary.autoSeed")}
          />
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.providerJobId")}
            value={
              result?.providerJobId ??
              t("settings.microApps.imageGenerationStudio.summary.pending")
            }
          />
          <SummaryRow
            label={t("settings.microApps.imageGenerationStudio.fields.artifactId")}
            value={
              result?.artifactId ??
              t("settings.microApps.imageGenerationStudio.summary.pending")
            }
          />
          {submittedSnapshot.mode === "prompt" ? (
            <SummaryRow
              label={t("settings.microApps.imageGenerationStudio.fields.prompt")}
              value={submittedSnapshot.promptSummary || "—"}
            />
          ) : (
            <SummaryRow
              label={t("settings.microApps.imageGenerationStudio.fields.workflowJson")}
              value={submittedSnapshot.workflowSummary || "—"}
            />
          )}
        </div>
      )}
    </Card>
  );
}
