"use client";

import { useMemo } from "react";
import type { ChatMessage } from "../core";
import {
  getExecutionFailurePresentation,
  getExecutionProgressFromRenderableParts,
  toUChatRenderableParts,
} from "./executionParsers";

export const getUChatMessageTraceState = (message: ChatMessage) => {
  const steps = getExecutionProgressFromRenderableParts(
    toUChatRenderableParts(message),
  );

  return {
    steps,
    hasTrace: steps.length > 0,
    failurePresentation:
      message.status === "error"
        ? getExecutionFailurePresentation(steps, message.errorMessage)
        : null,
  };
};

export const useUChatMessageTrace = (message: ChatMessage) =>
  useMemo(() => getUChatMessageTraceState(message), [message]);
