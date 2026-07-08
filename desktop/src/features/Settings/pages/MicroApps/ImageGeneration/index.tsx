import { useEffect, useState } from "react";
import { ImageIcon, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import NavigationCardTabs from "@/shared/ui/NavigationCardTabs";
import { Button, Modal, TextArea, TextInput } from "@/shared/ui";
import {
  createComfyUiConnection,
  createComfyUiFlow,
  listComfyUiConnections,
  listComfyUiFlows,
  testComfyUiConnection as testComfyUiConnectionRequest,
  updateComfyUiConnection,
  updateComfyUiFlow,
  type ComfyUiConnection,
  type ComfyUiFlow,
} from "@/shared/api/comfyuiStudio";
import ResultPreviewCard from "./components/ResultPreviewCard";
import ComfyUiExecutionInputCard from "./components/ComfyUiExecutionInputCard";
import ComfyUiSetupCard from "./components/ComfyUiSetupCard";
import { useImageGenerationStudioState } from "./hooks/useImageGenerationStudioState";
import type { createImageGeneration, getImageGeneration } from "@/shared/api/imageGeneration";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import {
  composeComfyUiWorkflowJson,
  getComfyUiNodeSummaries,
  type ComfyUiConnectionStatus,
  type ComfyUiNodeMapping,
} from "./model/comfyui-workbench";
import type { WorkflowJsonStatus } from "./model/view-model";

interface ImageGenerationStudioPageProps {
  api?: {
    createImageGeneration: typeof createImageGeneration;
    getImageGeneration: typeof getImageGeneration;
  };
}

type StudioTab = "comfyui" | "providers";
type StudioFlow = ComfyUiFlow & { rawJson: string };

const flowJsonStatusVariant = (status: WorkflowJsonStatus) => {
  if (status === "valid") {
    return "success";
  }
  if (status === "invalid-json" || status === "invalid-comfyui-format") {
    return "danger";
  }
  return "neutral";
};

const getFlowJsonStatus = (workflowJson: string): WorkflowJsonStatus => {
  const trimmed = workflowJson.trim();
  if (!trimmed) {
    return "empty";
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "invalid-comfyui-format";
    }

    const hasApiNodes = Object.values(parsed as Record<string, unknown>).some(
      (node) =>
        !!node &&
        typeof node === "object" &&
        !Array.isArray(node) &&
        "class_type" in (node as Record<string, unknown>) &&
        "inputs" in (node as Record<string, unknown>),
    );

    return hasApiNodes ? "valid" : "invalid-comfyui-format";
  } catch {
    return "invalid-json";
  }
};

export default function ImageGenerationStudioPage({
  api,
}: ImageGenerationStudioPageProps) {
  const { t } = useTranslation();
  const state = useImageGenerationStudioState(api);
  const [activeTab, setActiveTab] = useState<StudioTab>(
    state.mode === "workflow" || state.provider === "comfyui-local"
      ? "comfyui"
      : "providers",
  );
  const [connections, setConnections] = useState<ComfyUiConnection[]>([]);
  const [editingConnection, setEditingConnection] = useState(false);
  const [draftConnectionAddress, setDraftConnectionAddress] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [flows, setFlows] = useState<StudioFlow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [flowEditorOpen, setFlowEditorOpen] = useState(false);
  const [flowEditorMode, setFlowEditorMode] = useState<"create" | "edit">("edit");
  const [flowNameDraft, setFlowNameDraft] = useState("");
  const [flowNoteDraft, setFlowNoteDraft] = useState("");
  const [flowJsonDraft, setFlowJsonDraft] = useState("");
  const [studioLoading, setStudioLoading] = useState(false);

  const currentConnection = connections[0] ?? null;
  const connectionStatus: ComfyUiConnectionStatus =
    currentConnection?.status ?? "unconfigured";
  const connectionAddress = currentConnection?.baseUrl ?? "";

  const selectedFlow =
    flows.find((flow) => flow.id === selectedFlowId) ?? null;
  const selectedFlowNodes = selectedFlow
    ? getComfyUiNodeSummaries(selectedFlow.rawJson)
    : [];
  const flowEditorJsonStatus = getFlowJsonStatus(flowJsonDraft);

  const reloadStudioConfig = async () => {
    setStudioLoading(true);
    try {
      const [nextConnections, nextFlows] = await Promise.all([
        listComfyUiConnections(),
        listComfyUiFlows(),
      ]);
      setConnections(nextConnections);
      setFlows(nextFlows.map((flow) => ({ ...flow, rawJson: flow.workflowApiJson })));
    } finally {
      setStudioLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "comfyui") {
      if (state.mode !== "workflow") {
        state.setMode("workflow");
      }
      if (state.provider !== "comfyui-local") {
        state.setProvider("comfyui-local");
      }
      return;
    }

    if (state.mode !== "prompt") {
      state.setMode("prompt");
    }
  }, [activeTab, state.mode, state.provider, state.setMode, state.setProvider]);

  useEffect(() => {
    void reloadStudioConfig();
  }, []);

  useEffect(() => {
    if (!flows.length) {
      if (selectedFlowId) {
        setSelectedFlowId("");
      }
      return;
    }

    if (!selectedFlowId || !flows.some((flow) => flow.id === selectedFlowId)) {
      setSelectedFlowId(flows[0].id);
    }
  }, [flows, selectedFlowId]);

  useEffect(() => {
    if (!selectedFlow) {
      return;
    }

    if (state.workflowForm.workflowJson !== selectedFlow.rawJson) {
      state.setWorkflowForm((current) => ({
        ...current,
        workflowJson: selectedFlow.rawJson,
      }));
    }
  }, [selectedFlow, state.setWorkflowForm, state.workflowForm.workflowJson]);

  const startCreateConnection = () => {
    setDraftConnectionAddress("");
    setEditingConnection(true);
  };

  const startEditConnection = () => {
    setDraftConnectionAddress(currentConnection?.baseUrl ?? "");
    setEditingConnection(true);
  };

  const saveConnection = async () => {
    const nextAddress = draftConnectionAddress.trim();
    if (!nextAddress) {
      return;
    }

    const nextConnection = currentConnection
      ? await updateComfyUiConnection(currentConnection.id, { baseUrl: nextAddress })
      : await createComfyUiConnection({ baseUrl: nextAddress });
    setConnections([nextConnection, ...connections.filter((item) => item.id !== nextConnection.id)]);
    setEditingConnection(false);
  };

  const testConnection = async () => {
    if (!currentConnection) {
      return;
    }

    setTestingConnection(true);
    try {
      const tested = await testComfyUiConnectionRequest(currentConnection.id);
      setConnections([tested, ...connections.filter((item) => item.id !== tested.id)]);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSelectFlow = (flowId: string) => {
    setSelectedFlowId(flowId);
  };

  const openCreateFlowEditor = () => {
    setFlowEditorMode("create");
    setFlowNameDraft(
      t("settings.microApps.imageGenerationStudio.flow.defaults.newFlowName"),
    );
    setFlowNoteDraft("");
    setFlowJsonDraft("{}");
    setFlowEditorOpen(true);
  };

  const openEditFlowEditor = () => {
    if (!selectedFlow) {
      return;
    }

    setFlowEditorMode("edit");
    setFlowNameDraft(selectedFlow.name);
    setFlowNoteDraft(selectedFlow.note);
    setFlowJsonDraft(selectedFlow.rawJson);
    setFlowEditorOpen(true);
  };

  const closeFlowEditor = () => {
    if (state.isRunning) {
      return;
    }

    setFlowEditorOpen(false);
  };

  const saveFlowEditor = () => {
    void (async () => {
    const nextName = flowNameDraft.trim();
    const nextNote = flowNoteDraft.trim();
    const nextRawJson = flowJsonDraft.trim();

    if (!nextName || !nextRawJson) {
      return;
    }

    if (flowEditorMode === "create") {
      const nextFlow = await createComfyUiFlow({
        connectionId: currentConnection?.id ?? null,
        name: nextName,
        note:
          nextNote ||
          t("settings.microApps.imageGenerationStudio.flow.defaults.newFlowNote"),
        source: "manual",
        workflowApiJson: nextRawJson,
        mapping: selectedFlow?.mapping ?? {
          promptPath: "",
          seedPath: "",
          widthPath: "",
          heightPath: "",
          outputNodeId: "",
          previewNodeId: "",
        },
      });
      const mappedFlow = { ...nextFlow, rawJson: nextFlow.workflowApiJson };
      setFlows((current) => [...current, mappedFlow]);
      setSelectedFlowId(mappedFlow.id);
      setFlowEditorOpen(false);
      return;
    }

    if (!selectedFlow) {
      return;
    }

    const nextFlow = await updateComfyUiFlow(selectedFlow.id, {
      connectionId: selectedFlow.connectionId ?? currentConnection?.id ?? null,
      name: nextName,
      note: nextNote || selectedFlow.note,
      source: selectedFlow.source,
      workflowApiJson: nextRawJson,
      mapping: selectedFlow.mapping,
    });
    setFlows((current) =>
      current.map((flow) =>
        flow.id === selectedFlow.id
          ? { ...nextFlow, rawJson: nextFlow.workflowApiJson }
          : flow,
      ),
    );
    setFlowEditorOpen(false);
    })();
  };

  const handleFlowMappingChange = (nextMapping: ComfyUiNodeMapping) => {
    void (async () => {
    if (!selectedFlow) {
      return;
    }

    const nextFlow = await updateComfyUiFlow(selectedFlow.id, {
      connectionId: selectedFlow.connectionId ?? currentConnection?.id ?? null,
      name: selectedFlow.name,
      note: selectedFlow.note,
      source: selectedFlow.source,
      workflowApiJson: selectedFlow.rawJson,
      mapping: nextMapping,
    });

    setFlows((current) =>
      current.map((flow) =>
        flow.id === selectedFlow.id
          ? { ...nextFlow, rawJson: nextFlow.workflowApiJson }
          : flow,
      ),
    );
    })();
  };

  const handleSubmit = () => {
    if (activeTab !== "comfyui" || !selectedFlow) {
      void state.submit();
      return;
    }

    const workflowJson = composeComfyUiWorkflowJson({
      rawJson: selectedFlow.rawJson,
      mapping: selectedFlow.mapping,
      overrides: {
        prompt: state.workflowForm.overridePrompt,
        seed: state.workflowForm.overrideSeed,
        size: state.workflowForm.overrideSize,
      },
    });

    void state.submit({
      workflowJson,
      providerParams: currentConnection
        ? {
            baseUrl: currentConnection.baseUrl,
            clientId: currentConnection.clientId || undefined,
          }
        : undefined,
    });
  };

  return (
    <MicroAppPageLayout
      miniTitle={t("settings.microApps.imageGenerationStudio.page.miniTitle")}
      title={t("settings.microApps.imageGenerationStudio.page.title")}
      description={t("settings.microApps.imageGenerationStudio.page.description")}
      contentClassName="pt-6"
      scrollBody={false}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <NavigationCardTabs<StudioTab>
            tabs={[
              {
                value: "providers",
                label: t("settings.microApps.imageGenerationStudio.tabs.providers"),
                icon: <ImageIcon className="h-4 w-4" />,
              },
              {
                value: "comfyui",
                label: t("settings.microApps.imageGenerationStudio.tabs.comfyui"),
                icon: <Workflow className="h-4 w-4" />,
              },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto pt-6">
          {activeTab === "comfyui" ? (
            <div className="grid gap-3 lg:gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
              <div className="space-y-4">
                <ComfyUiSetupCard
                  connectionStatus={connectionStatus}
                  connectionAddress={connectionAddress}
                  editingConnection={editingConnection}
                  draftConnectionAddress={draftConnectionAddress}
                  testingConnection={testingConnection || studioLoading}
                  flows={flows}
                  selectedFlowId={selectedFlowId}
                  selectedFlow={selectedFlow}
                  nodes={selectedFlowNodes}
                  running={state.isRunning}
                  onDraftConnectionAddressChange={setDraftConnectionAddress}
                  onStartCreateConnection={startCreateConnection}
                  onStartEditConnection={startEditConnection}
                  onSaveConnection={saveConnection}
                  onTestConnection={testConnection}
                  onSelectFlow={handleSelectFlow}
                  onCreateFlow={openCreateFlowEditor}
                  onEditFlow={openEditFlowEditor}
                  onMappingChange={handleFlowMappingChange}
                />
              </div>

              <div className="space-y-4">
                <ComfyUiExecutionInputCard
                  overridePrompt={state.workflowForm.overridePrompt}
                  overrideSize={state.workflowForm.overrideSize}
                  formStatus={state.formStatus}
                  running={state.isRunning}
                  canCancel={state.canCancel}
                  onOverridePromptChange={(overridePrompt) =>
                    state.setWorkflowForm((current) => ({ ...current, overridePrompt }))
                  }
                  onOverrideSizeChange={(overrideSize) =>
                    state.setWorkflowForm((current) => ({ ...current, overrideSize }))
                  }
                  onSubmit={handleSubmit}
                  onReset={state.reset}
                  onCancel={state.cancel}
                />
                <ResultPreviewCard
                  previewStatus={state.previewStatus}
                  result={state.result}
                />
              </div>
            </div>
          ) : (
            <Card className="space-y-4 p-5">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-text-primary">
                  {t("settings.microApps.imageGenerationStudio.cards.providersPlaceholder.title")}
                </div>
                <div className="max-w-2xl text-sm leading-6 text-text-secondary">
                  {t("settings.microApps.imageGenerationStudio.cards.providersPlaceholder.description")}
                </div>
              </div>

              <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-4 py-6 text-sm leading-6 text-text-secondary">
                {t("settings.microApps.imageGenerationStudio.cards.providersPlaceholder.body")}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={flowEditorOpen}
        title={t(
          flowEditorMode === "create"
            ? "settings.microApps.imageGenerationStudio.flow.dialogs.createTitle"
            : "settings.microApps.imageGenerationStudio.flow.dialogs.editTitle",
        )}
        width={860}
        maxHeight="calc(100vh - 4rem)"
        onClose={closeFlowEditor}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={closeFlowEditor}
              disabled={state.isRunning}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button size="sm" onClick={saveFlowEditor} disabled={state.isRunning}>
              {t("common.actions.save")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-ui-panel border border-border bg-surface-secondary/30 px-4 py-3 text-sm leading-6 text-text-secondary">
            {t("settings.microApps.imageGenerationStudio.flow.dialogs.description")}
          </div>
          <div className="grid gap-4">
            <TextInput
              label={t("settings.microApps.imageGenerationStudio.flow.fields.name")}
              value={flowNameDraft}
              onChange={setFlowNameDraft}
              compact
              disabled={state.isRunning}
            />
            <TextArea
              label={t("settings.microApps.imageGenerationStudio.flow.fields.note")}
              value={flowNoteDraft}
              onChange={setFlowNoteDraft}
              rows={3}
              compact
              disabled={state.isRunning}
            />
            <TextArea
              label={t("settings.microApps.imageGenerationStudio.flow.fields.rawJson")}
              value={flowJsonDraft}
              onChange={setFlowJsonDraft}
              placeholder={t(
                "settings.microApps.imageGenerationStudio.flow.placeholders.rawJson",
              )}
              rows={14}
              compact
              disabled={state.isRunning}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={flowJsonStatusVariant(flowEditorJsonStatus)} size="sm">
                {t("settings.microApps.imageGenerationStudio.workflowJsonStatus.title")}
              </Badge>
              <div className="text-sm text-text-secondary">
                {t(
                  `settings.microApps.imageGenerationStudio.workflowJsonStatus.${flowEditorJsonStatus}`,
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </MicroAppPageLayout>
  );
}
