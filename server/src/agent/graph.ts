import {
  Annotation,
  END,
  START,
  StateGraph,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { RetrievedChunk } from "@/services/rag-nodes";
import {
  type AgentIntentEmbeddingConfig,
  type CapabilityIntentResult,
  capabilitySelectNode,
  toolGuardNode,
} from "./intent/index.js";
import {
  evaluateNode,
  approvalNode,
  errorNode,
  generateNode,
  planNode,
  policyNode,
  prepareContextNode,
  routeStepNode,
  retrieveNode,
  toolNode,
  type EmitAgentExecutionNode,
} from "./nodes.js";
import type {
  AgentGoal,
  AgentGraphInput,
  AgentGraphOutput,
  AgentObservation,
  AgentPlan,
} from "./types.js";
import type { ContextBudgetAudit } from "@/services/context-budget/index.js";

const AGENT_EMIT_CONFIG_KEY = "agent:emitExecutionNode";
const DEFAULT_AGENT_MAX_ITERATIONS = 3;

const AgentGraphState = Annotation.Root({
  runId: Annotation<string>,
  threadId: Annotation<string>,
  userId: Annotation<number>,
  goal: Annotation<AgentGoal>,
  plan: Annotation<AgentPlan>,
  messages: Annotation<NormalizedChatMessage[]>,
  requestContextMessages: Annotation<NormalizedChatMessage[] | undefined>,
  params: Annotation<Record<string, unknown> | undefined>,
  knowledgeBaseId: Annotation<string | null | undefined>,
  intentConfig: Annotation<AgentIntentEmbeddingConfig | undefined>,
  capabilityIntent: Annotation<CapabilityIntentResult | undefined>,
  pendingApproval: Annotation<AgentGraphOutput["pendingApproval"] | undefined>,
  selectedCapabilityId: Annotation<string | undefined>,
  selectedToolId: Annotation<string | undefined>,
  pendingToolCall: Annotation<AgentGraphOutput["pendingToolCall"] | undefined>,
  lastToolExecution: Annotation<AgentGraphOutput["lastToolExecution"] | undefined>,
  answer: Annotation<string | undefined>,
  retrievedChunks: Annotation<RetrievedChunk[] | undefined>,
  observations: Annotation<AgentObservation[] | undefined>,
  evidence: Annotation<AgentGraphOutput["evidence"] | undefined>,
  blockedReason: Annotation<string | undefined>,
  terminalReason: Annotation<string | undefined>,
  contextBudget: Annotation<ContextBudgetAudit | undefined>,
  errorMessage: Annotation<string | undefined>,
  errorSourceNodeId: Annotation<string | undefined>,
  approvedInvocations: Annotation<AgentGraphInput["approvedInvocations"] | undefined>,
  iterationCount: Annotation<number | undefined>,
  maxIterations: Annotation<number | undefined>,
  continueIteration: Annotation<boolean | undefined>,
  postToolReviewPending: Annotation<boolean | undefined>,
  reviewDecision: Annotation<"capability" | "generate" | undefined>,
  reviewReason: Annotation<string | undefined>,
});

type AgentGraphStateType = typeof AgentGraphState.State;

const getEmitter = (
  config?: LangGraphRunnableConfig,
): EmitAgentExecutionNode | undefined => {
  const configurable = config?.configurable as
    | Record<string, unknown>
    | undefined;
  const candidate = configurable?.[AGENT_EMIT_CONFIG_KEY];
  return typeof candidate === "function"
    ? (candidate as EmitAgentExecutionNode)
    : undefined;
};

const createAgentNode = (
  nodeId: string,
  handler: (
    state: AgentGraphStateType,
    emit?: EmitAgentExecutionNode,
  ) => Promise<Partial<AgentGraphStateType>>,
) =>
  async (state: AgentGraphStateType, config?: LangGraphRunnableConfig) => {
    try {
      return await handler(state, getEmitter(config));
    } catch (error) {
      return {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorSourceNodeId: nodeId,
      };
    }
  };

const routeAfterCapabilityIntent = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  const selectedToolIds = state.capabilityIntent?.selectedToolIds ?? [];
  const lastToolId =
    state.lastToolExecution?.status === "completed"
      ? state.lastToolExecution.toolId
      : undefined;
  const isReviewingSameTool =
    state.postToolReviewPending &&
    Boolean(lastToolId) &&
    selectedToolIds.length > 0 &&
    selectedToolIds.every((toolId) => toolId === lastToolId);

  if (isReviewingSameTool) {
    return "generate";
  }

  if (selectedToolIds.length > 0) {
    return "policyStep";
  }

  if (state.postToolReviewPending) {
    return "generate";
  }

  return "retrieve";
};

const routeAfterPrepareContext = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "planStep";
};

const routeAfterPlanStep = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "capabilitySelectStep";
};

const routeAfterCapabilitySelect = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "toolGuardStep";
};

const routeAfterPolicy = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.pendingApproval) {
    return "approval";
  }

  if (state.selectedToolId) {
    return "tool";
  }

  if (state.postToolReviewPending) {
    return "generate";
  }

  return "retrieve";
};

const routeAfterTool = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.pendingApproval) {
    return "approval";
  }

  return "routeStep";
};

const routeAfterRouteStep = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.reviewDecision === "capability") {
    return "capabilitySelectStep";
  }

  return "generate";
};

const routeAfterRetrieve = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "routeStep";
};

const routeAfterGenerate = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "evaluate";
};

const routeAfterEvaluate = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.pendingApproval) {
    return END;
  }

  return END;
};

const routeAfterApproval = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return END;
};

const agentStateGraph = new StateGraph(AgentGraphState)
  .addNode("prepareContext", createAgentNode("prepareContext", prepareContextNode))
  .addNode("planStep", createAgentNode("planStep", planNode))
  .addNode(
    "capabilitySelectStep",
    createAgentNode("capabilitySelectStep", capabilitySelectNode),
  )
  .addNode("toolGuardStep", createAgentNode("toolGuardStep", toolGuardNode))
  .addNode("policyStep", createAgentNode("policyStep", policyNode))
  .addNode("routeStep", createAgentNode("routeStep", routeStepNode))
  .addNode("approval", createAgentNode("approval", approvalNode))
  .addNode("retrieve", createAgentNode("retrieve", retrieveNode))
  .addNode("tool", createAgentNode("tool", toolNode))
  .addNode("generate", createAgentNode("generate", generateNode))
  .addNode("evaluate", createAgentNode("evaluate", evaluateNode))
  .addNode("error", createAgentNode("error", errorNode))
  .addEdge(START, "prepareContext")
  .addConditionalEdges("prepareContext", routeAfterPrepareContext, [
    "planStep",
    "error",
  ])
  .addConditionalEdges("planStep", routeAfterPlanStep, [
    "capabilitySelectStep",
    "error",
  ])
  .addConditionalEdges("capabilitySelectStep", routeAfterCapabilitySelect, [
    "toolGuardStep",
    "error",
  ])
  .addConditionalEdges("toolGuardStep", routeAfterCapabilityIntent, [
    "policyStep",
    "retrieve",
    "generate",
    "error",
  ])
  .addConditionalEdges("policyStep", routeAfterPolicy, [
    "approval",
    "tool",
    "retrieve",
    "generate",
    "error",
  ])
  .addConditionalEdges("approval", routeAfterApproval, [END, "error"])
  .addConditionalEdges("retrieve", routeAfterRetrieve, ["routeStep", "error"])
  .addConditionalEdges("tool", routeAfterTool, [
    "approval",
    "routeStep",
    "generate",
    "error",
  ])
  .addConditionalEdges("routeStep", routeAfterRouteStep, [
    "capabilitySelectStep",
    "generate",
    "error",
  ])
  .addConditionalEdges("generate", routeAfterGenerate, ["evaluate", "error"])
  .addConditionalEdges("evaluate", routeAfterEvaluate, [END, "error"])
  .addEdge("error", END)
  .compile();

export const agentGraph = {
  async run(input: AgentGraphInput): Promise<AgentGraphOutput> {
    const state = await agentStateGraph.invoke(
      {
        runId: input.runId,
        threadId: input.threadId,
        userId: input.userId,
        goal: input.goal,
        plan: input.plan,
        messages: input.messages,
        requestContextMessages: input.requestContextMessages,
        params: input.params,
        knowledgeBaseId: input.knowledgeBaseId,
        intentConfig: input.intentConfig,
        observations: [],
        approvedInvocations: input.approvedInvocations,
        selectedCapabilityId: input.selectedCapabilityId,
        selectedToolId: input.selectedToolId,
        pendingToolCall: input.pendingToolCall,
        lastToolExecution: undefined,
        evidence: undefined,
        pendingApproval: undefined,
        iterationCount: 0,
        maxIterations: input.maxIterations ?? DEFAULT_AGENT_MAX_ITERATIONS,
        continueIteration: false,
        postToolReviewPending: false,
        reviewDecision: undefined,
        reviewReason: undefined,
      },
      {
        configurable: {
          [AGENT_EMIT_CONFIG_KEY]: input.onExecutionNode,
        },
      },
    );

    const answer = state.answer?.trim() ?? "";
    return {
      answer,
      observations: state.observations ?? [],
      evidence: state.evidence ?? {
        observations: state.observations ?? [],
        toolExecutions: [],
        retrievals: [],
      },
      retrievedChunks: state.retrievedChunks ?? [],
      capabilityIntent: state.capabilityIntent,
      pendingApproval: state.pendingApproval,
      selectedCapabilityId: state.selectedCapabilityId,
      selectedToolId:
        state.selectedToolId ??
        state.lastToolExecution?.toolId ??
        state.pendingApproval?.toolId,
      pendingToolCall: state.pendingToolCall,
      lastToolExecution: state.lastToolExecution,
      blockedReason: state.blockedReason,
      terminalReason:
        state.terminalReason ??
        (state.pendingApproval
          ? "waiting_approval"
          : state.errorMessage
            ? "failed_error"
            : state.blockedReason
              ? "blocked"
              : answer
                ? "completed"
                : "blocked"),
      contextBudget: state.contextBudget,
      errorMessage: state.errorMessage,
      errorSourceNodeId: state.errorSourceNodeId,
      status: state.pendingApproval
        ? "waiting_approval"
        : state.errorMessage
          ? "failed"
          : state.blockedReason
            ? "blocked"
          : answer
            ? "completed"
            : "blocked",
    };
  },

  get graph() {
    return agentStateGraph;
  },
};
