import { Loader2, RotateCcw, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { Button, Select, TextArea } from "@/shared/ui";
import { sizeOptions } from "../model/view-model";
import type { StudioFormStatus } from "../model/view-model";

interface ComfyUiExecutionInputCardProps {
  overridePrompt: string;
  overrideSize: string;
  formStatus: StudioFormStatus;
  running: boolean;
  canCancel: boolean;
  onOverridePromptChange: (value: string) => void;
  onOverrideSizeChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onCancel: () => void;
}

export default function ComfyUiExecutionInputCard({
  overridePrompt,
  overrideSize,
  formStatus,
  running,
  canCancel,
  onOverridePromptChange,
  onOverrideSizeChange,
  onSubmit,
  onReset,
  onCancel,
}: ComfyUiExecutionInputCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-text-primary">
          {t(
            "settings.microApps.imageGenerationStudio.cards.executionInputs.title",
          )}
        </div>
      </div>

      <div className="grid gap-3">
        <TextArea
          label={t(
            "settings.microApps.imageGenerationStudio.fields.overridePrompt",
          )}
          value={overridePrompt}
          onChange={onOverridePromptChange}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.placeholders.overridePrompt",
          )}
          rows={4}
          compact
          disabled={running}
        />
        <Select
          label={t("settings.microApps.imageGenerationStudio.fields.overrideSize")}
          value={overrideSize}
          onChange={onOverrideSizeChange}
          compact
          disabled={running}
          options={sizeOptions.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={formStatus === "invalid" || running}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("settings.microApps.imageGenerationStudio.actions.submit")}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} disabled={running}>
            <RotateCcw className="h-4 w-4" />
            {t("settings.microApps.imageGenerationStudio.actions.reset")}
          </Button>
          {running && canCancel ? (
            <Button variant="danger-outline" size="sm" onClick={onCancel}>
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
      </div>
    </Card>
  );
}
