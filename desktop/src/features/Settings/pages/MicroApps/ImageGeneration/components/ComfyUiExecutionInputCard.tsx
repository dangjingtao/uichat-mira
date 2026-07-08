import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { Alert, TextArea, TextInput } from "@/shared/ui";

interface ComfyUiExecutionInputCardProps {
  overridePrompt: string;
  overrideSeed: string;
  running: boolean;
  onOverridePromptChange: (value: string) => void;
  onOverrideSeedChange: (value: string) => void;
}

export default function ComfyUiExecutionInputCard({
  overridePrompt,
  overrideSeed,
  running,
  onOverridePromptChange,
  onOverrideSeedChange,
}: ComfyUiExecutionInputCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t(
            "settings.microApps.imageGenerationStudio.cards.executionInputs.title",
          )}
        </div>
        <div className="text-sm leading-6 text-text-secondary">
          {t(
            "settings.microApps.imageGenerationStudio.cards.executionInputs.description",
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
          disabled={running}
        />
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.fields.overrideSeed")}
          value={overrideSeed}
          onChange={onOverrideSeedChange}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.placeholders.overrideSeed",
          )}
          disabled={running}
        />
      </div>

      <Alert variant="info" title={t("settings.microApps.imageGenerationStudio.cards.executionInputs.noticeTitle")}>
        {t("settings.microApps.imageGenerationStudio.cards.executionInputs.noticeDescription")}
      </Alert>
    </Card>
  );
}

