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
  SkillAgentCheckpoint,
  SkillAgentRequirement,
} from "@/skills/agent/types.js";

type SkillAwareTaskFrame = NonNullable<AgentNodeState["currentTaskFrame"]> & {
  skillContext?: SkillContext;
};

type SkillAgentPendingToolCall = {
  id: string;
  toolId: string;
  args: Record<string, unknown>;
  inputHash: string;
  source: "llm_tool_call";
  origin: "skill_agent";
  skillId: string;
  skillAgentCheckpoint: SkillAgentCheckpoint;
  createdAt: string;
};

const getSkillContext = (state: AgentNodeState) =>
  (state.currentTaskFrame as SkillAwareTaskFrame | undefined)?.skillContext;

const isSkillAgentPendingToolCall = (
  pendingToolCall: AgentToolCallRequest | undefined,
): pendingToolCall is AgentToolCallRequest & SkillAgentPendingToolCall =>
  Boolean(
    pendingToolCall &&
      "origin" in pendingToolCall &&
      pendingToolCall.origin === "skill_agent" &&
      "id" in pendingToolCall &&
      typeof pendingToolCall.id === "string" &&
      "skillAgentCheckpoint" in pendingToolCall,
  );

const getReplayApprovedInvocations = (
  state: AgentNodeState,
): SkillAgentApprovedInvocation[] => {
  const pendingToolCall = state.pendingToolCall;
  if (!isSkillAgentPendingToolCall(pendingToolCall)) return [];

  // Only the invocation currently frozen for this resume may cross back into
  // the fork. Older approvals from previous boundaries must never become
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

const getReplayCheckpoint = (
  state: AgentNodeState,
  skillId: string,
): SkillAgentCheckpoint | undefined => {
  const pendingToolCall = state.pendingToolCall;
  if (!pendingToolCall || !("origin" in pendingToolCall)) return undefined;
  if (pendingToolCall.origin !== "skill_agent") return undefined;
  if (!isSkillAgentPendingToolCall(pendingToolCall)) {
    throw new Error(
      "Frozen Skill approval is missing its Pi transcript checkpoint; refusing to restart the original goal.",
    );
  }
  if (pendingToolCall.skillId !== skillId) {
    throw new Error(
      `Frozen Skill approval belongs to ${pendingToolCall.skillId}, not active Skill ${skillId}.`,
    );
  }

  const checkpoint = pendingToolCall.skillAgentCheckpoint;
  const frozen = checkpoint.pendingInvocation;
  if (
    frozen.toolCallId !== pendingToolCall.id ||
    frozen.toolId !== pendingToolCall.toolId ||
    frozen.inputHash !== pendingToolCall.inputHash
  ) {
    throw new Error(
      "Frozen Skill approval does not match its Pi checkpoint invocation; resume was blocked.",
    );
  }
  return checkpoint;
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
      Boolean(requirement.toolCallId) &&
      Boolean(requirement.inputHash) &&
      Boolean(requirement.input),
  );

const buildParentApprovalPatch = (input: {
  state: AgentNodeState;
  skillId: string;
  requirement: SkillAgentRequirement;
  checkpoint: SkillAgentCheckpoint;
  createdAt: string;
}): Pick<AgentNodeState, "pendingApproval" | "pendingToolCall" | "policyDecision"> => {
  const toolId = input.requirement.toolId!;
  const toolCallId = input.requirement.toolCallId!;
  const args = structuredClone(input.requirement.input!);
  const inputHash = input.requirement.inputHash!;
  const frozen = input.checkpoint.pendingInvocation;
  if (
    frozen.toolId !== toolId ||
    frozen.toolCallId !== toolCallId ||
    frozen.inputHash !== inputHash
  ) {
    throw new Error(
      "Pi approval requirement does not match its serialized checkpoint invocation.",
    );
  }

  const skillPendingToolCall: SkillAgentPendingToolCall = {
    id: toolCallId,
    toolId,
    args,
    inputHash,
    source: "llm_tool_call",
    origin: "skill_agent",
    skillId: input.skillId,
    skillAgentCheckpoint: structuredClone(input.checkpoint),
    createdAt: input.createdAt,
  };
  const pendingToolCall = skillPendingToolCall as AgentToolCallRequest;
  const pendingApproval: AgentApprovalRequest = {
    id: crypto.randomUUID(),
    runId: input.state.runId,
    stepId: `skill_agent:${input.skillId}`,
    toolId,
    toolCallId,
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
  const skillContext = getSkillContext(state);
  const skillId = skillContext?.primary?.id;
  if (!skillContext?.primary || !skillId) return {};

  const profile = getSkillAgentExecutionProfile(skillId);
  if (!profile) return {};

  const checkpoint = getReplayCheckpoint(state, skillId);
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-forked-skill-agent",
    nodeType: "reason",
    phase: "start",
    label: "技能执行代理",
    summary: checkpoint
      ? `正在恢复 ${skillId} Skill 的已审批 Pi 执行上下文`
      : `正在把 ${skillId} Skill 委托给隔离 Pi Agent 执行`,
    details: {
      skillId,
      engine: profile.engine,
      mode: profile.mode,
      allowedHarnessToolIds: profile.allowedHarnessToolIds,
      runtimeBindings: profile.runtimeBindings,
      workspaceRoot: state.workspaceRoot ?? null,
      approvalResume: Boolean(checkpoint),
      resumeToolCallId: checkpoint?.pendingInvocation.toolCallId ?? null,
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
    checkpoint,
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
      actionTaken: checkpoint
        ? `Resumed ${skillId} Skill from its exact Pi approval checkpoint`
        : `Delegated ${skillId} Skill to Pi Agent Core`,
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
          resumedFromApproval: Boolean(checkpoint),
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
  if (approvalRequirement && !result.checkpoint) {
    throw new Error(
      "Pi Skill Agent requested approval without a resumable transcript checkpoint.",
    );
  }
  const approvalPatch = approvalRequirement
    ? buildParentApprovalPatch({
        state,
        skillId,
        requirement: approvalRequirement,
        checkpoint: result.checkpoint!,
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
      resumedFromApproval: Boolean(checkpoint),
      artifactCount: result.artifacts.length,
      requirementCount: result.requirements?.length ?? 0,
      missingEvidenceCount: result.missingEvidence?.length ?? 0,
      toolCalls: result.trace?.toolCalls ?? [],
      approvalToolId: approvalRequirement?.toolId ?? null,
      approvalToolCallId: approvalRequirement?.toolCallId ?? null,
      approvalInputHash: approvalRequirement?.inputHash ?? null,
    },
  });

  return {
    pendingEvidenceObservation: observation,
    ...approvalPatch,
  };
};
