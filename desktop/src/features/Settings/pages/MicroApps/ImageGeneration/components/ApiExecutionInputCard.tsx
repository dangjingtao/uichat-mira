import { Loader2, RotateCcw, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { Button, Select, TextArea, TextInput } from "@/shared/ui";
import type { PromptFormValue, StudioFormStatus } from "../model/view-model";
import type { ApiImageSizeOption } from "./ApiProviderStatusCard";

interface ApiExecutionInputCardProps {
  value: PromptFormValue;
  formStatus: StudioFormStatus;
  running: boolean;
  canCancel: boolean;
  configured: boolean;
  sizeOptions: ApiImageSizeOption[];
  sizeValidationMessage?: string;
  onChange: (value: PromptFormValue) => void;
  onSubmit: () => void;
  onReset: () => void;
  onCancel: () => void;
}

export default function ApiExecutionInputCard({
  value,
  formStatus,
  running,
  canCancel,
  configured,
  sizeOptions,
  sizeValidationMessage,
  onChange,
  onSubmit,
  onReset,
  onCancel,
}: ApiExecutionInputCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="text-sm font-semibold text-text-primary">执行输入</div>

      <div className="grid gap-3">
        <TextArea
          label={t("settings.microApps.imageGenerationStudio.fields.prompt")}
          value={value.prompt}
          onChange={(prompt) => onChange({ ...value, prompt })}
          placeholder={t("settings.microApps.imageGenerationStudio.placeholders.prompt")}
          rows={5}
          compact
          disabled={running || !configured}
        />

        <TextArea
          label={t("settings.microApps.imageGenerationStudio.fields.negativePrompt")}
          value={value.negativePrompt}
          onChange={(negativePrompt) => onChange({ ...value, negativePrompt })}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.placeholders.negativePrompt",
          )}
          rows={3}
          compact
          disabled={running || !configured}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label={t("settings.microApps.imageGenerationStudio.fields.size")}
            value={value.size}
            onChange={(size) => onChange({ ...value, size })}
            compact
            disabled={running || !configured}
            options={sizeOptions}
          />

          <TextInput
            label={t("settings.microApps.imageGenerationStudio.fields.seed")}
            value={value.seed}
            onChange={(seed) => onChange({ ...value, seed })}
            placeholder={t("settings.microApps.imageGenerationStudio.placeholders.seed")}
            compact
            disabled={running || !configured}
          />
        </div>

        <TextInput
          label={t("settings.microApps.imageGenerationStudio.fields.providerParam")}
          value={value.providerParam}
          onChange={(providerParam) => onChange({ ...value, providerParam })}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.placeholders.providerParam",
          )}
          compact
          disabled={running || !configured}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={
              !configured ||
              formStatus === "invalid" ||
              running ||
              Boolean(sizeValidationMessage)
            }
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

        {!configured ? (
          <div className="rounded-ui-panel border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-text">
            请先在模型设置里配置默认生图模型和可用密钥。
          </div>
        ) : null}

        {sizeValidationMessage ? (
          <div className="rounded-ui-panel border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-text">
            {sizeValidationMessage}
          </div>
        ) : null}

        {running && !canCancel ? (
          <div className="rounded-ui-panel border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-text">
            {t("settings.microApps.imageGenerationStudio.messages.cancelUnavailable")}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
