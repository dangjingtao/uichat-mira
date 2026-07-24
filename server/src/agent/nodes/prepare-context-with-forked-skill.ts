import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime.js";
import type {
  AgentEvidenceReference,
  AgentFinalizationPacket,
} from "../types.js";
import { evidenceNode } from "./evidence.js";
import { forkedSkillAgentNode } from "./forked-skill-agent.js";
import { prepareContextNode as basePrepareContextNode } from "./prepare-context.js";

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const readDelegatedResult = (state: {
  summary?: { data?: unknown };
}) => {
  const data = asRecord(state.summary?.data);
  const preview = asRecord(data?.preview);
  const status = typeof preview?.status === "string" ? preview.status : undefined;
  const requirements = Array.isArray(preview?.requirements)
    ? preview.requirements
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  return { status, requirements };
};

const buildNeedsInputQuestion = (
  requirements: Record<string, unknown>[],
): string => {
  const questions = requirements
    .map((requirement) => {
      const description =
        typeof requirement.description === "string"
          ? requirement.description.trim()
          : "";
      return description;
    })
    .filter(Boolean);

  if (questions.length === 0) {
    return "还需要一项必要信息才能继续完成这个任务。请补充缺失的信息。";
  }
  return questions.join("\n");
};

/**
 * Compatibility wrapper for the forked Skill Agent pilot.
 *
 * Default behavior is unchanged unless MIRA_SKILL_AGENT_RUNTIME=pi-core.
 * Once a matched Skill delegates execution to the isolated Pi executor, the
 * Parent keeps governance/finalization ownership without taking task-local
 * construction back from the Skill Agent.
 */
export const prepareContextWithForkedSkillAgentNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const prepared = await basePrepareContextNode(state, emit);
  const preparedState: AgentNodeState = { ...state, ...prepared };
  if (preparedState.errorMessage) return prepared;

  const delegated = await forkedSkillAgentNode(preparedState, emit);
  const delegatedObservation = delegated.pendingEvidenceObservation;
  if (!delegatedObservation) {
    return {
      ...prepared,
      ...delegated,
    };
  }

  const delegatedState: AgentNodeState = { ...preparedState, ...delegated };
  const observationIndex = preparedState.evidence?.observations.length ?? 0;
  const evidence = await evidenceNode(delegatedState, emit);
  const committed = {
    ...prepared,
    ...delegated,
    ...evidence,
  };
  const delegatedResult = readDelegatedResult(delegatedObservation);

  // Approval is Parent-governed and wins over needs_input. The Pi loop pauses
  // immediately on pendingApproval, preserving the frozen exact invocation.
  if (delegated.pendingApproval) {
    return committed;
  }

  // needs_input is a terminal handoff from the delegated executor, not an
  // invitation for Main Planner to take construction ownership back. Route it
  // directly into the existing Parent ask_user / waiting_user finalization path.
  if (
    delegatedObservation.status === "partial" &&
    delegatedResult.status === "needs_input"
  ) {
    return {
      ...committed,
      nextAction: {
        type: "ask_user",
        question: buildNeedsInputQuestion(delegatedResult.requirements),
        reason:
          "Forked Skill Agent reached a governed needs_input boundary; Parent must ask for the missing information before replaying delegated execution.",
      },
    };
  }

  // insufficient_evidence and recoverable failure remain Parent recovery paths.
  if (
    delegatedObservation.status === "partial" ||
    delegatedObservation.status === "failed"
  ) {
    return committed;
  }

  // A terminal Skill failure must preserve the existing Main Agent terminal C
  // contract: Graph failed, finishReason/error path, Generate never runs.
  if (delegatedObservation.status === "blocked") {
    const errorMessage =
      delegatedObservation.errorMessage ??
      "Forked Skill Agent reported a terminal execution failure.";
    return {
      ...committed,
      errorMessage,
      errorSourceNodeId: "agent-forked-skill-agent",
      terminalReason: "skill_agent_terminal_failure",
    };
  }

  // completed means task-local execution ownership has finished. Freeze a
  // Parent finalization packet over the committed Skill observation so the Pi
  // loop can go directly to Generate instead of asking Main Planner to rebuild
  // the deliverable a second time.
  const skillId = delegatedObservation.stepId.replace(/^skill_agent:/, "") || "skill";
  const evidenceRef = `observation:${observationIndex}` as AgentEvidenceReference;
  const finalizationPacket: AgentFinalizationPacket = {
    type: "answer",
    reason: `Forked Skill Agent ${skillId} completed the delegated task-local execution; Parent finalization may now deliver the grounded result without replanning construction.`,
    completionProof: [
      {
        criterion: `Complete delegated ${skillId} Skill execution and preserve its Evidence/Artifact result.`,
        evidenceRefs: [evidenceRef],
      },
    ],
    unresolvedGaps: [],
  };

  return {
    ...committed,
    nextAction: finalizationPacket,
    finalizationPacket,
  };
};
