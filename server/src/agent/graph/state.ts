import {
  Annotation,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type { RetrievedChunk } from "@/services/rag-nodes";
import type { ContextBudgetAudit } from "@/services/context-budget/index";
import { runWithAgentNodeSpan } from "../observability";
import type { AgentIntentEmbeddingConfig, ToolIntentResult } from "../intent/index";
import type {
  AgentGraphInput,
  AgentGraphOutput,
  AgentGoal,
  AgentNextAction,
  AgentObservation,
  AgentPlan,
  AgentSchemaReplanDiagnostics,
  AgentToolExposureState,
} from "../types";
import type { EmitAgentExecutionNode } from "../node-runtime";
import { createInitialCurrentTaskFrame } from "../node-runtime";

export const AGENT_EMIT_CONFIG_KEY = "agent:emitExecutionNode";
export const DEFAULT_AGENT_MAX_ITERATIONS = 3;

export const AgentGraphStateAnnotation = Annotation.Root({
  runId: Annotation<string>,
  threadId: Annotation<string>,
  userId: Annotation<number>,
  goal: Annotation<AgentGoal>,
  plan: Annotation<AgentPlan>,
  currentTaskFrame: Annotation<AgentGraphOutput["currentTaskFrame"] | undefined>,
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
  schemaReplanDiagnostics: Annotation<AgentSchemaReplanDiagnostics | undefined>,
  generatedAnswerEmptyFallback: Annotation<boolean | undefined>,
  approvedInvocations: Annotation<AgentGraphInput["approvedInvocations"] | undefined>,
  iterationCount: Annotation<number | undefined>,
  maxIterations: Annotation<number | undefined>,
  continueIteration: Annotation<boolean | undefined>,
  postToolReviewPending: Annotation<boolean | undefined>,
  reviewDecision: Annotation<"tool" | "generate" | undefined>,
  reviewReason: Annotation<string | undefined>,
});

export type AgentGraphStateType = typeof AgentGraphStateAnnotation.State;

export const getEmitter = (
  config?: LangGraphRunnableConfig,
): EmitAgentExecutionNode | undefined => {
  const configurable = config?.configurable as Record<string, unknown> | undefined;
  const candidate = configurable?.[AGENT_EMIT_CONFIG_KEY];
  return typeof candidate === "function"
    ? (candidate as EmitAgentExecutionNode)
    : undefined;
};

export const createAgentNode =
  (
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

export const createInitialAgentGraphState = (
  input: AgentGraphInput,
): AgentGraphStateType => ({
  runId: input.runId,
  threadId: input.threadId,
  userId: input.userId,
  goal: input.goal,
  plan: input.plan,
  currentTaskFrame:
    input.currentTaskFrame ??
    createInitialCurrentTaskFrame({
      goal: input.goal,
      messages: input.messages,
      workspaceRoot: input.workspaceRoot,
      knowledgeBaseId: input.knowledgeBaseId,
    }),
  messages: input.messages,
  requestContextMessages: input.requestContextMessages,
  params: input.params,
  knowledgeBaseId: input.knowledgeBaseId,
  intentConfig: input.intentConfig,
  workspaceRoot: input.workspaceRoot,
  toolIntent: undefined,
  observations: [],
  approvedInvocations: input.approvedInvocations,
  policyDecision: input.policyDecision,
  toolExposure: undefined,
  selectedToolId: input.selectedToolId,
  pendingToolCall: input.pendingToolCall,
  nextAction: undefined,
  lastToolExecution: undefined,
  answer: undefined,
  retrievedChunks: undefined,
  evidence: undefined,
  blockedReason: undefined,
  terminalReason: undefined,
  contextBudget: undefined,
  errorMessage: undefined,
  errorSourceNodeId: undefined,
  pendingApproval: undefined,
  schemaReplanDiagnostics: undefined,
  generatedAnswerEmptyFallback: false,
  iterationCount: 0,
  maxIterations: input.maxIterations ?? DEFAULT_AGENT_MAX_ITERATIONS,
  continueIteration: false,
  postToolReviewPending: false,
  reviewDecision: undefined,
  reviewReason: undefined,
});
