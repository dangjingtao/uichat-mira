import {
  createGenericTaskResumeExposure,
  withGenericTaskDelegationTool,
} from "../delegation/contract.js";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "../node-runtime.js";
import type { AgentObservation } from "../types.js";
import { evidenceNode } from "./evidence.js";
import { forkedSkillAgentNode } from "./forked-skill-agent.js";
import { isGenericTaskApprovalToolCall } from "./generic-task-subagent.js";
import { prepareContextNode as basePrepareContextNode } from "./prepare-context.js";
import { prepareContextWithForkedSkillAgentNode } from "./prepare-context-with-forked-skill.js";

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const readDelegatedResult = (observation: AgentObservation | undefined) => {
  const data = asRecord(observation?.summary?.data);
  const preview = asRecord(data?.preview);
  return {
    status: typeof preview?.status === "string" ? preview.status : undefined,
    requirements: Array.isArray(preview?.requirements)
      ? preview.requirements
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
      : [],
  };
};

const buildNeedsInputQuestion = (requirements: Record<string, unknown>[]) => {
  const questions = requirements
    .filter((requirement) => requirement.kind === "user_input")
    .map((requirement) => {
      const userPrompt =
        typeof requirement.userPrompt === "string"
          ? requirement.userPrompt.trim()
          : "";
      const description =
        typeof requirement.description === "string"
          ? requirement.description.trim()
          : "";
      return userPrompt || description;
    })
    .filter(Boolean)
    .slice(0, 3);

  return questions.length > 0 ? questions.join("\n") : undefined;
};

const hasForkedSkillContext = (state: AgentNodeState) => {
  const frame = state.currentTaskFrame as
    | (NonNullable<AgentNodeState["currentTaskFrame"]> & {
        skillContext?: { primary?: { execution?: { context?: string } } };
      })
    | undefined;
  return frame?.skillContext?.primary?.execution?.context === "fork";
};

const addPlannerDelegationSurface = (
  patch: Partial<AgentNodeState>,
  fallback?: AgentNodeState["toolExposure"],
): Partial<AgentNodeState> => {
  const exposure = patch.toolExposure ?? fallback;
  if (!exposure) return patch;
  return {
    ...patch,
    toolExposure: withGenericTaskDelegationTool(exposure),
  };
};

const resumeGenericTaskSubAgent = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const prepared = await basePrepareContextNode(state, emit);
  const preparedState: AgentNodeState = { ...state, ...prepared };
  if (preparedState.errorMessage) return prepared;

  const resumeState: AgentNodeState = {
    ...preparedState,
    toolExposure: createGenericTaskResumeExposure({
      currentExposure: preparedState.toolExposure,
      pendingToolCall: state.pendingToolCall,
    }),
  };
  const delegated = await forkedSkillAgentNode(resumeState, emit);
  const observation = delegated.pendingEvidenceObservation;
  if (!observation) {
    return {
      ...prepared,
      ...delegated,
      errorMessage:
        "generic task subAgent approval resume returned without a structured observation.",
      errorSourceNodeId: "agent-generic-task-subagent",
    };
  }

  const delegatedState: AgentNodeState = { ...resumeState, ...delegated };
  const evidence = await evidenceNode(delegatedState, emit);
  const committed: Partial<AgentNodeState> = {
    ...prepared,
    ...delegated,
    ...evidence,
  };
  const result = readDelegatedResult(observation);

  if (delegated.pendingApproval) {
    return committed;
  }

  if (observation.status === "partial" && result.status === "needs_input") {
    const question = buildNeedsInputQuestion(result.requirements);
    if (!question) {
      return {
        ...committed,
        errorMessage: "subAgent returned needs_input without a user_input requirement.",
        errorSourceNodeId: "agent-generic-task-subagent",
        finalizationPacket: undefined,
      };
    }
    return {
      ...committed,
      nextAction: {
        type: "ask_user",
        question,
        reason:
          "The resumed delegated task reached a structured needs_input boundary; Parent must collect the missing information before continuing.",
      },
      finalizationPacket: undefined,
    };
  }

  if (observation.status === "blocked") {
    const errorMessage =
      observation.errorMessage ??
      "generic task subAgent reported a terminal execution failure after approval resume.";
    return {
      ...committed,
      errorMessage,
      errorSourceNodeId: "agent-generic-task-subagent",
      terminalReason: "generic_task_subagent_terminal_failure",
      finalizationPacket: undefined,
    };
  }

  // completed and recoverable outcomes both return to Main Planner. The child
  // owns only the task package, never the global completion decision.
  return {
    ...committed,
    nextAction: undefined,
    finalizationPacket: undefined,
  };
};

/**
 * Add the runtime delegation protocol after normal context preparation and any
 * Skill-owned subAgent work. It is visible to Main Planner only. Generic task
 * approval resumes are handled separately so Skill delivery semantics cannot
 * freeze a global finalization packet for a merely task-local completion.
 */
export const prepareContextWithDelegationNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  if (isGenericTaskApprovalToolCall(state.pendingToolCall)) {
    const resumed = await resumeGenericTaskSubAgent(state, emit);
    return addPlannerDelegationSurface(resumed, state.toolExposure);
  }

  const prepared = await prepareContextWithForkedSkillAgentNode(state, emit);
  if (hasForkedSkillContext({ ...state, ...prepared })) return prepared;
  return addPlannerDelegationSurface(prepared, state.toolExposure);
};
