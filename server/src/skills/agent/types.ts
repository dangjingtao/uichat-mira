import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SkillContext } from "@/skills/context/types.js";

export type SkillAgentExecutionStatus =
  | "completed"
  | "insufficient_evidence"
  | "needs_input"
  | "failed";

export type SkillAgentRuntimeBinding = {
  id: string;
  kind: "skill-private-runtime";
  status: "ready" | "pending";
  description: string;
};

export type SkillAgentExecutionProfile = {
  skillId: string;
  mode: "forked-agent";
  engine: "pi-agent-core";
  allowedHarnessToolIds: string[];
  runtimeBindings: SkillAgentRuntimeBinding[];
  workspaceBound: boolean;
};

export type SkillAgentRequirement = {
  id: string;
  kind: "user_input" | "evidence" | "resource" | "capability" | "approval";
  description: string;
  requiredFor: string;
  toolId?: string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  inputHash?: string;
};

export type SkillAgentPendingInvocation = {
  toolCallId: string;
  toolId: string;
  input: Record<string, unknown>;
  inputHash: string;
};

/**
 * Serializable pi-agent-core transcript checkpoint captured at a governed
 * approval boundary. Product/runtime code refers to the owner as subAgent;
 * the engine-specific message type remains an implementation detail here.
 */
export type SkillAgentCheckpoint = {
  version: 1;
  messages: AgentMessage[];
  pendingInvocation: SkillAgentPendingInvocation;
  evidence: unknown[];
  artifacts: unknown[];
  toolCalls: string[];
};

export type SkillAgentExecutionResult = {
  status: SkillAgentExecutionStatus;
  summary?: string;
  evidence: unknown[];
  artifacts: unknown[];
  missingEvidence?: unknown[];
  requirements?: SkillAgentRequirement[];
  checkpoint?: SkillAgentCheckpoint;
  recoverable?: boolean;
  error?: string;
  trace?: {
    engine: "pi-agent-core";
    skillId: string;
    toolCalls: string[];
  };
};

export type SkillAgentApprovedInvocation = {
  toolId: string;
  inputHash: string;
  input?: Record<string, unknown>;
};

export type SkillAgentExecutionInput = {
  goal: string;
  skillContext: SkillContext;
  workspaceRoot?: string;
  userId?: number;
  threadId?: string;
  turnId?: string;
  approvedInvocations?: SkillAgentApprovedInvocation[];
  checkpoint?: SkillAgentCheckpoint;
};

export type SkillAgentToolBinding = {
  id: string;
  label: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<{
    result?: unknown;
    evidence?: unknown;
    artifacts?: unknown[];
    terminate?: boolean;
    requirement?: SkillAgentRequirement;
  }>;
};

// Public product/architecture aliases. Existing SkillAgent* imports remain
// temporarily valid so the migration does not turn into a broad rename patch.
export type SubAgentExecutionStatus = SkillAgentExecutionStatus;
export type SubAgentRuntimeBinding = SkillAgentRuntimeBinding;
export type SubAgentExecutionProfile = SkillAgentExecutionProfile;
export type SubAgentRequirement = SkillAgentRequirement;
export type SubAgentPendingInvocation = SkillAgentPendingInvocation;
export type SubAgentCheckpoint = SkillAgentCheckpoint;
export type SubAgentExecutionResult = SkillAgentExecutionResult;
export type SubAgentApprovedInvocation = SkillAgentApprovedInvocation;
export type SubAgentExecutionInput = SkillAgentExecutionInput;
export type SubAgentToolBinding = SkillAgentToolBinding;
