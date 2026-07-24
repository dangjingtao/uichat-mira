import crypto from "node:crypto";
import { emitStepNode } from "../node-runtime.js";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime.js";
import type {
  AgentApprovalRequest,
  AgentObservation,
  AgentToolCallRequest,
} from "../types.js";
import type { SkillContext } from "@/skills/context/types.js";
import { getSkillAgentExecutionProfile } from "@/skills/agent/profiles.js";
import { runWenShuPiSkillAgentPilot } from "@/skills/agent/wenshu-pilot.js";
import type {
  SkillAgentApprovedInvocation,
  SkillAgentRequirement,
} from "@/skills/agent/types.js";

const isPiSkillRuntimeEnabled = () => {
  const value = process.env.MIRA_SKILL_AGENT_RUNTIME?.trim().toLowerCase();
  return value === "pi-core" || value === "pi_core";
};

type SkillAwareTaskFrame = NonNullable<AgentNodeState["currentTaskFrame"]> & {
  skillContext?: SkillContext;
};

const getSkillContext = (state: AgentNodeState) =>
  (state.currentTaskFrame as SkillAwareTaskFrame | undefined)?.skillContext;

const isSkillAgentPendingToolCall = (
  pendingToolCall: AgentToolCallRequest | undefined,
): pendingToolCall is Extract<AgentToolCallRequest, { source: "llm_tool_call" }> & {
  origin: "skill_agent";
  skillId?: string;
} =>
  Boolean(
    pendingToolCall &&
      "origin" in pendingToolCall &&
      pendingToolCall.origin === "skill_agent",
  );

const getReplayApprovedInvocations = (
  state: AgentNodeState,
): SkillAgentApprovedInvocation[] => {
  const pendingToolCall = state.pendingToolCall;
  if (!isSkillAgentPendingToolCall(pendingToolCall)) return [];

  // Only the invocation currently frozen for this resume may cross back into
  // the new fork. Older approvals from previous fork boundaries must not become
  // reusable grants that can repeat already-executed side effects.
  return (state.approvedInvocations ?? [])
    .filter(
      (approval) =>
        approval.toolId === pendingToolCall.toolId &&
        approval.inputHash === pendingToolCall.inputHash,
    )
    .map((approval) => ({
      toolId: approval.toolId,
      inputHash: approval.inputHash,
      input: approval.input,
    }));
};

const toObservationStatus = (
  status: "completed" | "insufficient_evidence" | "needs_input" | "failed",
  recoverable?: boolean,
): AgentObservation["status"] => {
  if (status === "completed") return "ok";
  if (status === "insufficient_evidence" || status === "needs_input") return "partial";
  return recoverable === false ? "blocked" : "failed";
};

const boundedJson = (value: unknown, maxChars = 8_000) => {
  try {
    const text = JSON.stringify(value);
    if (!text) return "null";
    return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`;
  } catch {
    return "[unserializable]";
  }
};

const findApprovalRequirement = (
  requirements: SkillAgentRequirement[] | undefined,
): SkillAgentRequirement | undefined =>
  requirements?.find(
    (requirement) =>
      requirement.kind === "approval" &&
      Boolean(requirement.toolId) &&
      Boolean(requirement.inputHash) &&
      Boolean(requirement.input),
  );

const buildParentApprovalPatch = (input: {
  state: AgentNodeState;
  skillId: string;
  requirement: SkillAgentRequirement;
  createdAt: string;
}): Pick<AgentNodeState, "pendingApproval" | "pendingToolCall" | "policyDecision"> => {
  const toolId = input.requirement.toolId!;
  const args = structuredClone(input.requirement.input!);
  const inputHash = input.requirement.inputHash!;
  const pendingToolCall: AgentToolCallRequest = {
    toolId,
    args,
    inputHash,
    source: "llm_tool_call",
    origin: "skill_agent",
    skillId: input.skillId,
    createdAt: input.createdAt,
  };
  const pendingApproval: AgentApprovalRequest = {
    id: crypto.randomUUID(),
    runId: input.state.runId,
    stepId: `skill_agent:${input.skillId}`,
    toolId,
    reason: input.requirement.description,
    input: args,
    inputHash,
    createdAt: input.createdAt,
  };
  return {
    pendingToolCall,
    pendingApproval,
    policyDecision: {
      type: "require_approval",
      toolId,
      inputHash,
      reason: input.requirement.description,
    },
  };
};

export const forkedSkillAgentNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  if (!isPiSkillRuntimeEnabled()) return {};

  const skillContext = getSkillContext(state);
  const skillId = skillContext?.primary?.id;
  if (!skillContext?.primary || !skillId) return {};

  const profile = getSkillAgentExecutionProfile(skillId);
  if (!profile) return {};

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-forked-skill-agent",
    nodeType: "reason",
    phase: "start",
    label: "技能执行代理",
    summary: `正在把 ${skillId} Skill 委托给隔离 Pi Agent 执行`,
    details: {
      skillId,
      engine: profile.engine,
      mode: profile.mode,
      allowedHarnessToolIds: profile.allowedHarnessToolIds,
      runtimeBindings: profile.runtimeBindings,
      workspaceRoot: state.workspaceRoot ?? null,
      approvalResume: isSkillAgentPendingToolCall(state.pendingToolCall),
    },
  });

  const createdAt = new Date().toISOString();
  if (!state.workspaceRoot) {
    const observation: AgentObservation = {
      id: crypto.randomUUID(),
      runId: state.runId,
      stepId: `skill_agent:${skillId}`,
      status: "failed",
      facts: ["Forked Skill Agent requires an active workspace."],
      errorMessage: "Workspace is not selected",
      summary: {
        source: "observation",
        status: "failed",
        actionTaken: `Tried to delegate ${skillId} to Pi Skill Agent`,
        keyFindings: ["Workspace is not selected"],
        gaps: ["Select a workspace before executing a workspace-bound Skill"],
        error: "Workspace is not selected",
        data: {
          kind: "generic_structured",
          preview: { skillId, engine: profile.engine },
          truncated: false,
          redacted: false,
          unsupported: false,
        },
      },
      createdAt,
    };
    return { pendingEvidenceObservation: observation };
  }

  const result = await runWenShuPiSkillAgentPilot({
    goal: state.question?.trim() || state.goal.text,
    skillContext,
    workspaceRoot: state.workspaceRoot,
    userId: state.userId,
    threadId: state.threadId,
    approvedInvocations: getReplayApprovedInvocations(state),
  });

  const facts = [
    `Skill Agent status: ${result.status}`,
    ...(result.summary ? [result.summary] : []),
    `Tool calls: ${result.trace?.toolCalls.join(", ") || "none"}`,
    `Artifacts: ${result.artifacts.length}`,
    ...(result.artifacts.length
      ? [`Artifact records: ${boundedJson(result.artifacts)}`]
      : []),
    ...(result.evidence.length
      ? [`Skill execution evidence: ${boundedJson(result.evidence)}`]
      : []),
    ...(result.requirements?.length
      ? [`Requirements: ${boundedJson(result.requirements)}`]
      : []),
    ...(result.missingEvidence?.length
      ? [`Missing evidence: ${boundedJson(result.missingEvidence)}`]
      : []),
  ];

  const observation: AgentObservation = {
    id: crypto.randomUUID(),
    runId: state.runId,
    stepId: `skill_agent:${skillId}`,
    status: toObservationStatus(result.status, result.recoverable),
    facts,
    ...(result.error ? { errorMessage: result.error } : {}),
    summary: {
      source: "observation",
      status:
        result.status === "completed"
          ? "completed"
          : result.status === "failed"
            ? "failed"
            : "partial",
      actionTaken: `Delegated ${skillId} Skill to Pi Agent Core`,
      keyFindings: facts.slice(0, 8),
      ...(result.missingEvidence?.length
        ? { gaps: result.missingEvidence.map((item) => String(item)) }
        : result.requirements?.length
          ? { gaps: result.requirements.map((item) => item.description) }
          : {}),
      ...(result.error ? { error: result.error } : {}),
      data: {
        kind: "generic_structured",
        preview: {
          skillId,
          engine: profile.engine,
          status: result.status,
          artifacts: result.artifacts,
          requirements: result.requirements ?? [],
          missingEvidence: result.missingEvidence ?? [],
          trace: result.trace ?? null,
        },
        truncated: false,
        redacted: false,
        unsupported: false,
      },
    },
    createdAt,
  };

  const approvalRequirement = findApprovalRequirement(result.requirements);
  const approvalPatch = approvalRequirement
    ? buildParentApprovalPatch({
        state,
        skillId,
        requirement: approvalRequirement,
        createdAt,
      })
    : isSkillAgentPendingToolCall(state.pendingToolCall)
      ? {
          pendingApproval: undefined,
          pendingToolCall: undefined,
          policyDecision: undefined,
        }
      : {};

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-forked-skill-agent",
    nodeType: "reason",
    phase: "done",
    label: "技能执行代理",
    summary: approvalRequirement
      ? `Pi Skill Agent 等待审批：${approvalRequirement.toolId}`
      : `Pi Skill Agent 已返回：${result.status}`,
    details: {
      skillId,
      status: result.status,
      artifactCount: result.artifacts.length,
      requirementCount: result.requirements?.length ?? 0,
      missingEvidenceCount: result.missingEvidence?.length ?? 0,
      toolCalls: result.trace?.toolCalls ?? [],
      approvalToolId: approvalRequirement?.toolId ?? null,
      approvalInputHash: approvalRequirement?.inputHash ?? null,
    },
  });

  return {
    pendingEvidenceObservation: observation,
    ...approvalPatch,
  };
};
