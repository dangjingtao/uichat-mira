import { useEffect, useState } from "react";
import { ImageIcon, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import NavigationCardTabs from "@/shared/ui/NavigationCardTabs";
import WorkflowRequestCard from "./components/WorkflowRequestCard";
import SubmitActionCard from "./components/SubmitActionCard";
import ResultPreviewCard from "./components/ResultPreviewCard";
import TaskStatusCard from "./components/TaskStatusCard";
import RequestSummaryCard from "./components/RequestSummaryCard";
import DebugLogCard from "./components/DebugLogCard";
import HelpCard from "./components/HelpCard";
import CollapsiblePanel from "@/shared/ui/CollapsiblePanel";
import { useImageGenerationStudioState } from "./hooks/useImageGenerationStudioState";
import type { createImageGeneration, getImageGeneration } from "@/shared/api/imageGeneration";
import MicroAppPageLayout from "../components/MicroAppPageLayout";

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
            <Card className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-text-primary">
                  {t("settings.microApps.imageGenerationStudio.cards.comfyui.title")}
                </div>
                <div className="text-sm leading-6 text-text-secondary">
                  {t("settings.microApps.imageGenerationStudio.cards.comfyui.description")}
                </div>
              </div>

              <div className="rounded-ui-panel border border-border bg-surface-secondary/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-[0.08em] text-text-tertiary">
                      {t("settings.microApps.imageGenerationStudio.cards.modeProvider.currentTarget")}
                    </div>
                    <div className="text-sm font-medium text-text-primary">
                      {t("settings.microApps.imageGenerationStudio.providers.comfyUiLocal.label")}
                    </div>
                    <div className="max-w-xl text-sm leading-6 text-text-secondary">
                      {t("settings.microApps.imageGenerationStudio.cards.comfyui.flowFirst")}
                    </div>
                  </div>
                  <div className="rounded-ui-panel border border-border bg-surface-primary px-3 py-2 text-right">
                    <div className="text-xs uppercase tracking-[0.08em] text-text-tertiary">
                      {t("settings.microApps.imageGenerationStudio.fields.mode")}
                    </div>
                    <div className="mt-1 text-sm font-medium text-text-primary">
                      {t("settings.microApps.imageGenerationStudio.modes.workflow")}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <WorkflowRequestCard
              value={state.workflowForm}
              running={state.isRunning}
              jsonStatus={state.workflowJsonStatus}
              onChange={state.setWorkflowForm}
            />

            <SubmitActionCard
              formStatus={state.formStatus}
              pageStatus={state.pageStatus}
              running={state.isRunning}
              canCancel={state.canCancel}
              onSubmit={state.submit}
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
