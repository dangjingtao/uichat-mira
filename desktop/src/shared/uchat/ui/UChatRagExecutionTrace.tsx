import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import {
  getDisplayExecutionStep,
  normalizeInlineText,
  summarizeRagProgress,
  type UChatExecutionProgressDetail,
} from "./executionParsers";
import type { RagNodeLike } from "./ragTypes";

type ApprovalTraceState = "waiting_approval" | "running" | null;
type AgentTraceStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "waiting_user"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

const getStepDetailString = (step: RagNodeLike, key: string) => {
  const value = step.details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getApprovalTraceState = (
  steps: RagNodeLike[],
  agentStatus?: AgentTraceStatus,
): ApprovalTraceState => {
  if (agentStatus === "waiting_approval") {
    return "waiting_approval";
  }
  if (agentStatus === "queued" || agentStatus === "running") {
    return "running";
  }
  if (agentStatus) {
    return null;
  }

  // Legacy fallback for persisted messages that predate explicit Agent status.
  const hasTerminalState = steps.some(
    (step) =>
      step.phase === "error" ||
      (step.phase === "done" &&
        (step.nodeType === "generate" || step.nodeType === "evaluate")),
  );
  if (hasTerminalState) {
    return null;
  }

  const resumeSteps = steps.filter(
    (step) => step.details?.resumedFromApproval === true,
  );
  const resumedToolCallIds = new Set(
    resumeSteps
      .map((step) => getStepDetailString(step, "toolCallId"))
      .filter((value): value is string => Boolean(value)),
  );
  const approvalWaitSteps = steps.filter(
    (step) =>
      step.nodeType === "approval" &&
      step.phase === "done" &&
      (typeof step.details?.approvalId === "string" ||
        step.summary?.includes("审批等待") === true),
  );

  const hasUnresolvedApproval = approvalWaitSteps.some((step) => {
    const toolCallId = getStepDetailString(step, "toolCallId");
    return !toolCallId || !resumedToolCallIds.has(toolCallId);
  });
  if (hasUnresolvedApproval) {
    return "waiting_approval";
  }
  if (resumeSteps.length > 0) {
    return "running";
  }

  return approvalWaitSteps.length > 0 ? "waiting_approval" : null;
};

const getLatestPlannerThought = (steps: RagNodeLike[]) => {
  const plannerStep = [...steps]
    .reverse()
    .find((step) => step.nodeType === "plan" && step.phase === "done");
  if (!plannerStep) {
    return null;
  }

  const reason = getStepDetailString(plannerStep, "reason");
  const text = reason || plannerStep.summary;
  return text ? normalizeInlineText(text) : null;
};

const getAgentInnerStatus = (
  steps: RagNodeLike[],
  approvalTraceState: ApprovalTraceState,
) => {
  const hasFinishedAnswer = steps.some(
    (step) =>
      step.phase === "done" &&
      (step.nodeType === "generate" || step.nodeType === "evaluate"),
  );
  const hasFailed = steps.some((step) => step.phase === "error");
  if (hasFinishedAnswer || hasFailed) {
    return null;
  }

  const plannerThought = getLatestPlannerThought(steps);
  const activeStep = [...steps].reverse().find((step) => step.phase === "start");

  if (activeStep?.nodeType === "generate" && plannerThought) {
    return plannerThought;
  }

  if (activeStep) {
    const display = getDisplayExecutionStep(activeStep);
    const activeText = display.summary || activeStep.summary;
    if (activeText) {
      return normalizeInlineText(activeText);
    }
  }

  if (approvalTraceState === "waiting_approval" && plannerThought) {
    return `${plannerThought}，等你确认后继续。`;
  }

  if (plannerThought) {
    return plannerThought;
  }

  const latestMeaningfulStep = [...steps]
    .reverse()
    .find(
      (step) =>
        step.phase === "done" &&
        step.nodeType !== "approval" &&
        Boolean(step.summary),
    );
  return latestMeaningfulStep?.summary
    ? normalizeInlineText(latestMeaningfulStep.summary)
    : null;
};

// UChatExecutionTrace renders the inline retrieval/generation progress row.
export function UChatExecutionTrace({
  messageId,
  steps,
  agentStatus,
  onOpenDetail,
}: {
  messageId?: string;
  steps: RagNodeLike[];
  agentStatus?: AgentTraceStatus;
  onOpenDetail: (detail: UChatExecutionProgressDetail) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) {
    return null;
  }

  const approvalTraceState = getApprovalTraceState(steps, agentStatus);
  const innerStatus = getAgentInnerStatus(steps, approvalTraceState);
  const summary =
    approvalTraceState === "waiting_approval"
      ? t("chat.thread.agent.waitingApprovalTitle")
      : approvalTraceState === "running"
        ? t("chat.thread.agent.running")
        : summarizeRagProgress(steps);
  const runningCount = steps.filter((step) => step.phase === "start").length;
  const completedCount = steps.filter((step) => step.phase === "done").length;
  const showActiveSpinner =
    approvalTraceState === "running" || runningCount > 0;

  return (
    <div className="mt-4 border-b border-border/60 pb-2 transition-[border-color] duration-200">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 text-left transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden text-sm">
          <p className="min-w-0 truncate text-text-secondary">{summary}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {approvalTraceState === null ? (
            <span className="hidden text-[11px] text-text-tertiary sm:inline">
              {t("chat.executionTrace.stepCount", {
                completed: completedCount,
                total: steps.length,
              })}
            </span>
          ) : null}
          {showActiveSpinner ? (
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-text-tertiary" />
          ) : null}
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          )}
        </div>
      </button>

      <div
        aria-hidden={!expanded}
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0">
          <div className="mt-1 border-t border-border/50 pt-1.5">
            {steps.map((step, index) => {
              const display = getDisplayExecutionStep(step);
              const clickable =
                step.phase !== "start" &&
                ((!!step.details && Object.keys(step.details).length > 0) ||
                  (!!step.environment &&
                    Object.keys(step.environment).length > 0));
              const StatusIcon =
                step.phase === "error"
                  ? AlertCircle
                  : step.phase === "start"
                    ? LoaderCircle
                    : CheckCircle2;

              return (
                <button
                  type="button"
                  key={step.attemptKey ?? step.nodeId}
                  disabled={!clickable || !messageId}
                  onClick={() => {
                    if (!clickable || !messageId) {
                      return;
                    }

                    onOpenDetail({
                      messageId,
                      nodeId: step.nodeId,
                      nodeType: step.nodeType,
                      label: display.label,
                      status: step.phase,
                      summary: display.summary,
                      details: step.details,
                      environment: step.environment,
                    });
                  }}
                  className={`flex w-full items-start gap-2.5 px-1 py-1.5 text-left transition-colors duration-150 ${
                    clickable
                      ? "cursor-pointer hover:bg-[rgba(var(--color-primary),0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      : "cursor-default"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                      step.phase === "error"
                        ? "bg-rose-500/10 text-rose-600"
                        : step.phase === "start"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-[rgba(var(--color-primary),0.10)] text-primary"
                    }`}
                  >
                    {step.phase === "start" ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                    <p className="shrink-0 text-[13px] font-medium text-text-primary">
                      {display.label}
                    </p>
                    {display.summary ? (
                      <>
                        <span className="shrink-0 text-text-tertiary">·</span>
                        <p className="min-w-0 truncate text-[12px] leading-5 text-text-secondary">
                          {display.summary}
                        </p>
                      </>
                    ) : null}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2 pt-0.5">
                    <StatusIcon
                      className={`h-3.5 w-3.5 ${
                        step.phase === "start"
                          ? "animate-spin text-text-tertiary"
                          : step.phase === "error"
                            ? "text-danger-text"
                            : "text-text-tertiary"
                      }`}
                    />
                    {clickable ? (
                      <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {innerStatus ? (
        <div
          data-testid="agent-inner-status"
          className="mt-2 flex items-start gap-2 px-1 text-[13px] leading-5 text-text-secondary"
        >
          <span
            className="mt-[7px] h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary/70"
            aria-hidden="true"
          />
          <p className="min-w-0 break-words">{innerStatus}</p>
        </div>
      ) : null}
    </div>
  );
}