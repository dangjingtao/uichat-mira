import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime.js";
import type {
  AgentEvidenceReference,
  AgentFinalizationPacket,
} from "../types.js";
import { evidenceNode } from "./evidence.js";
import { forkedSkillAgentNode } from "./forked-skill-agent.js";
import { prepareContextNode as basePrepareContextNode } from "./prepare-context.js";

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

  // Approval and recoverable/insufficient paths remain Parent-governed. The Pi
  // loop will pause immediately when pendingApproval is present; otherwise the
  // Main Planner may recover from partial/recoverable evidence.
  if (delegatedObservation.status === "partial" || delegatedObservation.status === "failed") {
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
