import { withGenericTaskDelegationTool } from "../delegation/contract.js";
import type {
  AgentNodeState,
  EmitAgentExecutionNode,
} from "../node-runtime.js";
import { prepareContextWithForkedSkillAgentNode } from "./prepare-context-with-forked-skill.js";

/**
 * Add the runtime delegation protocol after normal context preparation and any
 * Skill-owned subAgent work. It is visible to Main Planner only. The generic
 * worker derives its Harness bindings from the underlying exposure and removes
 * delegate_task before starting, so recursion is impossible in V1.
 */
export const prepareContextWithDelegationNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  const prepared = await prepareContextWithForkedSkillAgentNode(state, emit);
  const exposure = prepared.toolExposure ?? state.toolExposure;
  if (!exposure) return prepared;

  return {
    ...prepared,
    toolExposure: withGenericTaskDelegationTool(exposure),
  };
};
