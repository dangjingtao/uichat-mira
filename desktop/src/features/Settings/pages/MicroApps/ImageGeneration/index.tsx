import { useTranslation } from "react-i18next";
import HeaderBanner from "./components/HeaderBanner";
import ModeProviderCard from "./components/ModeProviderCard";
import PromptRequestCard from "./components/PromptRequestCard";
import WorkflowRequestCard from "./components/WorkflowRequestCard";
import SubmitActionCard from "./components/SubmitActionCard";
import ResultPreviewCard from "./components/ResultPreviewCard";
import TaskStatusCard from "./components/TaskStatusCard";
import RequestSummaryCard from "./components/RequestSummaryCard";
import DebugLogCard from "./components/DebugLogCard";
import HelpCard from "./components/HelpCard";
import { useImageGenerationStudioState } from "./hooks/useImageGenerationStudioState";
import type { createImageGeneration, getImageGeneration } from "@/shared/api/imageGeneration";
import MicroAppPageLayout from "../components/MicroAppPageLayout";

interface ImageGenerationStudioPageProps {
  api?: {
    createImageGeneration: typeof createImageGeneration;
    getImageGeneration: typeof getImageGeneration;
  };
}

export default function ImageGenerationStudioPage({
  api,
}: ImageGenerationStudioPageProps) {
  const { t } = useTranslation();
  const state = useImageGenerationStudioState(api);

  return (
    <MicroAppPageLayout
      miniTitle={t("settings.microApps.imageGenerationStudio.page.miniTitle")}
      title={t("settings.microApps.imageGenerationStudio.page.title")}
      description={t("settings.microApps.imageGenerationStudio.page.description")}
      contentClassName="space-y-6 pt-6"
    >
      <HeaderBanner />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <ModeProviderCard
            mode={state.mode}
            provider={state.provider}
            model={state.promptForm.model}
            running={state.isRunning}
            onModeChange={state.setMode}
            onProviderChange={state.setProvider}
            onModelChange={(model) =>
              state.setPromptForm((current) => ({ ...current, model }))
            }
          />

          {state.mode === "prompt" ? (
            <PromptRequestCard
              value={state.promptForm}
              running={state.isRunning}
              invalid={state.formStatus === "invalid"}
              onChange={state.setPromptForm}
            />
          ) : (
            <WorkflowRequestCard
              value={state.workflowForm}
              running={state.isRunning}
              jsonStatus={state.workflowJsonStatus}
              onChange={state.setWorkflowForm}
            />
          )}

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
          <RequestSummaryCard
            submittedSnapshot={state.submittedSnapshot}
            result={state.result}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <DebugLogCard logs={state.logs} />
        <HelpCard />
      </div>
    </MicroAppPageLayout>
  );
}
