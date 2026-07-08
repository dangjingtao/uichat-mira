import { Cable, FilePlus2, Loader2, Pencil, RotateCcw, ScanSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import { Button, Select, TextInput } from "@/shared/ui";
import type {
  ComfyUiConnectionStatus,
  ComfyUiFlowAsset,
  ComfyUiNodeMapping,
  ComfyUiNodeSummary,
} from "../model/comfyui-workbench";

interface ComfyUiSetupCardProps {
  connectionStatus: ComfyUiConnectionStatus;
  connectionAddress: string;
  editingConnection: boolean;
  draftConnectionAddress: string;
  testingConnection: boolean;
  selectedFlowId: string;
  selectedFlow: ComfyUiFlowAsset | null;
  nodes: ComfyUiNodeSummary[];
  running: boolean;
  flows: ComfyUiFlowAsset[];
  onDraftConnectionAddressChange: (value: string) => void;
  onStartCreateConnection: () => void;
  onStartEditConnection: () => void;
  onSaveConnection: () => void;
  onTestConnection: () => void;
  onSelectFlow: (id: string) => void;
  onCreateFlow: () => void;
  onEditFlow: () => void;
  onMappingChange: (nextMapping: ComfyUiNodeMapping) => void;
}

const connectionStatusVariant = (status: ComfyUiConnectionStatus) => {
  if (status === "connectable") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  if (status === "unverified") {
    return "warning";
  }
  return "neutral";
};

const NodeChip = ({ node }: { node: ComfyUiNodeSummary }) => (
  <div className="py-3">
    <div className="flex items-center gap-2 text-sm text-text-primary">
      <Badge variant="neutral" size="sm">
        {node.id}
      </Badge>
      <div className="font-medium">{node.title}</div>
    </div>
    <div className="mt-1 pl-8 text-xs text-text-secondary">{node.classType}</div>
  </div>
);

export default function ComfyUiSetupCard({
  connectionStatus,
  connectionAddress,
  editingConnection,
  draftConnectionAddress,
  testingConnection,
  selectedFlowId,
  selectedFlow,
  nodes,
  running,
  flows,
  onDraftConnectionAddressChange,
  onStartCreateConnection,
  onStartEditConnection,
  onSaveConnection,
  onTestConnection,
  onSelectFlow,
  onCreateFlow,
  onEditFlow,
  onMappingChange,
}: ComfyUiSetupCardProps) {
  const { t } = useTranslation();
  const mapping = selectedFlow?.mapping;
  const saveConnectionDisabled = running || !draftConnectionAddress.trim() || testingConnection;

  const updateMappingField =
    (field: keyof ComfyUiNodeMapping) =>
    (value: string) => {
      if (!mapping) {
        return;
      }
      onMappingChange({
        ...mapping,
        [field]: value,
      });
    };

  return (
    <Card className="space-y-5">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-text-primary">
            {t("settings.microApps.imageGenerationStudio.cards.connection.title")}
          </div>
          <Badge variant={connectionStatusVariant(connectionStatus)} size="sm">
            {t(`settings.microApps.imageGenerationStudio.connection.status.${connectionStatus}`)}
          </Badge>
        </div>

        {!editingConnection ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex h-10 items-center rounded-ui-panel border border-border bg-surface-primary px-3">
                {connectionStatus === "unconfigured" ? (
                  <div className="truncate text-sm text-text-secondary">
                    {t("settings.microApps.imageGenerationStudio.connection.messages.empty")}
                  </div>
                ) : (
                  <a
                    href={connectionAddress}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-mono text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {connectionAddress}
                  </a>
                )}
              </div>
              {connectionStatus === "failed" ? (
                <div className="mt-1 text-xs text-danger-text">
                  {t("settings.microApps.imageGenerationStudio.connection.messages.failed")}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {connectionStatus === "unconfigured" ? (
                <Button size="sm" variant="primary" onClick={onStartCreateConnection} disabled={running}>
                  {t("settings.microApps.imageGenerationStudio.connection.actions.new")}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={onStartEditConnection} disabled={running}>
                    {t("settings.microApps.imageGenerationStudio.connection.actions.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant={connectionStatus === "failed" ? "primary" : "outline"}
                    onClick={onTestConnection}
                    disabled={running || testingConnection}
                  >
                    {testingConnection ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {t(
                      connectionStatus === "failed"
                        ? "settings.microApps.imageGenerationStudio.connection.actions.retry"
                        : "settings.microApps.imageGenerationStudio.connection.actions.test",
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <TextInput
                value={draftConnectionAddress}
                onChange={onDraftConnectionAddressChange}
                placeholder={t("settings.microApps.imageGenerationStudio.connection.placeholders.address")}
                compact
                disabled={running || testingConnection}
              />
            </div>
            <div className="shrink-0">
              <Button size="sm" variant="primary" onClick={onSaveConnection} disabled={saveConnectionDisabled}>
                {t("settings.microApps.imageGenerationStudio.connection.actions.save")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-border" />

      <section className="space-y-4">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.flow.title")}
        </div>

        <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <Select
              value={selectedFlowId}
              onChange={onSelectFlow}
              compact
              disabled={running}
              options={[
                {
                  value: "",
                  label: t("settings.microApps.imageGenerationStudio.flow.placeholders.select"),
                },
                ...flows.map((flow) => ({
                  value: flow.id,
                  label: flow.name,
                })),
              ]}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onEditFlow}
                disabled={running}
                aria-label={t("settings.microApps.imageGenerationStudio.flow.actions.edit")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateFlow}
                disabled={running}
                aria-label={t("settings.microApps.imageGenerationStudio.flow.actions.new")}
              >
                <FilePlus2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {selectedFlow ? (
        <section className="space-y-4">
          <div className="text-sm font-semibold text-text-primary">
            {t("settings.microApps.imageGenerationStudio.cards.nodeMapping.title")}
          </div>

          <div className="rounded-ui-panel border border-info-border bg-info-soft px-4 py-3 text-sm leading-6 text-text-secondary">
            {t("settings.microApps.imageGenerationStudio.cards.nodeMapping.ruleDescription")}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label={t("settings.microApps.imageGenerationStudio.mapping.fields.promptPath")}
              value={mapping?.promptPath ?? ""}
              onChange={updateMappingField("promptPath")}
              placeholder={t("settings.microApps.imageGenerationStudio.mapping.placeholders.promptPath")}
              compact
              disabled={running}
            />
            <TextInput
              label={t("settings.microApps.imageGenerationStudio.mapping.fields.seedPath")}
              value={mapping?.seedPath ?? ""}
              onChange={updateMappingField("seedPath")}
              placeholder={t("settings.microApps.imageGenerationStudio.mapping.placeholders.seedPath")}
              compact
              disabled={running}
            />
            <TextInput
              label={t("settings.microApps.imageGenerationStudio.mapping.fields.widthPath")}
              value={mapping?.widthPath ?? ""}
              onChange={updateMappingField("widthPath")}
              placeholder={t("settings.microApps.imageGenerationStudio.mapping.placeholders.widthPath")}
              compact
              disabled={running}
            />
            <TextInput
              label={t("settings.microApps.imageGenerationStudio.mapping.fields.heightPath")}
              value={mapping?.heightPath ?? ""}
              onChange={updateMappingField("heightPath")}
              placeholder={t("settings.microApps.imageGenerationStudio.mapping.placeholders.heightPath")}
              compact
              disabled={running}
            />
            <TextInput
              label={t("settings.microApps.imageGenerationStudio.mapping.fields.outputNodeId")}
              value={mapping?.outputNodeId ?? ""}
              onChange={updateMappingField("outputNodeId")}
              placeholder={t("settings.microApps.imageGenerationStudio.mapping.placeholders.outputNodeId")}
              compact
              disabled={running}
            />
            <TextInput
              label={t("settings.microApps.imageGenerationStudio.mapping.fields.previewNodeId")}
              value={mapping?.previewNodeId ?? ""}
              onChange={updateMappingField("previewNodeId")}
              placeholder={t("settings.microApps.imageGenerationStudio.mapping.placeholders.previewNodeId")}
              compact
              disabled={running}
            />
          </div>

          <div className="grid gap-3">
            <div className="rounded-ui-panel border border-border bg-surface-secondary/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Cable className="h-4 w-4 text-icon-secondary" />
                {t("settings.microApps.imageGenerationStudio.mapping.summary.title")}
              </div>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <div>
                  {t("settings.microApps.imageGenerationStudio.mapping.summary.input")}{" "}
                  {mapping?.promptPath || "—"} / {mapping?.seedPath || "—"} / {mapping?.widthPath || "—"} + {mapping?.heightPath || "—"}
                </div>
                <div>
                  {t("settings.microApps.imageGenerationStudio.mapping.summary.output")}{" "}
                  {mapping?.outputNodeId || "—"}
                </div>
                <div>
                  {t("settings.microApps.imageGenerationStudio.mapping.summary.preview")}{" "}
                  {mapping?.previewNodeId || "—"}
                </div>
              </div>
            </div>

            <div className="rounded-ui-panel border border-border bg-surface-secondary/20 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <ScanSearch className="h-4 w-4 text-icon-secondary" />
                {t("settings.microApps.imageGenerationStudio.mapping.nodes.title")}
              </div>
              <div className="mt-3 max-h-48 overflow-auto pr-1">
                {nodes.length > 0 ? (
                  <div className="divide-y divide-border">
                    {nodes.map((node) => (
                      <NodeChip key={node.id} node={node} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-ui-panel border border-dashed border-border px-3 py-4 text-sm text-text-secondary">
                    {t("settings.microApps.imageGenerationStudio.mapping.nodes.empty")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </Card>
  );
}
