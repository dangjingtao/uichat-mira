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
  capabilityIntentNode,
} from "./intent/index.js";
import {
  evaluateNode,
  approvalNode,
  errorNode,
  generateNode,
  planNode,
  policyNode,
  prepareContextNode,
  retrieveNode,
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
  answer: Annotation<string | undefined>,
  retrievedChunks: Annotation<RetrievedChunk[] | undefined>,
  observations: Annotation<AgentObservation[] | undefined>,
  blockedReason: Annotation<string | undefined>,
  contextBudget: Annotation<ContextBudgetAudit | undefined>,
  errorMessage: Annotation<string | undefined>,
  errorSourceNodeId: Annotation<string | undefined>,
  approvedToolIds: Annotation<string[] | undefined>,
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

  if ((state.capabilityIntent?.selectedCapabilityIds.length ?? 0) > 0) {
    return "policyStep";
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

  return "capabilityIntentStep";
};

const routeAfterPolicy = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  if (state.pendingApproval) {
    return "approval";
  }

  return "retrieve";
};

const routeAfterRetrieve = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "generate";
};

const routeAfterGenerate = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "evaluate";
};

const routeAfterEvaluate = (state: AgentGraphStateType) => {
  if (state.errorMessage || state.blockedReason) {
    return "error";
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
  .addNode("capabilityIntentStep", createAgentNode("capabilityIntentStep", capabilityIntentNode))
  .addNode("policyStep", createAgentNode("policyStep", policyNode))
  .addNode("approval", createAgentNode("approval", approvalNode))
  .addNode("retrieve", createAgentNode("retrieve", retrieveNode))
  .addNode("generate", createAgentNode("generate", generateNode))
  .addNode("evaluate", createAgentNode("evaluate", evaluateNode))
  .addNode("error", createAgentNode("error", errorNode))
  .addEdge(START, "prepareContext")
  .addConditionalEdges("prepareContext", routeAfterPrepareContext, [
    "planStep",
    "error",
  ])
  .addConditionalEdges("planStep", routeAfterPlanStep, [
    "capabilityIntentStep",
    "error",
  ])
  .addConditionalEdges("capabilityIntentStep", routeAfterCapabilityIntent, [
    "policyStep",
    "retrieve",
    "error",
  ])
  .addConditionalEdges("policyStep", routeAfterPolicy, ["approval", "retrieve", "error"])
  .addConditionalEdges("approval", routeAfterApproval, [END, "error"])
  .addEdge("retrieve", "generate")
  .addConditionalEdges("retrieve", routeAfterRetrieve, ["generate", "error"])
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
        approvedToolIds: input.approvedToolIds,
        pendingApproval: undefined,
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
      retrievedChunks: state.retrievedChunks ?? [],
      capabilityIntent: state.capabilityIntent,
      pendingApproval: state.pendingApproval,
      contextBudget: state.contextBudget,
      errorMessage: state.errorMessage,
      status: state.pendingApproval
        ? "waiting_approval"
        : state.errorMessage
          ? "failed"
          : answer && !state.blockedReason
            ? "completed"
            : "blocked",
    };
  },

  get graph() {
    return agentStateGraph;
  },
};
