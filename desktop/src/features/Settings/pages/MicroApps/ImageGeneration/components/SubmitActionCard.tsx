import { Loader2, RotateCcw, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui";
import type {
  StudioFormStatus,
  StudioPageStatus,
} from "../model/view-model";

interface SubmitActionCardProps {
  formStatus: StudioFormStatus;
  pageStatus: StudioPageStatus;
  running: boolean;
  canCancel: boolean;
  onSubmit: () => void;
  onReset: () => void;
  onCancel: () => void;
}

const formStatusTone = (status: StudioFormStatus) => {
  if (status === "invalid") {
    return "danger";
  }
  if (status === "dirty") {
    return "warning";
  }
  if (status === "locked-by-running-job") {
    return "primary";
  }
  return "neutral";
};

export default function SubmitActionCard({
  formStatus,
  pageStatus,
  running,
  canCancel,
  onSubmit,
  onReset,
  onCancel,
}: SubmitActionCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.actions.title")}
        </div>
        <div className="text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.cards.actions.description")}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={formStatusTone(formStatus)} size="sm">
          {t(`settings.microApps.imageGenerationStudio.formStatus.${formStatus}`)}
        </Badge>
        <Badge variant="neutral" size="sm">
          {t(`settings.microApps.imageGenerationStudio.pageStatus.${pageStatus}`)}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={formStatus === "invalid" || running}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("settings.microApps.imageGenerationStudio.actions.submit")}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={running}>
          <RotateCcw className="h-4 w-4" />
          {t("settings.microApps.imageGenerationStudio.actions.reset")}
        </Button>
        {running ? (
          <Button
            variant="danger-outline"
            onClick={onCancel}
            disabled={!canCancel}
          >
            <Square className="h-4 w-4" />
            {t("settings.microApps.imageGenerationStudio.actions.cancel")}
          </Button>
        ) : null}
      </div>

      {running && !canCancel ? (
        <div className="rounded-ui-panel border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-text">
          {t("settings.microApps.imageGenerationStudio.messages.cancelUnavailable")}
        </div>
      ) : null}

      {formStatus === "dirty" ? (
        <div className="rounded-ui-panel border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-text">
          {t("settings.microApps.imageGenerationStudio.messages.formDirty")}
        </div>
      ) : null}
    </Card>
  );
}
