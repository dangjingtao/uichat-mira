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
  type ToolIntentResult,
  toolSelectNode,
  toolGuardNode,
} from "./intent/index.js";
import {
  evaluateNode,
  approvalNode,
  errorNode,
  generateNode,
  nextActionPlannerNode,
  planNode,
  prepareContextNode,
  retrieveNode,
  toolCallNormalizeNode,
  toolNode,
  type EmitAgentExecutionNode,
} from "./nodes.js";
import { policyNode } from "./policy-node.js";
import {
  runWithAgentNodeSpan,
  runWithAgentRunSpan,
} from "./observability.js";
import type {
  AgentGoal,
  AgentGraphInput,
  AgentGraphOutput,
  AgentNextAction,
  AgentObservation,
  AgentPlan,
  AgentToolExposureState,
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
  workspaceRoot: Annotation<string | null | undefined>,
  toolIntent: Annotation<ToolIntentResult | undefined>,
  toolExposure: Annotation<AgentToolExposureState | undefined>,
  nextAction: Annotation<AgentNextAction | undefined>,
  pendingApproval: Annotation<AgentGraphOutput["pendingApproval"] | undefined>,
  policyDecision: Annotation<AgentGraphOutput["policyDecision"] | undefined>,
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
  reviewDecision: Annotation<"tool" | "generate" | undefined>,
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
      return await runWithAgentNodeSpan({
        nodeName: nodeId,
        state,
        run: () => handler(state, getEmitter(config)),
        mergeResult: (result) => result,
      });
    } catch (error) {
      return {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorSourceNodeId: nodeId,
      };
    }
  };

const hasFrozenPendingToolCall = (
  pendingToolCall: AgentGraphStateType["pendingToolCall"],
) =>
  Boolean(
    pendingToolCall &&
      pendingToolCall.source === "planner" &&
      "status" in pendingToolCall &&
      pendingToolCall.status === "frozen",
  );

const routeAfterToolGuard = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "nextActionPlanner";
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

  if (hasFrozenPendingToolCall(state.pendingToolCall)) {
    return "policyStep";
  }

  return "toolSelectStep";
};

const routeAfterToolSelect = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  return "toolGuardStep";
};

const routeAfterNextAction = (state: AgentGraphStateType) => {
  if (state.errorMessage) {
    return "error";
  }

  switch (state.nextAction?.type) {
    case "answer":
      return "generate";
    case "retrieve":
      return "retrieve";
    case "ask_user":
      // ask_user is retained only for legacy compatibility until a dedicated
      // askUserNode + waiting_user state are implemented.
      return "generate";
    case "use_tool":
      return "toolCallNormalize";
    case "error":
      return "error";
    default:
      return "error";
  }
};

const routeAfterToolCallNormalize = (state: AgentGraphStateType) => {
  if (state.errorMessage || !state.pendingToolCall) {
    return "error";
  }

  return "policyStep";
};

const routeAfterPolicy = (state: AgentGraphStateType) => {
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

  if (state.errorMessage) {
    return "error";
  }

  return "generate";
};

const routeAfterTool = (state: AgentGraphStateType) => {
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

const routeAfterRetrieve = (state: AgentGraphStateType) => {
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
    "toolSelectStep",
    createAgentNode("toolSelectStep", toolSelectNode),
  )
  .addNode("toolGuardStep", createAgentNode("toolGuardStep", toolGuardNode))
  .addNode(
    "nextActionPlanner",
    createAgentNode("nextActionPlanner", nextActionPlannerNode),
  )
  .addNode(
    "toolCallNormalize",
    createAgentNode("toolCallNormalize", toolCallNormalizeNode),
  )
  .addNode("policyStep", createAgentNode("policyStep", policyNode))
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
    "policyStep",
    "toolSelectStep",
    "error",
  ])
  .addConditionalEdges("toolSelectStep", routeAfterToolSelect, [
    "toolGuardStep",
    "error",
  ])
  .addConditionalEdges("toolGuardStep", routeAfterToolGuard, [
    "nextActionPlanner",
    "error",
  ])
  .addConditionalEdges("nextActionPlanner", routeAfterNextAction, [
    "generate",
    "retrieve",
    "toolCallNormalize",
    "error",
  ])
  .addConditionalEdges("toolCallNormalize", routeAfterToolCallNormalize, [
    "policyStep",
    "error",
  ])
  .addConditionalEdges("policyStep", routeAfterPolicy, [
    "approval",
    "tool",
    "generate",
    "error",
  ])
  .addConditionalEdges("approval", routeAfterApproval, [END, "error"])
  .addConditionalEdges("retrieve", routeAfterRetrieve, [
    "toolSelectStep",
    "generate",
    "error",
  ])
  .addConditionalEdges("tool", routeAfterTool, [
    "approval",
    "toolSelectStep",
    "error",
  ])
  .addConditionalEdges("generate", routeAfterGenerate, ["evaluate", "error"])
  .addConditionalEdges("evaluate", routeAfterEvaluate, [END, "error"])
  .addEdge("error", END)
  .compile();

export const agentGraph = {
  async run(input: AgentGraphInput): Promise<AgentGraphOutput> {
    return runWithAgentRunSpan({
      graphInput: input,
      run: async () => {
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
            workspaceRoot: input.workspaceRoot,
            observations: [],
            approvedInvocations: input.approvedInvocations,
            policyDecision: input.policyDecision,
            toolExposure: undefined,
            selectedToolId: input.selectedToolId,
            pendingToolCall: input.pendingToolCall,
            nextAction: undefined,
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
          toolIntent: state.toolIntent,
          pendingApproval: state.pendingApproval,
          policyDecision: state.policyDecision,
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
      summarizeResult: (result) => result,
    });
  },

  get graph() {
    return agentStateGraph;
  },
};
