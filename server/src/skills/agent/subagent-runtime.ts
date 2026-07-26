import crypto from "node:crypto";
import { getWorkspaceSelection } from "@/mcp/workspace.js";
import { loadSkillResource } from "@/skills/context/provider.js";
import type { SkillContext } from "@/skills/context/types.js";
import { runPiSkillAgent } from "./pi-core.js";
import { resolveSubAgentExecutionProfile } from "./profiles.js";
import {
  createHarnessSkillAgentToolBinding,
  createPrivateWenShuRuntimeToolBinding,
} from "./tool-adapters.js";
import type {
  SubAgentApprovedInvocation,
  SubAgentCheckpoint,
  SubAgentExecutionInput,
  SubAgentExecutionResult,
  SubAgentRequirement,
  SubAgentRuntimeEvent,
  SubAgentToolBinding,
  SubAgentTraceEvent,
  SubAgentWorkingState,
} from "./types.js";

const createSkillResourceTool = (skillId: string): SubAgentToolBinding => ({
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
  checkpoint?: SubAgentCheckpoint;
}): SubAgentExecutionResult | null => {
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

  const requirements: SubAgentRequirement[] = [
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
      "A formal acceptance report requires project-specific facts; authoritative-looking business content must not be fabricated.",
    requirements,
    evidence: [],
    artifacts: [],
    trace: { engine: "pi-agent-core", skillId, toolCalls: [] },
  };
};

type PrepareSubAgentInput = {
  goal: string;
  skillContext: SkillContext;
  workspaceRoot?: string;
  userId?: number;
  threadId?: string;
  turnId?: string;
  approvedInvocations?: SubAgentApprovedInvocation[];
  checkpoint?: SubAgentCheckpoint;
  onRuntimeEvent?: (event: SubAgentRuntimeEvent) => Promise<void> | void;
};

const capabilityRequirement = (skillId: string, capabilityId: string): SubAgentRequirement => ({
  id: `capability:${skillId}:${capabilityId}`,
  kind: "capability",
  description: `Skill ${skillId} requires capability ${capabilityId}, but no governed adapter is currently available to this subAgent.`,
  requiredFor: capabilityId,
});

const publishBlockedCapabilityState = async (input: {
  skillId: string;
  requirements: SubAgentRequirement[];
  onRuntimeEvent?: PrepareSubAgentInput["onRuntimeEvent"];
}) => {
  const runId = crypto.randomUUID();
  const timestamp = Date.now();
  const reason = input.requirements.map((item) => item.description).join("；");
  const state: SubAgentWorkingState = {
    runId,
    skillId: input.skillId,
    phase: "blocked",
    currentJudgement: "Skill 说明书已读取，但当前环境没有提供它声明的受管能力。",
    currentAction: "等待所需能力可用",
    nextAction: "启用或授权能力后重新发起任务",
    blockingReason: reason,
    updatedAt: timestamp,
  };
  const event: SubAgentTraceEvent = {
    runId,
    seq: 1,
    eventId: crypto.randomUUID(),
    skillId: input.skillId,
    type: "input.required",
    title: "subAgent 缺少执行能力",
    timestamp,
    details: {
      requirements: input.requirements.map((item) => ({
        kind: item.kind,
        requiredFor: item.requiredFor,
      })),
    },
  };
  await input.onRuntimeEvent?.({ kind: "trace", event });
  await input.onRuntimeEvent?.({ kind: "working_state", state });
  return { runId, state, event };
};

export const prepareSubAgent = (input: PrepareSubAgentInput) => {
  const primary = input.skillContext.primary;
  const skillId = primary?.id;
  if (!primary || !skillId) {
    throw new Error("subAgent requires one primary SkillContext");
  }
  const profile = resolveSubAgentExecutionProfile(primary);

  const selectedWorkspace = getWorkspaceSelection();
  const workspaceRoot = input.workspaceRoot?.trim() || selectedWorkspace.rootPath || undefined;
  if (profile.workspaceBound && !workspaceRoot) {
    throw new Error(`Skill ${skillId} requires an active workspace`);
  }

  const execution: SubAgentExecutionInput = {
    goal: input.goal,
    skillContext: input.skillContext,
    workspaceRoot,
    userId: input.userId,
    threadId: input.threadId,
    turnId: input.turnId,
    approvedInvocations: input.approvedInvocations,
    checkpoint: input.checkpoint,
    onRuntimeEvent: input.onRuntimeEvent,
  };

  const tools: SubAgentToolBinding[] = [createSkillResourceTool(skillId)];
  const missingCapabilities: SubAgentRequirement[] = [];

  for (const toolId of profile.allowedHarnessToolIds) {
    try {
      tools.push(createHarnessSkillAgentToolBinding({ toolId, execution }));
    } catch {
      missingCapabilities.push(capabilityRequirement(skillId, toolId));
    }
  }
  for (const binding of profile.runtimeBindings) {
    if (binding.status !== "ready") {
      missingCapabilities.push(capabilityRequirement(skillId, binding.id));
      continue;
    }
    try {
      tools.push(
        createPrivateWenShuRuntimeToolBinding({
          runtimeId: binding.id,
          execution,
        }),
      );
    } catch {
      missingCapabilities.push(capabilityRequirement(skillId, binding.id));
    }
  }

  return {
    profile,
    execution,
    tools,
    missingCapabilities,
  };
};

export const runSubAgent = async (
  input: PrepareSubAgentInput,
): Promise<SubAgentExecutionResult> => {
  const deterministicNeedsInput = buildDeterministicNeedsInput(input);
  if (deterministicNeedsInput) return deterministicNeedsInput;

  const prepared = prepareSubAgent(input);
  if (prepared.missingCapabilities.length > 0) {
    const published = await publishBlockedCapabilityState({
      skillId: prepared.profile.skillId,
      requirements: prepared.missingCapabilities,
      onRuntimeEvent: input.onRuntimeEvent,
    });
    return {
      status: "needs_input",
      summary: "The Skill instruction was loaded, but one or more declared capabilities are unavailable.",
      requirements: prepared.missingCapabilities,
      evidence: [],
      artifacts: [],
      trace: {
        engine: "pi-agent-core",
        skillId: prepared.profile.skillId,
        toolCalls: [],
        runId: published.runId,
        nextSeq: 2,
        workingState: published.state,
        events: [published.event],
      },
    };
  }

  const result = await runPiSkillAgent({
    execution: prepared.execution,
    tools: prepared.tools,
  });

  const requiresAuthoritativeRuntimeEvidence = prepared.profile.runtimeBindings.some(
    (binding) => binding.status === "ready",
  );
  if (
    requiresAuthoritativeRuntimeEvidence &&
    result.status === "completed" &&
    result.evidence.length === 0 &&
    result.artifacts.length === 0
  ) {
    return {
      status: "insufficient_evidence",
      summary:
        "The subAgent declared completion without authoritative Runtime Evidence or Artifact support.",
      evidence: result.evidence,
      artifacts: result.artifacts,
      missingEvidence: [
        "At least one authoritative Skill Runtime Evidence or Artifact record is required before completed may be accepted.",
      ],
      trace: result.trace,
    };
  }

  return result;
};

// Compatibility aliases for the previous WenShu-only entry point.
export const prepareWenShuPiSkillAgentPilot = prepareSubAgent;
export const runWenShuPiSkillAgentPilot = runSubAgent;
