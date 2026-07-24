import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime.js";
import { evidenceNode } from "./evidence.js";
import { forkedSkillAgentNode } from "./forked-skill-agent.js";
import { prepareContextNode as basePrepareContextNode } from "./prepare-context.js";

/**
 * Compatibility wrapper for the Skill V2 pilot.
 *
 * Default behavior is unchanged unless MIRA_SKILL_AGENT_RUNTIME=pi-core.
 * When enabled and the matched primary Skill has a forked-agent profile, the
 * isolated Skill executor runs after normal context preparation. Its bounded
 * result is committed through the existing Evidence writer before Planner sees
 * the turn, so Planner/Generate contracts remain the parent control boundary.
 */
export const prepareContextWithForkedSkillAgentNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const prepared = await basePrepareContextNode(state, emit);
  const preparedState: AgentNodeState = { ...state, ...prepared };
  if (preparedState.errorMessage) return prepared;

  const delegated = await forkedSkillAgentNode(preparedState, emit);
  if (!delegated.pendingEvidenceObservation) {
    return prepared;
  }

  const delegatedState: AgentNodeState = { ...preparedState, ...delegated };
  const evidence = await evidenceNode(delegatedState, emit);
  return {
    ...prepared,
    ...delegated,
    ...evidence,
  };
};
