import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { Select, TextArea, TextInput } from "@/shared/ui";
import Badge from "@/shared/ui/Badge";
import type { PromptFormValue } from "../model/view-model";
import {
  sizeOptions,
  stylePresetOptions,
} from "../model/view-model";

interface PromptRequestCardProps {
  value: PromptFormValue;
  running: boolean;
  invalid: boolean;
  onChange: (value: PromptFormValue) => void;
}

export default function PromptRequestCard({
  value,
  running,
  invalid,
  onChange,
}: PromptRequestCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-text-primary">
            {t("settings.microApps.imageGenerationStudio.cards.prompt.title")}
          </div>
          <div className="text-sm text-text-secondary">
            {t("settings.microApps.imageGenerationStudio.cards.prompt.description")}
          </div>
        </div>
        <Badge variant="neutral" size="sm">
          {t("settings.microApps.imageGenerationStudio.countFixed")}
        </Badge>
      </div>

      <TextArea
        label={t("settings.microApps.imageGenerationStudio.fields.prompt")}
        value={value.prompt}
        onChange={(prompt) => onChange({ ...value, prompt })}
        placeholder={t("settings.microApps.imageGenerationStudio.placeholders.prompt")}
        rows={6}
        disabled={running}
        error={
          invalid
            ? t("settings.microApps.imageGenerationStudio.validation.promptRequired")
            : undefined
        }
      />

      <TextArea
        label={t("settings.microApps.imageGenerationStudio.fields.negativePrompt")}
        value={value.negativePrompt}
        onChange={(negativePrompt) => onChange({ ...value, negativePrompt })}
        placeholder={t(
          "settings.microApps.imageGenerationStudio.placeholders.negativePrompt",
        )}
        rows={3}
        disabled={running}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label={t("settings.microApps.imageGenerationStudio.fields.size")}
          value={value.size}
          onChange={(size) => onChange({ ...value, size })}
          options={sizeOptions.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          disabled={running}
        />
        <Select
          label={t("settings.microApps.imageGenerationStudio.fields.stylePreset")}
          value={value.stylePreset}
          onChange={(stylePreset) => onChange({ ...value, stylePreset })}
          options={stylePresetOptions.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          disabled={running}
        />
      </div>

      <details className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-text-primary">
          {t("settings.microApps.imageGenerationStudio.advanced.title")}
        </summary>
        <div className="mt-3 grid gap-3">
          <TextInput
            label={t("settings.microApps.imageGenerationStudio.fields.seed")}
            value={value.seed}
            onChange={(seed) => onChange({ ...value, seed })}
            placeholder={t("settings.microApps.imageGenerationStudio.placeholders.seed")}
            disabled={running}
          />
          <TextInput
            label={t("settings.microApps.imageGenerationStudio.fields.providerParam")}
            value={value.providerParam}
            onChange={(providerParam) => onChange({ ...value, providerParam })}
            placeholder={t(
              "settings.microApps.imageGenerationStudio.placeholders.providerParam",
            )}
            disabled={running}
          />
        </div>
      </details>

      <div className="rounded-ui-panel border border-info-border bg-info-soft px-3 py-2.5 text-sm text-info-text">
        <span className="font-medium">
          {t("settings.microApps.imageGenerationStudio.cards.prompt.countTitle")}
        </span>
        {" "}
        {t("settings.microApps.imageGenerationStudio.cards.prompt.countDescription")}
      </div>
    </Card>
  );
}
