"use client";

import { useMemo } from "react";
import type { ChatMessage } from "../core";
import {
  getExecutionFailurePresentation,
  getExecutionProgressFromRenderableParts,
  toUChatRenderableParts,
} from "./executionParsers";
import {
  getDisplayExecutionSteps,
  getLatestSubAgentWorkingState,
} from "./subAgentTrace";

export const getUChatMessageTraceState = (message: ChatMessage) => {
  const allSteps = getExecutionProgressFromRenderableParts(
    toUChatRenderableParts(message),
  );
  const steps = getDisplayExecutionSteps(allSteps);
  const subAgentWorkingState = getLatestSubAgentWorkingState(allSteps);

  return {
    steps,
    allSteps,
    subAgentWorkingState,
    hasTrace: steps.length > 0 || subAgentWorkingState !== null,
    failurePresentation:
      message.status === "error"
        ? getExecutionFailurePresentation(steps, message.errorMessage)
        : null,
  };
};

export const useUChatMessageTrace = (message: ChatMessage) =>
  useMemo(() => getUChatMessageTraceState(message), [message]);
