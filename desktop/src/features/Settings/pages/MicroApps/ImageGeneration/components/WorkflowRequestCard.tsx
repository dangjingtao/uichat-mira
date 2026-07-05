import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { Alert, FileUploadDropzone, TextArea, TextInput } from "@/shared/ui";
import type {
  WorkflowFormValue,
  WorkflowJsonStatus,
} from "../model/view-model";

interface WorkflowRequestCardProps {
  value: WorkflowFormValue;
  running: boolean;
  jsonStatus: WorkflowJsonStatus;
  onChange: (value: WorkflowFormValue) => void;
}

const workflowJsonTone = (status: WorkflowJsonStatus) => {
  if (status === "valid") {
    return "success";
  }
  if (status === "invalid-json" || status === "invalid-comfyui-format") {
    return "danger";
  }
  return "info";
};

export default function WorkflowRequestCard({
  value,
  running,
  jsonStatus,
  onChange,
}: WorkflowRequestCardProps) {
  const { t } = useTranslation();

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.item(0);
    if (!file) {
      return;
    }

    void file.text().then((workflowJson) => {
      onChange({ ...value, workflowJson });
    });
  };

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.workflow.title")}
        </div>
        <div className="text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.cards.workflow.description")}
        </div>
      </div>

      <TextArea
        label={t("settings.microApps.imageGenerationStudio.fields.workflowJson")}
        value={value.workflowJson}
        onChange={(workflowJson) => onChange({ ...value, workflowJson })}
        placeholder={t(
          "settings.microApps.imageGenerationStudio.placeholders.workflowJson",
        )}
        rows={10}
        disabled={running}
      />

      <FileUploadDropzone
        onSelectFiles={handleFileSelect}
        accept=".json,application/json"
        maxCount={1}
        disabled={running}
        helperText={t(
          "settings.microApps.imageGenerationStudio.cards.workflow.uploadHint",
        )}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.fields.overridePrompt")}
          value={value.overridePrompt}
          onChange={(overridePrompt) => onChange({ ...value, overridePrompt })}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.placeholders.overridePrompt",
          )}
          disabled={running}
        />
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.fields.overrideSeed")}
          value={value.overrideSeed}
          onChange={(overrideSeed) => onChange({ ...value, overrideSeed })}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.placeholders.overrideSeed",
          )}
          disabled={running}
        />
      </div>

      <Alert
        variant={workflowJsonTone(jsonStatus)}
        title={t("settings.microApps.imageGenerationStudio.workflowJsonStatus.title")}
      >
        {t(
          `settings.microApps.imageGenerationStudio.workflowJsonStatus.${jsonStatus}`,
        )}
      </Alert>
    </Card>
  );
}
