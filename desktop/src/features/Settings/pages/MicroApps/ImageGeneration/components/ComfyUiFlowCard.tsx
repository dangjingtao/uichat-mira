import { Braces, FilePlus2, Pencil, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Button, FileUploadDropzone, Select, TextArea, TextInput } from "@/shared/ui";
import type { WorkflowJsonStatus } from "../model/view-model";
import type { ComfyUiFlowAsset } from "../model/comfyui-workbench";

interface ComfyUiFlowCardProps {
  flows: ComfyUiFlowAsset[];
  selectedFlowId: string;
  selectedFlow: ComfyUiFlowAsset | null;
  flowNoteDraft: string;
  jsonStatus: WorkflowJsonStatus;
  running: boolean;
  editingFlowMeta: boolean;
  onSelectFlow: (id: string) => void;
  onUploadFlow: (files: FileList | null) => void;
  onCreateFlow: () => void;
  onStartEditFlowMeta: () => void;
  onCancelEditFlowMeta: () => void;
  onFlowNoteDraftChange: (value: string) => void;
  onSaveFlowMeta: () => void;
  onWorkflowJsonChange: (value: string) => void;
}

const sourceKeyByValue: Record<ComfyUiFlowAsset["source"], string> = {
  template: "template",
  upload: "upload",
  manual: "manual",
};

const jsonStatusVariant = (status: WorkflowJsonStatus) => {
  if (status === "valid") {
    return "success";
  }
  if (status === "invalid-json" || status === "invalid-comfyui-format") {
    return "danger";
  }
  return "neutral";
};

export default function ComfyUiFlowCard({
  flows,
  selectedFlowId,
  selectedFlow,
  flowNoteDraft,
  jsonStatus,
  running,
  editingFlowMeta,
  onSelectFlow,
  onUploadFlow,
  onCreateFlow,
  onStartEditFlowMeta,
  onCancelEditFlowMeta,
  onFlowNoteDraftChange,
  onSaveFlowMeta,
  onWorkflowJsonChange,
}: ComfyUiFlowCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.flow.title")}
        </div>
        <div className="text-sm leading-6 text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.cards.flow.description")}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Select
          label={t("settings.microApps.imageGenerationStudio.flow.fields.select")}
          value={selectedFlowId}
          onChange={onSelectFlow}
          disabled={running}
          options={[
            {
              value: "",
              label: t(
                "settings.microApps.imageGenerationStudio.flow.placeholders.select",
              ),
            },
            ...flows.map((flow) => ({
              value: flow.id,
              label: flow.name,
            })),
          ]}
        />
        <div className="pt-7">
          <FileUploadDropzone
            className="min-w-[160px]"
            onSelectFiles={onUploadFlow}
            accept=".json,application/json"
            maxCount={1}
            disabled={running}
            helperText={t(
              "settings.microApps.imageGenerationStudio.cards.workflow.uploadHint",
            )}
          />
        </div>
        <div className="pt-7">
          <Button variant="outline" onClick={onCreateFlow} disabled={running}>
            <FilePlus2 className="h-4 w-4" />
            {t("settings.microApps.imageGenerationStudio.flow.actions.new")}
          </Button>
        </div>
      </div>

      {selectedFlow ? (
        <div className="space-y-3 rounded-ui-panel border border-border bg-surface-secondary/20 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Workflow className="h-4.5 w-4.5 text-icon-secondary" />
                <span className="text-sm font-medium text-text-primary">
                  {selectedFlow.name}
                </span>
              </div>
              {!editingFlowMeta ? (
                <div className="text-sm leading-6 text-text-secondary">
                  {selectedFlow.note}
                </div>
              ) : (
                <div className="max-w-xl">
                  <TextInput
                    value={flowNoteDraft}
                    onChange={onFlowNoteDraftChange}
                    disabled={running}
                  />
                </div>
              )}
            </div>
            <Badge variant="neutral" size="sm">
              {t(
                `settings.microApps.imageGenerationStudio.flow.sources.${sourceKeyByValue[selectedFlow.source]}`,
              )}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-text-tertiary">
              {t("settings.microApps.imageGenerationStudio.flow.fields.updatedAt")}
              {" "}
              {selectedFlow.updatedAt}
            </div>
            {!editingFlowMeta ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="link"
                  onClick={onStartEditFlowMeta}
                  disabled={running}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("settings.microApps.imageGenerationStudio.flow.actions.edit")}
                </Button>
                <Button variant="link" disabled>
                  <Braces className="h-3.5 w-3.5" />
                  {t("settings.microApps.imageGenerationStudio.flow.actions.inspect")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={onSaveFlowMeta} disabled={running}>
                  {t("settings.microApps.imageGenerationStudio.flow.actions.save")}
                </Button>
                <Button
                  variant="link"
                  onClick={onCancelEditFlowMeta}
                  disabled={running}
                >
                  {t("settings.microApps.imageGenerationStudio.flow.actions.cancel")}
                </Button>
              </div>
            )}
          </div>

          <TextArea
            label={t("settings.microApps.imageGenerationStudio.flow.fields.rawJson")}
            value={selectedFlow.rawJson}
            onChange={onWorkflowJsonChange}
            placeholder={t(
              "settings.microApps.imageGenerationStudio.flow.placeholders.rawJson",
            )}
            rows={10}
            disabled={running}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={jsonStatusVariant(jsonStatus)} size="sm">
              {t("settings.microApps.imageGenerationStudio.workflowJsonStatus.title")}
            </Badge>
            <div className="text-sm text-text-secondary">
              {t(
                `settings.microApps.imageGenerationStudio.workflowJsonStatus.${jsonStatus}`,
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-4 py-6 text-sm leading-6 text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.flow.messages.empty")}
        </div>
      )}
    </Card>
  );
}
