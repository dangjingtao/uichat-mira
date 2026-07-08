import { useEffect, useState } from "react";
import { ImageIcon, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import NavigationCardTabs from "@/shared/ui/NavigationCardTabs";
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
  const [connectionName, setConnectionName] = useState("");
  const [connectionAddress, setConnectionAddress] = useState("");
  const [editingConnection, setEditingConnection] = useState(false);
  const [draftConnectionName, setDraftConnectionName] = useState("");
  const [draftConnectionAddress, setDraftConnectionAddress] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [flows, setFlows] = useState(defaultComfyUiFlows);
  const [selectedFlowId, setSelectedFlowId] = useState(defaultComfyUiFlows[0]?.id ?? "");
  const [editingFlowMeta, setEditingFlowMeta] = useState(false);
  const [flowNoteDraft, setFlowNoteDraft] = useState("");

  const selectedFlow =
    flows.find((flow) => flow.id === selectedFlowId) ?? null;
  const selectedFlowNodes = selectedFlow
    ? getComfyUiNodeSummaries(selectedFlow.rawJson)
    : [];

  useEffect(() => {
    if (selectedFlow) {
      setFlowNoteDraft(selectedFlow.note);
    }
  }, [selectedFlow]);

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
    setDraftConnectionName("");
    setDraftConnectionAddress("");
    setEditingConnection(true);
  };

  const startEditConnection = () => {
    setDraftConnectionName(connectionName);
    setDraftConnectionAddress(connectionAddress);
    setEditingConnection(true);
  };

  const saveConnection = () => {
    const nextName = draftConnectionName.trim();
    const nextAddress = draftConnectionAddress.trim();
    if (!nextName || !nextAddress) {
      return;
    }

    setConnectionName(nextName);
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
    setEditingFlowMeta(false);
  };

  const handleUploadFlow = (files: FileList | null) => {
    const file = files?.item(0);
    if (!file) {
      return;
    }

    void file.text().then((rawJson) => {
      const nextFlow = {
        id: `upload_${Date.now()}`,
        name: file.name.replace(/\.json$/i, ""),
        note: t("settings.microApps.imageGenerationStudio.flow.messages.uploaded"),
        updatedAt: new Date().toLocaleString(),
        source: "upload" as const,
        rawJson,
        mapping: emptyComfyUiNodeMapping(),
      };
      setFlows((current) => [...current, nextFlow]);
      setSelectedFlowId(nextFlow.id);
      setEditingFlowMeta(false);
    });
  };

  const handleCreateFlow = () => {
    const nextFlow = {
      id: `manual_${Date.now()}`,
      name: t("settings.microApps.imageGenerationStudio.flow.defaults.newFlowName"),
      note: t("settings.microApps.imageGenerationStudio.flow.defaults.newFlowNote"),
      updatedAt: new Date().toLocaleString(),
      source: "manual" as const,
      rawJson: "{}",
      mapping: emptyComfyUiNodeMapping(),
    };
    setFlows((current) => [...current, nextFlow]);
    setSelectedFlowId(nextFlow.id);
    setEditingFlowMeta(true);
  };

  const saveFlowMeta = () => {
    if (!selectedFlow) {
      return;
    }
    setFlows((current) =>
      current.map((flow) =>
        flow.id === selectedFlow.id
          ? {
              ...flow,
              note: flowNoteDraft.trim() || flow.note,
              updatedAt: new Date().toLocaleString(),
            }
          : flow,
      ),
    );
    setEditingFlowMeta(false);
  };

  const handleWorkflowJsonChange = (workflowJson: string) => {
    if (!selectedFlow) {
      return;
    }
    setFlows((current) =>
      current.map((flow) =>
        flow.id === selectedFlow.id
          ? {
              ...flow,
              rawJson: workflowJson,
              updatedAt: new Date().toLocaleString(),
            }
          : flow,
      ),
    );
    state.setWorkflowForm((current) => ({ ...current, workflowJson }));
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
            value: "comfyui",
            label: t("settings.microApps.imageGenerationStudio.tabs.comfyui"),
            icon: <Workflow className="h-4 w-4" />,
          },
          {
            value: "providers",
            label: t("settings.microApps.imageGenerationStudio.tabs.providers"),
            icon: <ImageIcon className="h-4 w-4" />,
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
              name={connectionName}
              address={connectionAddress}
              editing={editingConnection}
              draftName={draftConnectionName}
              draftAddress={draftConnectionAddress}
              testing={testingConnection}
              running={state.isRunning}
              onDraftNameChange={setDraftConnectionName}
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
              flowNoteDraft={flowNoteDraft}
              jsonStatus={state.workflowJsonStatus}
              running={state.isRunning}
              editingFlowMeta={editingFlowMeta}
              onSelectFlow={handleSelectFlow}
              onUploadFlow={handleUploadFlow}
              onCreateFlow={handleCreateFlow}
              onStartEditFlowMeta={() => setEditingFlowMeta(true)}
              onCancelEditFlowMeta={() => setEditingFlowMeta(false)}
              onFlowNoteDraftChange={setFlowNoteDraft}
              onSaveFlowMeta={saveFlowMeta}
              onWorkflowJsonChange={handleWorkflowJsonChange}
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
    </MicroAppPageLayout>
  );
}
