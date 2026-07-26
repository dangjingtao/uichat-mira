import { getSkillAgentExecutionProfile } from "@/skills/agent/profiles.js";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime.js";
import type {
  AgentEvidenceReference,
  AgentFinalizationPacket,
  AgentToolExposureState,
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

const narrowParentRecoveryToolExposure = (input: {
  skillId: string;
  toolExposure?: AgentToolExposureState;
}): AgentToolExposureState | undefined => {
  if (!input.toolExposure) return undefined;
  const profile = getSkillAgentExecutionProfile(input.skillId);
  const allowed = new Set(profile.allowedHarnessToolIds);
  return {
    exposedTools: input.toolExposure.exposedTools.filter((toolId) => allowed.has(toolId)),
    toolMeta: input.toolExposure.toolMeta.filter((tool) => allowed.has(tool.toolId)),
  };
};

/**
 * Compatibility wrapper for Skill-owned subAgent execution.
 *
 * A matched Skill delegates task-local work to one isolated subAgent. Parent
 * retains approval, recovery and final response governance without taking
 * construction ownership back from the subAgent.
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
  const skillId =
    delegatedObservation.stepId.replace(/^(?:skill_agent|subagent):/, "") || "skill";

  // Approval is Parent-governed and wins over needs_input. The Main runtime
  // pauses immediately, preserving the frozen exact invocation and checkpoint.
  if (delegated.pendingApproval) {
    return committed;
  }

  // needs_input is a terminal handoff from the subAgent, not an invitation for
  // Main Planner to take construction ownership back.
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
          "subAgent reached a governed needs_input boundary; Parent must ask for the missing information before replaying delegated execution.",
      },
    };
  }

  // insufficient_evidence and recoverable failure remain Parent recovery paths,
  // but recovery may only use the active Skill profile's declared Harness
  // surface. Parent must not bypass private runtimes through unrelated tools.
  if (
    delegatedObservation.status === "partial" ||
    delegatedObservation.status === "failed"
  ) {
    return {
      ...committed,
      toolExposure: narrowParentRecoveryToolExposure({
        skillId,
        toolExposure: preparedState.toolExposure,
      }),
    };
  }

  // A terminal subAgent failure preserves the existing Main Agent terminal C
  // contract: failed status, error finish path, Generate never runs.
  if (delegatedObservation.status === "blocked") {
    const errorMessage =
      delegatedObservation.errorMessage ??
      "subAgent reported a terminal execution failure.";
    return {
      ...committed,
      errorMessage,
      errorSourceNodeId: "agent-forked-skill-agent",
      terminalReason: "skill_agent_terminal_failure",
    };
  }

  // completed means task-local execution ownership has finished. Freeze a
  // Parent finalization packet over the committed observation so the Main loop
  // can go directly to Generate instead of rebuilding the deliverable.
  const evidenceRef = `observation:${observationIndex}` as AgentEvidenceReference;
  const finalizationPacket: AgentFinalizationPacket = {
    type: "answer",
    reason: `subAgent for Skill ${skillId} completed the delegated task-local execution; Parent finalization may now deliver the grounded result without replanning construction.`,
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
