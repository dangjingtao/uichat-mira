import { getWorkspaceSelection } from "@/mcp/workspace.js";
import { loadSkillResource } from "@/skills/context/provider.js";
import type { SkillContext } from "@/skills/context/types.js";
import { runPiSkillAgent } from "./pi-core.js";
import { getSkillAgentExecutionProfile } from "./profiles.js";
import {
  createHarnessSkillAgentToolBinding,
  createPrivateWenShuRuntimeToolBinding,
} from "./tool-adapters.js";
import type {
  SkillAgentApprovedInvocation,
  SkillAgentExecutionInput,
  SkillAgentExecutionResult,
  SkillAgentToolBinding,
} from "./types.js";

const createSkillResourceTool = (skillId: string): SkillAgentToolBinding => ({
  id: "skill_read_resource",
  label: "Read Skill Resource",
  description:
    "Read one reference/template/example/script text resource belonging to the active Skill. This does not expand tool permissions.",
  inputSchema: {
    type: "object",
    required: ["uri"],
    additionalProperties: false,
    properties: {
      uri: {
        type: "string",
        description: `A resource URI owned by skill://${skillId}/...`,
      },
    },
  },
  execute: async (args) => {
    const uri = typeof args.uri === "string" ? args.uri.trim() : "";
    if (!uri.startsWith(`skill://${skillId}/`)) {
      throw new Error(`Skill resource must belong to active Skill ${skillId}: ${uri}`);
    }
    const loaded = await loadSkillResource({ skillId, uri });
    return {
      result: {
        uri: loaded.uri,
        kind: loaded.kind,
        content: loaded.content,
      },
      evidence: {
        status: "completed",
        actionTaken: `Loaded Skill resource ${uri}`,
        facts: [`Loaded ${uri}`],
      },
    };
  },
});

export const prepareWenShuPiSkillAgentPilot = (input: {
  goal: string;
  skillContext: SkillContext;
  workspaceRoot?: string;
  userId?: number;
  threadId?: string;
  turnId?: string;
  approvedInvocations?: SkillAgentApprovedInvocation[];
}) => {
  const skillId = input.skillContext.primary?.id;
  if (!skillId) {
    throw new Error("WenShu Pi Skill pilot requires a primary SkillContext");
  }
  const profile = getSkillAgentExecutionProfile(skillId);
  if (!profile) {
    throw new Error(`Skill is not enabled for the WenShu Pi pilot: ${skillId}`);
  }

  const selectedWorkspace = getWorkspaceSelection();
  const workspaceRoot = input.workspaceRoot?.trim() || selectedWorkspace.rootPath;
  if (!workspaceRoot) {
    throw new Error("WenShu Pi Skill pilot requires an active workspace");
  }

  const execution: SkillAgentExecutionInput = {
    goal: input.goal,
    skillContext: input.skillContext,
    workspaceRoot,
    userId: input.userId,
    threadId: input.threadId,
    turnId: input.turnId,
    approvedInvocations: input.approvedInvocations,
  };

  const tools: SkillAgentToolBinding[] = [createSkillResourceTool(skillId)];
  for (const toolId of profile.allowedHarnessToolIds) {
    tools.push(createHarnessSkillAgentToolBinding({ toolId, execution }));
  }
  for (const binding of profile.runtimeBindings) {
    if (binding.status !== "ready") continue;
    tools.push(
      createPrivateWenShuRuntimeToolBinding({
        runtimeId: binding.id,
        execution,
      }),
    );
  }

  return {
    profile,
    execution,
    tools,
  };
};

export const runWenShuPiSkillAgentPilot = async (input: {
  goal: string;
  skillContext: SkillContext;
  workspaceRoot?: string;
  userId?: number;
  threadId?: string;
  turnId?: string;
  approvedInvocations?: SkillAgentApprovedInvocation[];
}): Promise<SkillAgentExecutionResult> => {
  const prepared = prepareWenShuPiSkillAgentPilot(input);
  const result = await runPiSkillAgent({
    execution: prepared.execution,
    tools: prepared.tools,
  });

  if (
    result.status === "completed" &&
    result.evidence.length === 0 &&
    result.artifacts.length === 0
  ) {
    return {
      status: "insufficient_evidence",
      summary:
        "Forked Skill Agent declared completion without authoritative runtime Evidence or Artifact support.",
      evidence: result.evidence,
      artifacts: result.artifacts,
      missingEvidence: [
        "At least one authoritative Skill runtime Evidence or Artifact record is required before completed may be accepted.",
      ],
      trace: result.trace,
    };
  }

  return result;
};
