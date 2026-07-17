import {
  approvalNode,
  errorNode,
  evaluateNode,
  evidenceNode,
  generateNode,
  nextActionPlannerNode,
  policyNode,
  prepareContextNode,
  retrieveNode,
  toolCallNormalizeNode,
  toolNode,
} from "../nodes/index";
import { mapGraphStateToOutput } from "../graph/output";
import {
  createInitialAgentGraphState,
  type AgentGraphStateType,
} from "../graph/state";
import {
  runWithAgentNodeSpan,
  runWithAgentRunSpan,
} from "../observability";
import { buildPlannerRecoveryContext } from "../recovery";
import type {
  AgentGraphInput,
  AgentGraphOutput,
} from "../types";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "../node-runtime";

export type PiAgentLoopNodeHandler = (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
) => Promise<Partial<AgentNodeState>>;

export interface PiAgentLoopNodes {
  prepareContext: PiAgentLoopNodeHandler;
  planner: PiAgentLoopNodeHandler;
  normalizeToolCall: PiAgentLoopNodeHandler;
  policy: PiAgentLoopNodeHandler;
  approval: PiAgentLoopNodeHandler;
  retrieve: PiAgentLoopNodeHandler;
  tool: PiAgentLoopNodeHandler;
  evidence: PiAgentLoopNodeHandler;
  generate: PiAgentLoopNodeHandler;
  evaluate: PiAgentLoopNodeHandler;
  error: PiAgentLoopNodeHandler;
}

const defaultNodes: PiAgentLoopNodes = {
  prepareContext: prepareContextNode,
  planner: nextActionPlannerNode,
  normalizeToolCall: toolCallNormalizeNode,
  policy: policyNode,
  approval: approvalNode,
  retrieve: retrieveNode,
  tool: toolNode,
  evidence: evidenceNode,
  generate: generateNode,
  evaluate: evaluateNode,
  error: errorNode,
};

const mergeStatePatch = (
  state: AgentGraphStateType,
  patch: Partial<AgentNodeState>,
) => {
  Object.assign(state, patch);
};

const toNodeFailurePatch = (
  nodeName: string,
  error: unknown,
): Partial<AgentNodeState> => ({
  errorMessage: error instanceof Error ? error.message : String(error),
  errorSourceNodeId: nodeName,
});

const runNode = async (input: {
  nodeName: string;
  handler: PiAgentLoopNodeHandler;
  state: AgentGraphStateType;
  emit?: EmitAgentExecutionNode;
}) => {
  try {
    const patch = await runWithAgentNodeSpan({
      nodeName: input.nodeName,
      state: input.state,
      run: () => input.handler(input.state, input.emit),
      mergeResult: (result) => result,
    });
    mergeStatePatch(input.state, patch);
  } catch (error) {
    mergeStatePatch(
      input.state,
      toNodeFailurePatch(input.nodeName, error),
    );
  }
};

const shouldGenerateAfterRecoverableFailure = (
  state: AgentGraphStateType,
) => {
  if (
    state.lastToolExecution?.status !== "failed" ||
    state.lastToolExecution.failureKind === "terminal"
  ) {
    return false;
  }

  const recovery = buildPlannerRecoveryContext(state);
  return recovery.source === "tool_failure" && recovery.exhausted;
};

const createPiAgentLoopRunner = (nodes: PiAgentLoopNodes) => {
  const finishWithError = async (
    state: AgentGraphStateType,
    emit?: EmitAgentExecutionNode,
  ): Promise<AgentGraphOutput> => {
    await runNode({
      nodeName: "error",
      handler: nodes.error,
      state,
      emit,
    });
    return mapGraphStateToOutput(state);
  };

  const finishWithAnswer = async (
    state: AgentGraphStateType,
    emit?: EmitAgentExecutionNode,
  ): Promise<AgentGraphOutput> => {
    await runNode({
      nodeName: "generate",
      handler: nodes.generate,
      state,
      emit,
    });
    if (state.errorMessage) {
      return finishWithError(state, emit);
    }

    await runNode({
      nodeName: "evaluate",
      handler: nodes.evaluate,
      state,
      emit,
    });
    if (state.errorMessage) {
      return finishWithError(state, emit);
    }

    return mapGraphStateToOutput(state);
  };

  const finishWaitingApproval = async (
    state: AgentGraphStateType,
    emit?: EmitAgentExecutionNode,
  ): Promise<AgentGraphOutput> => {
    await runNode({
      nodeName: "approval",
      handler: nodes.approval,
      state,
      emit,
    });
    if (state.errorMessage) {
      return finishWithError(state, emit);
    }
    return mapGraphStateToOutput(state);
  };

  const collectPendingEvidence = async (
    state: AgentGraphStateType,
    emit?: EmitAgentExecutionNode,
  ) => {
    await runNode({
      nodeName: "evidenceStage",
      handler: nodes.evidence,
      state,
      emit,
    });
  };

  const executeFrozenToolCall = async (
    state: AgentGraphStateType,
    emit?: EmitAgentExecutionNode,
  ): Promise<AgentGraphOutput | null> => {
    await runNode({
      nodeName: "policyStep",
      handler: nodes.policy,
      state,
      emit,
    });

    if (state.pendingApproval) {
      return finishWaitingApproval(state, emit);
    }
    if (state.errorMessage) {
      return finishWithError(state, emit);
    }
    if (state.policyDecision?.type !== "allow") {
      return finishWithAnswer(state, emit);
    }

    await runNode({
      nodeName: "tool",
      handler: nodes.tool,
      state,
      emit,
    });

    if (state.pendingApproval) {
      return finishWaitingApproval(state, emit);
    }

    await collectPendingEvidence(state, emit);

    if (shouldGenerateAfterRecoverableFailure(state)) {
      return finishWithAnswer(state, emit);
    }
    if (state.errorMessage) {
      return finishWithError(state, emit);
    }

    return null;
  };

  const run = async (input: AgentGraphInput): Promise<AgentGraphOutput> =>
    runWithAgentRunSpan({
      graphInput: input,
      run: async () => {
        const state = createInitialAgentGraphState(input);
        const emit = input.onExecutionNode;

        await runNode({
          nodeName: "prepareContext",
          handler: nodes.prepareContext,
          state,
          emit,
        });
        if (state.errorMessage) {
          return finishWithError(state, emit);
        }

        if (state.pendingToolCall) {
          const resumedResult = await executeFrozenToolCall(state, emit);
          if (resumedResult) {
            return resumedResult;
          }
        }

        while (true) {
          await runNode({
            nodeName: "nextActionPlanner",
            handler: nodes.planner,
            state,
            emit,
          });

          if (state.pendingApproval) {
            return finishWaitingApproval(state, emit);
          }
          if (state.errorMessage) {
            return finishWithError(state, emit);
          }

          switch (state.nextAction?.type) {
            case "answer":
            case "ask_user":
              return finishWithAnswer(state, emit);

            case "retrieve":
              await runNode({
                nodeName: "retrieve",
                handler: nodes.retrieve,
                state,
                emit,
              });
              await collectPendingEvidence(state, emit);
              if (state.errorMessage) {
                return finishWithError(state, emit);
              }
              continue;

            case "use_tool": {
              await runNode({
                nodeName: "toolCallNormalize",
                handler: nodes.normalizeToolCall,
                state,
                emit,
              });

              if (state.errorMessage) {
                return finishWithError(state, emit);
              }
              if (state.schemaReplanDiagnostics) {
                if (state.schemaReplanDiagnostics.attemptCount <= 1) {
                  continue;
                }
                return finishWithAnswer(state, emit);
              }
              if (!state.pendingToolCall) {
                mergeStatePatch(state, {
                  errorMessage:
                    "Pi agent loop did not receive a frozen pendingToolCall after normalization.",
                  errorSourceNodeId: "toolCallNormalize",
                });
                return finishWithError(state, emit);
              }

              const toolResult = await executeFrozenToolCall(state, emit);
              if (toolResult) {
                return toolResult;
              }
              continue;
            }

            case "error":
              return finishWithError(state, emit);

            default:
              mergeStatePatch(state, {
                errorMessage:
                  "Pi agent loop planner did not return a supported next action.",
                errorSourceNodeId: "nextActionPlanner",
              });
              return finishWithError(state, emit);
          }
        }
      },
      summarizeResult: (result) => result,
    });

  return { run };
};

export const createPiAgentLoop = (
  nodes: PiAgentLoopNodes = defaultNodes,
) => createPiAgentLoopRunner(nodes);

export const piAgentLoop = createPiAgentLoop();
