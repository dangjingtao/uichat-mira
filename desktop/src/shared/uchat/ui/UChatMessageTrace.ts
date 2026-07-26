"use client";

import { useMemo } from "react";
import type { ChatMessage } from "../core";
import {
  getExecutionFailurePresentation,
  getExecutionProgressFromRenderableParts,
  toUChatRenderableParts,
} from "./executionParsers";
import { getLatestSubAgentWorkingState } from "./subAgentTrace";

export const getUChatMessageTraceState = (message: ChatMessage) => {
  const steps = getExecutionProgressFromRenderableParts(
    toUChatRenderableParts(message),
  );
  const subAgentWorkingState = getLatestSubAgentWorkingState(steps);

  return {
    steps,
    subAgentWorkingState,
    hasTrace: steps.length > 0,
    failurePresentation:
      message.status === "error"
        ? getExecutionFailurePresentation(steps, message.errorMessage)
        : null,
  };
};

export const useUChatMessageTrace = (message: ChatMessage) =>
  useMemo(() => getUChatMessageTraceState(message), [message]);
