import { Cable, ScanSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Alert, TextInput } from "@/shared/ui";
import type {
  ComfyUiFlowAsset,
  ComfyUiNodeMapping,
  ComfyUiNodeSummary,
} from "../model/comfyui-workbench";

interface ComfyUiNodeMappingCardProps {
  selectedFlow: ComfyUiFlowAsset | null;
  nodes: ComfyUiNodeSummary[];
  running: boolean;
  onMappingChange: (nextMapping: ComfyUiNodeMapping) => void;
}

const NodeChip = ({ node }: { node: ComfyUiNodeSummary }) => (
  <div className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-2">
    <div className="flex items-center gap-2">
      <Badge variant="neutral" size="sm">
        {node.id}
      </Badge>
      <div className="text-sm font-medium text-text-primary">{node.title}</div>
    </div>
    <div className="mt-1 text-xs text-text-secondary">{node.classType}</div>
  </div>
);

export default function ComfyUiNodeMappingCard({
  selectedFlow,
  nodes,
  running,
  onMappingChange,
}: ComfyUiNodeMappingCardProps) {
  const { t } = useTranslation();

  if (!selectedFlow) {
    return null;
  }

  const mapping = selectedFlow.mapping;

  const updateField =
    (field: keyof ComfyUiNodeMapping) =>
    (value: string) => {
      onMappingChange({
        ...mapping,
        [field]: value,
      });
    };

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.nodeMapping.title")}
        </div>
      </div>

      <Alert
        variant="info"
        title={t(
          "settings.microApps.imageGenerationStudio.cards.nodeMapping.ruleTitle",
        )}
      >
        {t(
          "settings.microApps.imageGenerationStudio.cards.nodeMapping.ruleDescription",
        )}
      </Alert>

      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.mapping.fields.promptPath")}
          value={mapping.promptPath}
          onChange={updateField("promptPath")}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.mapping.placeholders.promptPath",
          )}
          disabled={running}
        />
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.mapping.fields.seedPath")}
          value={mapping.seedPath}
          onChange={updateField("seedPath")}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.mapping.placeholders.seedPath",
          )}
          disabled={running}
        />
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.mapping.fields.widthPath")}
          value={mapping.widthPath}
          onChange={updateField("widthPath")}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.mapping.placeholders.widthPath",
          )}
          disabled={running}
        />
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.mapping.fields.heightPath")}
          value={mapping.heightPath}
          onChange={updateField("heightPath")}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.mapping.placeholders.heightPath",
          )}
          disabled={running}
        />
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.mapping.fields.outputNodeId")}
          value={mapping.outputNodeId}
          onChange={updateField("outputNodeId")}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.mapping.placeholders.outputNodeId",
          )}
          disabled={running}
        />
        <TextInput
          label={t("settings.microApps.imageGenerationStudio.mapping.fields.previewNodeId")}
          value={mapping.previewNodeId}
          onChange={updateField("previewNodeId")}
          placeholder={t(
            "settings.microApps.imageGenerationStudio.mapping.placeholders.previewNodeId",
          )}
          disabled={running}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div className="rounded-ui-panel border border-border bg-surface-secondary/20 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Cable className="h-4 w-4 text-icon-secondary" />
            {t("settings.microApps.imageGenerationStudio.mapping.summary.title")}
          </div>
          <div className="mt-3 space-y-2 text-sm text-text-secondary">
            <div>
              {t("settings.microApps.imageGenerationStudio.mapping.summary.input")}
              {" "}
              {mapping.promptPath || "—"} / {mapping.seedPath || "—"} /{" "}
              {mapping.widthPath || "—"} + {mapping.heightPath || "—"}
            </div>
            <div>
              {t("settings.microApps.imageGenerationStudio.mapping.summary.output")}
              {" "}
              {mapping.outputNodeId || "—"}
            </div>
            <div>
              {t("settings.microApps.imageGenerationStudio.mapping.summary.preview")}
              {" "}
              {mapping.previewNodeId || "—"}
            </div>
          </div>
        </div>

        <div className="rounded-ui-panel border border-border bg-surface-secondary/20 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <ScanSearch className="h-4 w-4 text-icon-secondary" />
            {t("settings.microApps.imageGenerationStudio.mapping.nodes.title")}
          </div>
          <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
            {nodes.length > 0 ? (
              nodes.map((node) => <NodeChip key={node.id} node={node} />)
            ) : (
              <div className="rounded-ui-panel border border-dashed border-border px-3 py-4 text-sm text-text-secondary">
                {t("settings.microApps.imageGenerationStudio.mapping.nodes.empty")}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
