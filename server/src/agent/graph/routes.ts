import { END } from "@langchain/langgraph";
import { DEFAULT_AGENT_MAX_ITERATIONS } from "./state";
import type { AgentGraphStateType } from "./state";

const hasFrozenPendingToolCall = (
  pendingToolCall: AgentGraphStateType["pendingToolCall"],
) =>
  Boolean(
    pendingToolCall &&
      pendingToolCall.source === "planner" &&
      "status" in pendingToolCall &&
      pendingToolCall.status === "frozen",
  );

export const routeAfterToolGuard = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "nextActionPlanner";
};

export const routeAfterPrepareContext = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "planStep";
};

export const routeAfterPlanStep = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (hasFrozenPendingToolCall(state.pendingToolCall)) {
    return "policyStep";
  }

  return "toolSelectStep";
};

export const routeAfterToolSelect = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "toolGuardStep";
};

export const routeAfterNextAction = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  switch (state.nextAction?.type) {
    case "answer":
      return "generate";
    case "retrieve":
      return "retrieve";
    case "ask_user":
      return "generate";
    case "use_tool":
      return "toolCallNormalize";
    case "error":
      return state.schemaReplanDiagnostics ? "generate" : "error";
    default:
      return "error";
  }
};

export const routeAfterToolCallNormalize = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.schemaReplanDiagnostics) {
    return state.schemaReplanDiagnostics.attemptCount <= 1
      ? "nextActionPlanner"
      : "generate";
  }

  if (!state.pendingToolCall) {
    return "error";
  }

  return "policyStep";
};

export const routeAfterPolicy = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.pendingApproval) {
    return "approval";
  }

  if (
    state.policyDecision?.type === "allow" &&
    state.policyDecision.toolId === state.pendingToolCall?.toolId &&
    state.policyDecision.inputHash === state.pendingToolCall?.inputHash
  ) {
    return "tool";
  }

  return "generate";
};

export const routeAfterTool = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.pendingApproval) {
    return "approval";
  }

  const iterationCount = state.iterationCount ?? 0;
  const maxIterations = state.maxIterations ?? DEFAULT_AGENT_MAX_ITERATIONS;
  if (maxIterations > 0 && iterationCount >= maxIterations) {
    return "generate";
  }

  return "toolSelectStep";
};

export const routeAfterRetrieve = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  const iterationCount = state.iterationCount ?? 0;
  const maxIterations = state.maxIterations ?? DEFAULT_AGENT_MAX_ITERATIONS;
  if (maxIterations > 0 && iterationCount >= maxIterations) {
    return "generate";
  }

  return "toolSelectStep";
};

export const routeAfterGenerate = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "evaluate";
};

export const routeAfterEvaluate = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.pendingApproval) {
    return END;
  }

  return END;
};

export const routeAfterApproval = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return END;
};
