"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "../core";
import { Button } from "@/shared/ui";
import type { UChatAgentUIController } from "./UChatAgentControls";

type AgentMessageMetadata = {
  status?: "waiting_approval" | "blocked" | "completed" | "failed";
  runId?: string;
  pendingApproval?: { toolId?: string; reason?: string };
  blockedReason?: string | null;
  terminalReason?: string | null;
  errorMessage?: string | null;
};

const getAgentMessageMetadata = (
  message: ChatMessage,
): AgentMessageMetadata | null =>
  message.metadata?.agent &&
  typeof message.metadata.agent === "object" &&
  !Array.isArray(message.metadata.agent)
    ? (message.metadata.agent as AgentMessageMetadata)
    : null;

export function UChatAgentMessageStatus({
  message,
  hideFailedStatus,
  controller,
}: {
  message: ChatMessage;
  hideFailedStatus: boolean;
  controller?: UChatAgentUIController;
}) {
  const { t } = useTranslation();
  const metadata = getAgentMessageMetadata(message);
  const [pendingAction, setPendingAction] = useState<{
    runId: string;
    action: "approve" | "reject";
  } | null>(null);
  const [actionError, setActionError] = useState<{
    runId: string;
    message: string;
  } | null>(null);

  const shouldRender =
    metadata?.status === "waiting_approval" ||
    metadata?.status === "blocked" ||
    (metadata?.status === "failed" && !hideFailedStatus);

  if (!metadata || !shouldRender) {
    return null;
  }

  const currentPendingAction =
    pendingAction && pendingAction.runId === metadata.runId
      ? pendingAction.action
      : null;
  const currentActionError =
    actionError && actionError.runId === metadata.runId
      ? actionError.message
      : null;

  const tone =
    metadata.status === "blocked"
      ? {
          containerClassName: "border border-rose-200 bg-rose-50 text-rose-700",
          detailClassName: "text-rose-700/90",
        }
      : metadata.status === "failed"
        ? {
            containerClassName:
              "border border-amber-200 bg-amber-50 text-amber-700",
            detailClassName: "text-amber-700/90",
          }
        : {
            containerClassName: "border border-sky-200 bg-sky-50 text-sky-700",
            detailClassName: "text-sky-700/90",
          };

  const runAction = async (action: "approve" | "reject", runId: string) => {
    setActionError(null);
    setPendingAction({ runId, action });
    try {
      if (action === "approve") {
        await controller?.onApprove?.(runId);
      } else {
        await controller?.onReject?.(runId);
      }
    } catch (error) {
      setActionError({
        runId,
        message:
          error instanceof Error
            ? error.message
            : t(
                action === "approve"
                  ? "chat.thread.agent.approveFailed"
                  : "chat.thread.agent.rejectFailed",
              ),
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div
      className={`inline-flex max-w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-sm ${tone.containerClassName}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">
          {metadata.status === "blocked"
            ? t("chat.thread.agent.blockedTitle")
            : metadata.status === "failed"
              ? t("chat.thread.agent.failedTitle")
              : t("chat.thread.agent.waitingApprovalTitle")}
        </div>
        <div className={`mt-1 break-words text-xs ${tone.detailClassName}`}>
          {metadata.status === "blocked"
            ? metadata.blockedReason ??
              metadata.errorMessage ??
              t("chat.thread.agent.blockedDetail")
            : metadata.status === "failed"
              ? metadata.errorMessage ?? t("chat.thread.agent.failedDetail")
              : metadata.pendingApproval?.reason ??
                t("chat.thread.agent.waitingApprovalDetail")}
        </div>
        {metadata.status === "waiting_approval" &&
        typeof metadata.runId === "string" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              className="min-w-[4.5rem] justify-center"
              disabled={currentPendingAction !== null}
              onClick={() => {
                void runAction("approve", metadata.runId as string);
              }}
            >
              {currentPendingAction === "approve"
                ? t("chat.thread.agent.approving")
                : t("common.actions.approve")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-w-[4.5rem] justify-center"
              disabled={currentPendingAction !== null}
              onClick={() => {
                void runAction("reject", metadata.runId as string);
              }}
            >
              {currentPendingAction === "reject"
                ? t("chat.thread.agent.rejecting")
                : t("common.actions.reject")}
            </Button>
          </div>
        ) : null}
        {currentActionError ? (
          <div className="mt-2 break-words text-xs text-rose-700/90">
            {currentActionError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
