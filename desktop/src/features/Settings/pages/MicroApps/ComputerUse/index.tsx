import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  LoaderCircle,
  ShieldAlert,
  SquareTerminal,
  XCircle,
} from "lucide-react";
import SettingsPageLayout from "@/features/Settings/components/SettingsPageLayout";
import {
  Badge,
  Button,
  Card,
  TabCard,
  TextArea,
  TextInput,
} from "@/shared/ui";
import type {
  ComputerUseRuntimeInstallRequest,
  ComputerUseTask,
} from "@/shared/api/computerUse";
import {
  useComputerUseStudioState,
  type ComputerUseStudioApiOverrides,
  type ComputerUseStudioState,
} from "./hooks/useComputerUseStudioState";

type EvidenceTab = "plan" | "evidence" | "result";

interface ComputerUseStudioPageProps {
  api?: ComputerUseStudioApiOverrides;
  runtimeInstallRequest?: ComputerUseRuntimeInstallRequest;
}

const runtimeBadgeVariantMap = {
  ready: "success",
  not_installed: "warning",
  downloading: "primary",
  broken: "danger",
} as const;

const taskBadgeVariantMap = {
  idle: "neutral",
  plan_ready: "primary",
  queued: "primary",
  planning: "primary",
  awaiting_approval: "warning",
  running: "primary",
  succeeded: "success",
  failed: "danger",
  blocked: "danger",
  cancelled: "muted",
} as const;

function toneKeyForTaskState(state: ComputerUseStudioState["derivedTaskState"]) {
  return taskBadgeVariantMap[state] ?? "neutral";
}

function renderTimestamp(value: string | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function getTaskTitleKey(state: ComputerUseStudioState["derivedTaskState"]) {
  switch (state) {
    case "plan_ready":
      return "settings.microApps.computerUseStudio.taskState.plan_ready";
    case "idle":
      return "settings.microApps.computerUseStudio.taskState.idle";
    default:
      return `settings.microApps.computerUseStudio.taskState.${state}`;
  }
}

function StatusBanner({ state }: { state: ComputerUseStudioState }) {
  const { t } = useTranslation();
  const runtimeStatus = state.runtime?.status ?? "not_installed";

  return (
    <Card className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
            {t("settings.microApps.computerUseStudio.header.miniTitle")}
          </div>
          <h2 className="text-xl font-semibold text-text-primary">
            {t("settings.microApps.computerUseStudio.header.title")}
          </h2>
          <p className="max-w-3xl text-sm text-text-secondary">
            {t("settings.microApps.computerUseStudio.header.description")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={runtimeBadgeVariantMap[runtimeStatus]}
            size="md"
          >
            {t("settings.microApps.computerUseStudio.status.runtimeLabel")}
            {" · "}
            {t(`settings.microApps.computerUseStudio.runtimeState.${runtimeStatus}`)}
          </Badge>
          <Badge
            variant={toneKeyForTaskState(state.derivedTaskState)}
            size="md"
          >
            {t("settings.microApps.computerUseStudio.status.taskLabel")}
            {" · "}
            {t(getTaskTitleKey(state.derivedTaskState))}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

function RiskPanel() {
  const { t } = useTranslation();

  return (
    <Card variant="subtle" className="space-y-2">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-text-primary">
            {t("settings.microApps.computerUseStudio.risk.title")}
          </div>
          <p className="text-sm text-text-secondary">
            {t("settings.microApps.computerUseStudio.risk.description")}
          </p>
        </div>
      </div>
    </Card>
  );
}

function TaskPanel({ state }: { state: ComputerUseStudioState }) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-base font-semibold text-text-primary">
          {t("settings.microApps.computerUseStudio.taskPanel.title")}
        </div>
        <p className="text-sm text-text-secondary">
          {t("settings.microApps.computerUseStudio.taskPanel.description")}
        </p>
      </div>

      <TextArea
        label={t("settings.microApps.computerUseStudio.fields.goal")}
        value={state.goal}
        onChange={state.setGoal}
        rows={6}
        disabled={state.isInstalling || state.isMutatingTask}
        placeholder={t("settings.microApps.computerUseStudio.placeholders.goal")}
      />

      <TextInput
        label={t("settings.microApps.computerUseStudio.fields.siteScope")}
        value={state.siteScopeText}
        onChange={state.setSiteScopeText}
        disabled={state.isInstalling || state.isMutatingTask}
        placeholder={t(
          "settings.microApps.computerUseStudio.placeholders.siteScope",
        )}
      />

      <RiskPanel />

      <div className="rounded-ui-control border border-border bg-surface-secondary/60 px-3 py-2">
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
          {t("settings.microApps.computerUseStudio.taskPanel.scopeLabel")}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {state.siteScope.length > 0 ? (
            state.siteScope.map((scope) => (
              <Badge key={scope} variant="muted">
                {scope}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-text-secondary">
              {t("settings.microApps.computerUseStudio.taskPanel.scopeEmpty")}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => void state.createPlan()}
          disabled={!state.canCreatePlan}
        >
          {t("settings.microApps.computerUseStudio.actions.createPlan")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void state.startTask()}
          disabled={!state.canStartTask}
        >
          {t("settings.microApps.computerUseStudio.actions.startTask")}
        </Button>
        <Button
          variant="outline"
          onClick={() => void state.retry()}
          disabled={state.isInstalling || state.isMutatingTask}
        >
          {t("settings.microApps.computerUseStudio.actions.retry")}
        </Button>
        <Button
          variant="danger-outline"
          onClick={() => void state.cancelTask()}
          disabled={!state.canCancelTask}
        >
          {t("settings.microApps.computerUseStudio.actions.cancelTask")}
        </Button>
      </div>
    </Card>
  );
}

function BrowserCanvas({
  title,
  subtitle,
  muted = false,
  icon,
}: {
  title: string;
  subtitle: string;
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-ui-panel border border-border bg-surface-primary">
      <div className="flex items-center gap-2 border-b border-border bg-surface-secondary/80 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cloudy-3" />
          <span className="h-2.5 w-2.5 rounded-full bg-cloudy-3" />
          <span className="h-2.5 w-2.5 rounded-full bg-cloudy-3" />
        </div>
        <div className="truncate rounded-ui-control bg-surface-primary px-2 py-1 font-mono text-xs text-text-secondary">
          {subtitle}
        </div>
      </div>
      <div
        className={`flex min-h-[300px] flex-col items-center justify-center gap-3 px-6 py-8 text-center ${
          muted ? "opacity-70" : ""
        }`}
      >
        {icon ?? <Globe className="h-10 w-10 text-icon-secondary" />}
        <div className="space-y-1">
          <div className="text-base font-semibold text-text-primary">{title}</div>
          <div className="max-w-md text-sm text-text-secondary">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function InstallGuide({ state }: { state: ComputerUseStudioState }) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-base font-semibold text-text-primary">
          {t("settings.microApps.computerUseStudio.runtimeGuide.title")}
        </div>
        <p className="text-sm text-text-secondary">
          {t("settings.microApps.computerUseStudio.runtimeGuide.description")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(
          ["why", "what", "after"] as Array<"why" | "what" | "after">
        ).map((item) => (
          <Card key={item} variant="subtle" className="space-y-1">
            <div className="text-sm font-medium text-text-primary">
              {t(`settings.microApps.computerUseStudio.runtimeGuide.${item}.title`)}
            </div>
            <p className="text-sm text-text-secondary">
              {t(`settings.microApps.computerUseStudio.runtimeGuide.${item}.description`)}
            </p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => void state.installRuntime()}
          disabled={state.isInstalling || !state.hasInstallRequest}
        >
          {t("settings.microApps.computerUseStudio.actions.installRuntime")}
        </Button>
        {!state.hasInstallRequest ? (
          <span className="text-sm text-text-secondary">
            {t("settings.microApps.computerUseStudio.runtimeGuide.configMissing")}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function DownloadingPanel({ state }: { state: ComputerUseStudioState }) {
  const { t } = useTranslation();
  const details =
    state.runtime?.details && typeof state.runtime.details === "object"
      ? (state.runtime.details as Record<string, unknown>)
      : {};
  const rawProgress = details.progress;
  const progress =
    typeof rawProgress === "number"
      ? Math.max(0, Math.min(100, rawProgress))
      : null;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
        <div className="space-y-1">
          <div className="text-base font-semibold text-text-primary">
            {t("settings.microApps.computerUseStudio.execution.downloadingTitle")}
          </div>
          <p className="text-sm text-text-secondary">
            {state.runtime?.message ||
              t(
                "settings.microApps.computerUseStudio.execution.downloadingDescription",
              )}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress ?? 35}%` }}
          />
        </div>
        <div className="text-sm text-text-secondary">
          {progress === null
            ? t("settings.microApps.computerUseStudio.execution.downloadingUnknown")
            : t(
                "settings.microApps.computerUseStudio.execution.downloadingProgress",
                { progress },
              )}
        </div>
      </div>
    </Card>
  );
}

function ExecutionPanel({ state }: { state: ComputerUseStudioState }) {
  const { t } = useTranslation();

  if (state.runtime?.status === "not_installed" || state.runtime?.status === "broken") {
    return <InstallGuide state={state} />;
  }

  if (state.runtime?.status === "downloading") {
    return <DownloadingPanel state={state} />;
  }

  if (state.derivedTaskState === "idle") {
    return (
      <BrowserCanvas
        title={t("settings.microApps.computerUseStudio.execution.emptyTitle")}
        subtitle={t(
          "settings.microApps.computerUseStudio.execution.emptyDescription",
        )}
        muted
        icon={<SquareTerminal className="h-10 w-10 text-icon-secondary" />}
      />
    );
  }

  if (state.derivedTaskState === "planning" || state.derivedTaskState === "queued") {
    return (
      <BrowserCanvas
        title={t("settings.microApps.computerUseStudio.execution.planningTitle")}
        subtitle={
          state.currentStep?.description ||
          t(
            "settings.microApps.computerUseStudio.execution.planningDescription",
          )
        }
        icon={<LoaderCircle className="h-10 w-10 animate-spin text-primary" />}
      />
    );
  }

  if (state.derivedTaskState === "plan_ready") {
    return (
      <BrowserCanvas
        title={t("settings.microApps.computerUseStudio.execution.planReadyTitle")}
        subtitle={t(
          "settings.microApps.computerUseStudio.execution.planReadyDescription",
        )}
        icon={<CheckCircle2 className="h-10 w-10 text-success" />}
      />
    );
  }

  if (state.derivedTaskState === "awaiting_approval") {
    return (
      <Card className="space-y-4">
        <BrowserCanvas
          title={t(
            "settings.microApps.computerUseStudio.execution.awaitingApprovalTitle",
          )}
          subtitle={state.pendingApproval?.title || ""}
          icon={<ShieldAlert className="h-10 w-10 text-warning" />}
        />
        <Card variant="subtle" className="space-y-2">
          <div className="text-sm font-medium text-text-primary">
            {state.pendingApproval?.title ||
              t(
                "settings.microApps.computerUseStudio.execution.awaitingApprovalTitle",
              )}
          </div>
          <p className="text-sm text-text-secondary">
            {state.pendingApproval?.reason ||
              t(
                "settings.microApps.computerUseStudio.execution.awaitingApprovalDescription",
              )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => void state.approvePending()}
              disabled={state.isMutatingTask}
            >
              {t("settings.microApps.computerUseStudio.actions.approveOnce")}
            </Button>
            <Button
              variant="danger-outline"
              onClick={() => void state.rejectPending()}
              disabled={state.isMutatingTask}
            >
              {t("settings.microApps.computerUseStudio.actions.reject")}
            </Button>
          </div>
        </Card>
      </Card>
    );
  }

  if (state.derivedTaskState === "running") {
    return (
      <Card className="space-y-4">
        <BrowserCanvas
          title={
            state.currentStep?.title ||
            t("settings.microApps.computerUseStudio.execution.runningTitle")
          }
          subtitle={
            state.currentStep?.description ||
            t("settings.microApps.computerUseStudio.execution.runningDescription")
          }
          icon={<LoaderCircle className="h-10 w-10 animate-spin text-primary" />}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Card variant="subtle" className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
              {t("settings.microApps.computerUseStudio.execution.currentStepLabel")}
            </div>
            <div className="text-sm font-medium text-text-primary">
              {state.currentStep?.title ||
                t("settings.microApps.computerUseStudio.execution.runningTitle")}
            </div>
            <div className="text-sm text-text-secondary">
              {state.currentStep?.riskSummary ||
                t(
                  "settings.microApps.computerUseStudio.execution.runningDescription",
                )}
            </div>
          </Card>
          <Card variant="subtle" className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
              {t("settings.microApps.computerUseStudio.execution.updatedAtLabel")}
            </div>
            <div className="text-sm font-medium text-text-primary">
              {renderTimestamp(state.task?.updatedAt)}
            </div>
            <div className="text-sm text-text-secondary">
              {t("settings.microApps.computerUseStudio.execution.updatedAtHint")}
            </div>
          </Card>
        </div>
      </Card>
    );
  }

  const terminalIcon =
    state.derivedTaskState === "succeeded" ? (
      <CheckCircle2 className="h-10 w-10 text-success" />
    ) : state.derivedTaskState === "cancelled" ? (
      <AlertCircle className="h-10 w-10 text-text-secondary" />
    ) : (
      <XCircle className="h-10 w-10 text-danger-text" />
    );

  return (
    <Card className="space-y-4">
      <BrowserCanvas
        title={t(getTaskTitleKey(state.derivedTaskState))}
        subtitle={
          state.task?.result?.summary ||
          t("settings.microApps.computerUseStudio.execution.terminalPlaceholder")
        }
        icon={terminalIcon}
      />
      <Card variant="subtle" className="space-y-2">
        <div className="text-sm font-medium text-text-primary">
          {t("settings.microApps.computerUseStudio.execution.resultSummaryTitle")}
        </div>
        <p className="text-sm text-text-secondary">
          {state.task?.result?.summary ||
            t("settings.microApps.computerUseStudio.result.empty")}
        </p>
      </Card>
    </Card>
  );
}

function PlanPanel({ task }: { task: ComputerUseTask | null }) {
  const { t } = useTranslation();
  const steps = task?.plan?.steps ?? [];

  if (steps.length === 0) {
    return (
      <div className="p-4 text-sm text-text-secondary">
        {t("settings.microApps.computerUseStudio.plan.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-text-secondary">
        {task?.plan?.summary || t("settings.microApps.computerUseStudio.plan.empty")}
      </p>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <Card key={step.id} variant="subtle" className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {index + 1}. {step.title}
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {step.description}
                </p>
              </div>
              <Badge
                variant={
                  step.status === "completed"
                    ? "success"
                    : step.status === "awaiting_approval"
                      ? "warning"
                      : step.status === "failed" || step.status === "cancelled"
                        ? "danger"
                        : "neutral"
                }
              >
                {t(`settings.microApps.computerUseStudio.plan.stepState.${step.status}`)}
              </Badge>
            </div>
            {step.riskSummary ? (
              <p className="text-xs text-text-secondary">{step.riskSummary}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function EvidencePanel({ task }: { task: ComputerUseTask | null }) {
  const { t } = useTranslation();
  const entries = task?.evidence.entries ?? [];
  const artifacts = task?.evidence.artifacts ?? [];

  if (entries.length === 0 && artifacts.length === 0) {
    return (
      <div className="p-4 text-sm text-text-secondary">
        {t("settings.microApps.computerUseStudio.evidence.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        {entries.map((entry) => (
          <Card key={entry.id} variant="subtle" className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-text-primary">
                {entry.message}
              </div>
              <Badge variant="muted">{entry.kind}</Badge>
            </div>
            <div className="text-xs text-text-secondary">
              {renderTimestamp(entry.createdAt)}
            </div>
          </Card>
        ))}
      </div>

      {artifacts.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-medium text-text-primary">
            {t("settings.microApps.computerUseStudio.evidence.artifactsTitle")}
          </div>
          {artifacts.map((artifact) => (
            <Card key={artifact.id} variant="subtle" className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-text-primary">
                  {artifact.label}
                </div>
                <Badge variant="muted">{artifact.kind}</Badge>
              </div>
              <div className="text-xs text-text-secondary">
                {renderTimestamp(artifact.createdAt)}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultPanel({ task }: { task: ComputerUseTask | null }) {
  const { t } = useTranslation();
  const result = task?.result;

  if (!result) {
    return (
      <div className="p-4 text-sm text-text-secondary">
        {t("settings.microApps.computerUseStudio.result.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <Card variant="subtle" className="space-y-2">
        <div className="text-sm font-medium text-text-primary">
          {result.summary}
        </div>
        <div className="text-xs text-text-secondary">
          {renderTimestamp(result.completedAt)}
        </div>
      </Card>

      {result.finalUrl ? (
        <Card variant="subtle" className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
            {t("settings.microApps.computerUseStudio.result.finalUrl")}
          </div>
          <div className="break-all text-sm text-text-primary">{result.finalUrl}</div>
        </Card>
      ) : null}

      {result.outputText ? (
        <Card variant="subtle" className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
            {t("settings.microApps.computerUseStudio.result.outputText")}
          </div>
          <div className="whitespace-pre-wrap text-sm text-text-primary">
            {result.outputText}
          </div>
        </Card>
      ) : null}

      {result.error ? (
        <Card variant="subtle" className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
            {t("settings.microApps.computerUseStudio.result.error")}
          </div>
          <div className="text-sm text-danger-text">{result.error.message}</div>
        </Card>
      ) : null}
    </div>
  );
}

function EvidenceWorkspace({ state }: { state: ComputerUseStudioState }) {
  const { t } = useTranslation();
  const items = [
    {
      value: "plan",
      label: t("settings.microApps.computerUseStudio.tabs.plan"),
    },
    {
      value: "evidence",
      label: t("settings.microApps.computerUseStudio.tabs.evidence"),
    },
    {
      value: "result",
      label: t("settings.microApps.computerUseStudio.tabs.result"),
    },
  ] satisfies Array<{ value: EvidenceTab; label: string }>;

  return (
    <TabCard<EvidenceTab>
      items={items}
      value={state.activeTab}
      onChange={state.setActiveTab}
      headerAside={t("settings.microApps.computerUseStudio.tabs.aside")}
      className="min-h-[560px]"
    >
      {state.activeTab === "plan" ? <PlanPanel task={state.task} /> : null}
      {state.activeTab === "evidence" ? <EvidencePanel task={state.task} /> : null}
      {state.activeTab === "result" ? <ResultPanel task={state.task} /> : null}
    </TabCard>
  );
}

export default function ComputerUseStudioPage({
  api,
  runtimeInstallRequest,
}: ComputerUseStudioPageProps) {
  const { t } = useTranslation();
  const state = useComputerUseStudioState({
    api,
    runtimeInstallRequest,
  });

  return (
    <SettingsPageLayout
      miniTitle={t("settings.microApps.computerUseStudio.page.miniTitle")}
      title={t("settings.microApps.computerUseStudio.page.title")}
      description={t("settings.microApps.computerUseStudio.page.description")}
      contentClassName="space-y-6 pt-6"
    >
      <StatusBanner state={state} />

      {state.loadError || state.actionError ? (
        <Card
          variant="subtle"
          className="border-danger-border bg-danger-soft text-sm text-danger-text"
        >
          {state.loadError || state.actionError}
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <TaskPanel state={state} />
        <ExecutionPanel state={state} />
        <EvidenceWorkspace state={state} />
      </div>
    </SettingsPageLayout>
  );
}
