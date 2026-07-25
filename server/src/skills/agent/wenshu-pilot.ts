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
  SkillAgentCheckpoint,
  SkillAgentExecutionInput,
  SkillAgentExecutionResult,
  SkillAgentRequirement,
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

const ACCEPTANCE_REPORT_PATTERN = /(?:项目|工程|系统|产品)?验收报告|acceptance\s+report/i;
const TEMPLATE_OR_EXAMPLE_PATTERN = /模板|示例|样例|范例|通用|演示|template|sample|example/i;
const ACCEPTANCE_FACT_PATTERNS = [
  /项目名称\s*[:：]/i,
  /(?:委托方|甲方|建设单位|客户)\s*[:：]/i,
  /(?:承接方|乙方|承建单位|实施单位|供应商)\s*[:：]/i,
  /验收日期\s*[:：]|\b20\d{2}[-/.年]\d{1,2}/i,
  /(?:验收内容|验收范围|交付物|交付清单)\s*[:：]/i,
  /(?:验收标准|验收依据|验收条件)\s*[:：]/i,
  /(?:验收结论|验收结果)\s*[:：]|(?:通过|不通过)验收/i,
];

const buildDeterministicNeedsInput = (input: {
  goal: string;
  skillContext: SkillContext;
  checkpoint?: SkillAgentCheckpoint;
}): SkillAgentExecutionResult | null => {
  const skillId = input.skillContext.primary?.id;
  if (skillId !== "docx" || input.checkpoint) return null;
  const goal = input.goal.trim();
  if (!ACCEPTANCE_REPORT_PATTERN.test(goal) || TEMPLATE_OR_EXAMPLE_PATTERN.test(goal)) {
    return null;
  }

  const suppliedFactGroups = ACCEPTANCE_FACT_PATTERNS.filter((pattern) =>
    pattern.test(goal),
  ).length;
  if (suppliedFactGroups >= 3) return null;

  const requirements: SkillAgentRequirement[] = [
    {
      id: "docx:acceptance:project",
      kind: "user_input",
      description:
        "请提供项目名称、委托方/甲方、承接方/乙方，以及计划或实际验收日期。",
      requiredFor: "acceptance_report_identity",
    },
    {
      id: "docx:acceptance:scope",
      kind: "user_input",
      description:
        "请提供本次验收范围、主要交付物，以及采用的验收依据或通过标准。",
      requiredFor: "acceptance_report_scope",
    },
    {
      id: "docx:acceptance:result",
      kind: "user_input",
      description:
        "请提供实际完成情况、遗留问题（如有）和预期验收结论；若只需要空白模板，请明确说“生成模板”。",
      requiredFor: "acceptance_report_result",
    },
  ];

  return {
    status: "needs_input",
    summary:
      "A formal acceptance report requires project-specific facts; generating authoritative-looking business content from no source data would be fabrication.",
    requirements,
    evidence: [],
    artifacts: [],
    trace: { engine: "pi-agent-core", skillId, toolCalls: [] },
  };
};

export const prepareWenShuPiSkillAgentPilot = (input: {
  goal: string;
  skillContext: SkillContext;
  workspaceRoot?: string;
  userId?: number;
  threadId?: string;
  turnId?: string;
  approvedInvocations?: SkillAgentApprovedInvocation[];
  checkpoint?: SkillAgentCheckpoint;
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
    checkpoint: input.checkpoint,
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
  checkpoint?: SkillAgentCheckpoint;
}): Promise<SkillAgentExecutionResult> => {
  const deterministicNeedsInput = buildDeterministicNeedsInput(input);
  if (deterministicNeedsInput) return deterministicNeedsInput;

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
