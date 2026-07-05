import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import SegmentedTabs from "@/shared/ui/SegmentedTabs";
import { Select, TextInput } from "@/shared/ui";
import Alert from "@/shared/ui/Alert";
import type {
  StudioMode,
  StudioProvider,
} from "../model/view-model";
import {
  promptProviderOptions,
  workflowProviderOptions,
} from "../model/view-model";

interface ModeProviderCardProps {
  mode: StudioMode;
  provider: StudioProvider;
  model: string;
  running: boolean;
  onModeChange: (mode: StudioMode) => void;
  onProviderChange: (provider: StudioProvider) => void;
  onModelChange: (value: string) => void;
}

export default function ModeProviderCard({
  mode,
  provider,
  model,
  running,
  onModeChange,
  onProviderChange,
  onModelChange,
}: ModeProviderCardProps) {
  const { t } = useTranslation();

  const options = useMemo(
    () => (mode === "prompt" ? promptProviderOptions : workflowProviderOptions),
    [mode],
  );

  const helperKey =
    mode === "workflow"
      ? "settings.microApps.imageGenerationStudio.environment.workflowHint"
      : `settings.microApps.imageGenerationStudio.environment.${provider}`;

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.modeProvider.title")}
        </div>
        <div className="text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.cards.modeProvider.description")}
        </div>
      </div>

      <SegmentedTabs
        value={mode}
        onChange={onModeChange}
        items={[
          {
            value: "prompt",
            label: t("settings.microApps.imageGenerationStudio.modes.prompt"),
          },
          {
            value: "workflow",
            label: t("settings.microApps.imageGenerationStudio.modes.workflow"),
          },
        ]}
      />

      <Select
        label={t("settings.microApps.imageGenerationStudio.fields.provider")}
        value={provider}
        onChange={(value) => onProviderChange(value as StudioProvider)}
        options={options.map((option) => ({
          value: option.value,
          label: t(option.labelKey),
        }))}
        disabled={running || mode === "workflow"}
      />

      <div className="grid gap-2">
        {options.map((option) => {
          const active = option.value === provider;
          return (
            <div
              key={option.value}
              className={`rounded-ui-panel border px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "border-primary/30 bg-primary/5 text-text-primary"
                  : "border-border bg-surface-secondary/30 text-text-secondary"
              }`}
            >
              <div className="font-medium">{t(option.labelKey)}</div>
              <div className="mt-1 text-xs leading-5">{t(option.descriptionKey)}</div>
            </div>
          );
        })}
      </div>

      <TextInput
        label={t("settings.microApps.imageGenerationStudio.fields.model")}
        value={model}
        onChange={onModelChange}
        disabled={running}
        placeholder={t("settings.microApps.imageGenerationStudio.placeholders.model")}
      />

      <Alert variant="info" title={t("settings.microApps.imageGenerationStudio.environment.title")}>
        {t(helperKey)}
      </Alert>
    </Card>
  );
}
