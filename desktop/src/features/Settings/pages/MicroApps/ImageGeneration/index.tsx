import { useEffect, useState } from "react";
import { ImageIcon, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import NavigationCardTabs from "@/shared/ui/NavigationCardTabs";
import { Button, Modal, TextArea, TextInput } from "@/shared/ui";
import SubmitActionCard from "./components/SubmitActionCard";
import ResultPreviewCard from "./components/ResultPreviewCard";
import TaskStatusCard from "./components/TaskStatusCard";
import RequestSummaryCard from "./components/RequestSummaryCard";
import DebugLogCard from "./components/DebugLogCard";
import HelpCard from "./components/HelpCard";
import CollapsiblePanel from "@/shared/ui/CollapsiblePanel";
import ComfyUiConnectionCard from "./components/ComfyUiConnectionCard";
import ComfyUiFlowCard from "./components/ComfyUiFlowCard";
import ComfyUiExecutionInputCard from "./components/ComfyUiExecutionInputCard";
import ComfyUiNodeMappingCard from "./components/ComfyUiNodeMappingCard";
import { useImageGenerationStudioState } from "./hooks/useImageGenerationStudioState";
import type { createImageGeneration, getImageGeneration } from "@/shared/api/imageGeneration";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import {
  composeComfyUiWorkflowJson,
  defaultComfyUiFlows,
  emptyComfyUiNodeMapping,
  getComfyUiNodeSummaries,
  type ComfyUiConnectionStatus,
  type ComfyUiNodeMapping,
} from "./model/comfyui-workbench";

interface ImageGenerationStudioPageProps {
  api?: {
    createImageGeneration: typeof createImageGeneration;
    getImageGeneration: typeof getImageGeneration;
  };
}

type StudioTab = "comfyui" | "providers";

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
  const [connectionStatus, setConnectionStatus] =
    useState<ComfyUiConnectionStatus>("unconfigured");
  const [connectionAddress, setConnectionAddress] = useState("");
  const [editingConnection, setEditingConnection] = useState(false);
  const [draftConnectionAddress, setDraftConnectionAddress] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [flows, setFlows] = useState(defaultComfyUiFlows);
  const [selectedFlowId, setSelectedFlowId] = useState(defaultComfyUiFlows[0]?.id ?? "");
  const [flowEditorOpen, setFlowEditorOpen] = useState(false);
  const [flowEditorMode, setFlowEditorMode] = useState<"create" | "edit">("edit");
  const [flowNameDraft, setFlowNameDraft] = useState("");
  const [flowNoteDraft, setFlowNoteDraft] = useState("");
  const [flowJsonDraft, setFlowJsonDraft] = useState("");

  const selectedFlow =
    flows.find((flow) => flow.id === selectedFlowId) ?? null;
  const selectedFlowNodes = selectedFlow
    ? getComfyUiNodeSummaries(selectedFlow.rawJson)
    : [];

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
    setDraftConnectionAddress(connectionAddress);
    setEditingConnection(true);
  };

  const saveConnection = () => {
    const nextAddress = draftConnectionAddress.trim();
    if (!nextAddress) {
      return;
    }

    setConnectionAddress(nextAddress);
    setConnectionStatus("unverified");
    setEditingConnection(false);
  };

  const testConnection = () => {
    if (!connectionAddress && !draftConnectionAddress.trim()) {
      return;
    }

    setTestingConnection(true);
    window.setTimeout(() => {
      setTestingConnection(false);
      setConnectionStatus("connectable");
    }, 600);
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
    const nextName = flowNameDraft.trim();
    const nextNote = flowNoteDraft.trim();
    const nextRawJson = flowJsonDraft.trim();

    if (!nextName || !nextRawJson) {
      return;
    }

    if (flowEditorMode === "create") {
      const nextFlow = {
        id: `manual_${Date.now()}`,
        name: nextName,
        note:
          nextNote ||
          t("settings.microApps.imageGenerationStudio.flow.defaults.newFlowNote"),
        updatedAt: new Date().toLocaleString(),
        source: "manual" as const,
        rawJson: nextRawJson,
        mapping: emptyComfyUiNodeMapping(),
      };
      setFlows((current) => [...current, nextFlow]);
      setSelectedFlowId(nextFlow.id);
      setFlowEditorOpen(false);
      return;
    }

    if (!selectedFlow) {
      return;
    }

    setFlows((current) =>
      current.map((flow) =>
        flow.id === selectedFlow.id
          ? {
              ...flow,
              name: nextName,
              note: nextNote || flow.note,
              rawJson: nextRawJson,
              updatedAt: new Date().toLocaleString(),
            }
          : flow,
      ),
    );
    setFlowEditorOpen(false);
  };

  const handleFlowMappingChange = (nextMapping: ComfyUiNodeMapping) => {
    if (!selectedFlow) {
      return;
    }

    setFlows((current) =>
      current.map((flow) =>
        flow.id === selectedFlow.id
          ? {
              ...flow,
              mapping: nextMapping,
            }
          : flow,
      ),
    );
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

    void state.submit({ workflowJson });
  };

  return (
    <MicroAppPageLayout
      miniTitle={t("settings.microApps.imageGenerationStudio.page.miniTitle")}
      title={t("settings.microApps.imageGenerationStudio.page.title")}
      description={t("settings.microApps.imageGenerationStudio.page.description")}
      contentClassName="space-y-6 pt-6"
    >
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

      {activeTab === "comfyui" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <ComfyUiConnectionCard
              status={connectionStatus}
              address={connectionAddress}
              editing={editingConnection}
              draftAddress={draftConnectionAddress}
              testing={testingConnection}
              running={state.isRunning}
              onDraftAddressChange={setDraftConnectionAddress}
              onStartCreate={startCreateConnection}
              onStartEdit={startEditConnection}
              onCancelEdit={() => setEditingConnection(false)}
              onSave={saveConnection}
              onTest={testConnection}
            />

            <ComfyUiFlowCard
              flows={flows}
              selectedFlowId={selectedFlowId}
              selectedFlow={selectedFlow}
              jsonStatus={state.workflowJsonStatus}
              running={state.isRunning}
              onSelectFlow={handleSelectFlow}
              onCreateFlow={openCreateFlowEditor}
              onEditFlow={openEditFlowEditor}
            />

            <ComfyUiNodeMappingCard
              selectedFlow={selectedFlow}
              nodes={selectedFlowNodes}
              running={state.isRunning}
              onMappingChange={handleFlowMappingChange}
            />

            <ComfyUiExecutionInputCard
              overridePrompt={state.workflowForm.overridePrompt}
              overrideSeed={state.workflowForm.overrideSeed}
              overrideSize={state.workflowForm.overrideSize}
              running={state.isRunning}
              onOverridePromptChange={(overridePrompt) =>
                state.setWorkflowForm((current) => ({ ...current, overridePrompt }))
              }
              onOverrideSeedChange={(overrideSeed) =>
                state.setWorkflowForm((current) => ({ ...current, overrideSeed }))
              }
              onOverrideSizeChange={(overrideSize) =>
                state.setWorkflowForm((current) => ({ ...current, overrideSize }))
              }
            />

            <SubmitActionCard
              formStatus={state.formStatus}
              pageStatus={state.pageStatus}
              running={state.isRunning}
              canCancel={state.canCancel}
              onSubmit={handleSubmit}
              onReset={state.reset}
              onCancel={state.cancel}
            />
          </div>

          <div className="space-y-4">
            <ResultPreviewCard
              previewStatus={state.previewStatus}
              result={state.result}
            />
            <TaskStatusCard taskStatus={state.taskStatus} />
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

      <CollapsiblePanel
        title={t("settings.microApps.imageGenerationStudio.cards.diagnostics.title")}
        meta={t("settings.microApps.imageGenerationStudio.cards.diagnostics.description")}
        contentClassName="p-4"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <RequestSummaryCard
              submittedSnapshot={state.submittedSnapshot}
              result={state.result}
            />
            <HelpCard />
          </div>
          <DebugLogCard logs={state.logs} />
        </div>
      </CollapsiblePanel>

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
              onClick={closeFlowEditor}
              disabled={state.isRunning}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={saveFlowEditor} disabled={state.isRunning}>
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
              disabled={state.isRunning}
            />
            <TextArea
              label={t("settings.microApps.imageGenerationStudio.flow.fields.note")}
              value={flowNoteDraft}
              onChange={setFlowNoteDraft}
              rows={3}
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
              disabled={state.isRunning}
            />
          </div>
        </div>
      </Modal>
    </MicroAppPageLayout>
  );
}
